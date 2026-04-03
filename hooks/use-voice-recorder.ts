"use client";

import { useState, useRef, useCallback } from "react";
import { type FilePayload } from "@/context/chat-context";
import { type VoiceEffectKey, VOICE_EFFECTS } from "@/lib/constants";

interface UseVoiceRecorderOptions {
  maxDuration?: number; // seconds
  onComplete?: (file: FilePayload) => void;
}

export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}) {
  const { maxDuration = 60, onComplete } = options;
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const startTimeRef = useRef(0);

  const startRecording = useCallback(async (effect: VoiceEffectKey = "none") => {
    try {
      setError(null);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Try to use webm/opus if supported, fallback to default
      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/webm";
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "audio/mp4";
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ""; // Let browser choose
          }
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          const finalDuration = Math.ceil((Date.now() - startTimeRef.current) / 1000);
          const file: FilePayload = {
            name: `voice_${Date.now()}.webm`,
            type: blob.type || "audio/webm",
            size: blob.size,
            data: base64,
            isVoice: true,
            durationHint: finalDuration,
            effect: effect !== "none" ? effect : undefined,
          };
          onComplete?.(file);
        };
        reader.readAsDataURL(blob);

        // Cleanup
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        clearInterval(timerRef.current);
      };

      startTimeRef.current = Date.now();
      setDuration(0);
      setRecording(true);
      recorder.start(100); // Collect data every 100ms

      // Duration timer
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);
        if (elapsed >= maxDuration) {
          stopRecording();
        }
      }, 1000);
    } catch (err) {
      setError("无法访问麦克风");
      console.error("Microphone access error:", err);
    }
  }, [maxDuration, onComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    clearInterval(timerRef.current);
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    setDuration(0);
    clearInterval(timerRef.current);
  }, []);

  return {
    recording,
    duration,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
