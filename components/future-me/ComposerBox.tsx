"use client";

import type { ChangeEvent, KeyboardEvent, RefObject } from "react";
import { motion } from "framer-motion";
import { hexToRgba, moodLabels, moodPlaceholders, type Mood } from "@/lib/futureMe";
import { InteractiveGlassCard } from "./InteractiveGlassCard";
import type { FutureMeStyles } from "./types";

interface ComposerBoxProps {
  styles: FutureMeStyles;
  accent: string;
  mood: Mood;
  input: string;
  loading: boolean;
  isPro: boolean;
  remainingToday: number;
  memoryBadge: string;
  voiceListening: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onVoiceToggle: () => void;
}

export function ComposerBox({
  styles,
  accent,
  mood,
  input,
  loading,
  isPro,
  remainingToday,
  memoryBadge,
  voiceListening,
  textareaRef,
  onInputChange,
  onKeyDown,
  onSend,
  onVoiceToggle,
}: ComposerBoxProps) {
  const composerPlaceholder = moodPlaceholders[mood];

  return (
    <InteractiveGlassCard accent={accent} style={styles.composerShell}>
      <div style={styles.composerTop}>
        <span style={styles.composerChip}>{moodLabels[mood]} mode</span>
        <span style={styles.composerChip}>{memoryBadge}</span>
      </div>

      <div style={styles.composerRow}>
        <textarea
          ref={textareaRef}
          style={{
            ...styles.composerTextarea,
            boxShadow: `inset 0 2px 4px rgba(0,0,0,0.2), 0 0 0 1px ${hexToRgba(accent, 0.02)}`,
          }}
          value={input}
          onChange={onInputChange}
          onKeyDown={onKeyDown}
          placeholder={composerPlaceholder}
          rows={1}
        />

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          style={styles.micButton}
          onClick={onVoiceToggle}
          disabled={loading}
        >
          {voiceListening ? "Stop" : "Mic"}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          style={styles.sendButton}
          onClick={onSend}
          disabled={loading}
        >
          {loading ? "Thinking..." : "Send"}
        </motion.button>
      </div>

      <div style={styles.helper}>
        Press Enter to send - Shift+Enter for a new line -{" "}
        {isPro ? "Pro memory active" : `${remainingToday} free messages left today`}
      </div>

      <div style={styles.voiceHint}>
        Haptics fires on send and mood changes. Voice input uses the browser speech engine when available.
      </div>
    </InteractiveGlassCard>
  );
}
