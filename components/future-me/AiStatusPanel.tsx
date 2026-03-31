"use client";

import type { User } from "@supabase/supabase-js";
import { InteractiveGlassCard } from "./InteractiveGlassCard";
import type { FutureMeStyles } from "./types";

interface AiStatusPanelProps {
  styles: FutureMeStyles;
  accent: string;
  hasConversationStarted: boolean;
  loading: boolean;
  memorySummary: string;
  user: User | null;
  isPro: boolean;
}

export function AiStatusPanel({
  styles,
  accent,
  hasConversationStarted,
  loading,
  memorySummary,
  user,
  isPro,
}: AiStatusPanelProps) {
  const liveLabel = loading ? "responding..." : hasConversationStarted ? "online" : "ready";

  return (
    <InteractiveGlassCard accent={accent} style={styles.aiPanel}>
      <div style={styles.aiHeader}>
        <div style={styles.aiHeaderLeft}>
          <div style={styles.avatar}>FM</div>
          <div style={{ minWidth: 0 }}>
            <div style={styles.aiTitle}>Future Me</div>
            <div style={styles.aiSub}>
              {hasConversationStarted ? "Online & remembering" : "Ready to respond"}
            </div>
          </div>
        </div>

        <div style={styles.liveChip}>
          <span style={styles.liveDot} />
          {liveLabel}
        </div>
      </div>

      <div style={styles.aiChips}>
        <span style={styles.aiChip}>memory {memorySummary ? "live" : "empty"}</span>
        <span style={styles.aiChip}>session {user ? "cloud" : "local"}</span>
        <span style={styles.aiChip}>mode {isPro ? "pro" : "free"}</span>
      </div>
    </InteractiveGlassCard>
  );
}
