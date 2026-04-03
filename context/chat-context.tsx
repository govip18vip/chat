"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  encrypt,
  decrypt,
  deriveKey,
  getRoomHash,
  getSalt,
} from "@/lib/crypto";
import {
  initDB,
  saveMsg as dbSave,
  deleteMsg as dbDelete,
  clearAllMsgs,
  loadHistory,
  closeDB,
} from "@/lib/db";
import { uid, formatTime } from "@/lib/utils";
import { AI_API_URL } from "@/lib/constants";

/* ────────── Types ────────── */
export interface ChatMessage {
  id: string;
  type: string;
  nick: string;
  text?: string;
  file?: FilePayload;
  dice?: number;
  ad?: number;
  once?: boolean;
  ts: number;
  isMe: boolean;
  replyTo?: { id: string; nick: string; text: string } | null;
  reactions?: Record<string, { count: number; mine: boolean }>;
  revealed?: boolean;
  deleted?: boolean;
}

export interface FilePayload {
  name: string;
  type: string;
  size: number;
  data: string;
  isVoice?: boolean;
  durationHint?: number;
  effect?: string;
}

export interface SystemMessage {
  id: string;
  type: "system";
  text: string;
  ts: number;
}

export type DisplayMessage = ChatMessage | SystemMessage;

interface PMMessage {
  me: boolean;
  nick: string;
  text: string;
  ts: number;
}

type Screen = "login" | "chat" | "call";

interface ChatState {
  screen: Screen;
  connected: boolean;
  connecting: boolean;
  myNick: string;
  myId: string;
  roomKey: string;
  roomHash: string;
  derivedKey: string;
  messages: DisplayMessage[];
  members: Record<string, string>;
  autoDelete: number;
  onceReadMode: boolean;
  schedMins: number;
  currentEffect: string;
  replyTo: { id: string; nick: string; text: string } | null;
  pendingFile: FilePayload | null;
  inCall: boolean;
  callType: "audio" | "video";
  isPrivateCall: boolean;
  callMini: boolean;
  pmTarget: string | null;
  pmNick: string;
  pmHistory: Record<string, PMMessage[]>;
  typingUser: string | null;
  noCopy: boolean;
  privacyLock: boolean;
  privacyLockEnabled: boolean;
  notificationsOn: boolean;
  autoClearOnExit: boolean;
  showEmoji: boolean;
  showAttach: boolean;
  activePanel: string | null;
  connectionError: string | null;
}

/* ────────── Actions ────────── */
type Action =
  | { type: "SET_SCREEN"; screen: Screen }
  | { type: "SET_CONNECTING"; connecting: boolean }
  | { type: "SET_CONNECTED"; myId: string }
  | { type: "SET_DISCONNECTED"; error?: string }
  | { type: "SET_CREDENTIALS"; myNick: string; roomKey: string; derivedKey: string; roomHash: string }
  | { type: "ADD_MESSAGE"; message: DisplayMessage }
  | { type: "ADD_MESSAGES"; messages: DisplayMessage[] }
  | { type: "REMOVE_MESSAGE"; id: string }
  | { type: "UPDATE_MESSAGE"; id: string; updates: Partial<ChatMessage> }
  | { type: "CLEAR_MESSAGES" }
  | { type: "ADD_MEMBER"; id: string; nick: string }
  | { type: "REMOVE_MEMBER"; id: string }
  | { type: "SET_AUTO_DELETE"; value: number }
  | { type: "SET_ONCE_READ"; value: boolean }
  | { type: "SET_SCHEDULE"; value: number }
  | { type: "SET_EFFECT"; value: string }
  | { type: "SET_REPLY"; reply: { id: string; nick: string; text: string } | null }
  | { type: "SET_PENDING_FILE"; file: FilePayload | null }
  | { type: "SET_CALL"; inCall: boolean; callType?: "audio" | "video"; isPrivate?: boolean }
  | { type: "SET_CALL_MINI"; mini: boolean }
  | { type: "SET_PM"; target: string | null; nick: string }
  | { type: "ADD_PM"; target: string; message: PMMessage }
  | { type: "SET_TYPING"; user: string | null }
  | { type: "SET_NO_COPY"; value: boolean }
  | { type: "SET_PRIVACY_LOCK"; locked: boolean }
  | { type: "SET_PRIVACY_LOCK_ENABLED"; enabled: boolean }
  | { type: "SET_NOTIFICATIONS"; on: boolean }
  | { type: "SET_AUTO_CLEAR"; on: boolean }
  | { type: "TOGGLE_EMOJI" }
  | { type: "TOGGLE_ATTACH" }
  | { type: "CLOSE_PANELS" }
  | { type: "SET_ACTIVE_PANEL"; panel: string | null }
  | { type: "ADD_REACTION"; msgId: string; emoji: string; nick: string; isMe: boolean }
  | { type: "RESET" };

