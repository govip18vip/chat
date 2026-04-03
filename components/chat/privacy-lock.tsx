"use client";

import { Lock } from "lucide-react";

export function PrivacyLock() {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl"
      style={{ animation: "lock-in 0.3s ease" }}
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
        <Lock className="h-10 w-10 text-primary" />
      </div>
      <p className="mt-4 font-mono text-sm text-muted-foreground">
        {"GeekChat"} <span className="text-primary">{"安全锁定"}</span>
      </p>
    </div>
  );
}
