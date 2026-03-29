"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type Role = "me" | "future me";
type Mood = "calm" | "honest" | "direct" | "wise";

type Message = {
  id: string;
  role: Role;
  text: string;
  time: string;
};

type Usage = {
  date: string;
  count: number;
};

type PersistedState = {
  messages: Message[];
  input: string;
  mood: Mood;
  isPro: boolean;
  usage: Usage;
};

type MessageRow = {
  id: string;
  role: Role;
  text: string;
  created_at: string;
};

type ProfileRow = {
  user_id: string;
  email: string | null;
  memory_summary: string | null;
  last_seen_at: string | null;
};

const STORAGE_KEY = "future-me-draft";
const MEMORY_SUMMARY_KEY = "future-me-memory";
const EMAIL_COOLDOWN_KEY = "future-me-email-cooldown-until";
const FREE_LIMIT = 5;
const MAX_MESSAGES = 50;
const MIN_REPLY_DELAY_MS = 650;
const EMAIL_COOLDOWN_MS = 60_000;

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "future me",
  text: "Write one thought. I’ll keep the conversation going.",
  time: "now",
};

const moodLabels: Record<Mood, string> = {
  calm: "Calm",
  honest: "Honest",
  direct: "Direct",
  wise: "Wise",
};

const moodIcons: Record<Mood, string> = {
  calm: "☾",
  honest: "☺",
  direct: "⚡",
  wise: "◉",
};

const moodHints: Record<Mood, string> = {
  calm: "slow the noise down",
  honest: "say the real thing",
  direct: "cut to the point",
  wise: "see the pattern",
};

const moodPlaceholders: Record<Mood, string> = {
  calm: "What feels heavy right now?",
  honest: "What are you actually avoiding?",
  direct: "Say the thing.",
  wise: "What really matters here?",
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatClock() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultUsage(): Usage {
  return { date: todayKey(), count: 0 };
}

function normalizeUsage(value: unknown): Usage {
  const today = todayKey();
  if (
    value &&
    typeof value === "object" &&
    typeof (value as Usage).date === "string" &&
    typeof (value as Usage).count === "number"
  ) {
    const usage = value as Usage;
    if (usage.date === today) {
      return { date: today, count: Math.max(0, usage.count) };
    }
  }
  return defaultUsage();
}

function looksFinnish(text: string) {
  const t = text.toLowerCase();
  return (
    /[äöå]/.test(t) ||
    /(suomeksi|voisitko|voinko|mikä|mitä|tämä|tätä|olen|ehkä|miksi|nyt|kyllä|ei|siksi|koska)/i.test(t)
  );
}

function fallbackReply(latestUserText: string, mood: Mood, isPro: boolean, lastAssistantText = "") {
  const seed = `${latestUserText}|${lastAssistantText}|${mood}|${isPro ? "pro" : "free"}`;
  const isFinnish = looksFinnish(seed);

  const freeSets: Record<Mood, { en: string[]; fi: string[] }> = {
    calm: {
      en: [
        "Pause first. You do not need to solve it in one move.",
        "The answer is usually quieter than the fear around it.",
      ],
      fi: [
        "Pysähdy ensin. Tätä ei tarvitse ratkaista yhdellä liikkeellä.",
        "Vastaus on yleensä hiljaisempi kuin sen ympärillä oleva pelko.",
      ],
    },
    honest: {
      en: [
        "You are not really asking for information. You are asking for permission.",
        "The cost matters more than the option itself.",
      ],
      fi: [
        "Et taida hakea pelkkää vastausta. Haluat että päätös tuntuisi vähemmän raskaalta.",
        "Hinta taitaa olla tärkeämpi kuin itse vaihtoehto.",
      ],
    },
    direct: {
      en: [
        "This is simpler than it feels. Decide, then move.",
        "The hesitation is the real problem, not the choice.",
      ],
      fi: [
        "Tämä on yksinkertaisempi kuin miltä tuntuu. Päätä ja liiku.",
        "Epäröinti on varsinainen ongelma, ei valinta.",
      ],
    },
    wise: {
      en: [
        "The real question is what this changes, not whether it works.",
        "The hidden cost is usually the part worth paying attention to.",
      ],
      fi: [
        "Oikea kysymys ei ehkä ole onnistuuko tämä, vaan mitä tämä muuttaa.",
        "Piilohinta on yleensä se kohta, johon kannattaa kiinnittää huomiota.",
      ],
    },
  };

  const proSets: Record<Mood, { en: string[]; fi: string[] }> = {
    calm: {
      en: [
        "You do not need more force. You need a cleaner decision.",
        "The fact that this still feels heavy is the clue.",
      ],
      fi: [
        "Et tarvitse enemmän voimaa. Tarvitset selkeämmän päätöksen.",
        "Se että tämä tuntuu yhä raskaalta on jo vihje.",
      ],
    },
    honest: {
      en: [
        "You already know the answer, you are just negotiating with it.",
        "What you call uncertainty is often just attachment to the easier path.",
      ],
      fi: [
        "Tiedät jo vastauksen, neuvottelet vain sen kanssa.",
        "Se mitä kutsut epävarmuudeksi on usein kiintymystä helpompaan polkuun.",
      ],
    },
    direct: {
      en: [
        "Choose the thing you will respect tomorrow.",
        "Do not optimize for comfort. Optimize for the version of you that has to live with it.",
      ],
      fi: [
        "Valitse se, mitä kunnioitat huomenna.",
        "Älä optimoi mukavuuden mukaan. Optimoi sen sinun version mukaan, joka elää seurauksen kanssa.",
      ],
    },
    wise: {
      en: [
        "The tradeoff is the point. Once you name it, the decision gets smaller.",
        "You are not choosing between good and bad. You are choosing which cost is worth paying.",
      ],
      fi: [
        "Vaihdon hinta on se juttu. Kun sanot sen ääneen, päätös pienenee.",
        "Et valitse hyvän ja pahan välillä. Valitset minkä hinnan haluat maksaa.",
      ],
    },
  };

  const source = (isPro ? proSets : freeSets)[mood];
  const pool = isFinnish ? source.fi : source.en;
  const score = [...seed].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return pool[Math.abs(score) % pool.length];
}

function buildMemorySummary(messages: Message[]) {
  const userTexts = messages
    .filter((m) => m.role === "me")
    .slice(-6)
    .map((m) => m.text.trim())
    .filter(Boolean)
    .join(" • ");

  return userTexts.slice(0, 240);
}

function buildMemoryPrompt(messages: Message[], mood: Mood, memorySummary = "") {
  const recentUserMessages = messages
    .filter((m) => m.role === "me")
    .slice(-4)
    .map((m) => m.text)
    .join(" | ");

  return `Mood: ${mood}. Recent user messages: ${recentUserMessages}${memorySummary ? ` | Summary: ${memorySummary}` : ""}`.slice(0, 240);
}

function loadDraft(key: string): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed || !Array.isArray(parsed.messages)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveDraft(key: string, value: PersistedState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function profileToMemoryKey(email?: string | null) {
  return email ? `future-me-memory:${email.trim().toLowerCase()}` : MEMORY_SUMMARY_KEY;
}

function profileToDraftKey(email?: string | null) {
  return email ? `future-me-draft:${email.trim().toLowerCase()}` : STORAGE_KEY;
}

function normalizeMessageRows(rows: MessageRow[] | null | undefined): Message[] {
  return (rows ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    text: m.text,
    time: new Date(m.created_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));
}

async function loadCloudState(userId: string) {
  if (!supabase) return { profile: null as ProfileRow | null, messages: [] as Message[] };

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
      .limit(80),
  ]);

  return {
    profile: (profileRes.data ?? null) as ProfileRow | null,
    messages: normalizeMessageRows((messagesRes.data ?? []) as MessageRow[]),
  };
}

