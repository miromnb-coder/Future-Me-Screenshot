
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MessageBubble } from "./MessageBubble";
import { Composer } from "./Composer";
import WelcomeScreen from './WelcomeScreen';

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
        <WelcomeScreen />
      ) : (
        <div className="grid gap-3.5">
          <div className="flex flex-wrap gap-2.5 px-1">
            {/* TODO: Add status pills */}
          </div>
          <div className="grid gap-3.5">
            {/* TODO: Add memory card */}
          </div>
        </div>
      )}

      <div className="grid gap-3.5">
        <div className="grid gap-2.5 px-1">
          {/* TODO: Mood selector */}
        </div>
      </div>

      <div className="rounded-[26px] bg-glass border border-white/10 shadow-lg backdrop-blur-xl grid gap-3.5 transition-all">
        {/* TODO: AI panel */}
      </div>

      <div className="flex flex-col rounded-[34px] bg-thread-glass border border-white/10 shadow-2xl overflow-hidden backdrop-blur-2xl min-h-[400px] md:min-h-[560px] max-h-[600px] relative transition-all">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-white/5 bg-white/5 backdrop-blur-sm relative z-10">
          {/* TODO: Thread header */}
        </div>
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
            <AnimatePresence initial={false}>
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex justify-start"
                >
                  <div className="px-4 py-3.5 rounded-3xl bg-white/5 text-white/60 text-sm border border-white/5 animate-pulse">
                    <span className="inline-flex gap-1.5 items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 animation-delay-100" />
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 animation-delay-200" />
                    </span>{" "}
                    typing...
                  </div>
                </motion.div>
              )}
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
