"use client";

import { useState, useRef, useEffect } from "react";
import { X, Lock, Send } from "lucide-react";
import { useChatContext } from "@/context/chat-context";
import { formatTime, cn } from "@/lib/utils";

interface PMPanelProps {
  onClose: () => void;
}

export function PMPanel({ onClose }: PMPanelProps) {
  const { state, dispatch, sendEncrypted } = useChatContext();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const target = state.pmTarget;
  const nick = state.pmNick;
  const history = (target && state.pmHistory[target]) || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history.length]);

  const handleSend = () => {
    if (!text.trim() || !target) return;
    sendEncrypted({
      type: "chat",
      id: Date.now().toString(36),
      nick: state.myNick,
      text: text.trim(),
      privateTo: target,
      ts: Date.now(),
    });
    dispatch({
      type: "ADD_PM",
      target,
      message: {
        me: true,
        nick: state.myNick,
        text: text.trim(),
        ts: Date.now(),
      },
    });
    setText("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex h-[60vh] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-purple" />
            <h3 className="text-sm font-semibold text-foreground">
              私聊 {nick}
            </h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {history.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              加密私信 -- 仅双方可见
            </p>
          )}
          {history.map((msg, i) => (
            <div
              key={i}
              className={cn("flex", msg.me ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3.5 py-2",
                  msg.me
                    ? "rounded-tr-md bg-purple/15 ring-1 ring-purple/20"
                    : "rounded-tl-md bg-card ring-1 ring-border"
                )}
              >
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {msg.text}
                </p>
                <p className="mt-0.5 text-right text-[10px] text-muted-foreground">
                  {formatTime(msg.ts)}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 border-t border-border px-4 py-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
            placeholder="加密私信..."
            autoFocus
            className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-purple focus:outline-none focus:ring-1 focus:ring-purple transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple text-white transition-colors hover:bg-purple/90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
