"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ChangeEvent,
  CSSProperties,
  KeyboardEvent,
  UIEvent,
} from "react";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

import {
  buildInsights,
  buildMemoryPrompt,
  buildMemorySummary,
  buildTimeContext,
  createSpeechRecognition,
  defaultUsage,
  EMAIL_COOLDOWN_KEY,
  EMAIL_COOLDOWN_MS,
  fallbackReply,
  FREE_LIMIT,
  formatClock,
  hexToRgba,
  loadDraft,
  looksFinnish,
  MAX_MESSAGES,
  MEMORY_SUMMARY_KEY,
  MIN_REPLY_DELAY_MS,
  moodHints,
  moodIcons,
  moodLabels,
  moodPlaceholders,
  normalizeMessageRows,
  normalizeUsage,
  profileToDraftKey,
  profileToMemoryKey,
  saveDraft,
  STORAGE_KEY,
  todayKey,
  type Message,
  type Mood,
  type PersistedState,
  type ProfileRow,
  type Role,
  type Usage,
  type ViewTab,
  uid,
  WELCOME_MESSAGE,
  vibrate,
} from "@/lib/futureMe";
import { TopBar } from "@/components/future-me/TopBar";
import { MessageBubble } from "@/components/future-me/MessageBubble";
import { QuickActionsMenu, type QuickActionItem } from "@/components/future-me/QuickActionsMenu";

type MessageRow = {
  id: string;
  role: Role;
  text: string;
  created_at: string;
};

const themeKeywords = {
  work: ["work", "job", "career", "project", "build", "school", "study", "exam", "code", "app"],
  relationships: ["friend", "friends", "family", "mother", "father", "sister", "brother", "love", "relationship"],
  fear: ["fear", "anxious", "anxiety", "worry", "scared", "afraid", "stress", "nervous"],
  growth: ["grow", "better", "future", "improve", "learn", "progress", "change", "discipline"],
  freedom: ["free", "freedom", "choice", "independent", "own", "myself", "control"],
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

function searchThemes(messages: Message[]) {
  const joined = messages
    .filter((m) => m.role === "me")
    .map((m) => m.text.toLowerCase())
    .join(" ");

  const results = Object.entries(themeKeywords).map(([label, keywords]) => {
    const count = keywords.reduce((sum, keyword) => {
      const matches = joined.split(keyword).length - 1;
      return sum + matches;
    }, 0);
    return { label, count };
  });

  return results
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
}

function loadEmailCooldownUntil() {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(EMAIL_COOLDOWN_KEY) || "0");
}

function writeEmailCooldownUntil(ts: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EMAIL_COOLDOWN_KEY, String(ts));
}

async function loadCloudState(userId: string) {
  if (!supabase) return { profile: null as ProfileRow | null, messages: [] as Message[] };

  try {
    const [profileRes, messagesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id,email,memory_summary,last_seen_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("messages")
        .select("id,role,text,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(120),
    ]);

    return {
      profile: (profileRes.data ?? null) as ProfileRow | null,
      messages: normalizeMessageRows((messagesRes.data ?? []) as MessageRow[]),
    };
  } catch {
    return { profile: null, messages: [] };
  }
}

async function saveCloudTurn(user: User, userText: string, assistantText: string, memorySummary: string) {
  if (!supabase) return;

  const now = new Date().toISOString();

  try {
    const insertRes = await supabase.from("messages").insert([
      { user_id: user.id, role: "me", text: userText, created_at: now },
      { user_id: user.id, role: "future me", text: assistantText, created_at: now },
    ]);
    if (insertRes.error) console.error(insertRes.error);

    const profileRes = await supabase.from("profiles").upsert({
      user_id: user.id,
      email: user.email ?? null,
      memory_summary: memorySummary,
      last_seen_at: now,
    });
    if (profileRes.error) console.error(profileRes.error);
  } catch (error) {
    console.error("Failed to save cloud turn", error);
  }
}

async function callMemorySearch(query: string, userId: string, email?: string | null) {
  try {
    const res = await fetch("/api/memory/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        userId,
        email,
        limit: 6,
      }),
    });

    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    const memories = Array.isArray(data?.memories) ? data.memories : [];
    return memories
      .map((item: unknown) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          return String(obj.text ?? obj.summary ?? obj.content ?? "");
        }
        return "";
      })
      .filter(Boolean)
      .slice(0, 6);
  } catch {
    return [];
  }
}

async function ingestMemory(user: User, text: string, kind: "user" | "assistant" | "summary") {
  try {
    await fetch("/api/memory/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        email: user.email ?? null,
        kind,
        text,
      }),
    });
  } catch {
    // optional backend
  }
}

