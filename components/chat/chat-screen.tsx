"use client";

import { useChatContext } from "@/context/chat-context";
import { ChatHeader } from "./chat-header";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { SettingsPanel } from "@/components/panels/settings-panel";
import { MembersPanel } from "@/components/panels/members-panel";
import { SearchPanel } from "@/components/panels/search-panel";
import { QRModal } from "@/components/panels/qr-modal";
import { AIPanel } from "@/components/panels/ai-panel";
import { PMPanel } from "@/components/panels/pm-panel";
import { SchedulePicker } from "@/components/panels/schedule-picker";
import { VoiceEffectPicker } from "@/components/panels/voice-effect-picker";
import { LightboxPanel } from "@/components/panels/lightbox-panel";

export function ChatScreen() {
  const { state, dispatch } = useChatContext();
  const panel = state.activePanel;

  return (
    <div className="flex h-dvh flex-col bg-background">
      <ChatHeader />
      <MessageList />
      <MessageInput />

      {/* Panels */}
      {panel === "settings" && (
        <SettingsPanel onClose={() => dispatch({ type: "SET_ACTIVE_PANEL", panel: null })} />
      )}
      {panel === "members" && (
        <MembersPanel onClose={() => dispatch({ type: "SET_ACTIVE_PANEL", panel: null })} />
      )}
      {panel === "search" && (
        <SearchPanel onClose={() => dispatch({ type: "SET_ACTIVE_PANEL", panel: null })} />
      )}
      {panel === "qr" && (
        <QRModal onClose={() => dispatch({ type: "SET_ACTIVE_PANEL", panel: null })} />
      )}
      {panel === "ai" && (
        <AIPanel onClose={() => dispatch({ type: "SET_ACTIVE_PANEL", panel: null })} />
      )}
      {panel === "pm" && (
        <PMPanel onClose={() => dispatch({ type: "SET_ACTIVE_PANEL", panel: null })} />
      )}
      {panel === "schedule" && (
        <SchedulePicker onClose={() => dispatch({ type: "SET_ACTIVE_PANEL", panel: null })} />
      )}
      {panel === "voice-effect" && (
        <VoiceEffectPicker onClose={() => dispatch({ type: "SET_ACTIVE_PANEL", panel: null })} />
      )}
      {panel === "lightbox" && (
        <LightboxPanel onClose={() => dispatch({ type: "SET_ACTIVE_PANEL", panel: null })} />
      )}
    </div>
  );
}
