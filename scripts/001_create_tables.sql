-- Create profiles table for user data
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  avatar_url text,
  status text default 'online',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create friendships table for friend relationships
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending', -- pending, accepted, blocked
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, friend_id)
);

-- Create chat_rooms table for private/group chats
create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  name text,
  is_group boolean default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create room_participants table
create table if not exists public.room_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(room_id, user_id)
);

-- Create messages table for chat history
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  message_type text default 'text', -- text, image, file, system
  encrypted boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for better query performance
create index if not exists idx_friendships_user_id on public.friendships(user_id);
create index if not exists idx_friendships_friend_id on public.friendships(friend_id);
create index if not exists idx_messages_room_id on public.messages(room_id);
create index if not exists idx_messages_created_at on public.messages(created_at desc);
create index if not exists idx_room_participants_user_id on public.room_participants(user_id);
create index if not exists idx_room_participants_room_id on public.room_participants(room_id);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.room_participants enable row level security;
alter table public.messages enable row level security;

-- Profiles policies
create policy "profiles_select_public" on public.profiles for select using (true);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = id);

-- Friendships policies
create policy "friendships_select_own" on public.friendships for select using (auth.uid() = user_id or auth.uid() = friend_id);
create policy "friendships_insert_own" on public.friendships for insert with check (auth.uid() = user_id);
create policy "friendships_update_own" on public.friendships for update using (auth.uid() = user_id or auth.uid() = friend_id);
create policy "friendships_delete_own" on public.friendships for delete using (auth.uid() = user_id);

-- Chat rooms policies
create policy "chat_rooms_select_participant" on public.chat_rooms for select using (
  exists (select 1 from public.room_participants where room_id = id and user_id = auth.uid())
);
create policy "chat_rooms_insert_auth" on public.chat_rooms for insert with check (auth.uid() = created_by);
create policy "chat_rooms_delete_creator" on public.chat_rooms for delete using (auth.uid() = created_by);

-- Room participants policies
create policy "room_participants_select_own" on public.room_participants for select using (
  auth.uid() = user_id or exists (
    select 1 from public.room_participants rp where rp.room_id = room_id and rp.user_id = auth.uid()
  )
);
create policy "room_participants_insert_own" on public.room_participants for insert with check (auth.uid() = user_id);
create policy "room_participants_delete_own" on public.room_participants for delete using (auth.uid() = user_id);

-- Messages policies
create policy "messages_select_participant" on public.messages for select using (
  exists (select 1 from public.room_participants where room_id = messages.room_id and user_id = auth.uid())
);
create policy "messages_insert_participant" on public.messages for insert with check (
  auth.uid() = sender_id and exists (
    select 1 from public.room_participants where room_id = messages.room_id and user_id = auth.uid()
  )
);

-- Function to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nickname', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Create trigger for new user signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Function to get or create private chat room between two users
create or replace function public.get_or_create_private_room(other_user_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  room_uuid uuid;
begin
  -- Find existing private room between these two users
  select cr.id into room_uuid
  from public.chat_rooms cr
  where cr.is_group = false
    and exists (select 1 from public.room_participants where room_id = cr.id and user_id = auth.uid())
    and exists (select 1 from public.room_participants where room_id = cr.id and user_id = other_user_id)
    and (select count(*) from public.room_participants where room_id = cr.id) = 2
  limit 1;

  -- If no room exists, create one
  if room_uuid is null then
    insert into public.chat_rooms (is_group, created_by)
    values (false, auth.uid())
    returning id into room_uuid;

    insert into public.room_participants (room_id, user_id) values (room_uuid, auth.uid());
    insert into public.room_participants (room_id, user_id) values (room_uuid, other_user_id);
  end if;

  return room_uuid;
end;
$$;