function createStyles(
  mobile: boolean,
  isPro: boolean,
  hasConversationStarted: boolean,
  loading: boolean,
  mood: Mood,
  accent: string,
  activeTab: ViewTab
): Record<string, CSSProperties> {
  const panelBorder = "1px solid rgba(255,255,255,0.10)";
  const glassBg = "linear-gradient(145deg, rgba(24, 26, 38, 0.72), rgba(255,255,255,0.05))";
  const textMain = "#ffffff";
  const textMuted = "rgba(255,255,255,0.62)";

  return {
    page: {
      minHeight: "100dvh",
      height: "auto",
      overflowY: "auto",
      overflowX: "hidden",
      WebkitOverflowScrolling: "touch",
      padding: mobile ? 10 : 16,
      background:
        "radial-gradient(circle at 20% 10%, rgba(96,165,250,0.14), transparent 22%), radial-gradient(circle at 80% 12%, rgba(167,139,250,0.16), transparent 20%), radial-gradient(circle at 50% 90%, rgba(52,211,153,0.12), transparent 24%), linear-gradient(180deg, #09090d 0%, #0d0f16 100%)",
      color: textMain,
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      position: "relative",
    },
    shell: {
      minHeight: "100dvh",
      height: "auto",
      maxWidth: 1040,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      gap: 14,
      paddingBottom: 24,
      position: "relative",
      zIndex: 1,
    },
    glowA: {
      position: "fixed",
      inset: "12% auto auto -12%",
      width: 420,
      height: 420,
      borderRadius: 999,
      background: `radial-gradient(circle, ${hexToRgba(accent, 0.18)}, transparent 60%)`,
      filter: "blur(70px)",
      pointerEvents: "none",
      zIndex: 0,
    },
    glowB: {
      position: "fixed",
      inset: "auto -12% -14% auto",
      width: 540,
      height: 540,
      borderRadius: 999,
      background: "radial-gradient(circle, rgba(255,255,255,0.10), transparent 62%)",
      filter: "blur(90px)",
      pointerEvents: "none",
      zIndex: 0,
    },
    noiseOverlay: {
      position: "fixed",
      inset: 0,
      pointerEvents: "none",
      zIndex: 0,
      opacity: 0.055,
      backgroundImage: "radial-gradient(rgba(255,255,255,0.24) 0.7px, transparent 0.7px)",
      backgroundSize: "3px 3px",
      mixBlendMode: "soft-light",
    },
    topBar: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: "10px 10px",
      background: glassBg,
      borderRadius: 24,
      border: panelBorder,
      boxShadow: "0 24px 64px rgba(0,0,0,0.34)",
      backdropFilter: "blur(30px) saturate(160%)",
    },
    hero: {
      borderRadius: 30,
      padding: mobile ? 22 : 32,
      background: glassBg,
      border: panelBorder,
      boxShadow: "0 28px 72px rgba(0,0,0,0.34)",
      backdropFilter: "blur(34px) saturate(150%)",
      overflow: "hidden",
      position: "relative",
      transition: "all 420ms ease",
    },
    heroShine: {
      position: "absolute",
      inset: "-30% -10% auto auto",
      width: 320,
      height: 320,
      borderRadius: 999,
      background: `radial-gradient(circle, ${hexToRgba(accent, 0.24)}, transparent 60%)`,
      filter: "blur(24px)",
      pointerEvents: "none",
      transform: "translate3d(0,0,0)",
    },
    heroTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
      flexWrap: "wrap",
      marginBottom: 16,
      position: "relative",
      zIndex: 1,
    },
    badge: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 14px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.06)",
      border: panelBorder,
      color: textMain,
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: "0.02em",
      boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
    },
    badgeAccent: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 14px",
      borderRadius: 999,
      background: isPro ? "rgba(76,175,122,0.16)" : "rgba(255,255,255,0.05)",
      border: isPro ? "1px solid rgba(76,175,122,0.28)" : panelBorder,
      color: isPro ? "#78efb0" : textMain,
      fontSize: 12,
      fontWeight: 800,
      boxShadow: "0 8px 20px rgba(0,0,0,0.16)",
    },
    heroTitle: {
      fontSize: mobile ? 34 : 48,
      fontWeight: 950,
      letterSpacing: "-0.06em",
      lineHeight: 1.02,
      maxWidth: 580,
      marginBottom: 12,
      position: "relative",
      zIndex: 1,
      color: textMain,
    },
    heroSub: {
      fontSize: mobile ? 15 : 16,
      lineHeight: 1.6,
      color: textMuted,
      maxWidth: 740,
      position: "relative",
      zIndex: 1,
    },
    heroMetrics: {
      display: "grid",
      gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(3, minmax(0, 1fr))",
      gap: 12,
      marginTop: 24,
      position: "relative",
      zIndex: 1,
    },
    metricCard: {
      borderRadius: 22,
      padding: 16,
      background: "rgba(0,0,0,0.22)",
      border: "1px solid rgba(255,255,255,0.05)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    },
    metricValue: {
      fontSize: mobile ? 22 : 26,
      fontWeight: 900,
      letterSpacing: "-0.04em",
      lineHeight: 1,
      color: textMain,
    },
    metricLabel: {
      fontSize: 12,
      color: textMuted,
      marginTop: 6,
      fontWeight: 500,
    },
    compactHero: {
      borderRadius: 30,
      padding: mobile ? 20 : 26,
      background: glassBg,
      border: panelBorder,
      boxShadow: "0 28px 72px rgba(0,0,0,0.34)",
      backdropFilter: "blur(34px) saturate(150%)",
      overflow: "hidden",
      position: "relative",
    },
    compactTitle: {
      fontSize: mobile ? 24 : 30,
      fontWeight: 950,
      letterSpacing: "-0.05em",
      lineHeight: 1,
      marginTop: 10,
      color: textMain,
    },
    compactSub: {
      marginTop: 10,
      fontSize: mobile ? 14 : 15,
      lineHeight: 1.6,
      color: textMuted,
      maxWidth: 760,
    },
    compactActionRow: {
      marginTop: 16,
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
    },
    compactButton: {
      border: 0,
      borderRadius: 16,
      padding: "12px 18px",
      background: textMain,
      color: "#0b0d12",
      fontWeight: 900,
      boxShadow: "0 8px 20px rgba(255,255,255,0.12)",
      cursor: "pointer",
    },
    compactGhost: {
      border: panelBorder,
      borderRadius: 16,
      padding: "12px 18px",
      background: "rgba(255,255,255,0.05)",
      color: textMain,
      fontWeight: 800,
      boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
      cursor: "pointer",
    },
    statusRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: 10,
      alignItems: "center",
      padding: "0 4px",
    },
    pill: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 14px",
      borderRadius: 999,
      border: panelBorder,
      background: "rgba(20,22,32,0.68)",
      color: textMuted,
      fontSize: 12,
      fontWeight: 600,
      backdropFilter: "blur(12px)",
      boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
    },
    pillAction: {
      border: panelBorder,
      background: "rgba(255,255,255,0.08)",
      color: textMain,
      padding: "8px 14px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
      cursor: "pointer",
    },
    memoryCard: {
      borderRadius: 26,
      padding: 18,
      background: "linear-gradient(180deg, rgba(35, 26, 44, 0.84), rgba(15, 15, 22, 0.88))",
      border: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "0 24px 64px rgba(0,0,0,0.36)",
      backdropFilter: "blur(34px) saturate(150%)",
      display: "grid",
      gap: 14,
      position: "relative",
      overflow: "hidden",
    },
    memoryHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      flexWrap: "wrap",
    },
    memoryTitleWrap: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      minWidth: 0,
    },
    memoryIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      display: "grid",
      placeItems: "center",
      background: `linear-gradient(180deg, ${hexToRgba(accent, 0.32)}, rgba(255,255,255,0.08))`,
      color: textMain,
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14)",
      flex: "0 0 auto",
      fontSize: 18,
    },
    memoryTitle: {
      fontSize: 16,
      fontWeight: 900,
      letterSpacing: "-0.03em",
      color: textMain,
    },
    memoryMeta: {
      fontSize: 12,
      color: textMuted,
      marginTop: 2,
    },
    memoryUpdated: {
      fontSize: 12,
      color: textMuted,
      whiteSpace: "nowrap",
    },
    memoryQuote: {
      borderRadius: 20,
      padding: 16,
      background: "rgba(0,0,0,0.28)",
      color: "rgba(255,255,255,0.88)",
      border: "1px solid rgba(255,255,255,0.05)",
      lineHeight: 1.6,
      fontSize: 14,
      fontStyle: "italic",
      whiteSpace: "pre-wrap",
    },
    memoryGlow: {
      position: "absolute",
      inset: "auto auto -10% 82%",
      width: 150,
      height: 150,
      borderRadius: 999,
      background: `radial-gradient(circle, ${hexToRgba(accent, 0.24)}, transparent)`,
      filter: "blur(20px)",
      pointerEvents: "none",
    },
    moodSection: {
      display: "grid",
      gap: 10,
      padding: "0 4px",
    },
    moodHeading: {
      fontSize: 18,
      fontWeight: 900,
      letterSpacing: "-0.04em",
      color: textMain,
    },
    moodSub: {
      fontSize: 13,
      color: textMuted,
      lineHeight: 1.5,
    },
    moodRow: {
      display: "grid",
      gridTemplateColumns: mobile ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))",
      gap: 12,
    },
    moodButton: {
      position: "relative",
      border: panelBorder,
      borderRadius: 20,
      padding: "16px 12px",
      background: "rgba(30,32,44,0.42)",
      color: textMuted,
      display: "grid",
      gap: 6,
      justifyItems: "center",
      boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
      overflow: "hidden",
      cursor: "pointer",
      backdropFilter: "blur(16px)",
      transition:
        "background 420ms ease, box-shadow 420ms ease, border-color 420ms ease, color 420ms ease, transform 420ms ease",
    },
    moodButtonActive: {
      position: "relative",
      border: `1px solid ${hexToRgba(accent, 0.72)}`,
      borderRadius: 20,
      padding: "16px 12px",
      background: "rgba(18,20,28,0.84)",
      color: textMain,
      display: "grid",
      gap: 6,
      justifyItems: "center",
      boxShadow: `0 0 0 1px ${hexToRgba(accent, 0.18)} inset, 0 12px 32px rgba(0,0,0,0.3), 0 0 20px ${hexToRgba(
        accent,
        0.24
      )}`,
      overflow: "hidden",
      cursor: "pointer",
      backdropFilter: "blur(16px)",
      transition:
        "background 420ms ease, box-shadow 420ms ease, border-color 420ms ease, color 420ms ease, transform 420ms ease",
    },
    moodIcon: {
      fontSize: 22,
      lineHeight: 1,
    },
    moodLabel: {
      fontSize: 14,
      fontWeight: 900,
      letterSpacing: "-0.02em",
    },
    moodLabelSub: {
      fontSize: 11,
      opacity: 0.74,
    },
    moodGlow: {
      position: "absolute",
      inset: "auto -20% -30% auto",
      width: 100,
      height: 100,
      borderRadius: 999,
      background: `radial-gradient(circle, ${hexToRgba(accent, 0.38)}, transparent)`,
      filter: "blur(10px)",
      pointerEvents: "none",
    },
    aiPanel: {
      borderRadius: 26,
      padding: 16,
      background: glassBg,
      border: panelBorder,
      boxShadow: "0 24px 64px rgba(0,0,0,0.34)",
      backdropFilter: "blur(34px) saturate(150%)",
      display: "grid",
      gap: 14,
      transition:
        "background 420ms ease, box-shadow 420ms ease, border-color 420ms ease, color 420ms ease, transform 420ms ease",
    },
    aiHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
    },
    aiHeaderLeft: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      minWidth: 0,
    },
    aiDot: {
      width: 12,
      height: 12,
      borderRadius: 999,
      background: loading ? "#64748b" : hasConversationStarted ? "#3bc6a1" : "#ff9e5e",
      boxShadow: loading
        ? "0 0 0 6px rgba(100,116,139,0.14)"
        : hasConversationStarted
          ? "0 0 0 6px rgba(59,198,161,0.14)"
          : "0 0 0 6px rgba(255,158,94,0.14)",
      flex: "0 0 auto",
    },
    aiTitle: {
      fontSize: 16,
      fontWeight: 900,
      letterSpacing: "-0.03em",
      lineHeight: 1.15,
      color: textMain,
    },
    aiSub: {
      marginTop: 2,
      fontSize: 13,
      color: textMuted,
      lineHeight: 1.4,
    },
    aiChips: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
    },
    aiChip: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "7px 12px",
      borderRadius: 999,
      background: "rgba(0,0,0,0.28)",
      border: "1px solid rgba(255,255,255,0.06)",
      fontSize: 12,
      color: "rgba(255,255,255,0.82)",
      fontWeight: 700,
    },
    threadCard: {
      display: "flex",
      flexDirection: "column",
      borderRadius: 34,
      background: "linear-gradient(180deg, rgba(20,22,32,0.72), rgba(11,13,18,0.86))",
      border: panelBorder,
      boxShadow: "0 32px 80px rgba(0,0,0,0.52)",
      overflow: "hidden",
      backdropFilter: "blur(40px) saturate(150%)",
      minHeight: mobile ? 400 : 560,
      maxHeight: 600,
      position: "relative",
      transition:
        "background 420ms ease, box-shadow 420ms ease, border-color 420ms ease, color 420ms ease, transform 420ms ease",
    },
    threadGlow: {
      position: "absolute",
      inset: "-20% auto auto -20%",
      width: 300,
      height: 300,
      borderRadius: 999,
      background: "radial-gradient(circle, rgba(255,255,255,0.06), transparent)",
      filter: "blur(18px)",
      pointerEvents: "none",
      zIndex: 0,
    },
    threadHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: 16,
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      background: "rgba(255,255,255,0.03)",
      backdropFilter: "blur(14px)",
      position: "relative",
      zIndex: 1,
    },
    threadLeft: {
      display: "flex",
      alignItems: "center",
      gap: 12,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 16,
      background: "linear-gradient(135deg, #2a2d3e, #141620)",
      color: textMain,
      display: "grid",
      placeItems: "center",
      fontSize: 15,
      fontWeight: 900,
      boxShadow: "0 8px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
      border: "1px solid rgba(255,255,255,0.05)",
    },
    threadText: {
      display: "flex",
      flexDirection: "column",
      gap: 2,
    },
    threadName: {
      fontSize: 16,
      fontWeight: 900,
      letterSpacing: "-0.03em",
      color: textMain,
    },
    threadMeta: {
      fontSize: 12,
      color: textMuted,
    },
    liveChip: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      borderRadius: 999,
      background: "rgba(0,0,0,0.22)",
      border: "1px solid rgba(255,255,255,0.05)",
      fontSize: 12,
      color: "rgba(255,255,255,0.82)",
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      background: isPro ? "#4caf7a" : "#ff9e5e",
      boxShadow: isPro ? "0 0 0 4px rgba(76,175,122,0.2)" : "0 0 0 4px rgba(255,158,94,0.2)",
    },
    threadBody: {
      flex: "1 1 auto",
      minHeight: 0,
      display: "flex",
      flexDirection: "column",
      padding: mobile ? 14 : 20,
      position: "relative",
      zIndex: 1,
      overflowY: "auto",
      scrollbarWidth: "none",
      msOverflowStyle: "none",
    },
    stream: {
      display: "flex",
      flexDirection: "column",
      gap: 16,
      paddingBottom: 4,
    },
    messageRow: {
      display: "flex",
      width: "100%",
    },
    messageBubble: {
      maxWidth: mobile ? "90%" : "75%",
      minWidth: 0,
      padding: "14px 16px",
      borderRadius: 24,
      fontSize: mobile ? 14 : 15,
      lineHeight: 1.5,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      overflowWrap: "anywhere",
      letterSpacing: "-0.005em",
      position: "relative",
      boxSizing: "border-box",
      backdropFilter: "blur(20px)",
      userSelect: "none",
      WebkitUserSelect: "none",
    },
    meBubble: {
      background: "rgba(40,44,60,0.75)",
      color: textMain,
      boxShadow: "0 12px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.05)",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 8,
    },
    futureMeBubble: {
      background: "rgba(255,255,255,0.09)",
      color: textMain,
      border: "1px solid rgba(255,255,255,0.10)",
      boxShadow: "0 12px 24px rgba(0,0,0,0.2)",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderBottomLeftRadius: 8,
      borderBottomRightRadius: 24,
    },
    messageTop: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 8,
    },
    messageRole: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 10px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 900,
      letterSpacing: "0.02em",
      background: "rgba(255,255,255,0.10)",
      color: "rgba(255,255,255,0.90)",
    },
    messageRoleMe: {
      background: "rgba(0,0,0,0.28)",
      color: textMuted,
    },
    copyButton: {
      border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: 999,
      padding: "6px 12px",
      background: "rgba(255,255,255,0.05)",
      color: textMain,
      fontSize: 11,
      fontWeight: 800,
      cursor: "pointer",
    },
    messageText: {
      fontSize: mobile ? 14 : 15,
      lineHeight: 1.6,
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
      color: "rgba(255,255,255,0.92)",
    },
    timestamp: {
      marginTop: 10,
      fontSize: 11,
      color: textMuted,
      textAlign: "right",
    },
    typingRow: {
      display: "flex",
      justifyContent: "flex-start",
    },
    typingBubble: {
      padding: "14px 16px",
      borderRadius: 24,
      background: "rgba(255,255,255,0.05)",
      color: textMuted,
      fontSize: 14,
      border: "1px solid rgba(255,255,255,0.05)",
      animation: "pulse 1.3s ease-in-out infinite",
    },
    typingDots: {
      display: "inline-flex",
      gap: 6,
      alignItems: "center",
    },
    typingDot: {
      width: 6,
      height: 6,
      borderRadius: 999,
      background: "currentColor",
      opacity: 0.8,
    },
    composerShell: {
      flex: "0 0 auto",
      borderRadius: 26,
      background: "rgba(20,22,32,0.62)",
      border: panelBorder,
      boxShadow: "0 -10px 40px rgba(0,0,0,0.3)",
      backdropFilter: "blur(40px) saturate(150%)",
      overflow: "hidden",
      position: "relative",
      transition:
        "background 420ms ease, box-shadow 420ms ease, border-color 420ms ease, color 420ms ease, transform 420ms ease",
    },
    composerTop: {
      display: "flex",
      justifyContent: "space-between",
      gap: 10,
      flexWrap: "wrap",
      padding: "14px 16px 0",
    },
    composerChip: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "7px 12px",
      borderRadius: 999,
      background: "rgba(0,0,0,0.24)",
      color: textMuted,
      border: "1px solid rgba(255,255,255,0.05)",
      fontSize: 12,
      fontWeight: 800,
    },
    composerRow: {
      display: "flex",
      gap: 10,
      alignItems: "flex-end",
      padding: 14,
      flexDirection: mobile ? "column" : "row",
    },
    composerTextarea: {
      flex: 1,
      width: "100%",
      minHeight: 52,
      maxHeight: 160,
      resize: "none",
      borderRadius: 20,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(0,0,0,0.24)",
      color: textMain,
      padding: "14px 16px",
      lineHeight: 1.45,
      fontSize: 15,
      outline: "none",
      boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)",
      transition:
        "border-color 420ms ease, box-shadow 420ms ease, background 420ms ease, color 420ms ease",
    },
    sendButton: {
      minWidth: mobile ? "100%" : 110,
      border: 0,
      borderRadius: 20,
      padding: "14px 20px",
      background: `linear-gradient(180deg, ${accent}, ${hexToRgba(accent, 0.82)})`,
      color: "#ffffff",
      fontWeight: 900,
      fontSize: 15,
      boxShadow: `0 8px 20px ${hexToRgba(accent, 0.24)}, inset 0 1px 0 rgba(255,255,255,0.18)`,
      cursor: "pointer",
      transition: "transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease",
    },
    micButton: {
      width: mobile ? "100%" : 48,
      minWidth: mobile ? "100%" : 48,
      border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: 20,
      padding: "14px 0",
      background: loading ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.22)",
      color: textMain,
      fontWeight: 900,
      fontSize: 15,
      boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
      cursor: "pointer",
    },
    helper: {
      padding: "0 16px 16px",
      fontSize: 12,
      color: textMuted,
      lineHeight: 1.5,
      textAlign: "center",
    },
    sheetBackdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.62)",
      backdropFilter: "blur(8px)",
      zIndex: 40,
    },
    sheet: {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 50,
      background: "rgba(18,20,30,0.96)",
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      borderTop: panelBorder,
      padding: 24,
      boxShadow: "0 -24px 80px rgba(0,0,0,0.5)",
      display: "grid",
      gap: 16,
      backdropFilter: "blur(40px) saturate(150%)",
      color: textMain,
    },
    sheetTitle: {
      fontSize: 22,
      fontWeight: 900,
      letterSpacing: "-0.03em",
    },
    sheetSub: {
      marginTop: 4,
      fontSize: 14,
      color: textMuted,
      lineHeight: 1.5,
    },
    sheetGroup: {
      display: "grid",
      gap: 10,
    },
    sheetButton: {
      width: "100%",
      textAlign: "left",
      borderRadius: 16,
      padding: "16px",
      border: "1px solid rgba(255,255,255,0.05)",
      background: "rgba(255,255,255,0.03)",
      color: textMain,
      fontWeight: 800,
      fontSize: 15,
      cursor: "pointer",
    },
    paywallBackdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.68)",
      backdropFilter: "blur(12px)",
      zIndex: 60,
    },
    paywall: {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 70,
      background: "rgba(18,20,30,0.98)",
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      borderTop: "1px solid rgba(255,255,255,0.10)",
      padding: 24,
      boxShadow: "0 -24px 100px rgba(0,0,0,0.6)",
      display: "grid",
      gap: 16,
      backdropFilter: "blur(40px) saturate(150%)",
      color: textMain,
    },
    paywallHeader: {
      display: "grid",
      gap: 6,
    },
    paywallTitle: {
      fontSize: 24,
      fontWeight: 950,
      letterSpacing: "-0.04em",
      color: textMain,
    },
    paywallSub: {
      fontSize: 14,
      lineHeight: 1.5,
      color: "rgba(255,255,255,0.80)",
    },
    featureCard: {
      borderRadius: 20,
      padding: 16,
      background: "rgba(0,0,0,0.28)",
      border: "1px solid rgba(255,255,255,0.05)",
    },
    featureList: {
      display: "grid",
      gap: 12,
      marginTop: 8,
    },
    featureItem: {
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
      fontSize: 14,
      lineHeight: 1.5,
      color: textMain,
    },
    featureDot: {
      width: 8,
      height: 8,
      marginTop: 6,
      borderRadius: 999,
      background: accent,
      flex: "0 0 auto",
      boxShadow: `0 0 10px ${hexToRgba(accent, 0.5)}`,
    },
    paywallButtons: {
      display: "flex",
      gap: 12,
      flexWrap: "wrap",
    },
    proButton: {
      border: 0,
      borderRadius: 16,
      padding: "16px",
      background: `linear-gradient(180deg, ${accent}, ${hexToRgba(accent, 0.82)})`,
      color: "#050507",
      fontWeight: 900,
      fontSize: 15,
      boxShadow: `0 12px 24px ${hexToRgba(accent, 0.3)}`,
      cursor: "pointer",
      flex: 1,
      minWidth: "100%",
    },
    ghostButton: {
      border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: 16,
      padding: "14px 16px",
      background: "rgba(255,255,255,0.05)",
      color: textMain,
      fontWeight: 800,
      cursor: "pointer",
      flex: 1,
      minWidth: mobile ? "100%" : "calc(50% - 6px)",
    },
    hintLine: {
      fontSize: 12,
      color: textMuted,
      lineHeight: 1.5,
      textAlign: "center",
      marginTop: 8,
    },
    freeTag: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 14px",
      borderRadius: 999,
      background: isPro ? "rgba(76,175,122,0.18)" : "rgba(255,255,255,0.08)",
      color: isPro ? "#78efb0" : textMain,
      border: isPro ? "1px solid rgba(76,175,122,0.28)" : "1px solid rgba(255,255,255,0.10)",
      fontSize: 13,
      fontWeight: 800,
      width: "fit-content",
    },
    sheetInput: {
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.10)",
      padding: "16px",
      background: "rgba(0,0,0,0.32)",
      color: textMain,
      fontSize: 16,
      outline: "none",
    },
    sheetPrimary: {
      border: 0,
      borderRadius: 16,
      padding: "16px",
      background: textMain,
      color: "#08080c",
      fontWeight: 900,
      fontSize: 15,
      cursor: "pointer",
    },
    sheetSecondary: {
      border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: 16,
      padding: "16px",
      background: "rgba(255,255,255,0.05)",
      color: textMain,
      fontWeight: 800,
      fontSize: 15,
      cursor: "pointer",
    },
    sheetHint: {
      fontSize: 13,
      color: textMuted,
      lineHeight: 1.5,
      textAlign: "center",
    },
    insightsGrid: {
      display: "grid",
      gridTemplateColumns: mobile ? "1fr" : "1.2fr 0.8fr",
      gap: 14,
    },
    insightCard: {
      borderRadius: 26,
      padding: 18,
      background: glassBg,
      border: panelBorder,
      boxShadow: "0 24px 64px rgba(0,0,0,0.34)",
      backdropFilter: "blur(34px) saturate(150%)",
    },
    insightTitle: {
      fontSize: 18,
      fontWeight: 900,
      letterSpacing: "-0.04em",
      marginBottom: 8,
    },
    insightSub: {
      fontSize: 13,
      color: textMuted,
      lineHeight: 1.5,
    },
    sparkWrap: {
      display: "grid",
      gap: 10,
      marginTop: 14,
    },
    sparkBars: {
      display: "grid",
      gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
      gap: 8,
      alignItems: "end",
      minHeight: 140,
    },
    sparkBar: {
      borderRadius: 14,
      background: "rgba(255,255,255,0.10)",
      border: "1px solid rgba(255,255,255,0.06)",
      minHeight: 12,
      position: "relative",
      overflow: "hidden",
    },
    sparkFill: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 14,
      background: `linear-gradient(180deg, ${accent}, ${hexToRgba(accent, 0.5)})`,
      boxShadow: `0 0 18px ${hexToRgba(accent, 0.22)}`,
    },
    sparkLabelRow: {
      display: "grid",
      gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
      gap: 8,
      fontSize: 11,
      color: textMuted,
    },
    miniCards: {
      display: "grid",
      gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(2, minmax(0, 1fr))",
      gap: 10,
    },
    miniCard: {
      borderRadius: 20,
      padding: 14,
      background: "rgba(0,0,0,0.24)",
      border: "1px solid rgba(255,255,255,0.06)",
    },
    miniValue: {
      fontSize: 22,
      fontWeight: 900,
      letterSpacing: "-0.04em",
    },
    miniLabel: {
      fontSize: 12,
      color: textMuted,
      marginTop: 4,
    },
    themeBubbleContainer: {
      display: "flex",
      flexWrap: "wrap",
      gap: 12,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 20,
      padding: "10px 0",
    },
    themeBubble: {
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: `linear-gradient(135deg, ${accent}, ${hexToRgba(accent, 0.6)})`,
      color: "#fff",
      fontWeight: 800,
      fontSize: 12,
      boxShadow: `0 8px 24px ${hexToRgba(accent, 0.3)}`,
      textAlign: "center",
      border: "1px solid rgba(255,255,255,0.15)",
      transition: "transform 0.2s ease",
      userSelect: "none",
    },
    voiceHint: {
      fontSize: 12,
      color: textMuted,
      lineHeight: 1.5,
      marginTop: 8,
    },
    memoryPills: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      marginTop: 12,
    },
    memoryPill: {
      borderRadius: 999,
      padding: "8px 12px",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.06)",
      color: textMain,
      fontSize: 12,
      fontWeight: 700,
    },
    scrollBottomBtn: {
      position: "absolute",
      bottom: 24,
      right: 24,
      width: 44,
      height: 44,
      borderRadius: "50%",
      background: glassBg,
      border: panelBorder,
      color: textMain,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      backdropFilter: "blur(20px)",
      cursor: "pointer",
      zIndex: 10,
      fontSize: 18,
    },
    contextMenu: {
      position: "fixed",
      zIndex: 100,
      background: "rgba(24, 26, 38, 0.95)",
      backdropFilter: "blur(20px)",
      border: panelBorder,
      borderRadius: 16,
      padding: 8,
      display: "flex",
      flexDirection: "column",
      gap: 4,
      boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
      minWidth: 220,
    },
    contextMenuBtn: {
      background: "transparent",
      border: "none",
      color: textMain,
      textAlign: "left",
      padding: "10px 14px",
      fontSize: 14,
      fontWeight: 600,
      borderRadius: 10,
      cursor: "pointer",
    },
    contextMenuBtnDanger: {
      color: "#fb7185",
    },
    focusModeOverlay: {
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "rgba(9, 9, 13, 0.98)",
      backdropFilter: "blur(20px)",
      display: "flex",
      flexDirection: "column",
      padding: mobile ? 20 : 40,
    },
    focusModeHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    focusModeTitle: {
      fontSize: 20,
      fontWeight: 800,
      color: textMuted,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
    },
    focusModeClose: {
      background: "rgba(255,255,255,0.05)",
      border: panelBorder,
      color: textMain,
      width: 40,
      height: 40,
      borderRadius: 20,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
    },
    focusModeTextarea: {
      flex: 1,
      width: "100%",
      background: "transparent",
      border: "none",
      color: textMain,
      fontSize: mobile ? 22 : 32,
      lineHeight: 1.4,
      outline: "none",
      resize: "none",
    },
    focusModeFooter: {
      marginTop: 20,
      display: "flex",
      justifyContent: "flex-end",
    },
    memoryJourney: {
      borderRadius: 26,
      padding: 18,
      background: glassBg,
      border: panelBorder,
      boxShadow: "0 24px 64px rgba(0,0,0,0.34)",
      backdropFilter: "blur(34px) saturate(150%)",
      display: "grid",
      gap: 14,
    },
    journeyTrack: {
      position: "relative",
      minHeight: 180,
      borderRadius: 22,
      background: "rgba(0,0,0,0.22)",
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.06)",
    },
    journeyGlow: {
      position: "absolute",
      inset: 0,
      background: `radial-gradient(circle at 50% 60%, ${hexToRgba(accent, 0.22)}, transparent 52%)`,
      pointerEvents: "none",
    },
    journeyPath: {
      position: "absolute",
      inset: "20px 18px",
      borderRadius: 999,
      border: "1px dashed rgba(255,255,255,0.15)",
    },
    journeyNode: {
      position: "absolute",
      width: 18,
      height: 18,
      borderRadius: 999,
      background: accent,
      boxShadow: `0 0 18px ${hexToRgba(accent, 0.35)}`,
    },
  };
}

