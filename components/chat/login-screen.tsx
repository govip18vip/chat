"use client";

import { useState, useEffect, useCallback } from "react";
import { Lock, Eye, EyeOff, Zap, Copy, Link, QrCode, Shield, MessageSquare, Bot, Dice5, Mic } from "lucide-react";
import { useChatContext } from "@/context/chat-context";
import {
  generateRandomKey,
  checkPasswordStrength,
  buildShareLink,
  getKeyFromHash,
} from "@/lib/crypto";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";

const STRENGTH_COLORS = ["bg-border", "bg-destructive", "bg-orange", "bg-primary"];
const STRENGTH_WIDTHS = ["w-0", "w-1/3", "w-2/3", "w-full"];

export function LoginScreen() {
  const { joinRoom, state } = useChatContext();
  const [nick, setNick] = useState("");
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [strength, setStrength] = useState(0);
  const [showShare, setShowShare] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const hashKey = getKeyFromHash();
    if (hashKey) {
      setKey(hashKey);
      setShowKey(true);
      setStrength(checkPasswordStrength(hashKey));
    }
  }, []);

  const handleKeyChange = (value: string) => {
    setKey(value);
    setStrength(checkPasswordStrength(value));
  };

  const handleGenerate = () => {
    const newKey = generateRandomKey();
    setKey(newKey);
    setShowKey(true);
    setStrength(checkPasswordStrength(newKey));
    setShowShare(true);
    navigator.clipboard.writeText(newKey).catch(() => {});
    setCopied("key");
    setTimeout(() => setCopied(""), 2000);
  };

  const handleCopyKey = useCallback(() => {
    if (!key) return;
    navigator.clipboard.writeText(key).then(() => {
      setCopied("key");
      setTimeout(() => setCopied(""), 2000);
    });
  }, [key]);

  const handleCopyLink = useCallback(() => {
    if (!key) return;
    navigator.clipboard.writeText(buildShareLink(key)).then(() => {
      setCopied("link");
      setTimeout(() => setCopied(""), 2000);
    });
  }, [key]);

  const handleJoin = () => {
    if (!key.trim() || key.trim().length < 4) return;
    joinRoom(nick, key);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">
            {"GEEK"} <span className="text-primary">{"CHAT"}</span>
          </h1>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            AES-256 / PBKDF2 / WebRTC / E2E / AI
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xl shadow-black/20">
          {/* Nickname */}
          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              昵称
            </label>
            <input
              type="text"
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              placeholder="你叫什么？"
              maxLength={12}
              autoComplete="nickname"
              className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>

          {/* Key */}
          <div className="mb-5">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                AES-256 房间密钥
              </label>
              <button
                onClick={handleGenerate}
                className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
              >
                <Zap className="h-3 w-3" />
                随机生成
              </button>
            </div>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={key}
                onChange={(e) => handleKeyChange(e.target.value)}
                placeholder="双方保持一致"
                autoComplete="current-password"
                className="h-11 w-full rounded-xl border border-border bg-background px-4 pr-11 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {/* Strength bar */}
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  STRENGTH_WIDTHS[strength],
                  STRENGTH_COLORS[strength]
                )}
              />
            </div>
          </div>

          {/* Share box */}
          {showShare && key && (
            <div className="mb-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div
                onClick={handleCopyKey}
                className="cursor-pointer rounded-lg bg-background/50 px-3 py-2 text-center font-mono text-sm text-primary select-all"
              >
                {key}
              </div>
              <p className="mt-2 text-center text-xs text-primary/70">
                {copied === "key"
                  ? "已复制到剪贴板"
                  : "密钥已生成 -- 发给对方即可安全连线"}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleCopyKey}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary/20 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10",
                    copied === "key" && "bg-primary/10"
                  )}
                >
                  <Copy className="h-3 w-3" />
                  复制密钥
                </button>
                <button
                  onClick={handleCopyLink}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary/20 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10",
                    copied === "link" && "bg-primary/10"
                  )}
                >
                  <Link className="h-3 w-3" />
                  复制链接
                </button>
                <button
                  onClick={() => setShowQR(true)}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-primary/20 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  <QrCode className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* Join button */}
          <button
            onClick={handleJoin}
            disabled={state.connecting || !key.trim() || key.trim().length < 4}
            className={cn(
              "h-12 w-full rounded-xl font-mono text-sm font-semibold transition-all",
              state.connecting
                ? "cursor-wait bg-secondary text-muted-foreground"
                : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
            )}
          >
            {state.connecting ? "正在连接..." : "[ 安全连线 ]"}
          </button>
          {state.connecting && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              首次唤醒约需30秒
            </p>
          )}
          {state.connectionError && (
            <p className="mt-2 text-center text-xs text-destructive">
              {state.connectionError}
            </p>
          )}

          {/* Feature badges */}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {[
              { icon: Shield, label: "E2E", color: "text-primary" },
              { icon: Eye, label: "一次阅读", color: "text-primary" },
              { icon: Mic, label: "变声", color: "text-primary" },
              { icon: QrCode, label: "二维码", color: "text-primary" },
              { icon: MessageSquare, label: "私聊", color: "text-primary" },
              { icon: Bot, label: "AI", color: "text-ai" },
              { icon: Dice5, label: "骰子", color: "text-orange" },
            ].map((badge) => (
              <span
                key={badge.label}
                className={cn(
                  "flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[10px] font-medium",
                  badge.color
                )}
              >
                <badge.icon className="h-3 w-3" />
                {badge.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* QR Modal */}
      {showQR && key && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowQR(false);
          }}
        >
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="text-center text-lg font-semibold text-foreground">
              扫码加入聊天
            </h3>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              扫描二维码，密钥自动填入
            </p>
            <div className="mx-auto mt-4 flex w-fit rounded-xl bg-white p-4">
              <QRCodeSVG
                value={buildShareLink(key)}
                size={200}
                bgColor="#ffffff"
                fgColor="#09090b"
                level="M"
              />
            </div>
            <p className="mt-3 text-center font-mono text-xs text-muted-foreground">
              {"密钥: " + key.slice(0, 8) + "..."}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  handleCopyLink();
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                <Copy className="h-4 w-4" />
                复制链接
              </button>
              <button
                onClick={() => setShowQR(false)}
                className="flex-1 rounded-xl bg-secondary px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/80"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