async function saveCloudTurn(user: User, userText: string, assistantText: string, memorySummary: string) {
  if (!supabase) return;

  const now = new Date().toISOString();

  const insertRes = await supabase.from("messages").insert([
    { user_id: user.id, role: "me", text: userText },
    { user_id: user.id, role: "future me", text: assistantText },
  ]);
  if (insertRes.error) console.error(insertRes.error);

  const profileRes = await supabase.from("profiles").upsert({
    user_id: user.id,
    email: user.email ?? null,
    memory_summary: memorySummary,
    last_seen_at: now,
  });
  if (profileRes.error) console.error(profileRes.error);
}

function readEmailCooldownUntil() {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(EMAIL_COOLDOWN_KEY) || "0");
}

function writeEmailCooldownUntil(ts: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EMAIL_COOLDOWN_KEY, String(ts));
}

function createStyles(
  mobile: boolean,
  isPro: boolean,
  hasConversationStarted: boolean,
  loading: boolean,
  mood: Mood,
  accent: string
): Record<string, CSSProperties> {
  return {
    page: {
      minHeight: "100dvh",
      height: "auto",
      overflowY: "auto",
      overflowX: "hidden",
      WebkitOverflowScrolling: "touch",
      padding: mobile ? 10 : 16,
      background:
        "radial-gradient(circle at 50% 10%, rgba(255,255,255,0.92), rgba(255,255,255,0.0) 30%), radial-gradient(circle at 20% 20%, rgba(155,120,255,0.16), transparent 28%), radial-gradient(circle at 85% 18%, rgba(255,194,117,0.14), transparent 24%), linear-gradient(180deg, #f6f0e8 0%, #ebe4d8 100%)",
      color: "#101826",
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      position: "relative",
    },
    shell: {
      minHeight: "100dvh",
      height: "auto",
      maxWidth: 980,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      gap: 12,
      paddingBottom: 18,
      position: "relative",
      zIndex: 1,
    },
    glowA: {
      position: "fixed",
      inset: "auto auto 6% -8%",
      width: 280,
      height: 280,
      borderRadius: 999,
      background: "radial-gradient(circle, rgba(255,255,255,0.60), rgba(255,255,255,0))",
      filter: "blur(20px)",
      pointerEvents: "none",
      zIndex: 0,
    },
    glowB: {
      position: "fixed",
      inset: "8% -6% auto auto",
      width: 330,
      height: 330,
      borderRadius: 999,
      background: "radial-gradient(circle, rgba(255,255,255,0.36), rgba(255,255,255,0))",
      filter: "blur(24px)",
      pointerEvents: "none",
      zIndex: 0,
    },
    topBar: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: "10px 10px",
      background: "linear-gradient(180deg, rgba(255,255,255,0.82), rgba(255,255,255,0.56))",
      borderRadius: 24,
      border: "1px solid rgba(16,24,38,0.08)",
      boxShadow: "0 16px 46px rgba(16,24,38,0.08)",
      backdropFilter: "blur(18px)",
    },
    topTitle: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 2,
      textAlign: "center",
      flex: 1,
      minWidth: 0,
    },
    brand: {
      fontSize: mobile ? 18 : 20,
      fontWeight: 900,
      letterSpacing: "-0.04em",
      lineHeight: 1.05,
    },
    brandSub: {
      fontSize: 12,
      color: "rgba(16,24,38,0.58)",
      maxWidth: 220,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 16,
      border: "1px solid rgba(16,24,38,0.08)",
      background: "rgba(255,255,255,0.80)",
      color: "#101826",
      display: "grid",
      placeItems: "center",
      cursor: "pointer",
      boxShadow: "0 12px 26px rgba(16,24,38,0.05)",
    },
    hero: {
      borderRadius: 30,
      padding: mobile ? 18 : 22,
      background: hasConversationStarted
        ? "linear-gradient(135deg, rgba(255,255,255,0.84), rgba(255,255,255,0.62))"
        : "linear-gradient(180deg, rgba(255,255,255,0.88), rgba(255,255,255,0.60))",
      border: "1px solid rgba(16,24,38,0.08)",
      boxShadow: "0 22px 60px rgba(16,24,38,0.08)",
      backdropFilter: "blur(18px)",
      overflow: "hidden",
      position: "relative",
      transition: "all 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
    },
    heroShine: {
      position: "absolute",
      inset: "-40% auto auto 54%",
      width: 260,
      height: 260,
      borderRadius: 999,
      background: `radial-gradient(circle, ${accent}44, ${accent}00)`,
      filter: "blur(8px)",
      pointerEvents: "none",
    },
    heroTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
      flexWrap: "wrap",
      marginBottom: 12,
      position: "relative",
      zIndex: 1,
    },
    badge: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      borderRadius: 999,
      background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.72))",
      border: "1px solid rgba(16,24,38,0.06)",
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: "0.02em",
      width: "fit-content",
      boxShadow: "0 8px 20px rgba(16,24,38,0.04)",
    },
    badgeAccent: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      borderRadius: 999,
      background: isPro
        ? "linear-gradient(180deg, rgba(76,175,122,0.16), rgba(76,175,122,0.10))"
        : "linear-gradient(180deg, rgba(141,107,61,0.14), rgba(141,107,61,0.08))",
      border: "1px solid rgba(16,24,38,0.06)",
      color: isPro ? "#206f47" : "#7c5a2f",
      fontSize: 12,
      fontWeight: 800,
      width: "fit-content",
      boxShadow: "0 8px 20px rgba(16,24,38,0.04)",
    },
    heroTitle: {
      fontSize: mobile ? 30 : 42,
      fontWeight: 950,
      letterSpacing: "-0.06em",
      lineHeight: 0.96,
      maxWidth: 560,
      marginBottom: 10,
      position: "relative",
      zIndex: 1,
    },
    heroSub: {
      fontSize: mobile ? 14 : 15,
      lineHeight: 1.6,
      color: "rgba(16,24,38,0.68)",
      maxWidth: 720,
      position: "relative",
      zIndex: 1,
    },
    heroMetrics: {
      display: "grid",
      gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(3, minmax(0, 1fr))",
      gap: 10,
      marginTop: 18,
      position: "relative",
      zIndex: 1,
    },
    metricCard: {
      borderRadius: 22,
      padding: 14,
      background: "rgba(255,255,255,0.70)",
      border: "1px solid rgba(16,24,38,0.07)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
    },
    metricValue: {
      fontSize: mobile ? 20 : 24,
      fontWeight: 900,
      letterSpacing: "-0.04em",
      lineHeight: 1,
    },
    metricLabel: {
      fontSize: 12,
      color: "rgba(16,24,38,0.56)",
      marginTop: 4,
    },
    compactHero: {
      borderRadius: 30,
      padding: mobile ? 18 : 22,
      background: "linear-gradient(135deg, rgba(255,255,255,0.86), rgba(255,255,255,0.60))",
      border: "1px solid rgba(16,24,38,0.08)",
      boxShadow: "0 22px 60px rgba(16,24,38,0.08)",
      backdropFilter: "blur(18px)",
      overflow: "hidden",
      position: "relative",
    },
    compactTitle: {
      fontSize: mobile ? 24 : 30,
      fontWeight: 950,
      letterSpacing: "-0.05em",
      lineHeight: 1,
      marginTop: 10,
    },
    compactSub: {
      marginTop: 10,
      fontSize: mobile ? 14 : 15,
      lineHeight: 1.6,
      color: "rgba(16,24,38,0.68)",
      maxWidth: 760,
    },
    compactActionRow: {
      marginTop: 14,
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
    },
    compactButton: {
      border: 0,
      borderRadius: 16,
      padding: "11px 14px",
      background: "#101826",
      color: "#f5efe6",
      fontWeight: 900,
      boxShadow: "0 16px 32px rgba(16,24,38,0.16)",
    },
    compactGhost: {
      border: "1px solid rgba(16,24,38,0.08)",
      borderRadius: 16,
      padding: "11px 14px",
      background: "rgba(255,255,255,0.82)",
      color: "#101826",
      fontWeight: 800,
      boxShadow: "0 10px 24px rgba(16,24,38,0.05)",
    },
    statusRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      alignItems: "center",
    },
    pill: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      borderRadius: 999,
      border: "1px solid rgba(16,24,38,0.06)",
      background: "rgba(255,255,255,0.55)",
      color: "rgba(16,24,38,0.75)",
      fontSize: 12,
      backdropFilter: "blur(12px)",
      boxShadow: "0 10px 30px rgba(16,24,38,0.04)",
    },
    pillAction: {
      border: "1px solid rgba(16,24,38,0.06)",
      background: "rgba(255,255,255,0.72)",
      color: "#101826",
      padding: "8px 12px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      boxShadow: "0 10px 30px rgba(16,24,38,0.04)",
    },
    memoryCard: {
      borderRadius: 26,
      padding: 16,
      background: "linear-gradient(180deg, rgba(52,32,40,0.94), rgba(33,24,34,0.96))",
      border: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "0 20px 56px rgba(26,18,26,0.18)",
      backdropFilter: "blur(18px)",
      display: "grid",
      gap: 12,
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
      gap: 10,
      minWidth: 0,
    },
    memoryIcon: {
      width: 32,
      height: 32,
      borderRadius: 12,
      display: "grid",
      placeItems: "center",
      background: "linear-gradient(180deg, rgba(255,139,214,0.24), rgba(122,93,255,0.18))",
      color: "#f7b3ff",
      boxShadow: "0 0 0 1px rgba(255,255,255,0.05) inset",
      flex: "0 0 auto",
    },
    memoryTitle: {
      fontSize: 15,
      fontWeight: 900,
      letterSpacing: "-0.03em",
      color: "#fff",
    },
    memoryMeta: {
      fontSize: 12,
      color: "rgba(255,255,255,0.64)",
      marginTop: 2,
    },
    memoryUpdated: {
      fontSize: 12,
      color: "rgba(255,255,255,0.66)",
      whiteSpace: "nowrap",
    },
    memoryQuote: {
      borderRadius: 20,
      padding: 14,
      background: "linear-gradient(180deg, rgba(17,14,22,0.96), rgba(28,22,30,0.96))",
      color: "#f8f5ff",
      border: "1px solid rgba(255,255,255,0.06)",
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.02)",
      lineHeight: 1.6,
      fontSize: 13,
      whiteSpace: "pre-wrap",
    },
    memoryGlow: {
      position: "absolute",
      inset: "auto auto -18% 62%",
      width: 160,
      height: 160,
      borderRadius: 999,
      background: "radial-gradient(circle, rgba(177,97,255,0.20), rgba(177,97,255,0))",
      filter: "blur(8px)",
      pointerEvents: "none",
    },
    moodSection: {
      display: "grid",
      gap: 8,
    },
    moodHeading: {
      fontSize: 18,
      fontWeight: 900,
      letterSpacing: "-0.04em",
    },
    moodSub: {
      fontSize: 13,
      color: "rgba(16,24,38,0.56)",
      lineHeight: 1.5,
    },
    moodRow: {
      display: "grid",
      gridTemplateColumns: mobile ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))",
      gap: 10,
    },
    moodButton: {
      position: "relative",
      border: "1px solid rgba(16,24,38,0.06)",
      borderRadius: 20,
      padding: "14px 12px",
      background: "linear-gradient(180deg, rgba(255,255,255,0.82), rgba(255,255,255,0.66))",
      color: "#101826",
      display: "grid",
      gap: 4,
      justifyItems: "center",
      boxShadow: "0 14px 30px rgba(16,24,38,0.05)",
      overflow: "hidden",
    },
    moodButtonActive: {
      position: "relative",
      border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: 20,
      padding: "14px 12px",
      background: "linear-gradient(180deg, rgba(24,28,46,0.98), rgba(14,18,31,0.98))",
      color: "#fff",
      display: "grid",
      gap: 4,
      justifyItems: "center",
      boxShadow: `0 0 0 1px ${accent}33 inset, 0 18px 42px rgba(16,24,38,0.18), 0 0 22px ${accent}66`,
      overflow: "hidden",
    },
    moodIcon: {
      fontSize: 18,
      lineHeight: 1,
    },
    moodLabel: {
      fontSize: 13,
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
      width: 90,
      height: 90,
      borderRadius: 999,
      background: `radial-gradient(circle, ${accent}50, ${accent}00)`,
      filter: "blur(4px)",
      pointerEvents: "none",
    },
    aiPanel: {
      borderRadius: 26,
      padding: 16,
      background: "linear-gradient(180deg, rgba(255,255,255,0.82), rgba(255,255,255,0.60))",
      border: "1px solid rgba(16,24,38,0.07)",
      boxShadow: "0 18px 46px rgba(16,24,38,0.07)",
      backdropFilter: "blur(18px)",
      display: "grid",
      gap: 12,
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
      background: loading ? "#64748b" : hasConversationStarted ? "#3bc6a1" : "#8d6b3d",
      boxShadow: loading
        ? "0 0 0 6px rgba(100,116,139,0.14)"
        : hasConversationStarted
          ? "0 0 0 6px rgba(59,198,161,0.14)"
          : "0 0 0 6px rgba(141,107,61,0.14)",
      flex: "0 0 auto",
    },
    aiTitle: {
      fontSize: 15,
      fontWeight: 900,
      letterSpacing: "-0.03em",
      lineHeight: 1.15,
    },
    aiSub: {
      marginTop: 2,
      fontSize: 12,
      color: "rgba(16,24,38,0.58)",
      lineHeight: 1.4,
    },
    aiPill: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      borderRadius: 999,
      background: "rgba(16,24,38,0.05)",
      border: "1px solid rgba(16,24,38,0.06)",
      fontSize: 12,
      fontWeight: 800,
      color: "rgba(16,24,38,0.72)",
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
      padding: "7px 10px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.72)",
      border: "1px solid rgba(16,24,38,0.06)",
      fontSize: 12,
      color: "rgba(16,24,38,0.74)",
      fontWeight: 700,
    },
    threadCard: {
      display: "flex",
      flexDirection: "column",
      borderRadius: 34,
      background: "linear-gradient(180deg, rgba(255,255,255,0.80), rgba(255,255,255,0.60))",
      border: "1px solid rgba(16,24,38,0.08)",
      boxShadow: "0 26px 70px rgba(16,24,38,0.10)",
      overflow: "hidden",
      backdropFilter: "blur(22px)",
      minHeight: mobile ? 360 : 520,
      position: "relative",
    },
    threadGlow: {
      position: "absolute",
      inset: "-30% auto auto -12%",
      width: 220,
      height: 220,
      borderRadius: 999,
      background: "radial-gradient(circle, rgba(255,255,255,0.40), rgba(255,255,255,0))",
      filter: "blur(12px)",
      pointerEvents: "none",
      zIndex: 0,
    },
    threadHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: 16,
      borderBottom: "1px solid rgba(16,24,38,0.06)",
      background: "rgba(255,255,255,0.38)",
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
      width: 42,
      height: 42,
      borderRadius: 16,
      background: "linear-gradient(135deg, #101826, #26364f)",
      color: "#f5efe6",
      display: "grid",
      placeItems: "center",
      fontSize: 14,
      fontWeight: 900,
      boxShadow: "0 12px 24px rgba(16,24,38,0.16)",
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
    },
    threadMeta: {
      fontSize: 12,
      color: "rgba(16,24,38,0.56)",
    },
    liveChip: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      borderRadius: 999,
      background: "rgba(16,24,38,0.05)",
      border: "1px solid rgba(16,24,38,0.06)",
      fontSize: 12,
      color: "rgba(16,24,38,0.7)",
      boxShadow: "0 10px 26px rgba(16,24,38,0.04)",
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      background: isPro ? "#4caf7a" : "#8d6b3d",
      boxShadow: isPro ? "0 0 0 5px rgba(76,175,122,0.16)" : "0 0 0 5px rgba(141,107,61,0.14)",
    },
    threadBody: {
      flex: "1 1 auto",
      minHeight: 0,
      display: "flex",
      flexDirection: "column",
      padding: mobile ? 12 : 16,
      position: "relative",
      zIndex: 1,
    },
    stream: {
      display: "flex",
      flexDirection: "column",
      gap: 12,
      paddingBottom: 4,
    },
    messageRow: {
      display: "flex",
      width: "100%",
      animation: "floatIn 220ms ease both",
    },
    meRow: { justifyContent: "flex-end" },
    futureMeRow: { justifyContent: "flex-start" },
    messageBubble: {
      maxWidth: mobile ? "90%" : "72%",
      minWidth: 0,
      padding: mobile ? "12px 13px" : "12px 14px",
      borderRadius: 26,
      fontSize: mobile ? 13 : 14,
      lineHeight: 1.5,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      overflowWrap: "anywhere",
      letterSpacing: "-0.005em",
      position: "relative",
      boxSizing: "border-box",
      boxShadow: "0 14px 30px rgba(16,24,38,0.06)",
      backdropFilter: "blur(10px)",
    },
    meBubble: {
      background: "linear-gradient(135deg, #111827, #1f2940)",
      color: "#f5efe6",
      boxShadow: "0 16px 34px rgba(16,24,38,0.18)",
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      borderBottomLeftRadius: 26,
      borderBottomRightRadius: 16,
    },
    futureMeBubble: {
      background: "rgba(255,255,255,0.76)",
      color: "#101826",
      border: "1px solid rgba(16,24,38,0.06)",
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 26,
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
      background: "rgba(16,24,38,0.06)",
      color: "rgba(16,24,38,0.72)",
    },
    messageRoleMe: {
      background: "rgba(255,255,255,0.10)",
      color: "#f5efe6",
    },
    copyButton: {
      border: "1px solid rgba(16,24,38,0.08)",
      borderRadius: 999,
      padding: "6px 10px",
      background: "rgba(255,255,255,0.74)",
      color: "#101826",
      fontSize: 11,
      fontWeight: 800,
      boxShadow: "0 8px 18px rgba(16,24,38,0.04)",
    },
    messageText: {
      fontSize: mobile ? 13 : 14,
      lineHeight: 1.6,
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
    },
    timestamp: {
      marginTop: 8,
      fontSize: 11,
      color: "rgba(16,24,38,0.52)",
    },
    typingRow: {
      display: "flex",
      justifyContent: "flex-start",
      animation: "floatIn 180ms ease both",
    },
    typingBubble: {
      padding: "12px 14px",
      borderRadius: 26,
      background: "rgba(16,24,38,0.05)",
      color: "rgba(16,24,38,0.58)",
      fontSize: 14,
      letterSpacing: "0.02em",
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
      animation: "pulse 1.1s ease-in-out infinite",
    },
    composerShell: {
      flex: "0 0 auto",
      borderRadius: 26,
      background: "linear-gradient(180deg, rgba(255,255,255,0.80), rgba(255,255,255,0.58))",
      border: "1px solid rgba(16,24,38,0.08)",
      boxShadow: "0 26px 70px rgba(16,24,38,0.10)",
      backdropFilter: "blur(22px)",
      overflow: "hidden",
    },
    composerTop: {
      display: "flex",
      justifyContent: "space-between",
      gap: 10,
      flexWrap: "wrap",
      padding: "14px 14px 0",
    },
    composerChip: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "7px 10px",
      borderRadius: 999,
      background: "rgba(16,24,38,0.05)",
      color: "rgba(16,24,38,0.7)",
      border: "1px solid rgba(16,24,38,0.06)",
      fontSize: 12,
      fontWeight: 800,
    },
    composerRow: {
      display: "flex",
      gap: 8,
      alignItems: "flex-end",
      padding: 12,
      flexDirection: mobile ? "column" : "row",
    },
    composerTextarea: {
      flex: 1,
      width: "100%",
      minHeight: 52,
      maxHeight: 140,
      resize: "none",
      borderRadius: 20,
      border: "1px solid rgba(16,24,38,0.08)",
      background: "rgba(255,255,255,0.92)",
      color: "#101826",
      padding: "13px 13px",
      lineHeight: 1.45,
      fontSize: 14,
      outline: "none",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.72)",
      transition: "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
    },
    sendButton: {
      minWidth: mobile ? "100%" : 102,
      border: 0,
      borderRadius: 20,
      padding: "12px 16px",
      background: `linear-gradient(180deg, ${accent}, ${accent}CC)`,
      color: "#ffffff",
      fontWeight: 900,
      boxShadow: `0 16px 32px ${accent}44, 0 0 26px ${accent}44`,
      transition: "transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease",
    },
    helper: {
      padding: "0 16px 16px",
      fontSize: 12,
      color: "rgba(16,24,38,0.54)",
      lineHeight: 1.5,
    },
    sheetBackdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,38,0.24)",
      backdropFilter: "blur(4px)",
      zIndex: 40,
    },
    sheet: {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 50,
      background: "rgba(255,255,255,0.96)",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTop: "1px solid rgba(16,24,38,0.08)",
      padding: 16,
      boxShadow: "0 -18px 50px rgba(16,24,38,0.16)",
      display: "grid",
      gap: 12,
      backdropFilter: "blur(18px)",
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: 900,
      letterSpacing: "-0.03em",
    },
    sheetSub: {
      marginTop: 3,
      fontSize: 12,
      color: "rgba(16,24,38,0.56)",
      lineHeight: 1.5,
    },
    sheetGroup: {
      display: "grid",
      gap: 8,
    },
    sheetButton: {
      width: "100%",
      textAlign: "left",
      borderRadius: 16,
      padding: "12px 14px",
      border: "1px solid rgba(16,24,38,0.08)",
      background: "rgba(255,255,255,0.88)",
      color: "#101826",
      fontWeight: 800,
      boxShadow: "0 10px 24px rgba(16,24,38,0.04)",
    },
    paywallBackdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,38,0.28)",
      backdropFilter: "blur(8px)",
      zIndex: 60,
    },
    paywall: {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 70,
      background: "rgba(255,255,255,0.98)",
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderTop: "1px solid rgba(16,24,38,0.08)",
      padding: 16,
      boxShadow: "0 -18px 60px rgba(16,24,38,0.18)",
      display: "grid",
      gap: 12,
      backdropFilter: "blur(18px)",
    },
    paywallHeader: {
      display: "grid",
      gap: 4,
    },
    paywallTitle: {
      fontSize: 20,
      fontWeight: 950,
      letterSpacing: "-0.04em",
    },
    paywallSub: {
      fontSize: 13,
      lineHeight: 1.5,
      color: "rgba(16,24,38,0.62)",
    },
    featureCard: {
      borderRadius: 20,
      padding: 14,
      background: "rgba(16,24,38,0.04)",
      border: "1px solid rgba(16,24,38,0.06)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
    },
    featureList: {
      display: "grid",
      gap: 8,
      marginTop: 4,
    },
    featureItem: {
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      fontSize: 14,
      lineHeight: 1.5,
      color: "#101826",
    },
    featureDot: {
      width: 8,
      height: 8,
      marginTop: 6,
      borderRadius: 999,
      background: "#101826",
      flex: "0 0 auto",
    },
    paywallButtons: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
    },
    proButton: {
      border: 0,
      borderRadius: 16,
      padding: "12px 16px",
      background: "#101826",
      color: "#f5efe6",
      fontWeight: 900,
      boxShadow: "0 16px 32px rgba(16,24,38,0.16)",
    },
    ghostButton: {
      border: "1px solid rgba(16,24,38,0.08)",
      borderRadius: 16,
      padding: "12px 16px",
      background: "rgba(255,255,255,0.88)",
      color: "#101826",
      fontWeight: 800,
      boxShadow: "0 12px 24px rgba(16,24,38,0.05)",
    },
    hintLine: {
      fontSize: 12,
      color: "rgba(16,24,38,0.56)",
      lineHeight: 1.5,
    },
    freeTag: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      borderRadius: 999,
      background: isPro ? "rgba(76,175,122,0.12)" : "rgba(141,107,61,0.10)",
      color: isPro ? "#206f47" : "#7c5a2f",
      border: "1px solid rgba(16,24,38,0.06)",
      fontSize: 12,
      fontWeight: 800,
      width: "fit-content",
      boxShadow: "0 10px 26px rgba(16,24,38,0.04)",
    },
    sheetInput: {
      borderRadius: 16,
      border: "1px solid rgba(16,24,38,0.08)",
      padding: "12px 14px",
      background: "rgba(255,255,255,0.92)",
      fontSize: 15,
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
    },
    sheetPrimary: {
      border: 0,
      borderRadius: 16,
      padding: "12px 16px",
      background: "#101826",
      color: "#f5efe6",
      fontWeight: 900,
      boxShadow: "0 16px 32px rgba(16,24,38,0.16)",
    },
    sheetSecondary: {
      border: "1px solid rgba(16,24,38,0.08)",
      borderRadius: 16,
      padding: "12px 16px",
      background: "rgba(255,255,255,0.88)",
      color: "#101826",
      fontWeight: 800,
      boxShadow: "0 12px 24px rgba(16,24,38,0.05)",
    },
    sheetHint: {
      fontSize: 12,
      color: "rgba(16,24,38,0.56)",
      lineHeight: 1.5,
    },
  };
}

