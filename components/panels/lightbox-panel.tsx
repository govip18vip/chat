"use client";

import { useState, useEffect } from "react";
import { X, ZoomIn, ZoomOut, Download, RotateCw } from "lucide-react";
import { useChatContext } from "@/context/chat-context";

interface LightboxPanelProps {
  onClose: () => void;
  imageUrl?: string;
}

export function LightboxPanel({ onClose, imageUrl }: LightboxPanelProps) {
  const { state } = useChatContext();
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Find the most recent image message
  const imageMessages = state.messages.filter(
    (m) => "file" in m && m.file?.type?.startsWith("image/")
  );
  const latestImage = imageUrl || (imageMessages.length > 0 
    ? (imageMessages[imageMessages.length - 1] as { file?: { data: string } }).file?.data 
    : null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setScale((s) => Math.min(s + 0.25, 3));
      if (e.key === "-") setScale((s) => Math.max(s - 0.25, 0.5));
      if (e.key === "r") setRotation((r) => r + 90);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleDownload = () => {
    if (!latestImage) return;
    const link = document.createElement("a");
    link.href = latestImage;
    link.download = `geekchat_image_${Date.now()}.png`;
    link.click();
  };

  if (!latestImage) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
        onClick={onClose}
      >
        <p className="text-muted-foreground">没有可查看的图片</p>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      onClick={onClose}
    >
      {/* Header */}
      <div className="flex items-center justify-between bg-black/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setScale((s) => Math.max(s - 0.25, 0.5));
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="min-w-[50px] text-center text-xs text-white/50">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setScale((s) => Math.min(s + 0.25, 3));
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRotation((r) => r + 90);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Image */}
      <div
        className="flex flex-1 items-center justify-center overflow-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={latestImage}
          alt="Full size preview"
          className="max-h-full max-w-full object-contain transition-transform duration-200"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}
