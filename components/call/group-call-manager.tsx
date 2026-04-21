"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, X } from "lucide-react";
import { useChatContext } from "@/context/chat-context";
import type { GroupCallBridge } from "@/lib/group-call-bridge";
import { RTC_CONFIG, ICE_TIMEOUT, ICE_MAX_RESTART } from "@/lib/constants";
import { cn } from "@/lib/utils";

type CallKind = "audio" | "video";

function RemoteTile({ id, stream }: { id: string; stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => {});
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      className="h-full max-h-[50vh] w-full rounded-lg bg-black object-cover sm:max-h-none"
    />
  );
}

export function GroupCallManager() {
  const { state, dispatch, sendEncrypted, sysMsg, registerGroupCallBridge, startGroupCallImplRef } =
    useChatContext();

  const rtcCfgRef = useRef<RTCConfiguration>({
    ...RTC_CONFIG,
    iceServers: [...(RTC_CONFIG.iceServers || [])],
  });

  const inCallRef = useRef(false);
  const isPrivateRef = useRef(false);
  const callTypeRef = useRef<CallKind>("audio");
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Record<string, RTCPeerConnection>>({});
  const remoteStreamKeyRef = useRef<Map<string, string>>(new Map());
  const iceRCRef = useRef<Record<string, number>>({});
  const iceTORef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const callStartRef = useRef(0);
  const callTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [phase, setPhase] = useState<"idle" | "incoming" | "outgoing_wait" | "active">("idle");
  const [incoming, setIncoming] = useState<{
    fromId: string;
    nick: string;
    type: CallKind;
    isPrivate: boolean;
  } | null>(null);
  const [remotes, setRemotes] = useState<{ id: string; stream: MediaStream }[]>([]);
  const [callSecs, setCallSecs] = useState(0);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [connectingLabel, setConnectingLabel] = useState("");

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (state.screen !== "chat") return;
    let cancelled = false;
    fetch("/api/turn")
      .then((r) => r.json())
      .then((d: { iceServers?: RTCIceServer[] }) => {
        if (cancelled || !d.iceServers?.length) return;
        const cur = rtcCfgRef.current.iceServers || [];
        rtcCfgRef.current = { ...rtcCfgRef.current, iceServers: [...cur, ...d.iceServers] };
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [state.screen]);

  const stopCallTimer = () => {
    if (callTickRef.current) {
      clearInterval(callTickRef.current);
      callTickRef.current = null;
    }
    callStartRef.current = 0;
    setCallSecs(0);
  };

  const startCallTimer = () => {
    stopCallTimer();
    callStartRef.current = Date.now();
    callTickRef.current = setInterval(() => {
      setCallSecs(Math.floor((Date.now() - callStartRef.current) / 1000));
    }, 1000);
  };

  const hangupLocal = useCallback(() => {
    stopCallTimer();
    Object.values(iceTORef.current).forEach(clearTimeout);
    iceTORef.current = {};
    for (const id of Object.keys(pcsRef.current)) {
      try {
        pcsRef.current[id].close();
      } catch {
        /* ignore */
      }
    }
    pcsRef.current = {};
    remoteStreamKeyRef.current.clear();
    iceRCRef.current = {};
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    inCallRef.current = false;
    isPrivateRef.current = false;
    setRemotes([]);
    setPhase("idle");
    setIncoming(null);
    setConnectingLabel("");
    setMuted(false);
    setCamOff(false);
    dispatch({ type: "SET_CALL", inCall: false });
    dispatch({ type: "SET_CALL_MINI", mini: false });
  }, [dispatch]);

  const sendRtc = useCallback(
    (target: string, signal: Record<string, unknown>) => {
      sendEncrypted({ type: "webrtc", signal, target });
    },
    [sendEncrypted]
  );

  const checkCallEnd = useCallback(() => {
    if (!Object.keys(pcsRef.current).length && inCallRef.current) {
      sysMsg("通话已结束");
      hangupLocal();
    }
  }, [hangupLocal, sysMsg]);

  const removeRemote = useCallback(
    (uid: string) => {
      remoteStreamKeyRef.current.delete(uid);
      setRemotes((prev) => prev.filter((r) => r.id !== uid));
      const pc = pcsRef.current[uid];
      if (pc) {
        try {
          pc.close();
        } catch {
          /* ignore */
        }
        delete pcsRef.current[uid];
      }
      checkCallEnd();
    },
    [checkCallEnd]
  );

  const iceRestartRef = useRef<(tid: string, pc: RTCPeerConnection) => Promise<void>>(async () => {});

  const getPC = useCallback(
    (tid: string): RTCPeerConnection => {
      let pc = pcsRef.current[tid];
      if (pc) return pc;
      pc = new RTCPeerConnection(rtcCfgRef.current);
      pcsRef.current[tid] = pc;
      iceRCRef.current[tid] = 0;

      const stream = localStreamRef.current;
      if (stream) stream.getTracks().forEach((t) => pc!.addTrack(t, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) sendRtc(tid, { type: "ice", candidate: e.candidate });
      };

      pc.ontrack = (e) => {
        if (!e.streams?.length) return;
        const s = e.streams[0];
        const prev = remoteStreamKeyRef.current.get(tid);
        if (prev === s.id) return;
        remoteStreamKeyRef.current.set(tid, s.id);
        setRemotes((prevList) => {
          const others = prevList.filter((r) => r.id !== tid);
          return [...others, { id: tid, stream: s }];
        });
        setConnectingLabel("");
        if (!callStartRef.current) startCallTimer();
      };

      pc.oniceconnectionstatechange = () => {
        const st = pc!.iceConnectionState;
        if (st === "checking") setConnectingLabel("连接中…");
        else if (st === "connected" || st === "completed") {
          setConnectingLabel("");
          clearTimeout(iceTORef.current[tid]);
        } else if (st === "disconnected") {
          setConnectingLabel("网络不稳定…");
          clearTimeout(iceTORef.current[tid]);
          iceTORef.current[tid] = setTimeout(() => {
            if (pc!.iceConnectionState === "disconnected") void iceRestartRef.current(tid, pc!);
          }, 3000);
        } else if (st === "failed") {
          void iceRestartRef.current(tid, pc!);
        } else if (st === "closed") {
          removeRemote(tid);
        }
      };

      iceTORef.current[tid] = setTimeout(() => {
        if (pc!.iceConnectionState !== "connected" && pc!.iceConnectionState !== "completed") {
          void iceRestartRef.current(tid, pc!);
        }
      }, ICE_TIMEOUT);

      return pc;
    },
    [removeRemote, sendRtc]
  );

  const iceRestart = useCallback(
    async (tid: string, pc: RTCPeerConnection) => {
      const n = (iceRCRef.current[tid] || 0) + 1;
      iceRCRef.current[tid] = n;
      console.log("[v0] ICE restart attempt", n, "for peer", tid);
      if (n > ICE_MAX_RESTART) {
        console.log("[v0] ICE restart limit reached, removing peer", tid);
        sysMsg("网络连接失败，请检查网络后重试");
        removeRemote(tid);
        return;
      }
      setConnectingLabel(`重连(${n}/${ICE_MAX_RESTART})…`);
      try {
        const o = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(o);
        sendRtc(tid, { type: "offer", sdp: o });
      } catch (err) {
        console.log("[v0] ICE restart failed:", err);
        sysMsg("连接对方失败，请稍后重试");
        removeRemote(tid);
      }
    },
    [removeRemote, sendRtc, sysMsg]
  );
  iceRestartRef.current = iceRestart;

  const handleRTC = useCallback(
    async (sid: string, sig: Record<string, unknown>) => {
      if (!inCallRef.current || !localStreamRef.current) {
        console.log("[v0] handleRTC ignored: not in call or no local stream");
        return;
      }
      console.log("[v0] handleRTC from", sid, "type:", sig.type);
      const pc = getPC(sid);
      try {
        if (sig.type === "offer") {
          const sdp = sig.sdp as RTCSessionDescriptionInit;
          if (pc.signalingState === "have-local-offer") {
            const myId = stateRef.current.myId;
            if (myId < sid) {
              console.log("[v0] Collision: rolling back local offer");
              await pc.setLocalDescription({ type: "rollback" });
            } else {
              console.log("[v0] Collision: ignoring remote offer (we win)");
              return;
            }
          }
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendRtc(sid, { type: "answer", sdp: answer });
          console.log("[v0] Sent answer to", sid);
        } else if (sig.type === "answer") {
          const sdp = sig.sdp as RTCSessionDescriptionInit;
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            console.log("[v0] Set remote answer from", sid);
          }
        } else if (sig.type === "ice" && sig.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(sig.candidate as RTCIceCandidateInit));
        }
      } catch (e) {
        console.warn("[v0] RTC error:", e);
        sysMsg("连接出现问题，正在尝试重连…");
      }
    },
    [getPC, sendRtc, sysMsg]
  );

  const makeOffer = useCallback(
    async (tid: string) => {
      if (!inCallRef.current || !localStreamRef.current) return;
      const pc = getPC(tid);
      try {
        const o = await pc.createOffer();
        await pc.setLocalDescription(o);
        sendRtc(tid, { type: "offer", sdp: o });
      } catch (e) {
        console.warn("offer:", e);
      }
    },
    [getPC, sendRtc]
  );

  const startMedia = async (type: CallKind) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video:
        type === "video"
          ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
          : false,
    });
    localStreamRef.current = stream;
    return stream;
  };

  const startGroupCall = useCallback(
    async (type: CallKind) => {
      const s = stateRef.current;
      if (!s.connected) {
        sysMsg("未连接，请稍后再试");
        return;
      }
      // Allow starting call even with 0 members - they may join later
      // or the invite will be sent when members join
      try {
        await startMedia(type);
      } catch (err) {
        console.log("[v0] Media access error:", err);
        sysMsg("无法获取麦克风或摄像头权限，请检查浏览器设置");
        return;
      }
      inCallRef.current = true;
      isPrivateRef.current = false;
      callTypeRef.current = type;
      dispatch({ type: "SET_CALL", inCall: true, callType: type, isPrivate: false });
      sendEncrypted({ type: "call_invite", nick: s.myNick, callType: type });
      setPhase("outgoing_wait");
      const memberCount = Object.keys(s.members).length;
      if (memberCount === 0) {
        sysMsg(`已发起${type === "video" ? "群视频" : "群语音"}通话，等待其他成员加入房间…`);
      } else {
        sysMsg(`已发起${type === "video" ? "群视频" : "群语音"}通话，等待对方接听…`);
      }
    },
    [dispatch, sendEncrypted, sysMsg]
  );

  useEffect(() => {
    startGroupCallImplRef.current = startGroupCall;
    return () => {
      startGroupCallImplRef.current = null;
    };
  }, [startGroupCall, startGroupCallImplRef]);

  const implRef = useRef({
    onCallInvite(fromId: string, p: Record<string, unknown>) {},
    onCallAccept(fromId: string, _p: Record<string, unknown>) {},
    onCallDecline(fromId: string) {},
    onWebRTC(fromId: string, p: Record<string, unknown>) {},
    onMemberJoined(fromId: string) {},
    onPeerLeft(fromId: string) {},
    reset() {},
  });

  implRef.current.onCallInvite = (fromId, p) => {
    const nick = (p.nick as string) || "对方";
    const ct = (p.callType as CallKind) || "audio";
    const privateTo = p.privateTo as string | undefined;
    const isPrivate = !!privateTo && privateTo === stateRef.current.myId;
    console.log("[v0] Received call invite from:", nick, "type:", ct, "isPrivate:", isPrivate);
    if (inCallRef.current) {
      console.log("[v0] Already in call, declining");
      sendEncrypted({ type: "call_decline", nick: stateRef.current.myNick });
      sysMsg(`${nick} 发起了${ct === "video" ? "视频" : "语音"}通话，但您正在通话中`);
      return;
    }
    sysMsg(`${nick} 发起了${isPrivate ? "私密" : "群"}${ct === "video" ? "视频" : "语音"}通话邀请`);
    setIncoming({ fromId, nick, type: ct, isPrivate });
    setPhase("incoming");
  };

  implRef.current.onCallAccept = (fromId) => {
    console.log("[v0] Call accepted by", fromId);
    if (!inCallRef.current) {
      console.log("[v0] Not in call, ignoring accept");
      return;
    }
    const peerNick = stateRef.current.members[fromId] || "对方";
    sysMsg(`${peerNick} 已接听`);
    setPhase("active");
    setConnectingLabel("正在建立连接…");
    setTimeout(() => void makeOffer(fromId), 300);
  };

  implRef.current.onCallDecline = (fromId) => {
    console.log("[v0] Call declined by", fromId);
    const name = stateRef.current.members[fromId] || "对方";
    sysMsg(`${name} 拒绝了通话`);
    // If no active peer connections, end the call
    if (!Object.keys(pcsRef.current).length) {
      console.log("[v0] No active connections, ending call");
      hangupLocal();
    }
  };

  implRef.current.onWebRTC = (fromId, p) => {
    if (!inCallRef.current) return;
    const target = p.target as string | undefined;
    if (target && target !== stateRef.current.myId) return;
    const signal = p.signal as Record<string, unknown>;
    if (signal) void handleRTC(fromId, signal);
  };

  implRef.current.onMemberJoined = (sid) => {
    console.log("[v0] Member joined while in call:", sid);
    if (!inCallRef.current || isPrivateRef.current || !localStreamRef.current) {
      console.log("[v0] Not inviting member - not in call or private call");
      return;
    }
    // Send call invite to the new member
    const s = stateRef.current;
    sendEncrypted({ type: "call_invite", nick: s.myNick, callType: callTypeRef.current });
    console.log("[v0] Sent call invite to new member");
    setTimeout(() => void makeOffer(sid), 800);
  };

  implRef.current.onPeerLeft = (sid) => {
    removeRemote(sid);
  };

  implRef.current.reset = () => {
    hangupLocal();
  };

  const bridgeStub = useMemo<GroupCallBridge>(
    () => ({
      onCallInvite: (a, b) => implRef.current.onCallInvite(a, b),
      onCallAccept: (a, b) => implRef.current.onCallAccept(a, b),
      onCallDecline: (a) => implRef.current.onCallDecline(a),
      onWebRTC: (a, b) => implRef.current.onWebRTC(a, b),
      onMemberJoined: (a) => implRef.current.onMemberJoined(a),
      onPeerLeft: (a) => implRef.current.onPeerLeft(a),
      reset: () => implRef.current.reset(),
    }),
    []
  );

  useEffect(() => {
    registerGroupCallBridge(bridgeStub);
    return () => registerGroupCallBridge(null);
  }, [registerGroupCallBridge, bridgeStub]);

  const acceptIncoming = async () => {
    if (!incoming) return;
    try {
      const stream = await startMedia(incoming.type);
      if (incoming.type === "video" && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch {
      sysMsg("无法获取麦克风或摄像头权限");
      setIncoming(null);
      setPhase("idle");
      sendEncrypted({ type: "call_decline", nick: stateRef.current.myNick });
      return;
    }
    inCallRef.current = true;
    isPrivateRef.current = incoming.isPrivate;
    callTypeRef.current = incoming.type;
    dispatch({
      type: "SET_CALL",
      inCall: true,
      callType: incoming.type,
      isPrivate: incoming.isPrivate,
    });
    sendEncrypted({
      type: "call_accept",
      nick: stateRef.current.myNick,
      callType: incoming.type,
    });
    setIncoming(null);
    setPhase("active");
    setConnectingLabel("连接中…");
  };

  const declineIncoming = () => {
    sendEncrypted({ type: "call_decline", nick: stateRef.current.myNick });
    setIncoming(null);
    setPhase("idle");
  };

  const formatDur = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const toggleMic = () => {
    const t = localStreamRef.current?.getAudioTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    setMuted(!t.enabled);
  };

  const toggleCam = () => {
    const t = localStreamRef.current?.getVideoTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    setCamOff(!t.enabled);
  };

  useEffect(() => {
    if (callTypeRef.current === "video" && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [phase, remotes.length]);

  if (phase === "idle") return null;

  if (phase === "incoming" && incoming) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/95 backdrop-blur-xl">
        <div className="flex flex-col items-center px-6">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
            {incoming.type === "video" ? (
              <Video className="h-10 w-10 text-primary" />
            ) : (
              <Phone className="h-10 w-10 text-primary" />
            )}
          </div>
          <p className="mb-1 text-xl font-semibold">{incoming.nick}</p>
          <p className="mb-8 text-sm text-muted-foreground">
            {incoming.isPrivate ? "私密" : "群"}
            {incoming.type === "video" ? "视频" : "语音"}通话邀请
          </p>
          <div className="flex gap-6">
            <button
              type="button"
              onClick={declineIncoming}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive text-white shadow-lg"
            >
              <X className="h-7 w-7" />
            </button>
            <button
              type="button"
              onClick={() => void acceptIncoming()}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
            >
              {incoming.type === "video" ? (
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

  const isVideo = callTypeRef.current === "video";
  const showWait = phase === "outgoing_wait" && remotes.length === 0;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      {isVideo ? (
        <div className="relative flex-1 bg-zinc-900">
          <div className="grid h-full w-full grid-cols-1 gap-1 p-1 sm:grid-cols-2">
            {remotes.map((r) => (
              <RemoteTile key={r.id} id={r.id} stream={r.stream} />
            ))}
            {!remotes.length && (
              <div className="flex flex-col items-center justify-center text-muted-foreground">
                <Video className="mb-2 h-12 w-12 opacity-40" />
                <p>{showWait ? "等待对方接听…" : connectingLabel || "等待画面…"}</p>
              </div>
            )}
          </div>
          <div className="absolute right-4 top-4 h-28 w-20 overflow-hidden rounded-xl border border-border bg-zinc-800 shadow-lg">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={cn("h-full w-full object-cover", camOff && "hidden")}
            />
            {camOff && (
              <div className="flex h-full items-center justify-center">
                <VideoOff className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-gradient-to-b from-card to-background px-4">
          <Phone className="h-14 w-14 text-primary" />
          <p className="text-lg font-medium">
            {showWait ? "等待对方接听…" : connectingLabel || `通话中 ${formatDur(callSecs)}`}
          </p>
          <p className="text-xs text-muted-foreground">已连接 {remotes.length + 1} 方</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-4 border-t border-border bg-card px-6 py-5">
        <button
          type="button"
          onClick={toggleMic}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full bg-secondary",
            muted && "bg-destructive/20 text-destructive"
          )}
        >
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
        {isVideo && (
          <button
            type="button"
            onClick={toggleCam}
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full bg-secondary",
              camOff && "bg-destructive/20 text-destructive"
            )}
          >
            {camOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => hangupLocal()}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive text-white shadow-lg"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