const initialState: ChatState = {
  screen: "login",
  connected: false,
  connecting: false,
  myNick: "",
  myId: "",
  roomKey: "",
  roomHash: "",
  derivedKey: "",
  messages: [],
  members: {},
  autoDelete: 0,
  onceReadMode: false,
  schedMins: 0,
  currentEffect: "none",
  replyTo: null,
  pendingFile: null,
  inCall: false,
  callType: "audio",
  isPrivateCall: false,
  callMini: false,
  pmTarget: null,
  pmNick: "",
  pmHistory: {},
  typingUser: null,
  noCopy: false,
  privacyLock: false,
  privacyLockEnabled: true,
  notificationsOn: false,
  autoClearOnExit: false,
  showEmoji: false,
  showAttach: false,
  activePanel: null,
  connectionError: null,
};

function reducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case "SET_SCREEN":
      return { ...state, screen: action.screen };
    case "SET_CONNECTING":
      return { ...state, connecting: action.connecting, connectionError: null };
    case "SET_CONNECTED":
      return { ...state, connected: true, connecting: false, myId: action.myId, connectionError: null };
    case "SET_DISCONNECTED":
      return { ...state, connected: false, connectionError: action.error || null };
    case "SET_CREDENTIALS":
      return { ...state, myNick: action.myNick, roomKey: action.roomKey, derivedKey: action.derivedKey, roomHash: action.roomHash };
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.message] };
    case "ADD_MESSAGES":
      return { ...state, messages: [...state.messages, ...action.messages] };
    case "REMOVE_MESSAGE":
      return { ...state, messages: state.messages.filter((m) => m.id !== action.id) };
    case "UPDATE_MESSAGE":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id ? { ...m, ...action.updates } : m
        ),
      };
    case "CLEAR_MESSAGES":
      return { ...state, messages: [] };
    case "ADD_MEMBER":
      return { ...state, members: { ...state.members, [action.id]: action.nick } };
    case "REMOVE_MEMBER": {
      const newMembers = { ...state.members };
      delete newMembers[action.id];
      return { ...state, members: newMembers };
    }
    case "SET_AUTO_DELETE":
      return { ...state, autoDelete: action.value };
    case "SET_ONCE_READ":
      return { ...state, onceReadMode: action.value };
    case "SET_SCHEDULE":
      return { ...state, schedMins: action.value };
    case "SET_EFFECT":
      return { ...state, currentEffect: action.value };
    case "SET_REPLY":
      return { ...state, replyTo: action.reply };
    case "SET_PENDING_FILE":
      return { ...state, pendingFile: action.file };
    case "SET_CALL":
      return {
        ...state,
        inCall: action.inCall,
        callType: action.callType || state.callType,
        isPrivateCall: action.isPrivate || false,
      };
    case "SET_CALL_MINI":
      return { ...state, callMini: action.mini };
    case "SET_PM":
      return { ...state, pmTarget: action.target, pmNick: action.nick };
    case "ADD_PM": {
      const hist = { ...state.pmHistory };
      if (!hist[action.target]) hist[action.target] = [];
      hist[action.target] = [...hist[action.target], action.message];
      return { ...state, pmHistory: hist };
    }
    case "SET_TYPING":
      return { ...state, typingUser: action.user };
    case "SET_NO_COPY":
      return { ...state, noCopy: action.value };
    case "SET_PRIVACY_LOCK":
      return { ...state, privacyLock: action.locked };
    case "SET_PRIVACY_LOCK_ENABLED":
      return { ...state, privacyLockEnabled: action.enabled };
    case "SET_NOTIFICATIONS":
      return { ...state, notificationsOn: action.on };
    case "SET_AUTO_CLEAR":
      return { ...state, autoClearOnExit: action.on };
    case "TOGGLE_EMOJI":
      return { ...state, showEmoji: !state.showEmoji, showAttach: false };
    case "TOGGLE_ATTACH":
      return { ...state, showAttach: !state.showAttach, showEmoji: false };
    case "CLOSE_PANELS":
      return { ...state, showEmoji: false, showAttach: false, activePanel: null };
    case "SET_ACTIVE_PANEL":
      return { ...state, activePanel: action.panel, showEmoji: false, showAttach: false };
    case "ADD_REACTION": {
      return {
        ...state,
        messages: state.messages.map((m) => {
          if (m.id !== action.msgId || !("nick" in m)) return m;
          const cm = m as ChatMessage;
          const reactions = { ...(cm.reactions || {}) };
          const existing = reactions[action.emoji] || { count: 0, mine: false };
          reactions[action.emoji] = {
            count: existing.count + 1,
            mine: existing.mine || action.isMe,
          };
          return { ...cm, reactions };
        }),
      };
    }
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}