function InteractiveGlassCard({
  accent,
  style,
  children,
  className,
  onClick,
}: {
  accent: string;
  style?: CSSProperties;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState({ x: 50, y: 50, dx: 0, dy: 0, active: false });

  return (
    <motion.div
      ref={ref}
      className={className}
      onClick={onClick}
      onPointerMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        const dx = (e.clientX - rect.left - rect.width / 2) / rect.width;
        const dy = (e.clientY - rect.top - rect.height / 2) / rect.height;
        setHover({ x, y, dx, dy, active: true });
      }}
      onPointerLeave={() => setHover({ x: 50, y: 50, dx: 0, dy: 0, active: false })}
      style={{
        ...style,
        position: "relative",
        overflow: "hidden",
        transformStyle: "preserve-3d",
        transform: `perspective(1200px) rotateX(${hover.active ? -hover.dy * 7 : 0}deg) rotateY(${hover.active ? hover.dx * 9 : 0}deg)`,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `radial-gradient(700px circle at ${hover.x}% ${hover.y}%, ${hexToRgba(accent, 0.18)}, transparent 42%)`,
          transform: `translate3d(${hover.dx * 14}px, ${hover.dy * 14}px, 0)`,
          transition: "transform 120ms linear, background 120ms linear",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.08,
          backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 0.7px, transparent 0.7px)",
          backgroundSize: "3px 3px",
          mixBlendMode: "soft-light",
        }}
      />
      {children}
    </motion.div>
  );
}