export default function Page() {
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

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const accentMap: Record<Mood, string> = {
    calm: "#5b8def",
    honest: "#f3a85f",
    direct: "#3bc6a1",
    wise: "#8f67f2",
  };
  const accent = accentMap[mood];

  const remainingToday =
    usage.date === todayKey() ? Math.max(0, FREE_LIMIT - usage.count) : FREE_LIMIT;

  const draftKey = useMemo(() => profileToDraftKey(user?.email), [user?.email]);
  const memoryKey = useMemo(() => profileToMemoryKey(user?.email), [user?.email]);
  const hasConversationStarted = messages.some((m) => m.id !== "welcome");
  const visibleMessageCount = Math.max(0, messages.filter((m) => m.id !== "welcome").length);
  const liveLabel = loading ? "responding..." : hasConversationStarted ? "online" : "ready";
  const liveSub = loading
    ? "reframing your thought"
    : hasConversationStarted
      ? memorySummary
        ? "memory connected"
        : "holding context"
      : "waiting for the first thought";
  const composerPlaceholder = moodPlaceholders[mood];
  const memoryBadge = memoryPulse ? "memory updated" : user ? "cloud sync on" : "private draft";

  useEffect(() => {
    const update = () => setMobile(window.innerWidth < 900);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const initialCooldown = readEmailCooldownUntil();
    setEmailCooldownUntilState(initialCooldown);
    const timer = window.setInterval(() => {
      setEmailCooldownUntilState(readEmailCooldownUntil());
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
    saveDraft(draftKey, {
      messages: messages.slice(-MAX_MESSAGES),
      input,
      mood,
      isPro,
      usage,
    });
    window.localStorage.setItem(memoryKey, memorySummary);
  }, [draftKey, hydrated, input, isPro, messages, mood, memoryKey, memorySummary, usage]);

  useEffect(() => {
    const derived = buildMemorySummary(messages);
    setMemorySummary(derived);
    if (user?.email) {
      window.localStorage.setItem(memoryKey, derived);
    }
  }, [messages, memoryKey, user?.email]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  useEffect(() => {
    document.body.style.overflow = menuOpen || paywallOpen || showSaveSheet ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [menuOpen, paywallOpen, showSaveSheet]);

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
    () => createStyles(mobile, isPro, hasConversationStarted, loading, mood, accent),
    [mobile, isPro, hasConversationStarted, loading, mood, accent]
  );

  function incrementUsage() {
    const today = todayKey();
    const nextUsage =
      usage.date === today ? { date: today, count: usage.count + 1 } : { date: today, count: 1 };
    setUsage(nextUsage);
    return nextUsage;
  }

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
  }

  async function signInWithEmail() {
    if (!supabase) {
      setLoginStatus("Supabase env vars are missing.");
      return;
    }

    const email = emailInput.trim().toLowerCase();
    if (!email) return;

    const cooldownUntil = readEmailCooldownUntil();
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
    } catch {
      // ignore
    }
  }

  async function sendMessage() {
    if (loading) return;

    const trimmed = input.trim();
    if (!trimmed) return;

    if (!isPro && remainingToday <= 0) {
      setPaywallOpen(true);
      return;
    }

    const userMessage: Message = {
      id: uid(),
      role: "me",
      text: trimmed,
      time: formatClock(),
    };

    const nextMessages = [...messages, userMessage].slice(-MAX_MESSAGES);
    const nextMemorySummary = buildMemorySummary(nextMessages);

    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    if (!isPro) incrementUsage();

    const startedAt = Date.now();
    const memoryPrompt = buildMemoryPrompt(nextMessages, mood, nextMemorySummary);

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
      };

      const finalMessages = [...nextMessages, assistantMessage].slice(-MAX_MESSAGES);
      setMessages(finalMessages);
      setMemorySummary(buildMemorySummary(finalMessages));
      setMemoryPulse(true);
      window.setTimeout(() => setMemoryPulse(false), 1400);

      if (user) {
        await saveCloudTurn(user, trimmed, replyText, nextMemorySummary);
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
    setMood("honest");
    setLoading(false);
    setMenuOpen(false);
    setPaywallOpen(false);
    setShowSaveSheet(false);
    setIsPro(false);
    setUsage(defaultUsage());
    setMemorySummary("");
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

  return (
    <main style={styles.page}>
      <style jsx global>{`
        :root {
          color-scheme: light;
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
          background:
            radial-gradient(circle at 50% 10%, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0) 30%),
            radial-gradient(circle at 20% 20%, rgba(155, 120, 255, 0.16), transparent 28%),
            radial-gradient(circle at 85% 18%, rgba(255, 194, 117, 0.14), transparent 24%),
            linear-gradient(180deg, #f6f0e8 0%, #ebe4d8 100%);
          color: #101826;
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
          background: rgba(16, 24, 38, 0.14);
          color: #101826;
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
            opacity: 0.45;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>

      <div style={styles.glowA} />
      <div style={styles.glowB} />

      {showSaveSheet && <div style={styles.sheetBackdrop} onClick={() => setShowSaveSheet(false)} />}
      {menuOpen && <div style={styles.sheetBackdrop} onClick={() => setMenuOpen(false)} />}
      {paywallOpen && <div style={styles.paywallBackdrop} onClick={() => setPaywallOpen(false)} />}

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

      {menuOpen && (
        <aside style={styles.sheet}>
          <div>
            <div style={styles.sheetTitle}>Future Me</div>
            <div style={styles.sheetSub}>Quick actions</div>
          </div>

          <div style={styles.sheetGroup}>
            <button style={styles.sheetButton} onClick={startOver}>
              Start over
            </button>
            <button style={styles.sheetButton} onClick={shareConversation}>
              Share conversation
            </button>
            <button style={styles.sheetButton} onClick={openUpgrade}>
              Upgrade to Pro
            </button>
            {user ? (
              <button style={styles.sheetButton} onClick={() => void signOut()}>
                Sign out
              </button>
            ) : null}
            <button style={styles.sheetButton} onClick={() => setMenuOpen(false)}>
              Close
            </button>
          </div>
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
            <button style={styles.proButton} onClick={() => setIsPro(true)}>
              Unlock demo Pro
            </button>
            <button style={styles.ghostButton} onClick={shareConversation}>
              Share conversation
            </button>
            <button style={styles.ghostButton} onClick={() => setPaywallOpen(false)}>
              Not now
            </button>
          </div>

          <div style={styles.hintLine}>
            After you add real checkout, redirect back with <code>?pro=1</code> and the app will unlock automatically.
          </div>
        </aside>
      )}

      <div style={styles.shell}>
        <header style={styles.topBar}>
          <button style={styles.iconButton} aria-label="Menu" onClick={() => setMenuOpen(true)}>
            ≡
          </button>

          <div style={styles.topTitle}>
            <div style={styles.brand}>Future Me</div>
            <div style={styles.brandSub}>{user ? "synced cloud memory" : "guest mode · local memory"}</div>
          </div>

          <button style={styles.iconButton} aria-label="Menu" onClick={() => setMenuOpen(true)}>
            ⋯
          </button>
        </header>

        {!hasConversationStarted ? (
          <section style={styles.hero}>
            <div style={styles.heroShine} />
            <div style={styles.heroTop}>
              <span style={styles.badge}>✦ AI Mode Active</span>
              <span style={styles.badgeAccent}>👑 {isPro ? "Pro" : "Pro Mode"}</span>
            </div>

            <div style={styles.heroTitle}>
              Your future self, <br />
              but <span style={{ color: accent }}>sharper.</span>
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
          </section>
        ) : (
          <section style={styles.compactHero}>
            <div style={styles.heroTop}>
              <span style={styles.badge}>Conversation in motion</span>
              <span style={styles.badgeAccent}>{memoryBadge}</span>
            </div>

            <div style={styles.compactTitle}>The thread is alive.</div>
            <div style={styles.compactSub}>
              You are mid-conversation. The next message will fold into memory, sync to cloud when signed in, and keep
              the story moving.
            </div>

            <div style={styles.compactActionRow}>
              {memorySummary ? (
                <button style={styles.compactButton} onClick={continueFromYesterday}>
                  Continue from yesterday
                </button>
              ) : (
                <button style={styles.compactButton} onClick={() => textareaRef.current?.focus()}>
                  Keep writing
                </button>
              )}
              <button style={styles.compactGhost} onClick={() => setMenuOpen(true)}>
                Open actions
              </button>
            </div>
          </section>
        )}

        <div style={styles.statusRow}>
          <span style={styles.pill}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: isPro ? "#4caf7a" : "#8d6b3d",
              }}
            />
            {isPro ? "Pro active" : `Free: ${remainingToday} left today`}
          </span>
          <span style={styles.pill}>{user ? "synced to cloud" : "guest mode"}</span>
          <span style={styles.pill}>{visibleMessageCount} messages</span>
          {!user ? (
            <button style={styles.pillAction} type="button" onClick={() => setShowSaveSheet(true)}>
              Save with email
            </button>
          ) : (
            <button style={styles.pillAction} type="button" onClick={() => setMenuOpen(true)}>
              Account
            </button>
          )}
        </div>

        <section style={styles.memoryCard}>
          <div style={styles.memoryGlow} />
          <div style={styles.memoryHeader}>
            <div style={styles.memoryTitleWrap}>
              <div style={styles.memoryIcon}>🧠</div>
              <div>
                <div style={styles.memoryTitle}>Memory Snapshot</div>
                <div style={styles.memoryMeta}>AI remembers the thread</div>
              </div>
            </div>
            <div style={styles.memoryUpdated}>Updated 2 min ago</div>
          </div>

          <div style={styles.memoryQuote}>
            “{memorySummary ||
              "You’ve been thinking about direction, fear of wasting time, and wanting to build something real. You value freedom, growth and honesty with yourself."}”
          </div>
        </section>

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
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMood(item)}
                    style={active ? styles.moodButtonActive : styles.moodButton}
                  >
                    {active ? <div style={styles.moodGlow} /> : null}
                    <div style={styles.moodIcon}>{moodIcons[item]}</div>
                    <div style={styles.moodLabel}>{moodLabels[item]}</div>
                    <div style={styles.moodLabelSub}>{active ? moodHints[item] : " "}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section style={styles.aiPanel}>
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
        </section>

        <section style={styles.threadCard}>
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

          <div style={styles.threadBody}>
            <div style={styles.stream}>
              {messages.map((message) => {
                const isUser = message.role === "me";
                const roleStyle = isUser ? { ...styles.messageRole, ...styles.messageRoleMe } : styles.messageRole;

                return (
                  <div
                    key={message.id}
                    style={{
                      ...styles.messageRow,
                      justifyContent: isUser ? "flex-end" : "flex-start",
                      animation: "floatIn 220ms ease both",
                    }}
                  >
                    <article style={{ ...styles.messageBubble, ...(isUser ? styles.meBubble : styles.futureMeBubble) }}>
                      <div style={styles.messageTop}>
                        <span style={roleStyle}>{isUser ? "You" : "Future Me"}</span>
                        <button
                          type="button"
                          style={styles.copyButton}
                          onClick={() => void copyMessage(message.text, message.id)}
                        >
                          {copiedId === message.id ? "Copied" : "Copy"}
                        </button>
                      </div>

                      <div style={styles.messageText}>{message.text}</div>
                      <div style={styles.timestamp}>{message.time}</div>
                    </article>
                  </div>
                );
              })}

              {loading ? (
                <div style={styles.typingRow}>
                  <div style={styles.typingBubble}>
                    <span style={styles.typingDots}>
                      <span style={styles.typingDot} />
                      <span style={{ ...styles.typingDot, animationDelay: "120ms" }} />
                      <span style={{ ...styles.typingDot, animationDelay: "240ms" }} />
                    </span>{" "}
                    typing…
                  </div>
                </div>
              ) : null}

              <div ref={bottomRef} />
            </div>
          </div>
        </section>

        <section style={styles.composerShell}>
          <div style={styles.composerTop}>
            <span style={styles.composerChip}>{moodLabels[mood]} mode</span>
            <span style={styles.composerChip}>{memoryBadge}</span>
          </div>

          <div style={styles.composerRow}>
            <textarea
              ref={textareaRef}
              style={styles.composerTextarea}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={composerPlaceholder}
              rows={1}
            />

            <button style={styles.sendButton} onClick={() => void sendMessage()} disabled={loading}>
              {loading ? "Thinking..." : "Send"}
            </button>
          </div>

          <div style={styles.helper}>
            Press Enter to send · Shift+Enter for a new line ·{" "}
            {isPro ? "Pro memory active" : `${remainingToday} free messages left today`}
          </div>
        </section>
      </div>
    </main>
  );
}
