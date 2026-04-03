"use client";

import { useState, useEffect, useRef } from "react";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Minimize2,
  Maximize2,
  X,
} from "lucide-react";
import { useChatContext } from "@/context/chat-context";
import { cn } from "@/lib/utils";

interface CallOverlayProps {
  callType: "audio" | "video";
  targetNick: string;
  isIncoming?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onEnd?: () => void;
}

export function CallOverlay({
  callType,
  targetNick,
  isIncoming = false,
  onAccept,
  onDecline,
  onEnd,
}: CallOverlayProps) {
  const { state, dispatch } = useChatContext();
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connecting, setConnecting] = useState(true);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Simulate connection after 2s
  useEffect(() => {
    if (!isIncoming) {
      const timer = setTimeout(() => setConnecting(false), 2000);
      return () => clearTimeout(timer);
    }
    setConnecting(false);
  }, [isIncoming]);

  // Call duration timer
  useEffect(() => {
    if (!connecting && !isIncoming) {
      timerRef.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [connecting, isIncoming]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Mini mode
  if (state.callMini && !isIncoming) {
    return (
      <div
        className="fixed bottom-20 right-4 z-50 flex items-center gap-3 rounded-2xl border border-primary/30 bg-card/95 px-4 py-2.5 shadow-xl backdrop-blur-sm"
        onClick={() => dispatch({ type: "SET_CALL_MINI", mini: false })}
      >
        <div className="relative">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            {callType === "video" ? (
              <Video className="h-5 w-5 text-primary" />
            ) : (
              <Phone className="h-5 w-5 text-primary" />
            )}
          </div>
          <div
            className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-primary"
            style={{ animation: "pulse-ring 1.5s infinite" }}
          />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{targetNick}</p>
          <p className="text-xs text-primary">{formatDuration(callDuration)}</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEnd?.();
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive text-white"
        >
          <PhoneOff className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Incoming call
  if (isIncoming) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/95 backdrop-blur-xl">
        <div className="flex flex-col items-center">
          {/* Animated ring */}
          <div className="relative mb-6">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
              {callType === "video" ? (
                <Video className="h-10 w-10 text-primary" />
              ) : (
                <Phone
                  className="h-10 w-10 text-primary"
                  style={{ animation: "ring-bounce 0.5s infinite" }}
                />
              )}
            </div>
            <div
              className="absolute inset-0 rounded-full border-2 border-primary/50"
              style={{ animation: "pulse-ring 1.5s infinite" }}
            />
            <div
              className="absolute inset-0 rounded-full border-2 border-primary/30"
              style={{ animation: "pulse-ring 1.5s infinite 0.5s" }}
            />
          </div>

          <p className="mb-1 text-xl font-semibold text-foreground">
            {targetNick}
          </p>
          <p className="mb-8 text-sm text-muted-foreground">
            {callType === "video" ? "视频通话请求" : "语音通话请求"}
          </p>

          <div className="flex gap-6">
            <button
              onClick={onDecline}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive text-white shadow-lg transition-transform active:scale-95"
            >
              <X className="h-7 w-7" />
            </button>
            <button
              onClick={onAccept}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
            >
              {callType === "video" ? (
                <Video className="h-7 w-7" />
              ) : (
                <Phone className="h-7 w-7" />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Full call screen
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      {/* Video area */}
      {callType === "video" ? (
        <div className="relative flex-1 bg-zinc-900">
          {/* Remote video */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-full w-full object-cover"
          />

          {/* Local video (PIP) */}
          <div className="absolute right-4 top-4 h-32 w-24 overflow-hidden rounded-xl border border-border bg-zinc-800 shadow-lg">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                "h-full w-full object-cover",
                videoOff && "hidden"
              )}
            />
            {videoOff && (
              <div className="flex h-full items-center justify-center">
                <VideoOff className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Connecting overlay */}
          {connecting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/80">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <Video className="h-8 w-8 text-primary" />
              </div>
              <p className="text-lg font-medium text-foreground">{targetNick}</p>
              <p className="mt-1 text-sm text-muted-foreground">连接中...</p>
            </div>
          )}
        </div>
      ) : (
        // Audio call view
        <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-card to-background">
          <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
            <Phone className="h-12 w-12 text-primary" />
          </div>
          <p className="text-2xl font-semibold text-foreground">{targetNick}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {connecting ? "连接中..." : formatDuration(callDuration)}
          </p>
          {!connecting && (
            <div className="mt-4 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 rounded-full bg-primary"
                  style={{
                    height: Math.random() * 16 + 8,
                    animation: `wave-active ${0.3 + i * 0.1}s infinite alternate`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 bg-card px-6 py-6">
        {/* Minimize */}
        <button
          onClick={() => dispatch({ type: "SET_CALL_MINI", mini: true })}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-secondary/80"
        >
          <Minimize2 className="h-5 w-5" />
        </button>

        {/* Mute */}
        <button
          onClick={() => setMuted(!muted)}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
            muted
              ? "bg-destructive/20 text-destructive"
              : "bg-secondary text-foreground hover:bg-secondary/80"
          )}
        >
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        {/* Video toggle (for video calls) */}
        {callType === "video" && (
          <button
            onClick={() => setVideoOff(!videoOff)}
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
              videoOff
                ? "bg-destructive/20 text-destructive"
                : "bg-secondary text-foreground hover:bg-secondary/80"
            )}
          >
            {videoOff ? (
              <VideoOff className="h-5 w-5" />
            ) : (
              <Video className="h-5 w-5" />
            )}
          </button>
        )}

        {/* End call */}
        <button
          onClick={onEnd}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive text-white shadow-lg transition-transform active:scale-95"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
