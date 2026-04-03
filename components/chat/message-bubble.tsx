"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Reply,
  MessageSquare,
  Bot,
  Undo2,
  Trash2,
  SmilePlus,
  Eye,
} from "lucide-react";
import { useChatContext, type ChatMessage } from "@/context/chat-context";
import { formatTime, escapeHtml } from "@/lib/utils";
import { deleteMsg } from "@/lib/db";
import { cn } from "@/lib/utils";
import { REACTION_EMOJIS } from "@/lib/constants";
import { DiceBubble } from "@/components/dice/dice-bubble";
import { VoicePlayer } from "@/components/media/voice-player";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { state, dispatch, sendEncrypted } = useChatContext();
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [destroying, setDestroying] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout>>();
  const rowRef = useRef<HTMLDivElement>(null);

  const isMe = message.isMe;
  const showOnce = message.once && !isMe && !revealed;
  const sid = Object.entries(state.members).find(
    ([, v]) => v === message.nick
  )?.[0];

  // Auto-delete
  useEffect(() => {
    if (message.ad && message.ad > 0) {
      const timer = setTimeout(() => {
        setDestroying(true);
        setTimeout(() => {
          dispatch({ type: "REMOVE_MESSAGE", id: message.id });
          deleteMsg(message.id);
        }, 400);
      }, message.ad * 1000);
      return () => clearTimeout(timer);
    }
  }, [message.ad, message.id, dispatch]);

  const handleRevealOnce = () => {
    if (revealed) return;
    setRevealed(true);
    setTimeout(() => {
      setDestroying(true);
      setTimeout(() => {
        dispatch({ type: "REMOVE_MESSAGE", id: message.id });
      }, 500);
    }, 10000);
  };

  const handleRecall = () => {
    sendEncrypted({ type: "recall", msgId: message.id });
    dispatch({ type: "REMOVE_MESSAGE", id: message.id });
    deleteMsg(message.id);
    setShowActions(false);
  };

  const handleDeleteBoth = () => {
    sendEncrypted({ type: "remote_delete", msgId: message.id });
    dispatch({ type: "REMOVE_MESSAGE", id: message.id });
    deleteMsg(message.id);
    setShowActions(false);
  };

  const handleReaction = (emoji: string) => {
    sendEncrypted({
      type: "reaction",
      msgId: message.id,
      emoji,
      nick: state.myNick,
    });
    dispatch({
      type: "ADD_REACTION",
      msgId: message.id,
      emoji,
      nick: state.myNick,
      isMe: true,
    });
    setShowReactions(false);
    setShowActions(false);
  };

  const handleLongPress = useCallback(() => {
    longPressRef.current = setTimeout(() => setShowActions(true), 500);
  }, []);

  const cancelLongPress = useCallback(() => {
    clearTimeout(longPressRef.current);
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setShowActions(true);
    },
    []
  );

  // Close actions when clicking outside
  useEffect(() => {
    if (showActions) {
      const timer = setTimeout(() => setShowActions(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [showActions]);

  const renderContent = () => {
    if (showOnce) {
      return (
        <button
          onClick={handleRevealOnce}
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Eye className="h-4 w-4" />
          <span>点击查看 -- 仅可阅读一次</span>
        </button>
      );
    }

    if (message.dice) {
      return <DiceBubble value={message.dice} msgId={message.id} isMe={isMe} nick={message.nick} />;
    }

    return (
      <>
        {message.once && isMe && (
          <p className="mb-1 flex items-center gap-1 text-[10px] text-primary/70">
            <Eye className="h-3 w-3" /> 一次性消息
          </p>
        )}
        {message.file?.isVoice ? (
          <VoicePlayer file={message.file} msgId={message.id} />
        ) : message.file?.type?.startsWith("image/") ? (
          <img
            src={message.file.data}
            alt="shared image"
            className="max-w-[240px] rounded-lg cursor-pointer"
            loading="lazy"
            onClick={() =>
              dispatch({ type: "SET_ACTIVE_PANEL", panel: "lightbox" })
            }
          />
        ) : message.file?.type?.startsWith("video/") ? (
          <video
            controls
            playsInline
            preload="metadata"
            className="max-w-[240px] rounded-lg"
            src={message.file.data}
          />
        ) : message.file ? (
          <div className="flex items-center gap-2 rounded-lg bg-background/50 p-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-lg">
              {"📎"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{message.file.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {message.file.size < 1024
                  ? message.file.size + "B"
                  : message.file.size < 1048576
                  ? (message.file.size / 1024).toFixed(1) + "KB"
                  : (message.file.size / 1048576).toFixed(1) + "MB"}
              </p>
            </div>
          </div>
        ) : null}
        {message.text && (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {message.text}
          </p>
        )}
      </>
    );
  };

  return (
    <div
      ref={rowRef}
      className={cn(
        "group flex gap-2 px-3 py-1",
        isMe ? "flex-row-reverse" : "flex-row",
        destroying && "pointer-events-none opacity-0 -translate-y-2 transition-all duration-400"
      )}
      style={{ animation: "msg-in 0.2s ease" }}
      onContextMenu={handleContextMenu}
      onTouchStart={handleLongPress}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
    >
      <div className={cn("flex max-w-[75%] flex-col", isMe ? "items-end" : "items-start")}>
        {/* Reply preview */}
        {message.replyTo && (
          <div className="mb-1 max-w-full rounded-lg bg-secondary/50 px-2.5 py-1.5 text-[11px]">
            <span className="font-semibold text-primary">
              {message.replyTo.nick}
            </span>
            <span className="text-muted-foreground">
              {": "}
              {message.replyTo.text || "[媒体]"}
            </span>
          </div>
        )}

        {/* Name */}
        {!isMe && (
          <button
            onClick={() => {
              if (sid) {
                dispatch({ type: "SET_PM", target: sid, nick: message.nick });
                dispatch({ type: "SET_ACTIVE_PANEL", panel: "pm" });
              }
            }}
            className="mb-0.5 px-1 text-[11px] font-medium text-primary/80 hover:text-primary transition-colors"
          >
            {message.nick}
          </button>
        )}

        {/* Bubble */}
        <div
          className={cn(
            "relative rounded-2xl px-3.5 py-2.5",
            message.dice
              ? "bg-transparent p-0"
              : isMe
              ? "rounded-tr-md bg-primary/15 ring-1 ring-primary/20"
              : "rounded-tl-md bg-card ring-1 ring-border"
          )}
        >
          {renderContent()}
          {/* Auto-delete bar */}
          {message.ad && message.ad > 0 ? (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden rounded-b-2xl">
              <div
                className="h-full bg-orange"
                style={{
                  animation: `ad-countdown ${message.ad}s linear forwards`,
                }}
              />
            </div>
          ) : null}
        </div>

        {/* Reactions */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(message.reactions).map(([emoji, data]) => (
              <span
                key={emoji}
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs",
                  data.mine
                    ? "border-primary/30 bg-primary/10"
                    : "border-border bg-secondary"
                )}
              >
                {emoji}
                <span className="text-[10px] text-muted-foreground">
                  {data.count}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* Meta */}
        <div className="mt-0.5 flex items-center gap-1.5 px-1">
          <span className="text-[10px] text-muted-foreground">
            {formatTime(message.ts)}
          </span>
          {message.ad && message.ad > 0 ? (
            <span className="text-[10px] text-orange">
              {message.ad + "s"}
            </span>
          ) : null}
        </div>

        {/* Action menu */}
        {showActions && (
          <div
            className={cn(
              "mt-1 flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card p-1.5 shadow-lg",
              isMe ? "self-end" : "self-start"
            )}
          >
            <button
              onClick={() => {
                dispatch({
                  type: "SET_REPLY",
                  reply: {
                    id: message.id,
                    nick: message.nick,
                    text: message.text || "",
                  },
                });
                setShowActions(false);
              }}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-foreground hover:bg-secondary transition-colors"
            >
              <Reply className="h-3 w-3" />
              回复
            </button>
            {sid && (
              <button
                onClick={() => {
                  dispatch({ type: "SET_PM", target: sid, nick: message.nick });
                  dispatch({ type: "SET_ACTIVE_PANEL", panel: "pm" });
                  setShowActions(false);
                }}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-purple hover:bg-purple/10 transition-colors"
              >
                <MessageSquare className="h-3 w-3" />
                私聊
              </button>
            )}
            {message.text && (
              <button
                onClick={() => {
                  dispatch({
                    type: "SET_ACTIVE_PANEL",
                    panel: "ai",
                  });
                  setShowActions(false);
                }}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-ai hover:bg-ai/10 transition-colors"
              >
                <Bot className="h-3 w-3" />
                AI
              </button>
            )}
            {isMe && (
              <button
                onClick={handleRecall}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Undo2 className="h-3 w-3" />
                撤回
              </button>
            )}
            <button
              onClick={handleDeleteBoth}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              双方删
            </button>
            <button
              onClick={() => setShowReactions(!showReactions)}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-foreground hover:bg-secondary transition-colors"
            >
              <SmilePlus className="h-3 w-3" />
              回应
            </button>
          </div>
        )}

        {/* Reaction picker */}
        {showReactions && (
          <div className="mt-1 flex items-center gap-1 rounded-xl border border-border bg-card p-1.5 shadow-lg">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className="rounded-lg p-1.5 text-lg transition-transform hover:scale-125 hover:bg-secondary"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
