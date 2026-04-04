"use client";

import { useState, useRef, useCallback } from "react";
import {
  Mic,
  Keyboard,
  Smile,
  Plus,
  Send,
  X,
  Bot,
  Image as ImageIcon,
  Video,
  Paperclip,
  Phone,
  VideoIcon,
  Clock,
  Flame,
  Sparkles,
  Dice5,
  Square,
} from "lucide-react";
import { useChatContext } from "@/context/chat-context";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { cn, formatSize } from "@/lib/utils";
import { EMOJI_CATEGORIES, type VoiceEffectKey } from "@/lib/constants";

export function MessageInput() {
  const { state, dispatch, sendMessage, sendDice, sendEncrypted, callAI, sysMsg } = useChatContext();
  const [text, setText] = useState("");
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [activeEmojiTab, setActiveEmojiTab] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isTypingRef = useRef(false);

  const { recording, duration, startRecording, stopRecording, cancelRecording } = useVoiceRecorder({
    maxDuration: 60,
    onComplete: (file) => {
      dispatch({ type: "SET_PENDING_FILE", file });
      sysMsg(`语音已录制 ${file.durationHint}秒`);
    },
  });

  const isAIMode = /^@ai\s/i.test(text);
  const canSend = text.trim().length > 0 || state.pendingFile !== null;

  const handleTextChange = (value: string) => {
    setText(value);
    // Send typing indicator
    if (state.connected) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        sendEncrypted({ type: "typing", active: true });
      }
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        isTypingRef.current = false;
        sendEncrypted({ type: "typing", active: false });
      }, 2000);
    }
  };

  const handleSend = useCallback(async () => {
    if (!canSend && !isAIMode) return;

    if (isAIMode) {
      const query = text.replace(/^@ai\s*/i, "").trim();
      setText("");
      if (!query) return;
      // Add AI loading message
      sysMsg(`AI 正在思考: "${query.slice(0, 40)}${query.length > 40 ? "..." : ""}"`);
      try {
        const result = await callAI(query);
        dispatch({
          type: "ADD_MESSAGE",
          message: {
            id: "ai-" + Date.now(),
            type: "chat",
            nick: "AI 助手",
            text: result,
            ts: Date.now(),
            isMe: false,
          },
        });
      } catch {
        sysMsg("AI 请求失败，请检查网络");
      }
      return;
    }

    if (state.schedMins > 0) {
      const mins = state.schedMins;
      const msg = text;
      dispatch({ type: "SET_SCHEDULE", value: 0 });
      setText("");
      sysMsg(`${mins} 分钟后发送`);
      setTimeout(() => {
        sendMessage(msg);
      }, mins * 60 * 1000);
      return;
    }

    sendMessage(text);
    setText("");
  }, [text, canSend, isAIMode, state.schedMins, sendMessage, callAI, dispatch, sysMsg]);

  const handleFileSelect = (accept: string) => {
    dispatch({ type: "CLOSE_PANELS" });
    if (fileRef.current) {
      fileRef.current.accept = accept;
      fileRef.current.onchange = async (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        target.value = "";
        if (!file) return;
        if (file.size > 15 * 1024 * 1024) {
          sysMsg("文件超过15MB限制");
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          dispatch({
            type: "SET_PENDING_FILE",
            file: {
              name: file.name,
              type: file.type,
              size: file.size,
              data: reader.result as string,
            },
          });
        };
        reader.readAsDataURL(file);
      };
      fileRef.current.click();
    }
  };

  const handleVoiceStart = () => {
    if (recording) {
      stopRecording();
    } else {
      startRecording(state.currentEffect as VoiceEffectKey);
    }
  };

  const emojiKeys = Object.keys(EMOJI_CATEGORIES);

  return (
    <div className="shrink-0 border-t border-border bg-card">
      {/* Offline bar */}
      {!state.connected && state.screen === "chat" && (
        <div className="flex items-center justify-center gap-2 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          重连中...
        </div>
      )}

      {/* Auto-delete bar */}
      {state.autoDelete > 0 && (
        <div className="flex items-center justify-center gap-1.5 bg-orange/10 px-3 py-1 text-[11px] text-orange">
          <Flame className="h-3 w-3" />
          阅后即焚：
          {state.autoDelete < 60
            ? state.autoDelete + "秒"
            : state.autoDelete / 60 + "分钟"}
        </div>
      )}

      {/* Reply bar */}
      {state.replyTo && (
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-primary">
              回复 {state.replyTo.nick}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {state.replyTo.text || "[媒体]"}
            </p>
          </div>
          <button
            onClick={() => dispatch({ type: "SET_REPLY", reply: null })}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Pending file preview */}
      {state.pendingFile && (
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          {state.pendingFile.isVoice ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Mic className="h-5 w-5 text-primary" />
            </div>
          ) : state.pendingFile.type.startsWith("image/") ? (
            <img
              src={state.pendingFile.data}
              alt="preview"
              className="h-10 w-10 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-lg">
              {"📎"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">
              {state.pendingFile.isVoice 
                ? `语音消息 ${state.pendingFile.durationHint || 0}秒` 
                : state.pendingFile.name}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {formatSize(state.pendingFile.size)}
              {state.pendingFile.effect && state.pendingFile.effect !== "none" && (
                <span className="ml-1 text-purple">+ 变声</span>
              )}
            </p>
          </div>
          <button
            onClick={() => dispatch({ type: "SET_PENDING_FILE", file: null })}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Schedule bar */}
      {state.schedMins > 0 && (
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-[11px] text-ai">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            定时：
            {state.schedMins >= 60
              ? state.schedMins / 60 + "小时后"
              : state.schedMins + "分钟后"}
          </span>
          <button
            onClick={() => dispatch({ type: "SET_SCHEDULE", value: 0 })}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Recording bar */}
      {recording && (
        <div className="flex items-center justify-between bg-destructive/10 px-3 py-2">
          <div className="flex items-center gap-2">
            <div 
              className="h-3 w-3 rounded-full bg-destructive"
              style={{ animation: "rec-pulse 1s infinite" }}
            />
            <span className="text-sm text-destructive font-medium">
              录音中 {duration}s
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={cancelRecording}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              取消
            </button>
            <button
              onClick={stopRecording}
              className="flex items-center gap-1 rounded-lg bg-destructive px-3 py-1 text-xs text-white"
            >
              <Square className="h-3 w-3" />
              完成
            </button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-center gap-1.5 px-2 py-2">
        <button
          onClick={() => {
            if (isVoiceMode && !recording) {
              handleVoiceStart();
            }
            setIsVoiceMode(!isVoiceMode);
          }}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
            recording 
              ? "bg-destructive/10 text-destructive"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          {isVoiceMode ? (
            <Keyboard className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </button>

        <div
          className={cn(
            "relative flex-1 rounded-xl border transition-colors",
            isAIMode
              ? "border-ai/40 bg-ai/5"
              : "border-border bg-background"
          )}
        >
          {isVoiceMode ? (
            <button 
              onClick={handleVoiceStart}
              disabled={recording}
              className={cn(
                "flex h-10 w-full items-center justify-center text-sm transition-colors",
                recording 
                  ? "text-destructive" 
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-xl"
              )}
            >
              {recording ? `松开发送 (${duration}s)` : "按住 说话"}
            </button>
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="加密消息... (@ai 问AI)"
              autoComplete="off"
              className="h-10 w-full bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          )}
          {isAIMode && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Bot className="h-4 w-4 text-ai" />
            </div>
          )}
        </div>

        <button
          onClick={() => dispatch({ type: "TOGGLE_EMOJI" })}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Smile className="h-5 w-5" />
        </button>
        <button
          onClick={() => dispatch({ type: "TOGGLE_ATTACH" })}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Plus className="h-5 w-5" />
        </button>
        <button
          onClick={handleSend}
          disabled={!canSend && !isAIMode}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all",
            canSend || isAIMode
              ? isAIMode
                ? "bg-ai text-white"
                : "bg-primary text-primary-foreground"
              : "text-muted-foreground/40"
          )}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      {/* Emoji panel */}
      {state.showEmoji && (
        <div className="border-t border-border bg-card px-2 py-3">
          <div className="mb-2 flex gap-1">
            {emojiKeys.map((cat, i) => (
              <button
                key={cat}
                onClick={() => setActiveEmojiTab(i)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-lg transition-colors",
                  activeEmojiTab === i ? "bg-primary/10" : "hover:bg-secondary"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-8 gap-1">
            {EMOJI_CATEGORIES[emojiKeys[activeEmojiTab]].map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  setText((prev) => prev + emoji);
                  inputRef.current?.focus();
                }}
                className="flex h-9 items-center justify-center rounded-lg text-xl transition-transform hover:scale-110 hover:bg-secondary"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Attachment panel */}
      {state.showAttach && (
        <div className="grid grid-cols-5 gap-3 border-t border-border bg-card px-4 py-4">
          {[
            { icon: ImageIcon, label: "照片", color: "bg-primary/10 text-primary", action: () => handleFileSelect("image/*") },
            { icon: Video, label: "视频", color: "bg-ai/10 text-ai", action: () => handleFileSelect("video/*") },
            { icon: Paperclip, label: "文件", color: "bg-orange/10 text-orange", action: () => handleFileSelect("*/*") },
            { icon: Phone, label: "群语音", color: "bg-primary/10 text-primary", action: () => sysMsg("请部署WebSocket服务器后使用通话功能") },
            { icon: VideoIcon, label: "群视频", color: "bg-purple/10 text-purple", action: () => sysMsg("请部署WebSocket服务器后使用通话功能") },
            { icon: Clock, label: "定时", color: "bg-ai/10 text-ai", action: () => dispatch({ type: "SET_ACTIVE_PANEL", panel: "schedule" }) },
            { icon: Flame, label: "阅后即焚", color: "bg-destructive/10 text-destructive", action: () => dispatch({ type: "SET_ACTIVE_PANEL", panel: "settings" }) },
            { icon: Sparkles, label: "变声", color: "bg-purple/10 text-purple", action: () => dispatch({ type: "SET_ACTIVE_PANEL", panel: "voice-effect" }) },
            { icon: Bot, label: "AI助手", color: "bg-ai/10 text-ai", action: () => dispatch({ type: "SET_ACTIVE_PANEL", panel: "ai" }) },
            { icon: Dice5, label: "骰子", color: "bg-orange/10 text-orange", action: () => { sendDice(); dispatch({ type: "CLOSE_PANELS" }); } },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="flex flex-col items-center gap-1.5"
            >
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-2xl transition-transform active:scale-95",
                  item.color
                )}
              >
                <item.icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] text-muted-foreground">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      )}

      <input ref={fileRef} type="file" className="hidden" />
    </div>
  );
}
