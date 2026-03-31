
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { type Message } from "@/lib/futureMe";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: Message[];
  loading: boolean;
}

export function MessageList({ messages, loading }: MessageListProps) {
  return (
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
  );
}
