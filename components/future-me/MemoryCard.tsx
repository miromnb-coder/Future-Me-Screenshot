"use client";

import { InteractiveGlassCard } from "./InteractiveGlassCard";
import type { FutureMeStyles } from "./types";

interface MemoryCardProps {
  styles: FutureMeStyles;
  accent: string;
  memorySummary: string;
  retrievedMemories: string[];
}

export function MemoryCard({
  styles,
  accent,
  memorySummary,
  retrievedMemories,
}: MemoryCardProps) {
  const defaultMemory =
    "You've been thinking about direction, fear of wasting time, and wanting to build something real. You value freedom, growth and honesty with yourself.";

  const memoriesToShow =
    retrievedMemories.length > 0
      ? retrievedMemories
      : [
          "No long-term hits yet.",
          "Add /api/memory/search and /api/memory/ingest for vector memory.",
        ];

  return (
    <InteractiveGlassCard accent={accent} style={styles.memoryCard}>
      <div style={styles.memoryGlow} />
      <div style={styles.memoryHeader}>
        <div style={styles.memoryTitleWrap}>
          <div style={styles.memoryIcon}>Brain</div>
          <div>
            <div style={styles.memoryTitle}>Long-term Memory</div>
            <div style={styles.memoryMeta}>RAG / vector search ready</div>
          </div>
        </div>
        <div style={styles.memoryUpdated}>Updated just now</div>
      </div>

      <div style={styles.memoryQuote}>
        &quot;{memorySummary || defaultMemory}&quot;
      </div>

      <div style={styles.memoryPills}>
        {memoriesToShow.slice(0, 3).map((item, idx) => (
          <span key={`${item}-${idx}`} style={styles.memoryPill}>
            {item}
          </span>
        ))}
      </div>
    </InteractiveGlassCard>
  );
}
