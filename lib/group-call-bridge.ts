/** 由 GroupCallManager 注册，chat-context 在解密后转发通话 / WebRTC 信令 */
export interface GroupCallBridge {
  onCallInvite(fromId: string, payload: Record<string, unknown>): void;
  onCallAccept(fromId: string, payload: Record<string, unknown>): void;
  onCallDecline(fromId: string): void;
  onWebRTC(fromId: string, payload: Record<string, unknown>): void;
  onMemberJoined(fromId: string): void;
  onPeerLeft(fromId: string): void;
  reset(): void;
}
