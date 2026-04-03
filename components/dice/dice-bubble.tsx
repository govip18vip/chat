"use client";

import { useState, useRef, useCallback } from "react";
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6 } from "lucide-react";
import { useChatContext } from "@/context/chat-context";
import { cn } from "@/lib/utils";

const DICE_ICONS = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];

function getDiceComment(val: number): string {
  if (val === 6) return "MAX!";
  if (val === 1) return "最小...";
  if (val >= 4) return "不错!";
  return "";
}

interface DiceBubbleProps {
  value: number;
  msgId: string;
  isMe: boolean;
  nick: string;
}

export function DiceBubble({ value, msgId, isMe, nick }: DiceBubbleProps) {
  const { sysMsg } = useChatContext();
  const [revealed, setRevealed] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout>>();
  const DiceIcon = DICE_ICONS[value - 1] || Dice1;

  const handleReveal = useCallback(() => {
    if (revealed) return;
    setRevealed(true);
    const comment = getDiceComment(value);
    const displayNick = isMe ? "你" : nick;
    sysMsg(`${displayNick} 掷出了 ${value} 点！${comment}`);
    if (navigator.vibrate) navigator.vibrate([25, 15, 55]);
  }, [revealed, value, isMe, nick, sysMsg]);

  const handleLongPressStart = useCallback(() => {
    longPressRef.current = setTimeout(handleReveal, 420);
  }, [handleReveal]);

  const handleLongPressEnd = useCallback(() => {
    clearTimeout(longPressRef.current);
  }, []);

  return (
    <div className="flex flex-col items-center gap-2 py-1">
      <p className="text-xs text-muted-foreground">
        {isMe ? "你" : nick} 掷了骰子
      </p>
      <div
        className="relative cursor-pointer select-none"
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
        onTouchMove={handleLongPressEnd}
        onMouseDown={handleLongPressStart}
        onMouseUp={handleLongPressEnd}
        onMouseLeave={handleLongPressEnd}
        style={{ perspective: "400px" }}
      >
        <div
          className={cn(
            "relative h-20 w-20 transition-transform duration-500",
            revealed && "animate-none"
          )}
          style={{
            transformStyle: "preserve-3d",
            transform: revealed ? "rotateY(180deg)" : "rotateY(0deg)",
            transition: "transform 0.6s ease",
          }}
        >
          {/* Front face - question mark */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-orange/10 ring-1 ring-orange/30"
            style={{ backfaceVisibility: "hidden" }}
          >
            <Dice5 className="h-8 w-8 text-orange" />
            <span className="mt-1 text-[10px] text-orange/70">长按揭晓</span>
          </div>

          {/* Back face - result */}
          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center rounded-2xl ring-1",
              value === 6
                ? "bg-orange/20 ring-orange/40"
                : value === 1
                ? "bg-secondary ring-border"
                : "bg-primary/10 ring-primary/30"
            )}
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <DiceIcon
              className={cn(
                "h-10 w-10",
                value === 6
                  ? "text-orange"
                  : value === 1
                  ? "text-muted-foreground"
                  : "text-primary"
              )}
            />
            <span
              className={cn(
                "mt-1 text-sm font-bold",
                value === 6
                  ? "text-orange"
                  : value === 1
                  ? "text-muted-foreground"
                  : "text-primary"
              )}
            >
              {value} 点
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
