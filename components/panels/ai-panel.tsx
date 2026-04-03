"use client";

import { useState } from "react";
import {
  X,
  Bot,
  Languages,
  Globe,
  FileText,
  Lightbulb,
  PenLine,
  Sparkles,
  Heart,
  Code,
  Send,
  Copy,
  Loader2,
} from "lucide-react";
import { useChatContext } from "@/context/chat-context";
import { AI_ACTIONS, type AIActionKey } from "@/lib/constants";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Languages,
  Globe,
  FileText,
  Lightbulb,
  PenLine,
  Sparkles,
  Heart,
  Code,
};

interface AIPanelProps {
  onClose: () => void;
}

export function AIPanel({ onClose }: AIPanelProps) {
  const { callAI, sysMsg } = useChatContext();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAction = async (actionKey: AIActionKey) => {
    if (!query.trim() && !result.trim()) return;
    const text = query.trim() || result.trim();
    const action = AI_ACTIONS[actionKey];
    setLoading(true);
    setResult("");
    try {
      const r = await callAI(action.prompt + text);
      setResult(r);
    } catch {
      setResult("AI 请求失败，请检查网络");
    } finally {
      setLoading(false);
    }
  };

  const handleFreeAsk = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResult("");
    try {
      const r = await callAI(query);
      setResult(r);
    } catch {
      setResult("AI 请求失败，请检查网络");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result).then(() => sysMsg("已复制AI回复"));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-t-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-ai" />
            <h3 className="text-sm font-semibold text-foreground">AI 助手</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-4 py-3 space-y-3">
          {/* Action grid */}
          <div className="grid grid-cols-4 gap-2">
            {(Object.entries(AI_ACTIONS) as [AIActionKey, typeof AI_ACTIONS[AIActionKey]][]).map(([key, action]) => {
              const Icon = ICON_MAP[action.icon] || Bot;
              return (
                <button
                  key={key}
                  onClick={() => handleAction(key)}
                  disabled={loading}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border p-3 text-foreground transition-colors hover:bg-ai/5 hover:border-ai/30 disabled:opacity-50"
                >
                  <Icon className="h-5 w-5 text-ai" />
                  <span className="text-[10px] font-medium">{action.label}</span>
                </button>
              );
            })}
          </div>

          {/* Free input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleFreeAsk(); }}
              placeholder="输入文本或问AI任何问题..."
              className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ai focus:outline-none focus:ring-1 focus:ring-ai transition-colors"
            />
            <button
              onClick={handleFreeAsk}
              disabled={loading || !query.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-ai text-white transition-colors hover:bg-ai/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-4">
              <span className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-ai" style={{ animation: "ai-dot 1.4s infinite 0s" }} />
                <span className="h-2 w-2 rounded-full bg-ai" style={{ animation: "ai-dot 1.4s infinite 0.2s" }} />
                <span className="h-2 w-2 rounded-full bg-ai" style={{ animation: "ai-dot 1.4s infinite 0.4s" }} />
              </span>
              <span className="text-sm text-ai">AI 思考中...</span>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="rounded-xl border border-ai/20 bg-ai/5 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-ai">AI 回复</span>
                <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Copy className="h-3 w-3" /> 复制
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {result}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
