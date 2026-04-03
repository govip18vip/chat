"use client";

import { X, Copy, Link } from "lucide-react";
import { useChatContext } from "@/context/chat-context";
import { buildShareLink } from "@/lib/crypto";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";

interface QRModalProps {
  onClose: () => void;
}

export function QRModal({ onClose }: QRModalProps) {
  const { state, sysMsg } = useChatContext();
  const [copied, setCopied] = useState(false);

  const link = buildShareLink(state.roomKey);

  const handleCopy = () => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      sysMsg("邀请链接已复制");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">邀请加入</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mx-auto flex w-fit rounded-xl bg-white p-4">
          <QRCodeSVG
            value={link}
            size={180}
            bgColor="#ffffff"
            fgColor="#09090b"
            level="M"
          />
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          扫码或分享链接加入加密聊天
        </p>

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleCopy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            {copied ? <Link className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            {copied ? "已复制" : "复制链接"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-secondary py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/80"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
