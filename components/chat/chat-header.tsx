"use client";

import { Lock, Search, QrCode, Settings, Users, X, Signal, SignalLow, SignalZero } from "lucide-react";
import { useChatContext } from "@/context/chat-context";
import { cn } from "@/lib/utils";

export function ChatHeader() {
  const { state, dispatch, exitRoom } = useChatContext();
  const memberCount = Object.keys(state.members).length + 1;

  const headerSub = state.typingUser
    ? `${state.typingUser} 正在输入...`
    : state.connected
    ? "已加密"
    : "重连中...";

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
      {/* Room info */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Lock className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate font-mono text-sm font-semibold text-foreground">
            {state.roomHash.slice(0, 6)}
          </h2>
          <p
            className={cn(
              "truncate text-[10px]",
              state.typingUser
                ? "text-primary"
                : state.connected
                ? "text-primary/70"
                : "text-destructive"
            )}
          >
            {state.typingUser && (
              <span className="mr-1 inline-flex gap-0.5">
                <span className="inline-block h-1 w-1 rounded-full bg-primary" style={{ animation: "typing-dot 1.2s infinite 0s" }} />
                <span className="inline-block h-1 w-1 rounded-full bg-primary" style={{ animation: "typing-dot 1.2s infinite 0.2s" }} />
                <span className="inline-block h-1 w-1 rounded-full bg-primary" style={{ animation: "typing-dot 1.2s infinite 0.4s" }} />
              </span>
            )}
            {headerSub}
          </p>
        </div>
      </div>

      {/* Connection indicator */}
      <div className="flex items-center">
        {state.connected ? (
          <Signal className="h-3.5 w-3.5 text-primary" />
        ) : (
          <SignalZero className="h-3.5 w-3.5 text-destructive" />
        )}
      </div>

      {/* Action buttons */}
      <button
        onClick={() => dispatch({ type: "SET_ACTIVE_PANEL", panel: "search" })}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Search className="h-4 w-4" />
      </button>
      <button
        onClick={() => dispatch({ type: "SET_ACTIVE_PANEL", panel: "qr" })}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <QrCode className="h-4 w-4" />
      </button>
      <button
        onClick={() => dispatch({ type: "SET_ACTIVE_PANEL", panel: "settings" })}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Settings className="h-4 w-4" />
      </button>
      <button
        onClick={() => dispatch({ type: "SET_ACTIVE_PANEL", panel: "members" })}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Users className="h-4 w-4" />
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
          {memberCount}
        </span>
      </button>
      <button
        onClick={exitRoom}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-destructive transition-colors hover:bg-destructive/10"
      >
        <X className="h-4 w-4" />
      </button>
    </header>
  );
}
