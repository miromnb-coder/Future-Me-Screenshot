"use client";

import { motion } from "framer-motion";
import { hexToRgba, type Mood } from "@/lib/futureMe";
import { InteractiveGlassCard } from "./InteractiveGlassCard";
import type { FutureMeStyles } from "./types";

interface Insights {
  weeklyActivity: number[];
  totalUserMessages: number;
  avgLength: number;
  dominantTone: string;
  topThemes: { label: string; count: number }[];
  moodTrend: Record<Mood, number[]>;
}

interface InsightsViewProps {
  styles: FutureMeStyles;
  accent: string;
  mood: Mood;
  insights: Insights;
  retrievedMemories: string[];
}

const accentMap: Record<Mood, string> = {
  calm: "#60a5fa",
  honest: "#fb923c",
  direct: "#34d399",
  wise: "#a78bfa",
};

export function InsightsView({
  styles,
  accent,
  mood,
  insights,
  retrievedMemories,
}: InsightsViewProps) {
  return (
    <motion.div
      key="insights"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.22 }}
      style={{ display: "grid", gap: 14 }}
    >
      <InteractiveGlassCard accent={accent} style={styles.hero}>
        <div style={styles.heroTop}>
          <span style={styles.badge}>Insights mode</span>
          <span style={styles.badgeAccent}>patterns from your chats</span>
        </div>

        <div style={styles.heroTitle}>
          Your thoughts,
          <br />
          mapped into{" "}
          <span style={{ color: accent, textShadow: `0 0 20px ${hexToRgba(accent, 0.4)}` }}>
            patterns.
          </span>
        </div>

        <div style={styles.heroSub}>
          This view turns your conversation history into something you can actually read at a glance: recurring
          themes, activity over the week, and the emotional shape of the thread.
        </div>
      </InteractiveGlassCard>

      <div style={styles.insightsGrid}>
        <InteractiveGlassCard accent={accent} style={styles.insightCard}>
          <div style={styles.insightTitle}>Week Activity</div>
          <div style={styles.insightSub}>Messages per day across the last 7 days.</div>

          <div style={styles.sparkWrap}>
            <div style={styles.sparkBars}>
              {insights.weeklyActivity.map((value, index) => {
                const max = Math.max(1, ...insights.weeklyActivity);
                const height = `${Math.max(12, (value / max) * 100)}%`;
                return (
                  <div key={index} style={styles.sparkBar}>
                    <div style={{ ...styles.sparkFill, height }} />
                  </div>
                );
              })}
            </div>
            <div style={styles.sparkLabelRow}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
          </div>
        </InteractiveGlassCard>

        <InteractiveGlassCard accent={accent} style={styles.insightCard}>
          <div style={styles.insightTitle}>Snapshot</div>
          <div style={styles.insightSub}>A quick summary of the thread shape right now.</div>

          <div style={styles.miniCards}>
            <div style={styles.miniCard}>
              <div style={styles.miniValue}>{insights.totalUserMessages}</div>
              <div style={styles.miniLabel}>User messages</div>
            </div>
            <div style={styles.miniCard}>
              <div style={styles.miniValue}>{insights.avgLength}</div>
              <div style={styles.miniLabel}>Avg. length</div>
            </div>
            <div style={styles.miniCard}>
              <div style={styles.miniValue}>{insights.dominantTone}</div>
              <div style={styles.miniLabel}>Dominant tone</div>
            </div>
            <div style={styles.miniCard}>
              <div style={styles.miniValue}>{retrievedMemories.length}</div>
              <div style={styles.miniLabel}>RAG memories</div>
            </div>
          </div>

          <div style={styles.voiceHint}>
            If you add pgvector + embeddings, this panel can surface actual long-term memory matches instead of
            only the local fallback.
          </div>
        </InteractiveGlassCard>
      </div>

      <InteractiveGlassCard accent={accent} style={styles.insightCard}>
        <div style={styles.insightTitle}>Mood Trend</div>
        <div style={styles.insightSub}>How the AI modes matched your thoughts over the last 7 days.</div>

        <div style={{ position: "relative", height: 160, marginTop: 20, width: "100%" }}>
          <svg width="100%" height="100%" viewBox="0 0 700 160" preserveAspectRatio="none">
            {(Object.keys(insights.moodTrend) as Mood[]).map((mKey) => {
              const data = insights.moodTrend[mKey];
              const maxVal = Math.max(1, ...Object.values(insights.moodTrend).flat());
              const points = data
                .map((val, i) => {
                  const x = (i / 6) * 700;
                  const y = 160 - (val / maxVal) * 140;
                  return `${x},${y}`;
                })
                .join(" L ");

              return (
                <path
                  key={mKey}
                  d={`M ${points}`}
                  fill="none"
                  stroke={accentMap[mKey]}
                  strokeWidth={mKey === mood ? 4 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={mKey === mood ? 1 : 0.3}
                  style={{ transition: "all 0.4s ease" }}
                />
              );
            })}
          </svg>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 8,
              fontSize: 11,
              color: "rgba(255,255,255,0.62)",
            }}
          >
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
            <span>Sun</span>
          </div>
        </div>
      </InteractiveGlassCard>

      <InteractiveGlassCard accent={accent} style={styles.memoryJourney}>
        <div style={styles.insightTitle}>Journey</div>
        <div style={styles.insightSub}>A growing path that reflects repeated conversations and consistency.</div>

        <div style={styles.journeyTrack}>
          <div style={styles.journeyGlow} />
          <div style={styles.journeyPath} />
          {insights.weeklyActivity.map((count, index) => {
            const left = 12 + index * 13.5;
            const top = 60 + Math.max(0, 4 - count) * 12;
            return (
              <motion.div
                key={index}
                style={{
                  ...styles.journeyNode,
                  left: `${left}%`,
                  top: `${top}%`,
                  transform: `scale(${0.8 + Math.min(count, 6) * 0.08})`,
                  opacity: count > 0 ? 1 : 0.35,
                }}
                animate={{
                  y: [0, -2, 0],
                }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: index * 0.15,
                }}
              />
            );
          })}
        </div>
      </InteractiveGlassCard>

      <InteractiveGlassCard accent={accent} style={styles.insightCard}>
        <div style={styles.insightTitle}>Recurring themes</div>
        <div style={styles.insightSub}>Interactive word cloud based on frequency.</div>

        <div style={styles.themeBubbleContainer}>
          {(insights.topThemes.length > 0
            ? insights.topThemes
            : [{ label: "No clear themes yet", count: 1 }]
          ).map((item) => {
            const max = Math.max(1, ...insights.topThemes.map((t) => t.count), 1);
            const scale = 0.5 + (item.count / max) * 0.5;
            const size = 60 + scale * 50;
            return (
              <div
                key={item.label}
                style={{
                  ...styles.themeBubble,
                  width: size,
                  height: size,
                  fontSize: 10 + scale * 6,
                  background: `radial-gradient(circle at 30% 30%, ${hexToRgba(accent, 0.8)}, ${hexToRgba(accent, 0.2)})`,
                }}
              >
                {item.label}
              </div>
            );
          })}
        </div>
      </InteractiveGlassCard>

      <InteractiveGlassCard accent={accent} style={styles.insightCard}>
        <div style={styles.insightTitle}>Long-term memories</div>
        <div style={styles.insightSub}>
          Retrieved via the RAG hook. Add Supabase vector search to make these real across weeks and months.
        </div>

        <div style={styles.memoryPills}>
          {(retrievedMemories.length > 0
            ? retrievedMemories
            : [
                "No vector hits yet.",
                "Connect /api/memory/search and pgvector for real recall.",
                "The app is already wired to send the context.",
              ]
          ).map((item, idx) => (
            <span key={`${item}-${idx}`} style={styles.memoryPill}>
              {item}
            </span>
          ))}
        </div>
      </InteractiveGlassCard>
    </motion.div>
  );
}
