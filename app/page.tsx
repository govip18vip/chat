"use client";

import { ChatProvider, useChatContext } from "@/context/chat-context";
import { LoginScreen } from "@/components/chat/login-screen";
import { ChatScreen } from "@/components/chat/chat-screen";
import { PrivacyLock } from "@/components/chat/privacy-lock";

function AppContent() {
  const { state } = useChatContext();

  return (
    <div className="relative h-dvh overflow-hidden bg-background">
      {state.screen === "login" && <LoginScreen />}
      {state.screen === "chat" && <ChatScreen />}
      {state.privacyLock && <PrivacyLock />}
    </div>
  );
}

export default function HomePage() {
  return (
    <ChatProvider>
      <AppContent />
    </ChatProvider>
  );
}
