"use client";

import {
  X,
  Flame,
  Eye,
  EyeOff,
  Shield,
  Bell,
  BellOff,
  Copy,
  Trash2,
  Lock,
  LockOpen,
  LogOut,
} from "lucide-react";
import { useChatContext } from "@/context/chat-context";
import { clearAllMsgs } from "@/lib/db";
import { cn } from "@/lib/utils";
import { AUTO_DELETE_OPTIONS } from "@/lib/constants";

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { state, dispatch, sendEncrypted, sysMsg, exitRoom } = useChatContext();

  const handleClearAll = async () => {
    sendEncrypted({ type: "remote_clear", nick: state.myNick });
    await clearAllMsgs();
    dispatch({ type: "CLEAR_MESSAGES" });
    sysMsg("聊天记录已清除");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-t-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">设置</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-4 py-3 space-y-4">
          {/* Auto-delete */}
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <Flame className="h-4 w-4 text-orange" />
              阅后即焚
            </div>
            <div className="flex flex-wrap gap-2">
              {AUTO_DELETE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => dispatch({ type: "SET_AUTO_DELETE", value: opt.value })}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    state.autoDelete === opt.value
                      ? "border-orange bg-orange/10 text-orange"
                      : "border-border text-muted-foreground hover:bg-secondary"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Once-read */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              {state.onceReadMode ? <Eye className="h-4 w-4 text-purple" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              一次性消息
            </div>
            <button
              onClick={() => dispatch({ type: "SET_ONCE_READ", value: !state.onceReadMode })}
              className={cn(
                "h-6 w-11 rounded-full p-0.5 transition-colors",
                state.onceReadMode ? "bg-purple" : "bg-secondary"
              )}
            >
              <div className={cn(
                "h-5 w-5 rounded-full bg-white transition-transform",
                state.onceReadMode ? "translate-x-5" : "translate-x-0"
              )} />
            </button>
          </div>

          {/* No copy */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Shield className="h-4 w-4 text-primary" />
              禁止复制
            </div>
            <button
              onClick={() => dispatch({ type: "SET_NO_COPY", value: !state.noCopy })}
              className={cn(
                "h-6 w-11 rounded-full p-0.5 transition-colors",
                state.noCopy ? "bg-primary" : "bg-secondary"
              )}
            >
              <div className={cn(
                "h-5 w-5 rounded-full bg-white transition-transform",
                state.noCopy ? "translate-x-5" : "translate-x-0"
              )} />
            </button>
          </div>

          {/* Privacy lock */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              {state.privacyLockEnabled ? <Lock className="h-4 w-4 text-primary" /> : <LockOpen className="h-4 w-4 text-muted-foreground" />}
              隐私锁定
            </div>
            <button
              onClick={() => dispatch({ type: "SET_PRIVACY_LOCK_ENABLED", enabled: !state.privacyLockEnabled })}
              className={cn(
                "h-6 w-11 rounded-full p-0.5 transition-colors",
                state.privacyLockEnabled ? "bg-primary" : "bg-secondary"
              )}
            >
              <div className={cn(
                "h-5 w-5 rounded-full bg-white transition-transform",
                state.privacyLockEnabled ? "translate-x-5" : "translate-x-0"
              )} />
            </button>
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              {state.notificationsOn ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
              消息通知
            </div>
            <button
              onClick={() => {
                if (!state.notificationsOn && "Notification" in window) {
                  Notification.requestPermission();
                }
                dispatch({ type: "SET_NOTIFICATIONS", on: !state.notificationsOn });
              }}
              className={cn(
                "h-6 w-11 rounded-full p-0.5 transition-colors",
                state.notificationsOn ? "bg-primary" : "bg-secondary"
              )}
            >
              <div className={cn(
                "h-5 w-5 rounded-full bg-white transition-transform",
                state.notificationsOn ? "translate-x-5" : "translate-x-0"
              )} />
            </button>
          </div>

          {/* Auto clear on exit */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Trash2 className="h-4 w-4 text-destructive" />
              退出清除记录
            </div>
            <button
              onClick={() => dispatch({ type: "SET_AUTO_CLEAR", on: !state.autoClearOnExit })}
              className={cn(
                "h-6 w-11 rounded-full p-0.5 transition-colors",
                state.autoClearOnExit ? "bg-destructive" : "bg-secondary"
              )}
            >
              <div className={cn(
                "h-5 w-5 rounded-full bg-white transition-transform",
                state.autoClearOnExit ? "translate-x-5" : "translate-x-0"
              )} />
            </button>
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(state.roomKey);
                sysMsg("密钥已复制");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <Copy className="h-4 w-4" />
              复制房间密钥
            </button>
            <button
              onClick={handleClearAll}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
              双方清空记录
            </button>
            <button
              onClick={() => { onClose(); exitRoom(); }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-destructive/10 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
            >
              <LogOut className="h-4 w-4" />
              退出房间
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
