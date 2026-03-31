
"use client";

import { useFutureMe } from "@/hooks/useFutureMe";
import { TopBar } from "@/components/future-me/TopBar";
import { ChatView } from "@/components/future-me/ChatView";
import { InsightsView } from "@/components/future-me/InsightsView";

export default function FutureMeClient() {
  const {
    messages,
    input,
    mood,
    loading,
    isPro,
    user,
    activeTab,
    remainingToday,
    setInput,
    sendMessage,
    setActiveTab,
  } = useFutureMe();

  return (
    <main className="min-h-screen h-auto overflow-y-auto overflow-x-hidden webkit-overflow-scrolling-touch p-4 md:p-6 bg-gradient-to-br from-gray-900 to-slate-800 text-white font-sans relative">
      <div className="fixed inset-0 pointer-events-none z-0 opacity-5 mix-blend-soft-light bg-noise" />
      <div className="fixed inset-[12%_auto_auto_-12%] w-[420px] h-[420px] rounded-full bg-accent/10 blur-3xl pointer-events-none z-0" />
      <div className="fixed inset-[auto_-12%_-14%_auto] w-[540px] h-[540px] rounded-full bg-white/10 blur-4xl pointer-events-none z-0" />

      <div className="min-h-screen h-auto max-w-5xl mx-auto flex flex-col gap-3.5 pb-6 relative z-10">
        <TopBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onMenuOpen={() => {}}
          userLabel={user ? "synced cloud memory" : "guest mode · local memory"}
          isPro={isPro}
        />

        {activeTab === "chat" ? (
          <ChatView
            messages={messages}
            loading={loading}
            input={input}
            onInputChange={setInput}
            onSendMessage={sendMessage}
            mood={mood}
          />
        ) : (
          <InsightsView />
        )}
      </div>
    </main>
  );
}
