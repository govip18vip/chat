"use client";

import { useState } from "react";
import { X, Search, MessageCircle } from "lucide-react";
import { useChatContext } from "@/context/chat-context";
import { searchMsgs, type StoredMessage } from "@/lib/db";
import { formatTime } from "@/lib/utils";

interface SearchPanelProps {
  onClose: () => void;
}

export function SearchPanel({ onClose }: SearchPanelProps) {
  const { state } = useChatContext();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StoredMessage[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    const r = await searchMsgs(query, state.derivedKey);
    setResults(r);
    setSearched(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-t-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">搜索记录</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                placeholder="搜索加密消息..."
                autoFocus
                className="h-10 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            <button
              onClick={handleSearch}
              className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              搜索
            </button>
          </div>

          <div className="mt-3 max-h-[40vh] overflow-y-auto">
            {searched && results.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                未找到匹配的消息
              </p>
            )}
            {results.map((msg) => (
              <div
                key={msg.id}
                className="flex items-start gap-2 rounded-xl px-3 py-2.5 transition-colors hover:bg-secondary"
              >
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-primary">
                      {msg.nick}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatTime(msg.ts)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-foreground line-clamp-2">
                    {msg.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