/* ────────── Context ────────── */
interface ChatContextType {
  state: ChatState;
  dispatch: React.Dispatch<Action>;
  wsRef: React.RefObject<WebSocket | null>;
  sendEncrypted: (obj: Record<string, unknown>) => void;
  joinRoom: (nick: string, key: string) => void;
  exitRoom: () => void;
  sendMessage: (text: string) => void;
  sendDice: () => void;
  sysMsg: (text: string) => void;
  callAI: (prompt: string) => Promise<string>;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
}

/* ────────── Provider ────────── */
export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const clientIdRef = useRef<string>("");
  const seenNonces = useRef(new Set<string>());
  const reconTimer = useRef<ReturnType<typeof setTimeout>>();
  const reconCount = useRef(0);
  const pingInterval = useRef<ReturnType<typeof setInterval>>();
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();
  const isTypingRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const sysMsg = useCallback((text: string) => {
    dispatch({
      type: "ADD_MESSAGE",
      message: { id: uid(), type: "system", text, ts: Date.now() },
    });
  }, []);

  /* ── Dual-mode: WebSocket (NEXT_PUBLIC_WS_URL) or SSE fallback ── */
  const modeRef = useRef<"ws" | "sse">(
    typeof window !== "undefined" && process.env.NEXT_PUBLIC_WS_URL ? "ws" : "sse"
  );

  // Send encrypted message - auto-selects WS or POST
  const sendEncrypted = useCallback(
    async (obj: Record<string, unknown>) => {
      const s = stateRef.current;
      if (!s.connected || !s.derivedKey || !clientIdRef.current) return;

      const encrypted = encrypt(obj, s.derivedKey);

      if (
        modeRef.current === "ws" &&
        wsRef.current &&
        wsRef.current.readyState === WebSocket.OPEN
      ) {
        // WebSocket mode: send directly
        try {
          wsRef.current.send(encrypted);
        } catch (err) {
          console.error("WS send failed:", err);
        }
      } else {
        // SSE mode: POST to API route
        try {
          await fetch("/api/room", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roomId: s.roomHash,
              clientId: clientIdRef.current,
              data: encrypted,
            }),
          });
        } catch (err) {
          console.error("POST send failed:", err);
        }
      }
    },
    []
  );

  const handleSSEMessage = useCallback(
    (data: string) => {
      const s = stateRef.current;
      let env: Record<string, unknown>;
      try {
        env = JSON.parse(data);
      } catch {
        return;
      }
      if (env._pong) return;
      if (env._sys) {
        const sys = env._sys as string;
        if (sys === "welcome") {
          clientIdRef.current = env._id as string;
          dispatch({ type: "SET_CONNECTED", myId: env._id as string });
          // Send presence after connected
          const presenceMsg = encrypt(
            { type: "presence", action: "join", nick: s.myNick },
            s.derivedKey
          );
          fetch("/api/room", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roomId: s.roomHash,
              clientId: env._id,
              data: presenceMsg,
            }),
          }).catch(() => {});
        }
        if (sys === "left") {
          const leftId = env._id as string;
          if (s.members[leftId]) {
            sysMsg(`${s.members[leftId]} 已离开`);
          }
          dispatch({ type: "REMOVE_MEMBER", id: leftId });
        }
        if (sys === "offline_done") {
          sysMsg(`${env.count} 条离线消息`);
        }
        if (sys === "rate_limit") {
          sysMsg("发送太快，请稍后再试");
        }
        return;
      }
      if (env._data && env._from !== clientIdRef.current) {
        const p = decrypt(env._data as string, s.derivedKey, seenNonces.current);
        if (!p) return;
        const sid = env._from as string;
        const msgType = p.type as string;
        switch (msgType) {
          case "presence": {
            const action = p.action as string;
            if (action === "join" || action === "sync") {
              dispatch({ type: "ADD_MEMBER", id: sid, nick: p.nick as string });
              if (action === "join") {
                sysMsg(`${p.nick} 加入了房间`);
                // Send sync back
                const syncMsg = encrypt(
                  { type: "presence", action: "sync", nick: s.myNick },
                  s.derivedKey
                );
                fetch("/api/room", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    roomId: s.roomHash,
                    clientId: clientIdRef.current,
                    data: syncMsg,
                  }),
                }).catch(() => {});
              }
            }
            break;
          }
          case "chat": {
            if (p.privateTo) {
              if (p.privateTo === clientIdRef.current) {
                const nick = s.members[sid] || "对方";
                const pm: PMMessage = { me: false, nick, text: p.text as string, ts: (p.ts as number) || Date.now() };
                dispatch({ type: "ADD_PM", target: sid, message: pm });
                if (s.pmTarget !== sid) {
                  sysMsg(`${nick} 给你发了私信`);
                }
              }
            } else {
              const msg: ChatMessage = {
                id: p.id as string,
                type: "chat",
                nick: p.nick as string,
                text: p.text as string | undefined,
                file: p.file as FilePayload | undefined,
                dice: p.dice as number | undefined,
                ad: p.ad as number | undefined,
                once: p.once as boolean | undefined,
                ts: (p.ts as number) || Date.now(),
                isMe: false,
                replyTo: p.replyTo as ChatMessage["replyTo"],
              };
              dispatch({ type: "ADD_MESSAGE", message: msg });
              dbSave({ ...p, _isMe: false }, s.derivedKey);
              // Send read receipt
              const receiptMsg = encrypt(
                { type: "receipt", msgId: p.id, status: "read" },
                s.derivedKey
              );
              fetch("/api/room", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  roomId: s.roomHash,
                  clientId: clientIdRef.current,
                  data: receiptMsg,
                }),
              }).catch(() => {});
            }
            break;
          }
          case "recall":
            dispatch({ type: "REMOVE_MESSAGE", id: p.msgId as string });
            dbDelete(p.msgId as string);
            break;
          case "reaction":
            dispatch({
              type: "ADD_REACTION",
              msgId: p.msgId as string,
              emoji: p.emoji as string,
              nick: p.nick as string,
              isMe: false,
            });
            break;
          case "typing":
            if (p.active) {
              dispatch({ type: "SET_TYPING", user: s.members[sid] || "对方" });
              setTimeout(() => dispatch({ type: "SET_TYPING", user: null }), 3000);
            } else {
              dispatch({ type: "SET_TYPING", user: null });
            }
            break;
          case "remote_clear":
            clearAllMsgs().then(() => {
              dispatch({ type: "CLEAR_MESSAGES" });
              sysMsg(`${p.nick} 清除了聊天记录`);
            });
            break;
          case "remote_delete":
            dispatch({ type: "REMOVE_MESSAGE", id: p.msgId as string });
            dbDelete(p.msgId as string);
            break;
          case "call_invite":
          case "call_accept":
          case "call_decline":
          case "webrtc":
            // WebRTC handled by useWebRTC hook
            break;
        }
      }
    },
    [sysMsg]
  );

  /* ── Shared: after connect success ── */
  const onConnected = useCallback(
    async (derivedKeyVal: string, roomHashVal: string) => {
      reconCount.current = 0;
      clearTimeout(reconTimer.current);
      dispatch({ type: "SET_SCREEN", screen: "chat" });

      await initDB(roomHashVal);
      const history = await loadHistory(derivedKeyVal);
      if (history.length > 0) {
        const histMsgs: ChatMessage[] = history.map((m) => ({
          id: m.id,
          type: "chat",
          nick: m.nick,
          text: m.text,
          file: m.file as FilePayload | undefined,
          dice: m.dice as number | undefined,
          ad: 0,
          once: false,
          ts: m.ts,
          isMe: !!(m as Record<string, unknown>)._isMe,
          replyTo: m.replyTo as ChatMessage["replyTo"],
        }));
        dispatch({ type: "ADD_MESSAGES", messages: histMsgs });
        sysMsg(`已加载 ${history.length} 条历史`);
      }
      sysMsg("已加入加密聊天室 -- 输入 @ai 使用AI助手");
    },
    [sysMsg]
  );

  const scheduleReconnect = useCallback(
    (derivedKeyVal: string, myNickVal: string, roomHashVal: string) => {
      if (stateRef.current.screen !== "chat") return;
      const n = reconCount.current;
      if (n >= 15) return;
      const delay = Math.min(1000 * Math.pow(1.5, n), 30000);
      reconCount.current = n + 1;
      reconTimer.current = setTimeout(() => {
        connect(derivedKeyVal, myNickVal, roomHashVal);
      }, delay);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /* ── WebSocket connect (when NEXT_PUBLIC_WS_URL is set) ── */
  const connectWS = useCallback(
    (derivedKeyVal: string, myNickVal: string, roomHashVal: string) => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }

      const base = process.env.NEXT_PUBLIC_WS_URL!;
      const wsUrl = `${base}?r=${roomHashVal}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        onConnected(derivedKeyVal, roomHashVal);
        // Ping keepalive
        clearInterval(pingInterval.current);
        pingInterval.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try { ws.send(JSON.stringify({ _ping: Date.now() })); } catch {}
          }
        }, 20000);
      };

      ws.onmessage = (e) => {
        const raw = typeof e.data === "string" ? e.data : "";
        // The WS server wraps messages in {_data, _from} or {_sys}
        handleSSEMessage(raw);
      };

      ws.onerror = () => {};

      ws.onclose = () => {
        clearInterval(pingInterval.current);
        dispatch({ type: "SET_DISCONNECTED" });
        scheduleReconnect(derivedKeyVal, myNickVal, roomHashVal);
      };
    },
    [handleSSEMessage, onConnected, scheduleReconnect]
  );

  /* ── SSE connect (Vercel serverless fallback) ── */
  const connectSSE = useCallback(
    (derivedKeyVal: string, myNickVal: string, roomHashVal: string) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      const sseUrl = `/api/room?r=${roomHashVal}`;
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.onmessage = (e) => {
        handleSSEMessage(e.data);
      };

      es.onopen = async () => {
        await onConnected(derivedKeyVal, roomHashVal);
        // SSE ping via POST
        clearInterval(pingInterval.current);
        pingInterval.current = setInterval(() => {
          if (stateRef.current.connected && clientIdRef.current) {
            fetch("/api/room", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                roomId: roomHashVal,
                clientId: clientIdRef.current,
                data: { _ping: Date.now() },
              }),
            }).catch(() => {});
          }
        }, 20000);
      };

      es.onerror = () => {
        clearInterval(pingInterval.current);
        dispatch({ type: "SET_DISCONNECTED" });
        scheduleReconnect(derivedKeyVal, myNickVal, roomHashVal);
      };
    },
    [handleSSEMessage, onConnected, scheduleReconnect]
  );

  /* ── Unified connect entry point ── */
  const connect = useCallback(
    (derivedKeyVal: string, myNickVal: string, roomHashVal: string) => {
      if (modeRef.current === "ws") {
        connectWS(derivedKeyVal, myNickVal, roomHashVal);
      } else {
        connectSSE(derivedKeyVal, myNickVal, roomHashVal);
      }
    },
    [connectWS, connectSSE]
  );

  const joinRoom = useCallback(
    (nick: string, key: string) => {
      const cleanNick = nick.trim().replace(/[<>'"&]/g, "") || `用户_${Math.floor(Math.random() * 1000)}`;
      if (!key.trim()) return;
      if (key.trim().length < 4) return;
      const salt = getSalt(key);
      const dk = deriveKey(key, salt);
      const rh = getRoomHash(dk);
      dispatch({
        type: "SET_CREDENTIALS",
        myNick: cleanNick,
        roomKey: key,
        derivedKey: dk,
        roomHash: rh,
      });
      dispatch({ type: "SET_CONNECTING", connecting: true });
      // Use setTimeout to ensure state is updated before connecting
      setTimeout(() => connect(dk, cleanNick, rh), 0);
    },
    [connect]
  );

  const exitRoom = useCallback(() => {
    clearTimeout(reconTimer.current);
    clearInterval(pingInterval.current);
    clearTimeout(typingTimer.current);
    if (stateRef.current.autoClearOnExit) {
      clearAllMsgs();
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    clientIdRef.current = "";
    seenNonces.current.clear();
    closeDB();
    dispatch({ type: "RESET" });
  }, []);

  const sendMessage = useCallback(
    (text: string) => {
      const s = stateRef.current;
      if (!s.connected) return;
      if (!text.trim() && !s.pendingFile) return;
      const msg: Record<string, unknown> = {
        type: "chat",
        id: uid(),
        nick: s.myNick,
        text,
        file: s.pendingFile || undefined,
        ad: s.autoDelete,
        once: s.onceReadMode,
        ts: Date.now(),
        replyTo: s.replyTo,
      };
      sendEncrypted(msg);
      const chatMsg: ChatMessage = {
        id: msg.id as string,
        type: "chat",
        nick: s.myNick,
        text,
        file: s.pendingFile || undefined,
        ad: s.autoDelete,
        once: s.onceReadMode,
        ts: msg.ts as number,
        isMe: true,
        replyTo: s.replyTo,
      };
      dispatch({ type: "ADD_MESSAGE", message: chatMsg });
      dbSave({ ...msg, _isMe: true }, s.derivedKey);
      dispatch({ type: "SET_REPLY", reply: null });
      dispatch({ type: "SET_PENDING_FILE", file: null });
      dispatch({ type: "CLOSE_PANELS" });
      if (isTypingRef.current) {
        isTypingRef.current = false;
        sendEncrypted({ type: "typing", active: false });
      }
    },
    [sendEncrypted]
  );

  const sendDice = useCallback(() => {
    const s = stateRef.current;
    if (!s.connected) return;
    const value = Math.floor(Math.random() * 6) + 1;
    const msg: Record<string, unknown> = {
      type: "chat",
      id: uid(),
      nick: s.myNick,
      dice: value,
      text: "",
      ts: Date.now(),
      replyTo: s.replyTo,
    };
    sendEncrypted(msg);
    const chatMsg: ChatMessage = {
      id: msg.id as string,
      type: "chat",
      nick: s.myNick,
      dice: value,
      ts: msg.ts as number,
      isMe: true,
      replyTo: s.replyTo,
    };
    dispatch({ type: "ADD_MESSAGE", message: chatMsg });
    dbSave({ ...msg, _isMe: true }, s.derivedKey);
    dispatch({ type: "SET_REPLY", reply: null });
    dispatch({ type: "CLOSE_PANELS" });
  }, [sendEncrypted]);

  const callAI = useCallback(async (prompt: string): Promise<string> => {
    const sysPrompt = "你是一个高效的AI助手，集成在加密聊天软件GeekChat中。请简洁、准确地回答用户的问题。用户发的消息可能是多种语言，请根据上下文用合适语言回复，通常优先中文。";
    try {
      const resp = await fetch(AI_API_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: prompt },
          ],
          model: "openai",
          private: true,
          seed: Math.floor(Math.random() * 9999),
        }),
      });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const raw = await resp.text();
      if (!raw) throw new Error("Empty response");
      try {
        const j = JSON.parse(raw);
        return j.choices?.[0]?.message?.content || j.text || raw;
      } catch {
        return raw;
      }
    } catch (e) {
      throw e;
    }
  }, []);

  // Privacy lock on visibility change
  useEffect(() => {
    const handler = () => {
      if (
        document.hidden &&
        stateRef.current.screen === "chat" &&
        stateRef.current.privacyLockEnabled
      ) {
        dispatch({ type: "SET_PRIVACY_LOCK", locked: true });
      } else {
        dispatch({ type: "SET_PRIVACY_LOCK", locked: false });
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        state,
        dispatch,
        wsRef,
        sendEncrypted,
        joinRoom,
        exitRoom,
        sendMessage,
        sendDice,
        sysMsg,
        callAI,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
