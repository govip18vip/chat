"use client";

import { X, Mic, Flower2, Guitar, Bot, Ghost, Mountain } from "lucide-react";
import { useChatContext } from "@/context/chat-context";
import { VOICE_EFFECTS, type VoiceEffectKey } from "@/lib/constants";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Mic,
  Flower2,
  Guitar,
  Bot,
  Ghost,
  Mountain,
};

interface VoiceEffectPickerProps {
  onClose: () => void;
}

export function VoiceEffectPicker({ onClose }: VoiceEffectPickerProps) {
  const { state, dispatch, sysMsg } = useChatContext();

  const handleSelect = (key: VoiceEffectKey) => {
    dispatch({ type: "SET_EFFECT", value: key });
    sysMsg(`变声效果：${VOICE_EFFECTS[key].name}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mx-4 w-full max-w-xs rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-purple" />
            <h3 className="text-sm font-semibold text-foreground">变声效果</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(VOICE_EFFECTS) as [VoiceEffectKey, typeof VOICE_EFFECTS[VoiceEffectKey]][]).map(([key, effect]) => {
            const Icon = ICON_MAP[effect.icon] || Mic;
            return (
              <button
                key={key}
                onClick={() => handleSelect(key)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors",
                  state.currentEffect === key
                    ? "border-purple bg-purple/10"
                    : "border-border hover:bg-secondary"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    state.currentEffect === key ? "text-purple" : "text-foreground"
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    state.currentEffect === key ? "text-purple" : "text-muted-foreground"
                  )}
                >
                  {effect.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
