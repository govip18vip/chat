"use client";

import { useRef, useEffect } from "react";
import { Shield } from "lucide-react";
import { useChatContext, type ChatMessage, type SystemMessage } from "@/context/chat-context";
import { MessageBubble } from "./message-bubble";
import { cn } from "@/lib/utils";

export function MessageList() {
  const { state } = useChatContext();
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages.length]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex-1 overflow-y-auto py-3",
        state.noCopy && "no-copy"
      )}
    >
      {/* System initial message */}
      <div className="flex items-center justify-center gap-2 px-4 py-3">
        <Shield className="h-3.5 w-3.5 text-primary/50" />
        <p className="text-center text-xs text-muted-foreground">
          AES-256 端对端加密 -- 输入{" "}
          <span className="font-mono font-semibold text-ai">@ai</span>{" "}
          使用AI助手
        </p>
      </div>

      {state.messages.map((msg) => {
        if (msg.type === "system") {
          const sysMsg = msg as SystemMessage;
          return (
            <div key={sysMsg.id} className="flex justify-center px-4 py-1.5">
              <span className="rounded-full bg-secondary/50 px-3 py-1 text-[11px] text-muted-foreground">
                {sysMsg.text}
              </span>
            </div>
          );
        }
        return (
          <MessageBubble key={msg.id} message={msg as ChatMessage} />
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
