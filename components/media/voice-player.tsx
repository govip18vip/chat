"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import { type FilePayload } from "@/context/chat-context";
import { VOICE_EFFECTS, type VoiceEffectKey } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface VoicePlayerProps {
  file: FilePayload;
  msgId: string;
}

const BAR_COUNT = 22;

export function VoicePlayer({ file, msgId }: VoicePlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(file.durationHint || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>();

  // Generate pseudo-random bar heights based on filename
  const seed = file.name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const barHeights = Array.from({ length: BAR_COUNT }, (_, i) =>
    Math.max(6, Math.min(26, Math.round(Math.abs(Math.sin((i + seed) * 1.7) * 18 + Math.cos((i + seed) * 0.9) * 10))))
  );

  const effectLabel = file.effect && file.effect !== "none"
    ? VOICE_EFFECTS[file.effect as VoiceEffectKey]?.name
    : null;

  const buildAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const audio = new Audio(file.data);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(Math.ceil(audio.duration));
      }
    };
    audio.onended = () => {
      setPlaying(false);
      setProgress(0);
      cancelAnimationFrame(rafRef.current!);
    };
    audioRef.current = audio;
    return audio;
  }, [file.data]);

  const animate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused || audio.ended) return;
    if (audio.duration > 0) {
      setProgress(audio.currentTime / audio.duration);
      setDuration(Math.ceil(audio.duration - audio.currentTime));
    }
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  const togglePlay = useCallback(async () => {
    const audio = buildAudio();
    if (playing) {
      audio.pause();
      setPlaying(false);
      cancelAnimationFrame(rafRef.current!);
    } else {
      try {
        await audio.play();
        setPlaying(true);
        animate();
      } catch {
        // Rebuild audio on error
        audioRef.current = null;
        const newAudio = buildAudio();
        try {
          await newAudio.play();
          setPlaying(true);
          animate();
        } catch {}
      }
    }
  }, [playing, buildAudio, animate]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current!);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const litBars = Math.floor(progress * BAR_COUNT);

  return (
    <div className="flex items-center gap-2.5 py-1">
      <button
        onClick={togglePlay}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary transition-transform active:scale-95"
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
      </button>

      <div className="flex items-end gap-px">
        {barHeights.map((h, i) => (
          <div
            key={i}
            className={cn(
              "w-1 rounded-full transition-colors duration-150",
              i <= litBars ? "bg-primary" : "bg-muted-foreground/30"
            )}
            style={{ height: h + "px" }}
          />
        ))}
      </div>

      <div className="flex items-center gap-1">
        {duration > 0 && (
          <span className="min-w-[28px] text-right text-[11px] text-muted-foreground">
            {duration}{"''"}
          </span>
        )}
        {effectLabel && (
          <span className="text-[10px] text-purple">{effectLabel}</span>
        )}
      </div>
    </div>
  );
}
