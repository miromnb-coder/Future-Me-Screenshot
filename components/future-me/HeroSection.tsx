"use client";

import { motion } from "framer-motion";
import type { RefObject } from "react";
import { hexToRgba } from "@/lib/futureMe";
import { InteractiveGlassCard } from "./InteractiveGlassCard";
import type { FutureMeStyles } from "./types";

interface HeroSectionProps {
  styles: FutureMeStyles;
  accent: string;
  isPro: boolean;
  hasConversationStarted: boolean;
  remainingToday: number;
  memorySummary: string;
  memoryBadge: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onContinueFromYesterday: () => void;
  onOpenMenu: () => void;
}

export function HeroSection({
  styles,
  accent,
  isPro,
  hasConversationStarted,
  remainingToday,
  memorySummary,
  memoryBadge,
  textareaRef,
  onContinueFromYesterday,
  onOpenMenu,
}: HeroSectionProps) {
  if (!hasConversationStarted) {
    return (
      <InteractiveGlassCard accent={accent} style={styles.hero}>
        <div style={styles.heroShine} />
        <div style={styles.heroTop}>
          <span style={styles.badge}>AI Mode Active</span>
          <span style={styles.badgeAccent}>{isPro ? "Pro" : "Pro Mode"}</span>
        </div>

        <div style={styles.heroTitle}>
          Your future self, <br />
          but <span style={{ color: accent, textShadow: `0 0 20px ${hexToRgba(accent, 0.4)}` }}>sharper.</span>
        </div>

        <div style={styles.heroSub}>
          A private space where AI remembers, understands your patterns, and tells you what you need to hear.
        </div>

        <div style={styles.heroMetrics}>
          <div style={styles.metricCard}>
            <div style={styles.metricValue}>{remainingToday}</div>
            <div style={styles.metricLabel}>Messages today</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricValue}>{isPro ? "Unlimited" : "Pro Mode"}</div>
            <div style={styles.metricLabel}>{isPro ? "Unlimited" : "Locked"}</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricValue}>{memorySummary ? "3 days" : "-"}</div>
            <div style={styles.metricLabel}>Memory connected</div>
          </div>
        </div>
      </InteractiveGlassCard>
    );
  }

  return (
    <InteractiveGlassCard accent={accent} style={styles.compactHero}>
      <div style={styles.heroTop}>
        <span style={styles.badge}>Conversation in motion</span>
        <span style={styles.badgeAccent}>{memoryBadge}</span>
      </div>

      <div style={styles.compactTitle}>The thread is alive.</div>
      <div style={styles.compactSub}>
        You are mid-conversation. The next message will fold into memory, sync to cloud when signed in, and
        keep the story moving.
      </div>

      <div style={styles.compactActionRow}>
        {memorySummary ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            style={styles.compactButton}
            onClick={onContinueFromYesterday}
          >
            Continue from yesterday
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            style={styles.compactButton}
            onClick={() => textareaRef.current?.focus()}
          >
            Keep writing
          </motion.button>
        )}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          style={styles.compactGhost}
          onClick={onOpenMenu}
        >
          Open actions
        </motion.button>
      </div>
    </InteractiveGlassCard>
  );
}
