"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MessageBubble } from "./MessageBubble";
import { Composer } from "./Composer";

import {
  type Message,
  type Mood,
} from "@/lib/futureMe";

interface ChatViewProps {
  messages: Message[];
  loading: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  mood: Mood;
}

export function ChatView({
  messages,
  loading,
  input,
  onInputChange,
  onSendMessage,
  mood,
}: ChatViewProps) {
  const hasConversationStarted = messages.length > 1;

  return (
    <motion.div
      key="chat"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.22 }}
      className="grid gap-3.5"
    >
      {!hasConversationStarted ? (
        <div className="p-10 text-center text-white/50 border border-white/10 rounded-3xl bg-white/5">
          <h2 className="text-xl font-bold text-white mb-2">Future-Me Screenshot</h2>
          <p>Kirjoita URL-osoite alas aloittaaksesi.</p>
        </div>
      ) : (
        <div className="grid gap-3.5">
          <div className="flex flex-wrap gap-2.5 px-1">
          </div>
        </div>
      )}

      <div className="flex flex-col rounded-[34px] bg-white/5 border border-white/10 shadow-2xl overflow-hidden backdrop-blur-2xl min-h-[400px] md:min-h-[560px] max-h-[600px] relative transition-all">
        <div className="flex-1 min-h-0 flex flex-col p-3.5 md:p-5 relative z-10 overflow-y-auto">
          <div className="flex flex-col gap-4 pb-1">
            <AnimatePresence initial={false} mode="popLayout">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isUser={message.role === "me"}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <Composer
        input={input}
        onInputChange={onInputChange}
        onSendMessage={onSendMessage}
        mood={mood}
        loading={loading}
      />
    </motion.div>
  );
}
