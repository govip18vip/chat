"use client";

import { X, User, MessageSquare, Crown } from "lucide-react";
import { useChatContext } from "@/context/chat-context";
import { cn } from "@/lib/utils";

interface MembersPanelProps {
  onClose: () => void;
}

export function MembersPanel({ onClose }: MembersPanelProps) {
  const { state, dispatch } = useChatContext();
  const members = [
    { id: "__self__", nick: state.myNick, isMe: true },
    ...Object.entries(state.members).map(([id, nick]) => ({
      id,
      nick,
      isMe: false,
    })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-t-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">
            在线成员 ({members.length})
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-4 py-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-secondary"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {m.nick}
                  {m.isMe && (
                    <span className="ml-1.5 text-[10px] text-primary">(我)</span>
                  )}
                </p>
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="text-[10px] text-muted-foreground">在线</span>
                </div>
              </div>
              {!m.isMe && (
                <button
                  onClick={() => {
                    dispatch({ type: "SET_PM", target: m.id, nick: m.nick });
                    dispatch({ type: "SET_ACTIVE_PANEL", panel: "pm" });
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                >
                  <MessageSquare className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
