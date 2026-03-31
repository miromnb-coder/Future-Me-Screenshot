"use client";

import { useRef, type UIEvent } from "react";
import { AnimatePresence } from "framer-motion";
import { InteractiveGlassCard } from "./InteractiveGlassCard";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import type { FutureMeStyles, Message } from "./types";

interface ChatThreadProps {
  styles: FutureMeStyles;
  accent: string;
  isPro: boolean;
  loading: boolean;
  messages: Message[];
  copiedId: string | null;
  speakingId: string | null;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  showScrollBottom: boolean;
  onScroll: (e: UIEvent<HTMLDivElement>) => void;
  onCopy: (text: string, id: string) => void;
  onSpeak: (message: Message) => void;
  onOpenMenu: (message: Message, x: number, y: number) => void;
  onLongPressStart: (message: Message) => (e: React.PointerEvent<HTMLElement>) => void;
  onLongPressEnd: () => void;
  onScrollToBottom: () => void;
}

export function ChatThread({
  styles,
  accent,
  isPro,
  loading,
  messages,
  copiedId,
  speakingId,
  bottomRef,
  showScrollBottom,
  onScroll,
  onCopy,
  onSpeak,
  onOpenMenu,
  onLongPressStart,
  onLongPressEnd,
  onScrollToBottom,
}: ChatThreadProps) {
  const hasConversationStarted = messages.some((m) => m.id !== "welcome");
  const liveLabel = loading ? "responding..." : hasConversationStarted ? "online" : "ready";

  return (
    <InteractiveGlassCard accent={accent} style={styles.threadCard}>
      <div style={styles.threadGlow} />
      <div style={styles.threadHeader}>
        <div style={styles.threadLeft}>
          <div style={styles.avatar}>FM</div>
          <div style={styles.threadText}>
            <div style={styles.threadName}>Future Me</div>
            <div style={styles.threadMeta}>private chat - persistent memory</div>
          </div>
        </div>

        <div style={styles.liveChip}>
          <span style={styles.liveDot} />
          {liveLabel}
        </div>
      </div>

      <div style={styles.threadBody} onScroll={onScroll}>
        <div style={styles.stream}>
          <AnimatePresence initial={false} mode="popLayout">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isUser={message.role === "me"}
                styles={styles}
                copiedId={copiedId}
                speakingId={speakingId}
                onCopy={onCopy}
                onSpeak={onSpeak}
                onOpenMenu={onOpenMenu}
                onLongPressStart={onLongPressStart}
                onLongPressEnd={onLongPressEnd}
              />
            ))}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {loading && <TypingIndicator styles={styles} />}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>
      </div>

      {showScrollBottom && (
        <button style={styles.scrollBottomBtn} onClick={onScrollToBottom}>
          Down
        </button>
      )}
    </InteractiveGlassCard>
  );
}