export default function FutureMeClient() {
  const [mobile, setMobile] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [mood, setMood] = useState<Mood>("honest");
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [loginStatus, setLoginStatus] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [usage, setUsage] = useState<Usage>(defaultUsage());
  const [user, setUser] = useState<User | null>(null);
  const [emailCooldownUntil, setEmailCooldownUntilState] = useState(0);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [memorySummary, setMemorySummary] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [memoryPulse, setMemoryPulse] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>("chat");
  const [retrievedMemories, setRetrievedMemories] = useState<string[]>([]);
  const [voiceListening, setVoiceListening] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    messageId: string;
    text: string;
    role: Role;
    x: number;
    y: number;
  } | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const threadBodyRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accentMap: Record<Mood, string> = {
    calm: "#60a5fa",
    honest: "#fb923c",
    direct: "#34d399",
    wise: "#a78bfa",
  };
  const accent = accentMap[mood];

  const remainingToday = usage.date === todayKey() ? Math.max(0, FREE_LIMIT - usage.count) : FREE_LIMIT;
  const draftKey = useMemo(() => profileToDraftKey(user?.email), [user?.email]);
  const memoryKey = useMemo(() => profileToMemoryKey(user?.email), [user?.email]);
  const hasConversationStarted = messages.some((m) => m.id !== "welcome");
  const visibleMessageCount = Math.max(0, messages.filter((m) => m.id !== "welcome").length);
  const liveLabel = loading ? "responding..." : hasConversationStarted ? "online" : "ready";
  const composerPlaceholder = moodPlaceholders[mood];
  const memoryBadge = memoryPulse ? "memory updated" : user ? "cloud sync on" : "private draft";
  const insights = useMemo(() => buildInsights(messages), [messages]);

  const contextMenuPosition = useMemo(() => {
    if (!contextMenu) return null;
    const width = viewport.width || 390;
    const height = viewport.height || 844;
    const left = Math.max(12, Math.min(contextMenu.x, width - 240));
    const top = Math.max(12, Math.min(contextMenu.y, height - 240));
    return { left, top };
  }, [contextMenu, viewport]);

  useEffect(() => {
    const update = () => {
      setMobile(window.innerWidth < 900);
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const initialCooldown = loadEmailCooldownUntil();
    setEmailCooldownUntilState(initialCooldown);
    const timer = window.setInterval(() => {
      setEmailCooldownUntilState(loadEmailCooldownUntil());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const draft = loadDraft(STORAGE_KEY);
      if (draft) {
        if (Array.isArray(draft.messages) && draft.messages.length > 0) {
          setMessages(draft.messages.slice(-MAX_MESSAGES));
        }
        if (typeof draft.input === "string") setInput(draft.input);
        if (draft.mood && ["calm", "honest", "direct", "wise"].includes(draft.mood)) {
          setMood(draft.mood as Mood);
        }
        if (typeof draft.isPro === "boolean") setIsPro(draft.isPro);
        if (draft.usage) setUsage(normalizeUsage(draft.usage));
      }

      const savedEmail = window.localStorage.getItem("future-me-email") || "";
      if (savedEmail) setEmailInput(savedEmail);

      const savedMemory = window.localStorage.getItem(memoryKey) || "";
      if (savedMemory) setMemorySummary(savedMemory);

      const params = new URLSearchParams(window.location.search);
      if (params.get("pro") === "1" || params.get("pro") === "true") {
        setIsPro(true);
        params.delete("pro");
        const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
        window.history.replaceState({}, "", nextUrl);
      }
    } catch {
      // ignore
    } finally {
      setHydrated(true);
    }
  }, [memoryKey]);

  useEffect(() => {
    if (!hydrated) return;

    const timeoutId = window.setTimeout(() => {
      saveDraft(draftKey, {
        messages: messages.slice(-MAX_MESSAGES),
        input,
        mood,
        isPro,
        usage,
      });
      window.localStorage.setItem(memoryKey, memorySummary);
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [draftKey, hydrated, input, isPro, messages, mood, memoryKey, memorySummary, usage]);

  useEffect(() => {
    const derived = buildMemorySummary(messages);
    setMemorySummary(derived);
    if (user?.email) {
      window.localStorage.setItem(memoryKey, derived);
    }
  }, [messages, memoryKey, user?.email]);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  useEffect(() => {
    document.body.style.overflow = menuOpen || paywallOpen || showSaveSheet || contextMenu || isFocusMode ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [menuOpen, paywallOpen, showSaveSheet, contextMenu, isFocusMode]);

  useEffect(() => {
    if (!supabase) return;

    const hydrate = async () => {
      const { data } = await supabase.auth.getSession();
      await syncSession(data.session?.user ?? null);
    };

    void hydrate();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        void syncSession(null);
        return;
      }

      setTimeout(() => {
        void syncSession(session?.user ?? null);
      }, 0);
    });

    return () => authListener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const styles = useMemo(
    () => createStyles(mobile, isPro, hasConversationStarted, loading, mood, accent, activeTab),
    [mobile, isPro, hasConversationStarted, loading, mood, accent, activeTab]
  );

  const incrementUsage = useCallback(() => {
    setUsage((prevUsage) => {
      const today = todayKey();
      return prevUsage.date === today
        ? { date: today, count: prevUsage.count + 1 }
        : { date: today, count: 1 };
    });
  }, []);

  async function syncSession(nextUser: User | null) {
    setUser(nextUser);

    if (!nextUser) {
      const guestDraft = loadDraft(STORAGE_KEY);
      if (guestDraft) {
        if (Array.isArray(guestDraft.messages) && guestDraft.messages.length > 0) {
          setMessages(guestDraft.messages.slice(-MAX_MESSAGES));
        } else {
          setMessages([WELCOME_MESSAGE]);
        }
        if (typeof guestDraft.input === "string") setInput(guestDraft.input);
        if (guestDraft.mood && ["calm", "honest", "direct", "wise"].includes(guestDraft.mood)) {
          setMood(guestDraft.mood as Mood);
        }
        if (typeof guestDraft.isPro === "boolean") setIsPro(guestDraft.isPro);
        if (guestDraft.usage) setUsage(normalizeUsage(guestDraft.usage));
      }
      const savedMemory = window.localStorage.getItem(MEMORY_SUMMARY_KEY) || "";
      setMemorySummary(savedMemory);
      setEmailInput("");
      return;
    }

    setEmailInput(nextUser.email ?? "");

    const { profile, messages: cloudMessages } = await loadCloudState(nextUser.id);
    if (cloudMessages.length > 0) {
      setMessages(cloudMessages.slice(-MAX_MESSAGES));
    }

    const cloudMemory =
      profile?.memory_summary?.trim() ||
      buildMemorySummary(cloudMessages.length > 0 ? cloudMessages : messages);

    if (cloudMemory) {
      setMemorySummary(cloudMemory);
      window.localStorage.setItem(profileToMemoryKey(nextUser.email), cloudMemory);
    }

    if (cloudMessages.length > 0) {
      const lastQuery = messages.filter((m) => m.role === "me").slice(-1)[0]?.text ?? "";
      const longTerm = await callMemorySearch(lastQuery, nextUser.id, nextUser.email);
      setRetrievedMemories(longTerm);
    }
  }

  async function signInWithEmail() {
    if (!supabase) {
      setLoginStatus("Supabase env vars are missing.");
      return;
    }

    const email = emailInput.trim().toLowerCase();
    if (!email) return;

    const cooldownUntil = loadEmailCooldownUntil();
    if (Date.now() < cooldownUntil) {
      setLoginStatus(`Wait ${Math.ceil((cooldownUntil - Date.now()) / 1000)}s and try again.`);
      return;
    }

    setSendingEmail(true);
    setLoginStatus("Sending magic link...");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
      },
    });

    if (error) {
      setLoginStatus(error.message);
      setSendingEmail(false);
      return;
    }

    const until = Date.now() + EMAIL_COOLDOWN_MS;
    writeEmailCooldownUntil(until);
    setEmailCooldownUntilState(until);
    setLoginStatus("Check your email for the sign-in link.");
    setSendingEmail(false);
  }

  function continueFromYesterday() {
    if (!memorySummary) return;
    setInput((prev) => prev || `Continuing from yesterday: ${memorySummary}. `);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  async function copyMessage(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1200);
      setContextMenu(null);
    } catch {
      // ignore
    }
  }

  async function shareMessage(text: string) {
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setContextMenu(null);
    } catch {
      // ignore
    }
  }

  function deleteMessage(id: string) {
    if (id === "welcome") return;
    setMessages((prev) => {
      const next = prev.filter((m) => m.id !== id);
      return next.length > 0 ? next : [WELCOME_MESSAGE];
    });
    setContextMenu(null);
  }

  function deepenThought(text: string) {
    setInput(`Deepen this thought: "${text}"\n\n`);
    setContextMenu(null);
    setIsFocusMode(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function speakMessage(message: Message) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const synth = window.speechSynthesis;

    if (speakingId === message.id) {
      synth.cancel();
      setSpeakingId(null);
      return;
    }

    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(message.text);
    utterance.rate = 0.96;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.lang = looksFinnish(message.text) ? "fi-FI" : "en-US";

    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(message.id);
    synth.speak(utterance);
  }

  async function startVoice() {
    if (voiceListening) {
      recognitionRef.current?.stop?.();
      return;
    }

    const recognition = createSpeechRecognition();
    if (!recognition) {
      setLoginStatus("Voice input is not supported in this browser.");
      return;
    }

    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0]?.transcript ?? "")
        .join("")
        .trim();

      if (transcript) {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };

    recognition.onend = () => {
      setVoiceListening(false);
    };

    recognition.onerror = () => {
      setVoiceListening(false);
      setLoginStatus("Voice input stopped.");
    };

    recognitionRef.current = recognition;
    setVoiceListening(true);
    vibrate(10);
    recognition.start();
  }

  async function searchLongTerm(query: string) {
    if (!user) return [];
    const localFallback = retrievedMemories.length > 0 ? retrievedMemories : [];
    const fromServer = await callMemorySearch(query, user.id, user.email);
    return fromServer.length > 0 ? fromServer : localFallback;
  }

  async function ingestLongTerm(text: string, kind: "user" | "assistant" | "summary") {
    if (!user) return;
    await ingestMemory(user, text, kind);
  }

  async function sendMessage() {
    if (loading) return;

    const trimmed = input.trim();
    if (!trimmed) return;

    if (!isPro && remainingToday <= 0) {
      setPaywallOpen(true);
      return;
    }

    vibrate([12, 20, 12]);
    setIsFocusMode(false);

    const now = new Date().toISOString();
    const userMessage: Message = {
      id: uid(),
      role: "me",
      text: trimmed,
      time: formatClock(),
      createdAt: now,
    };

    const nextMessages = [...messages, userMessage].slice(-MAX_MESSAGES);
    const nextMemorySummary = buildMemorySummary(nextMessages);

    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    if (!isPro) incrementUsage();

    const startedAt = Date.now();
    const timeContext = buildTimeContext(new Date());
    const memoryPrompt = buildMemoryPrompt(nextMessages, mood, nextMemorySummary, new Date());
    const longTermMemories = await searchLongTerm(trimmed);
    setRetrievedMemories(longTermMemories);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          mood,
          isPro,
          memorySummary: nextMemorySummary,
          memory: memoryPrompt,
          timeContext,
          ragContext: longTermMemories.join("\n"),
          longTermMemories,
        }),
      });

      const data = await response.json().catch(() => ({}));
      const lastAssistant =
        [...messages].reverse().find((m) => m.role === "future me")?.text ?? "";

      const replyText =
        typeof data?.reply === "string" && data.reply.trim()
          ? data.reply.trim()
          : fallbackReply(trimmed, mood, isPro, lastAssistant);

      const remaining = Math.max(0, MIN_REPLY_DELAY_MS - (Date.now() - startedAt));
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      const assistantMessage: Message = {
        id: uid(),
        role: "future me",
        text: replyText,
        time: formatClock(),
        createdAt: new Date().toISOString(),
      };

      const finalMessages = [...nextMessages, assistantMessage].slice(-MAX_MESSAGES);
      setMessages(finalMessages);
      setMemorySummary(buildMemorySummary(finalMessages));
      setMemoryPulse(true);
      window.setTimeout(() => setMemoryPulse(false), 1400);

      if (user) {
        await saveCloudTurn(user, trimmed, replyText, nextMemorySummary);
        await ingestLongTerm(trimmed, "user");
        await ingestLongTerm(replyText, "assistant");
        await ingestLongTerm(nextMemorySummary, "summary");
      }
    } catch {
      const remaining = Math.max(0, MIN_REPLY_DELAY_MS - (Date.now() - startedAt));
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      const replyText = fallbackReply(trimmed, mood, isPro);
      const assistantMessage: Message = {
        id: uid(),
        role: "future me",
        text: replyText,
        time: formatClock(),
        createdAt: new Date().toISOString(),
      };

      const finalMessages = [...nextMessages, assistantMessage].slice(-MAX_MESSAGES);
      setMessages(finalMessages);
      setMemorySummary(buildMemorySummary(finalMessages));
      setMemoryPulse(true);
      window.setTimeout(() => setMemoryPulse(false), 1400);

      if (user) {
        await saveCloudTurn(user, trimmed, replyText, nextMemorySummary);
      }
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }

  function startOver() {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(MEMORY_SUMMARY_KEY);
    setMessages([WELCOME_MESSAGE]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setMood("honest");
    setLoading(false);
    setMenuOpen(false);
    setPaywallOpen(false);
    setShowSaveSheet(false);
    setIsPro(false);
    setUsage(defaultUsage());
    setMemorySummary("");
    setRetrievedMemories([]);
    setActiveTab("chat");
    setContextMenu(null);
    setIsFocusMode(false);
    textareaRef.current?.focus();
  }

  async function shareConversation() {
    const transcript = messages
      .map((m) => `${m.role === "me" ? "You" : "Future Me"}: ${m.text}`)
      .join("\n\n");

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Future Me",
          text: transcript,
        });
        return;
      }

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(transcript);
      }
    } catch {
      // ignore
    }
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setMenuOpen(false);
  }

  function openUpgrade() {
    setMenuOpen(false);
    setPaywallOpen(true);
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const handleTextareaChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  const openMessageMenu = (message: Message, x: number, y: number) => {
    setContextMenu({
      messageId: message.id,
      text: message.text,
      role: message.role,
      x,
      y,
    });
  };

  const handleLongPressStart = (message: Message) => (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse") return;
    longPressTimerRef.current = setTimeout(() => {
      vibrate(15);
      openMessageMenu(message, e.clientX, e.clientY);
    }, 450);
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleThreadScroll = (e: UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollBottom(distanceToBottom > 120);
  };

  const topMenuItems: QuickActionItem[] = [
    { label: "Start over", onClick: startOver },
    { label: "Share conversation", onClick: shareConversation },
    { label: "Upgrade to Pro", onClick: openUpgrade },
    ...(user ? [{ label: "Sign out", onClick: () => void signOut() }] : []),
    { label: "Close", onClick: () => setMenuOpen(false) },
  ];

  const messageMenuItems: QuickActionItem[] = contextMenu
    ? [
        { label: "Copy text", onClick: () => void copyMessage(contextMenu.text, contextMenu.messageId) },
        { label: "Share", onClick: () => void shareMessage(contextMenu.text) },
        { label: "Deepen this thought", onClick: () => deepenThought(contextMenu.text) },
        ...(contextMenu.role === "me"
          ? [{ label: "Delete", onClick: () => deleteMessage(contextMenu.messageId), tone: "danger" as const }]
          : []),
      ]
    : [];

  return (
    <main style={styles.page}>
      <style jsx global>{`
        :root {
          color-scheme: dark;
        }

        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          width: 100%;
          min-height: 100%;
          height: auto;
          background-color: #09090d;
          color: #ffffff;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          overflow-x: hidden;
          overflow-y: auto;
        }

        button,
        textarea {
          font: inherit;
        }

        button {
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }

        textarea {
          outline: none;
        }

        ::selection {
          background: rgba(255, 255, 255, 0.18);
          color: #ffffff;
        }

        ::-webkit-scrollbar {
          width: 0;
          height: 0;
        }

        @keyframes floatIn {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.99);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.8;
          }
        }
      `}</style>

      <div style={styles.noiseOverlay} />
      <div style={styles.glowA} />
      <div style={styles.glowB} />

      {showSaveSheet && <div style={styles.sheetBackdrop} onClick={() => setShowSaveSheet(false)} />}
      {menuOpen && <div style={styles.sheetBackdrop} onClick={() => setMenuOpen(false)} />}
      {paywallOpen && <div style={styles.paywallBackdrop} onClick={() => setPaywallOpen(false)} />}
      {contextMenu && (
        <div
          style={{
            ...styles.sheetBackdrop,
            background: "transparent",
            zIndex: 90,
          }}
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu(null);
          }}
        />
      )}

      <QuickActionsMenu
        open={menuOpen}
        mode="sheet"
        title="Future Me"
        subtitle="Quick actions"
        items={topMenuItems}
        onClose={() => setMenuOpen(false)}
      />

      <QuickActionsMenu
        open={Boolean(contextMenu && contextMenuPosition)}
        mode="context"
        title="Message"
        subtitle="Actions"
        items={messageMenuItems}
        onClose={() => setContextMenu(null)}
        position={contextMenuPosition ?? { left: 16, top: 16 }}
      />

      {showSaveSheet && (
        <aside style={styles.sheet}>
          <div>
            <div style={styles.sheetTitle}>Save with email</div>
            <div style={styles.sheetSub}>
              Enter your email to send yourself a magic link and save this conversation.
            </div>
          </div>

          <input
            style={styles.sheetInput}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@email.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void signInWithEmail();
              }
            }}
          />

          <button
            style={{ ...styles.sheetPrimary, opacity: emailCooldownUntil > Date.now() || sendingEmail ? 0.6 : 1 }}
            onClick={() => void signInWithEmail()}
            disabled={sendingEmail || emailCooldownUntil > Date.now()}
          >
            {sendingEmail
              ? "Sending..."
              : emailCooldownUntil > Date.now()
                ? `Wait ${Math.ceil((emailCooldownUntil - Date.now()) / 1000)}s`
                : "Send magic link"}
          </button>

          <button style={styles.sheetSecondary} onClick={() => setShowSaveSheet(false)}>
            Close
          </button>

          {loginStatus ? <div style={styles.sheetHint}>{loginStatus}</div> : null}
        </aside>
      )}

      {paywallOpen && (
        <aside style={styles.paywall}>
          <div style={styles.paywallHeader}>
            <div style={styles.paywallTitle}>Future Me Pro</div>
            <div style={styles.paywallSub}>
              More memory. Deeper replies. Longer conversations. The app starts to feel like it actually knows your
              story.
            </div>
          </div>

          <div style={styles.freeTag}>{isPro ? "Pro active" : `Free: ${remainingToday} left today`}</div>

          <div style={styles.featureCard}>
            <div style={styles.paywallSub}>What changes in Pro</div>
            <div style={styles.featureList}>
              <div style={styles.featureItem}>
                <span style={styles.featureDot} />
                Longer memory and fewer generic replies.
              </div>
              <div style={styles.featureItem}>
                <span style={styles.featureDot} />
                Mood modes that actually change the tone.
              </div>
              <div style={styles.featureItem}>
                <span style={styles.featureDot} />
                Unlimited messages and longer conversations.
              </div>
              <div style={styles.featureItem}>
                <span style={styles.featureDot} />
                Better sharing and a more personal feel.
              </div>
            </div>
          </div>

          <div style={styles.paywallButtons}>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }} style={styles.proButton} onClick={() => setIsPro(true)}>
              Unlock demo Pro
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }} style={styles.ghostButton} onClick={shareConversation}>
              Share conversation
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }} style={styles.ghostButton} onClick={() => setPaywallOpen(false)}>
              Not now
            </motion.button>
          </div>

          <div style={styles.hintLine}>
            After you add real checkout, redirect back with <code>?pro=1</code> and the app will unlock automatically.
          </div>
        </aside>
      )}

      {isFocusMode && (
        <div style={styles.focusModeOverlay}>
          <div style={styles.focusModeHeader}>
            <span style={styles.focusModeTitle}>Focus Mode</span>
            <button
              style={styles.focusModeClose}
              onClick={() => setIsFocusMode(false)}
            >
              ✕
            </button>
          </div>

          <textarea
            autoFocus
            style={styles.focusModeTextarea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Keep writing. No distractions."
          />

          <div style={styles.focusModeFooter}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              style={{ ...styles.sendButton, minWidth: 150 }}
              onClick={() => void sendMessage()}
              disabled={loading}
            >
              {loading ? "Thinking..." : "Send"}
            </motion.button>
          </div>
        </div>
      )}

      <div style={styles.shell}>
        <TopBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onMenuOpen={() => setMenuOpen(true)}
          userLabel={user ? "synced cloud memory" : "guest mode · local memory"}
          isPro={isPro}
        />

        <AnimatePresence mode="wait" initial={false}>
          {activeTab === "chat" ? (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22 }}
              style={{ display: "grid", gap: 14 }}
            >
              {!hasConversationStarted ? (
                <InteractiveGlassCard accent={accent} style={styles.hero}>
                  <div style={styles.heroShine} />
                  <div style={styles.heroTop}>
                    <span style={styles.badge}>✦ AI Mode Active</span>
                    <span style={styles.badgeAccent}>👑 {isPro ? "Pro" : "Pro Mode"}</span>
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
                      <div style={styles.metricValue}>{isPro ? "∞" : "Pro Mode"}</div>
                      <div style={styles.metricLabel}>{isPro ? "Unlimited" : "Locked"}</div>
                    </div>
                    <div style={styles.metricCard}>
                      <div style={styles.metricValue}>{memorySummary ? "3 days" : "—"}</div>
                      <div style={styles.metricLabel}>Memory connected</div>
                    </div>
                  </div>
                </InteractiveGlassCard>
              ) : (
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
                        onClick={continueFromYesterday}
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
                      onClick={() => setMenuOpen(true)}
                    >
                      Open actions
                    </motion.button>
                  </div>
                </InteractiveGlassCard>
              )}

              <div style={styles.statusRow}>
                <span style={styles.pill}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: isPro ? "#4caf7a" : "#ff9e5e",
                      boxShadow: `0 0 8px ${isPro ? "#4caf7a" : "#ff9e5e"}`,
                    }}
                  />
                  {isPro ? "Pro active" : `Free: ${remainingToday} left today`}
                </span>
                <span style={styles.pill}>{user ? "synced to cloud" : "guest mode"}</span>
                <span style={styles.pill}>{visibleMessageCount} messages</span>
                {!user ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    style={styles.pillAction}
                    type="button"
                    onClick={() => setShowSaveSheet(true)}
                  >
                    Save with email
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    style={styles.pillAction}
                    type="button"
                    onClick={() => setMenuOpen(true)}
                  >
                    Account
                  </motion.button>
                )}
              </div>

              <InteractiveGlassCard accent={accent} style={styles.memoryCard}>
                <div style={styles.memoryGlow} />
                <div style={styles.memoryHeader}>
                  <div style={styles.memoryTitleWrap}>
                    <div style={styles.memoryIcon}>🧠</div>
                    <div>
                      <div style={styles.memoryTitle}>Long-term Memory</div>
                      <div style={styles.memoryMeta}>RAG / vector search ready</div>
                    </div>
                  </div>
                  <div style={styles.memoryUpdated}>Updated just now</div>
                </div>

                <div style={styles.memoryQuote}>
                  “
                  {memorySummary ||
                    "You’ve been thinking about direction, fear of wasting time, and wanting to build something real. You value freedom, growth and honesty with yourself."}
                  ”
                </div>

                <div style={styles.memoryPills}>
                  {(retrievedMemories.length > 0
                    ? retrievedMemories
                    : [
                        "No long-term hits yet.",
                        "Add /api/memory/search and /api/memory/ingest for vector memory.",
                      ]
                  ).slice(0, 3).map((item, idx) => (
                    <span key={`${item}-${idx}`} style={styles.memoryPill}>
                      {item}
                    </span>
                  ))}
                </div>
              </InteractiveGlassCard>

              <section>
                <div style={styles.moodSection}>
                  <div>
                    <div style={styles.moodHeading}>Choose Mood</div>
                    <div style={styles.moodSub}>AI adapts tone to your current mindset</div>
                  </div>

                  <div style={styles.moodRow}>
                    {(Object.keys(moodLabels) as Mood[]).map((item) => {
                      const active = item === mood;
                      return (
                        <motion.button
                          key={item}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.96 }}
                          type="button"
                          onClick={() => {
                            setMood(item);
                            vibrate(8);
                          }}
                          style={active ? styles.moodButtonActive : styles.moodButton}
                        >
                          <div style={{ ...styles.moodGlow, opacity: active ? 1 : 0 }} />
                          <div style={{ ...styles.moodIcon, color: active ? accent : "rgba(255,255,255,0.58)" }}>
                            {moodIcons[item]}
                          </div>
                          <div style={styles.moodLabel}>{moodLabels[item]}</div>
                          <div style={styles.moodLabelSub}>{active ? moodHints[item] : " "}</div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </section>

              <InteractiveGlassCard accent={accent} style={styles.aiPanel}>
                <div style={styles.aiHeader}>
                  <div style={styles.aiHeaderLeft}>
                    <div style={styles.avatar}>FM</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={styles.aiTitle}>Future Me</div>
                      <div style={styles.aiSub}>{hasConversationStarted ? "Online & remembering" : "Ready to respond"}</div>
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

              <InteractiveGlassCard accent={accent} style={styles.threadCard}>
                <div style={styles.threadGlow} />
                <div style={styles.threadHeader}>
                  <div style={styles.threadLeft}>
                    <div style={styles.avatar}>FM</div>
                    <div style={styles.threadText}>
                      <div style={styles.threadName}>Future Me</div>
                      <div style={styles.threadMeta}>private chat · persistent memory</div>
                    </div>
                  </div>

                  <div style={styles.liveChip}>
                    <span style={styles.liveDot} />
                    {liveLabel}
                  </div>
                </div>

                <div ref={threadBodyRef} style={styles.threadBody} onScroll={handleThreadScroll}>
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
                          onCopy={copyMessage}
                          onSpeak={speakMessage}
                          onOpenMenu={openMessageMenu}
                          onLongPressStart={handleLongPressStart}
                          onLongPressEnd={handleLongPressEnd}
                        />
                      ))}
                    </AnimatePresence>

                    <AnimatePresence initial={false}>
                      {loading ? (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          style={styles.typingRow}
                        >
                          <div style={styles.typingBubble}>
                            <span style={styles.typingDots}>
                              <span style={styles.typingDot} />
                              <span style={{ ...styles.typingDot, animationDelay: "120ms" }} />
                              <span style={{ ...styles.typingDot, animationDelay: "240ms" }} />
                            </span>{" "}
                            typing…
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>

                    <div ref={bottomRef} />
                  </div>
                </div>

                {showScrollBottom && (
                  <button
                    style={styles.scrollBottomBtn}
                    onClick={() => {
                      setShowScrollBottom(false);
                      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
                    }}
                  >
                    ↓
                  </button>
                )}
              </InteractiveGlassCard>

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
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder={composerPlaceholder}
                    rows={1}
                  />

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    style={styles.micButton}
                    onClick={() => void startVoice()}
                    disabled={loading}
                  >
                    {voiceListening ? "■" : "◉"}
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    style={styles.sendButton}
                    onClick={() => void sendMessage()}
                    disabled={loading}
                  >
                    {loading ? "Thinking..." : "Send"}
                  </motion.button>
                </div>

                <div style={styles.helper}>
                  Press Enter to send · Shift+Enter for a new line ·{" "}
                  {isPro ? "Pro memory active" : `${remainingToday} free messages left today`}
                </div>

                <div style={styles.voiceHint}>
                  Haptics fires on send and mood changes. Voice input uses the browser speech engine when available.
                </div>
              </InteractiveGlassCard>
            </motion.div>
          ) : (
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
                    : [{ label: "No clear themes yet", count: 1 }]).map((item) => {
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
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
