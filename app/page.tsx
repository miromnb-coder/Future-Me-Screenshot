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

const STORAGE_KEY = "future-me-v6";
const MEMORY_SUMMARY_KEY = "future-me-memory-summary";
const FREE_LIMIT = 5;
const MAX_MESSAGES = 50;
const MIN_REPLY_DELAY_MS = 850;
const EMAIL_COOLDOWN_MS = 60_000;
const EMAIL_COOLDOWN_KEY = "future-me-email-cooldown-until";

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "future me",
  text: "Write one thought. I’ll keep the conversation going.",
  time: "now"
};

const moodLabels: Record<Mood, string> = {
  calm: "Calm",
  honest: "Honest",
  direct: "Direct",
  wise: "Wise"
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatClock() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
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
        "The answer is usually quieter than the fear around it."
      ],
      fi: [
        "Pysähdy ensin. Tätä ei tarvitse ratkaista yhdellä liikkeellä.",
        "Vastaus on yleensä hiljaisempi kuin sen ympärillä oleva pelko."
      ]
    },
    honest: {
      en: [
        "You are not really asking for information. You are asking for permission.",
        "The cost matters more than the option itself."
      ],
      fi: [
        "Et taida hakea pelkkää vastausta. Haluat että päätös tuntuisi vähemmän raskaalta.",
        "Hinta taitaa olla tärkeämpi kuin itse vaihtoehto."
      ]
    },
    direct: {
      en: [
        "This is simpler than it feels. Decide, then move.",
        "The hesitation is the real problem, not the choice."
      ],
      fi: [
        "Tämä on yksinkertaisempi kuin miltä tuntuu. Päätä ja liiku.",
        "Epäröinti on varsinainen ongelma, ei valinta."
      ]
    },
    wise: {
      en: [
        "The real question is what this changes, not whether it works.",
        "The hidden cost is usually the part worth paying attention to."
      ],
      fi: [
        "Oikea kysymys ei ehkä ole onnistuuko tämä, vaan mitä tämä muuttaa.",
        "Piilohinta on yleensä se kohta, johon kannattaa kiinnittää huomiota."
      ]
    }
  };

  const proSets: Record<Mood, { en: string[]; fi: string[] }> = {
    calm: {
      en: [
        "You do not need more force. You need a cleaner decision.",
        "The fact that this still feels heavy is the clue."
      ],
      fi: [
        "Et tarvitse enemmän voimaa. Tarvitset selkeämmän päätöksen.",
        "Se että tämä tuntuu yhä raskaalta on jo vihje."
      ]
    },
    honest: {
      en: [
        "You already know the answer, you are just negotiating with it.",
        "What you call uncertainty is often just attachment to the easier path."
      ],
      fi: [
        "Tiedät jo vastauksen, neuvottelet vain sen kanssa.",
        "Se mitä kutsut epävarmuudeksi on usein kiintymystä helpompaan polkuun."
      ]
    },
    direct: {
      en: [
        "Choose the thing you will respect tomorrow.",
        "Do not optimize for comfort. Optimize for the version of you that has to live with it."
      ],
      fi: [
        "Valitse se, mitä kunnioitat huomenna.",
        "Älä optimoi mukavuuden mukaan. Optimoi sen sinun version mukaan, joka elää seurauksen kanssa."
      ]
    },
    wise: {
      en: [
        "The tradeoff is the point. Once you name it, the decision gets smaller.",
        "You are not choosing between good and bad. You are choosing which cost is worth paying."
      ],
      fi: [
        "Vaihdon hinta on se juttu. Kun sanot sen ääneen, päätös pienenee.",
        "Et valitse hyvän ja pahan välillä. Valitset minkä hinnan haluat maksaa."
      ]
    }
  };

  const source = (isPro ? proSets : freeSets)[mood];
  const pool = isFinnish ? source.fi : source.en;
  const score = [...seed].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return pool[Math.abs(score) % pool.length];
}

