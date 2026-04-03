import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + "B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + "KB";
  return (bytes / 1048576).toFixed(1) + "MB";
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

export function getBlobURL(
  data: string,
  key: string,
  cache: Map<string, string>
): string {
  if (cache.has(key)) return cache.get(key)!;
  try {
    const [header, body] = data.split(",");
    const mime = header.match(/:(.*?);/)?.[1] || "application/octet-stream";
    const bin = atob(body);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: mime }));
    cache.set(key, url);
    return url;
  } catch {
    return data;
  }
}

export function freeBlob(key: string, cache: Map<string, string>) {
  if (cache.has(key)) {
    URL.revokeObjectURL(cache.get(key)!);
    cache.delete(key);
  }
}
