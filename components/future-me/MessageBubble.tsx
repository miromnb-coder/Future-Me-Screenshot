"use client";

import { motion } from "framer-motion";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { Message } from "@/lib/futureMe";

export function MessageBubble({
  message,
  isUser,
  styles,
  copiedId,
  speakingId,
  onCopy,
  onSpeak,
  onOpenMenu,
  onLongPressStart,
  onLongPressEnd,
}: {
  message: Message;
  isUser: boolean;
  styles: Record<string, CSSProperties>;
  copiedId: string | null;
  speakingId: string | null;
  onCopy: (text: string, id: string) => void;
  onSpeak?: (message: Message) => void;
  onOpenMenu: (message: Message, x: number, y: number) => void;
  onLongPressStart: (message: Message) => (e: ReactPointerEvent<HTMLElement>) => void;
  onLongPressEnd: () => void;
}) {
  const roleStyle = isUser ? { ...styles.messageRole, ...styles.messageRoleMe } : styles.messageRole;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.985 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      style={{
        ...styles.messageRow,
        justifyContent: isUser ? "flex-end" : "flex-start",
        animation: "floatIn 220ms ease both",
      }}
    >
      <article
        onPointerDown={onLongPressStart(message)}
        onPointerUp={onLongPressEnd}
        onPointerCancel={onLongPressEnd}
        onPointerLeave={onLongPressEnd}
        onContextMenu={(e) => {
          e.preventDefault();
          onOpenMenu(message, e.clientX, e.clientY);
        }}
        style={{
          ...styles.messageBubble,
          ...(isUser ? styles.meBubble : styles.futureMeBubble),
        }}
      >
        <div style={styles.messageTop}>
          <span style={roleStyle}>{isUser ? "You" : "Future Me"}</span>

          <div style={{ display: "flex", gap: 6 }}>
            {!isUser && onSpeak ? (
              <button type="button" style={styles.copyButton} onClick={() => onSpeak(message)}>
                {speakingId === message.id ? "Stop" : "🔊"}
              </button>
            ) : null}
            <button type="button" style={styles.copyButton} onClick={() => onCopy(message.text, message.id)}>
              {copiedId === message.id ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div style={styles.messageText}>{message.text}</div>
        <div style={styles.timestamp}>{message.time}</div>
      </article>
    </motion.div>
  );
}