function buildMemory(messages: Message[], mood: Mood, memorySummary = "") {
  const recentUserMessages = messages
    .filter((m) => m.role === "me")
    .slice(-4)
    .map((m) => m.text)
    .join(" | ");

  return `Mood: ${mood}. Recent user messages: ${recentUserMessages}${
    memorySummary ? ` | Summary: ${memorySummary}` : ""
  }`.slice(0, 240);
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

function readDraft(key: string): PersistedState | null {
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

function writeDraft(key: string, value: PersistedState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

async function loadDbMessages(client: SupabaseClient, userId: string): Promise<Message[] | null> {
  const { data, error } = await client
    .from("messages")
    .select("id, role, text, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return null;
  }

  const rows = (data ?? []) as MessageRow[];
  return rows.map((m) => ({
    id: m.id,
    role: m.role,
    text: m.text,
    time: new Date(m.created_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    })
  }));
}

function createStyles(mobile: boolean, isPro: boolean): Record<string, CSSProperties> {
  return {
    page: {
      minHeight: "100dvh",
      height: "auto",
      overflowY: "auto",
      overflowX: "hidden",
      WebkitOverflowScrolling: "touch",
      padding: mobile ? 10 : 16,
      background:
        "radial-gradient(circle at top left, rgba(255,255,255,0.70), transparent 24%), radial-gradient(circle at top right, rgba(255,255,255,0.28), transparent 20%), linear-gradient(180deg, #f4efe7 0%, #ebe4d8 100%)",
      color: "#101826",
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    },
    shell: {
      minHeight: "100dvh",
      height: "auto",
      maxWidth: 860,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      gap: 12,
      paddingBottom: 18
    },
    topBar: {
      flex: "0 0 auto",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: "8px 2px 8px",
      backdropFilter: "blur(16px)",
      background: "linear-gradient(180deg, rgba(244,239,231,0.96), rgba(244,239,231,0.80))",
      borderRadius: 18
    },
    topTitle: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 2,
      textAlign: "center",
      flex: 1
    },
    brand: {
      fontSize: 18,
      fontWeight: 800,
      letterSpacing: "-0.035em"
    },
    brandSub: {
      fontSize: 12,
      color: "rgba(16,24,38,0.56)"
    },
    iconButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      border: "1px solid rgba(16,24,38,0.08)",
      background: "rgba(255,255,255,0.78)",
      color: "#101826",
      display: "grid",
      placeItems: "center",
      cursor: "pointer",
      boxShadow: "0 12px 26px rgba(16,24,38,0.05)"
    },
    statusRow: {
      flex: "0 0 auto",
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      alignItems: "center"
    },
    pill: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      borderRadius: 999,
      border: "1px solid rgba(16,24,38,0.06)",
      background: "rgba(255,255,255,0.52)",
      color: "rgba(16,24,38,0.72)",
      fontSize: 12,
      letterSpacing: "0.01em",
      backdropFilter: "blur(12px)"
    },
    pillAction: {
      border: "1px solid rgba(16,24,38,0.06)",
      background: "rgba(255,255,255,0.66)",
      color: "#101826",
      padding: "8px 12px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600
    },
    moodRow: {
      flex: "0 0 auto",
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    },
    moodButton: {
      border: "1px solid rgba(16,24,38,0.08)",
      background: "rgba(255,255,255,0.68)",
      color: "#101826",
      padding: "9px 13px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600
    },
    moodButtonActive: {
      border: "1px solid rgba(16,24,38,0.10)",
      background: "#101826",
      color: "#f5efe6",
      padding: "9px 13px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700
    },
    memoryCard: {
      borderRadius: 20,
      padding: 12,
      background: "rgba(16,24,38,0.05)",
      border: "1px solid rgba(16,24,38,0.06)",
      display: "grid",
      gap: 6
    },
    memoryTitle: {
      fontSize: 13,
      fontWeight: 800,
      letterSpacing: "-0.02em"
    },
    memoryText: {
      fontSize: 13,
      lineHeight: 1.5,
      color: "rgba(16,24,38,0.72)"
    },
    memoryButton: {
      border: 0,
      borderRadius: 16,
      padding: "10px 14px",
      background: "#101826",
      color: "#f5efe6",
      fontWeight: 700,
      width: "fit-content"
    },
    threadCard: {
      display: "flex",
      flexDirection: "column",
      borderRadius: 30,
      background: "rgba(255,255,255,0.62)",
      border: "1px solid rgba(16,24,38,0.07)",
      boxShadow: "0 22px 60px rgba(16,24,38,0.08)",
      overflow: "hidden",
      backdropFilter: "blur(18px)",
      minHeight: mobile ? 320 : 420
    },
    threadHeader: {
      flex: "0 0 auto",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: 16,
      borderBottom: "1px solid rgba(16,24,38,0.06)",
      background: "rgba(255,255,255,0.34)",
      backdropFilter: "blur(10px)"
    },
    threadLeft: {
      display: "flex",
      alignItems: "center",
      gap: 12
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 999,
      background: "linear-gradient(135deg, #101826, #1f2b3d)",
      color: "#f5efe6",
      display: "grid",
      placeItems: "center",
      fontSize: 14,
      fontWeight: 800,
      boxShadow: "0 10px 18px rgba(16,24,38,0.14)"
    },
    threadText: {
      display: "flex",
      flexDirection: "column",
      gap: 2
    },
    threadName: {
      fontSize: 16,
      fontWeight: 800,
      letterSpacing: "-0.03em"
    },
    threadMeta: {
      fontSize: 12,
      color: "rgba(16,24,38,0.56)"
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
      color: "rgba(16,24,38,0.7)"
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      background: isPro ? "#4caf7a" : "#8d6b3d",
      boxShadow: isPro ? "0 0 0 5px rgba(76,175,122,0.16)" : "0 0 0 5px rgba(141,107,61,0.14)"
    },
    threadBody: {
      flex: "1 1 auto",
      minHeight: 0,
      display: "flex",
      flexDirection: "column",
      padding: mobile ? 12 : 16
    },
    stream: {
      flex: "1 1 auto",
      minHeight: 0,
      overflowY: "visible",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      paddingRight: 0,
      paddingBottom: 4
    },
    messageRow: {
      display: "flex",
      width: "100%",
      animation: "floatIn 220ms ease both"
    },
    meRow: {
      justifyContent: "flex-end"
    },
    futureMeRow: {
      justifyContent: "flex-start"
    },
    messageBubble: {
      maxWidth: mobile ? "88%" : "74%",
      minWidth: 0,
      padding: mobile ? "11px 13px" : "12px 14px",
      borderRadius: 24,
      fontSize: mobile ? 13 : 14,
      lineHeight: 1.45,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      overflowWrap: "anywhere",
      letterSpacing: "-0.005em",
      position: "relative",
      boxSizing: "border-box"
    },
    meBubble: {
      background: "linear-gradient(180deg, #101826, #141f2f)",
      color: "#f5efe6",
      boxShadow: "0 12px 24px rgba(16,24,38,0.12)",
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      borderBottomLeftRadius: 26,
      borderBottomRightRadius: 16
    },
    futureMeBubble: {
      background: "rgba(16,24,38,0.06)",
      color: "#101826",
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 26
    },
    timestamp: {
      marginTop: 6,
      fontSize: 11,
      color: "rgba(16,24,38,0.52)"
    },
    typingRow: {
      display: "flex",
      justifyContent: "flex-start",
      animation: "floatIn 180ms ease both"
    },
    typingBubble: {
      padding: "12px 14px",
      borderRadius: 26,
      background: "rgba(16,24,38,0.05)",
      color: "rgba(16,24,38,0.58)",
      fontSize: 14,
      letterSpacing: "0.02em",
      animation: "pulse 1.3s ease-in-out infinite"
    },
    composerShell: {
      flex: "0 0 auto",
      borderRadius: 22,
      background: "rgba(255,255,255,0.72)",
      border: "1px solid rgba(16,24,38,0.07)",
      boxShadow: "0 20px 54px rgba(16,24,38,0.08)",
      backdropFilter: "blur(18px)",
      overflow: "hidden"
    },
    composerRow: {
      display: "flex",
      gap: 8,
      alignItems: "flex-end",
      padding: 12,
      flexDirection: mobile ? "column" : "row"
    },
    composerTextarea: {
      flex: 1,
      width: "100%",
      minHeight: 44,
      maxHeight: 110,
      resize: "none",
      borderRadius: 18,
      border: "1px solid rgba(16,24,38,0.08)",
      background: "rgba(255,255,255,0.88)",
      color: "#101826",
      padding: "11px 12px",
      lineHeight: 1.45,
      fontSize: 14,
      outline: "none",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.72)",
      transition: "border-color 160ms ease, box-shadow 160ms ease"
    },
    sendButton: {
      minWidth: mobile ? "100%" : 80,
      border: 0,
      borderRadius: 18,
      padding: "10px 14px",
      background: "linear-gradient(180deg, #101826, #1b2636)",
      color: "#f5efe6",
      fontWeight: 700,
      boxShadow: "0 12px 22px rgba(16,24,38,0.16)"
    },
    helper: {
      padding: "0 16px 16px",
      fontSize: 12,
      color: "rgba(16,24,38,0.54)",
      lineHeight: 1.5
    },
    sheetBackdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,38,0.24)",
      backdropFilter: "blur(4px)",
      zIndex: 40
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
      gap: 12
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: 800,
      letterSpacing: "-0.03em"
    },
    sheetSub: {
      marginTop: 3,
      fontSize: 12,
      color: "rgba(16,24,38,0.56)",
      lineHeight: 1.5
    },
    sheetGroup: {
      display: "grid",
      gap: 8
    },
    sheetButton: {
      width: "100%",
      textAlign: "left",
      borderRadius: 16,
      padding: "12px 14px",
      border: "1px solid rgba(16,24,38,0.08)",
      background: "rgba(255,255,255,0.88)",
      color: "#101826",
      fontWeight: 600
    },
    paywallBackdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,38,0.28)",
      backdropFilter: "blur(8px)",
      zIndex: 60
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
      gap: 12
    },
    paywallHeader: {
      display: "grid",
      gap: 4
    },
    paywallTitle: {
      fontSize: 20,
      fontWeight: 900,
      letterSpacing: "-0.04em"
    },
    paywallSub: {
      fontSize: 13,
      lineHeight: 1.5,
      color: "rgba(16,24,38,0.62)"
    },
    featureCard: {
      borderRadius: 20,
      padding: 14,
      background: "rgba(16,24,38,0.04)",
      border: "1px solid rgba(16,24,38,0.06)"
    },
    featureList: {
      display: "grid",
      gap: 8,
      marginTop: 4
    },
    featureItem: {
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      fontSize: 14,
      lineHeight: 1.5,
      color: "#101826"
    },
    featureDot: {
      width: 8,
      height: 8,
      marginTop: 6,
      borderRadius: 999,
      background: "#101826",
      flex: "0 0 auto"
    },
    paywallButtons: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap"
    },
    proButton: {
      border: 0,
      borderRadius: 16,
      padding: "12px 16px",
      background: "#101826",
      color: "#f5efe6",
      fontWeight: 800
    },
    ghostButton: {
      border: "1px solid rgba(16,24,38,0.08)",
      borderRadius: 16,
      padding: "12px 16px",
      background: "rgba(255,255,255,0.88)",
      color: "#101826",
      fontWeight: 700
    },
    hintLine: {
      fontSize: 12,
      color: "rgba(16,24,38,0.56)",
      lineHeight: 1.5
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
      fontWeight: 700,
      width: "fit-content"
    },
    sheetInput: {
      borderRadius: 16,
      border: "1px solid rgba(16,24,38,0.08)",
      padding: "12px 14px",
      background: "rgba(255,255,255,0.92)",
      fontSize: 15
    },
    sheetPrimary: {
      border: 0,
      borderRadius: 16,
      padding: "12px 16px",
      background: "#101826",
      color: "#f5efe6",
      fontWeight: 800
    },
    sheetSecondary: {
      border: "1px solid rgba(16,24,38,0.08)",
      borderRadius: 16,
      padding: "12px 16px",
      background: "rgba(255,255,255,0.88)",
      color: "#101826",
      fontWeight: 700
    },
    sheetHint: {
      fontSize: 12,
      color: "rgba(16,24,38,0.56)",
      lineHeight: 1.5
    }
  };
}

