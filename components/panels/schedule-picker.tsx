"use client";

import { X, Clock } from "lucide-react";
import { useChatContext } from "@/context/chat-context";
import { SCHEDULE_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface SchedulePickerProps {
  onClose: () => void;
}

export function SchedulePicker({ onClose }: SchedulePickerProps) {
  const { state, dispatch, sysMsg } = useChatContext();

  const handlePick = (mins: number) => {
    dispatch({ type: "SET_SCHEDULE", value: mins });
    sysMsg(`定时发送已设置：${mins >= 60 ? mins / 60 + "小时后" : mins + "分钟后"}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mx-4 w-full max-w-xs rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-ai" />
            <h3 className="text-sm font-semibold text-foreground">定时发送</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          {SCHEDULE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handlePick(opt.value)}
              className={cn(
                "flex w-full items-center justify-center rounded-xl border border-border py-2.5 text-sm font-medium transition-colors hover:border-ai hover:bg-ai/5 hover:text-ai",
                state.schedMins === opt.value
                  ? "border-ai bg-ai/10 text-ai"
                  : "text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {state.schedMins > 0 && (
          <button
            onClick={() => {
              dispatch({ type: "SET_SCHEDULE", value: 0 });
              onClose();
            }}
            className="mt-3 w-full rounded-xl border border-destructive/30 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            取消定时
          </button>
        )}
      </div>
    </div>
  );
}
