"use client";

import { motion } from "framer-motion";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { Message } from "@/lib/futureMe";

export function MessageBubble({
  message,
  isUser,
  styles = {}, // Lisätty oletusarvo, ettei se ole undefined
  copiedId = null,
  speakingId = null,
  onCopy = () => {},
  onSpeak,
  onOpenMenu = () => {},
  onLongPressStart = () => () => {},
  onLongPressEnd = () => {},
}: {
  message: Message;
  isUser: boolean;
  styles?: Record<string, CSSProperties>;
  copiedId?: string | null;
  speakingId?: string | null;
  onCopy?: (text: string, id: string) => void;
  onSpeak?: (message: Message) => void;
  onOpenMenu?: (message: Message, x: number, y: number) => void;
  onLongPressStart?: (message: Message) => (e: ReactPointerEvent<HTMLElement>) => void;
  onLongPressEnd?: () => void;
}) {
  // Käytetään optional chainingia (?.) tyyleissä
  const roleStyle = isUser 
    ? { ...(styles?.messageRole || {}), ...(styles?.messageRoleMe || {}) } 
    : (styles?.messageRole || {});

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.985 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      style={{
        ...(styles?.messageRow || {}),
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      <article
        onPointerDown={onLongPressStart?.(message)}
        onPointerUp={onLongPressEnd}
        onPointerCancel={onLongPressEnd}
        onPointerLeave={onLongPressEnd}
        onContextMenu={(e) => {
          e.preventDefault();
          onOpenMenu?.(message, e.clientX, e.clientY);
        }}
        className={`p-4 rounded-3xl max-w-[85%] ${
          isUser ? "bg-blue-600 text-white" : "bg-white/10 text-white border border-white/10"
        }`}
        style={{
          ...(styles?.messageBubble || {}),
          ...(isUser ? (styles?.meBubble || {}) : (styles?.futureMeBubble || {})),
        }}
      >
        <div className="flex justify-between items-center gap-4 mb-1">
          <span className="text-xs font-bold opacity-50" style={roleStyle}>
            {isUser ? "Sinä" : "Future Me"}
          </span>

          <div className="flex gap-2">
            {!isUser && onSpeak && (
              <button className="text-xs opacity-50 hover:opacity-100" onClick={() => onSpeak(message)}>
                {speakingId === message.id ? "Stop" : "🔊"}
              </button>
            )}
            <button className="text-xs opacity-50 hover:opacity-100" onClick={() => onCopy(message.text, message.id)}>
              {copiedId === message.id ? "Kopioitu" : "Kopioi"}
            </button>
          </div>
        </div>

        <div className="text-sm leading-relaxed">{message.text}</div>
        <div className="text-[10px] opacity-30 mt-2 text-right">{message.time}</div>
      </article>
    </motion.div>
  );
}