function getEmailCooldownUntil() {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(EMAIL_COOLDOWN_KEY) || "0");
}

function setEmailCooldownUntilValue(ts: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EMAIL_COOLDOWN_KEY, String(ts));
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

  const threadRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const remainingToday = usage.date === todayKey() ? Math.max(0, FREE_LIMIT - usage.count) : FREE_LIMIT;
  const cooldownLeftMs = Math.max(0, emailCooldownUntil - Date.now());
  const cooldownLeftSec = Math.ceil(cooldownLeftMs / 1000);
  const emailDisabled = sendingEmail || cooldownLeftMs > 0;

  const activeDraftKey = useMemo(() => {
    return user?.email ? `future-me:${user.email.trim().toLowerCase()}` : STORAGE_KEY;
  }, [user?.email]);

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
    const initialCooldown = getEmailCooldownUntil();
    setEmailCooldownUntilState(initialCooldown);

    const timer = window.setInterval(() => {
      setEmailCooldownUntilState(getEmailCooldownUntil());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedState>;
        if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          setMessages(parsed.messages.slice(-MAX_MESSAGES));
        }
        if (typeof parsed.input === "string") setInput(parsed.input);
        if (parsed.mood && ["calm", "honest", "direct", "wise"].includes(parsed.mood)) {
          setMood(parsed.mood as Mood);
        }
        if (typeof parsed.isPro === "boolean") setIsPro(parsed.isPro);
        if (parsed.usage) setUsage(normalizeUsage(parsed.usage));
      }

      const lastEmail = window.localStorage.getItem("future-me-email");
      if (lastEmail) setEmailInput(lastEmail);

      const savedMemory = window.localStorage.getItem(MEMORY_SUMMARY_KEY) || "";
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
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeDraft(activeDraftKey, {
      messages: messages.slice(-MAX_MESSAGES),
      input,
      mood,
      isPro,
      usage
    });
  }, [messages, input, mood, isPro, usage, hydrated, activeDraftKey]);

  useEffect(() => {
    if (!hydrated) return;

    const summary = buildMemorySummary(messages);
    if (!summary) return;

    setMemorySummary(summary);
    window.localStorage.setItem(MEMORY_SUMMARY_KEY, summary);
  }, [messages, hydrated]);

  useEffect(() => {
    if (user?.email) {
      window.localStorage.setItem("future-me-email", user.email);
    }
  }, [user?.email]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    document.body.style.overflow = menuOpen || paywallOpen || showSaveSheet ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [menuOpen, paywallOpen, showSaveSheet]);

  useEffect(() => {
    if (!supabase) return;

    const hydrateAuth = async () => {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);

      if (sessionUser?.email) {
        setEmailInput(sessionUser.email);
        window.localStorage.setItem("future-me-email", sessionUser.email);

        const emailDraft = readDraft(`future-me:${sessionUser.email.trim().toLowerCase()}`);
        if (emailDraft) {
          if (Array.isArray(emailDraft.messages) && emailDraft.messages.length > 0) {
            setMessages(emailDraft.messages.slice(-MAX_MESSAGES));
          }
          if (typeof emailDraft.input === "string") setInput(emailDraft.input);
          if (emailDraft.mood && ["calm", "honest", "direct", "wise"].includes(emailDraft.mood)) {
            setMood(emailDraft.mood as Mood);
          }
          if (typeof emailDraft.isPro === "boolean") setIsPro(emailDraft.isPro);
        }

        const dbMessages = await loadDbMessages(supabase, sessionUser.id);
        if (dbMessages && dbMessages.length > 0) {
          setMessages(dbMessages.slice(-MAX_MESSAGES));
        }
      }
    };

    void hydrateAuth();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);

      if (!sessionUser?.email) return;

      window.localStorage.setItem("future-me-email", sessionUser.email);
      setEmailInput(sessionUser.email);

      const emailDraft = readDraft(`future-me:${sessionUser.email.trim().toLowerCase()}`);
      if (emailDraft?.messages?.length) {
        setMessages(emailDraft.messages.slice(-MAX_MESSAGES));
      }

      const dbMessages = await loadDbMessages(supabase, sessionUser.id);
      if (dbMessages && dbMessages.length > 0) {
        setMessages(dbMessages.slice(-MAX_MESSAGES));
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const styles = useMemo(() => createStyles(mobile, isPro), [mobile, isPro]);

  function incrementUsage() {
    const today = todayKey();
    const nextUsage = usage.date === today ? { date: today, count: usage.count + 1 } : { date: today, count: 1 };
    setUsage(nextUsage);
    return nextUsage;
  }

  async function signInWithEmail() {
    if (!supabase) {
      setLoginStatus("Supabase env vars are missing.");
      return;
    }

    const email = emailInput.trim().toLowerCase();
    if (!email) return;

    const cooldownUntil = getEmailCooldownUntil();
    if (Date.now() < cooldownUntil) {
      setLoginStatus(`Wait ${Math.ceil((cooldownUntil - Date.now()) / 1000)}s and try again.`);
      return;
    }

    setSendingEmail(true);
    setLoginStatus("Sending magic link...");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/`
      }
    });

    if (error) {
      setLoginStatus(error.message);
      setSendingEmail(false);
      return;
    }

    const until = Date.now() + EMAIL_COOLDOWN_MS;
    setEmailCooldownUntilValue(until);
    setEmailCooldownUntilState(until);
    setLoginStatus("Check your email for the sign-in link.");
    setSendingEmail(false);
  }

  function continueFromYesterday() {
    if (!memorySummary) return;
    setInput((prev) => prev || `Continuing from yesterday: ${memorySummary}. `);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  async function insertMessage(userId: string, role: Role, text: string) {
    if (!supabase) return;

    const { error } = await supabase.from("messages").insert({
      user_id: userId,
      role,
      text
    });

    if (error) console.error(error);
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
      time: formatClock()
    };

    const nextMessages = [...messages, userMessage].slice(-MAX_MESSAGES);
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    if (!isPro) incrementUsage();

    const startedAt = Date.now();
    const memory = buildMemory(nextMessages, mood, memorySummary);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          mood,
          isPro,
          memory
        })
      });

      const data = await response.json().catch(() => ({}));
      const lastAssistant = [...messages].reverse().find((m) => m.role === "future me")?.text ?? "";
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
        time: formatClock()
      };

      setMessages((prev) => [...prev, assistantMessage].slice(-MAX_MESSAGES));

      if (user?.id) {
        await insertMessage(user.id, "me", trimmed);
        await insertMessage(user.id, "future me", replyText);
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
        time: formatClock()
      };

      setMessages((prev) => [...prev, assistantMessage].slice(-MAX_MESSAGES));

      if (user?.id) {
        await insertMessage(user.id, "me", trimmed);
        await insertMessage(user.id, "future me", replyText);
      }
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }

  function startOver() {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(MEMORY_SUMMARY_KEY);
    setMemorySummary("");
    setMessages([WELCOME_MESSAGE]);
    setInput("");
    setMood("honest");
    setLoading(false);
    setMenuOpen(false);
    setPaywallOpen(false);
    setShowSaveSheet(false);
    setIsPro(false);
    setUsage(defaultUsage());
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
          text: transcript
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
            radial-gradient(circle at top left, rgba(255, 255, 255, 0.70), transparent 24%),
            radial-gradient(circle at top right, rgba(255, 255, 255, 0.28), transparent 20%),
            linear-gradient(180deg, #f4efe7 0%, #ebe4d8 100%);
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
            style={{ ...styles.sheetPrimary, opacity: emailDisabled ? 0.6 : 1 }}
            onClick={() => void signInWithEmail()}
            disabled={emailDisabled}
          >
            {sendingEmail ? "Sending..." : cooldownLeftMs > 0 ? `Wait ${cooldownLeftSec}s` : "Send magic link"}
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
            <div style={styles.brandSub}>free-form chat · persistent context</div>
          </div>

          <button style={styles.iconButton} aria-label="Menu" onClick={() => setMenuOpen(true)}>
            ⋯
          </button>
        </header>

        <div style={styles.statusRow}>
          <span style={styles.pill}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: isPro ? "#4caf7a" : "#8d6b3d" }} />
            {isPro ? "Pro active" : `Free: ${remainingToday} left today`}
          </span>
          <span style={styles.pill}>remembers context</span>
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

        {memorySummary ? (
          <div style={styles.memoryCard}>
            <div style={styles.memoryTitle}>Picked up from last time</div>
            <div style={styles.memoryText}>{memorySummary}</div>
            <button style={styles.memoryButton} onClick={continueFromYesterday}>
              Continue from yesterday
            </button>
          </div>
        ) : null}

        <div style={styles.moodRow}>
          {(Object.keys(moodLabels) as Mood[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMood(item)}
              style={item === mood ? styles.moodButtonActive : styles.moodButton}
            >
              {moodLabels[item]}
            </button>
          ))}
        </div>

        <section style={styles.threadCard}>
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
              {loading ? "typing..." : "ready"}
            </div>
          </div>

          <div ref={threadRef} style={styles.threadBody}>
            <div style={styles.stream}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  style={{
                    display: "flex",
                    width: "100%",
                    justifyContent: message.role === "me" ? "flex-end" : "flex-start",
                    animation: "floatIn 220ms ease both"
                  }}
                >
                  <div
                    style={{
                      ...styles.messageBubble,
                      ...(message.role === "me" ? styles.meBubble : styles.futureMeBubble)
                    }}
                  >
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45, overflowWrap: "anywhere" }}>
                      {message.text}
                    </div>
                    <div style={styles.timestamp}>{message.time}</div>
                  </div>
                </div>
              ))}

              {loading ? (
                <div style={styles.typingRow}>
                  <div style={styles.typingBubble}>typing…</div>
                </div>
              ) : null}

              <div ref={bottomRef} />
            </div>
          </div>
        </section>

        <section style={styles.composerShell}>
          <div style={styles.composerRow}>
            <textarea
              ref={textareaRef}
              style={styles.composerTextarea}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write anything..."
              rows={1}
            />

            <button style={styles.sendButton} onClick={() => void sendMessage()} disabled={loading}>
              {loading ? "Sending..." : "Send"}
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
