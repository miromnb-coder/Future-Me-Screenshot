"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { CSSProperties, KeyboardEvent, ChangeEvent } from "react";
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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

function fallbackReply(latestUserText: string, mood: Mood, isPro: boolean) {
  return "The answer is usually quieter than the fear around it. Focus on what stays true when the noise stops.";
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
      padding: mobile ? 10 : 16,
      background: "radial-gradient(circle at 50% 10%, rgba(255,255,255,0.92), rgba(255,255,255,0.0) 30%), radial-gradient(circle at 20% 20%, rgba(155,120,255,0.16), transparent 28%), radial-gradient(circle at 85% 18%, rgba(255,194,117,0.14), transparent 24%), linear-gradient(180deg, #f6f0e8 0%, #ebe4d8 100%)",
      color: "#101826",
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      position: "relative",
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
    shell: {
      minHeight: "100dvh",
      maxWidth: 980,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      gap: 12,
      paddingBottom: 18,
      position: "relative",
      zIndex: 1,
    },
    topBar: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px",
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
      flex: 1,
    },
    brand: {
      fontSize: mobile ? 18 : 20,
      fontWeight: 900,
      letterSpacing: "-0.04em",
    },
    brandSub: {
      fontSize: 12,
      color: "rgba(16,24,38,0.58)",
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 16,
      border: "1px solid rgba(16,24,38,0.08)",
      background: "rgba(255,255,255,0.80)",
      display: "grid",
      placeItems: "center",
      cursor: "pointer",
    },
    hero: {
      borderRadius: 30,
      padding: mobile ? 18 : 22,
      background: "linear-gradient(180deg, rgba(255,255,255,0.88), rgba(255,255,255,0.60))",
      border: "1px solid rgba(16,24,38,0.08)",
      boxShadow: "0 22px 60px rgba(16,24,38,0.08)",
      backdropFilter: "blur(18px)",
      position: "relative",
      overflow: "hidden",
    },
    heroShine: {
      position: "absolute",
      inset: "-40% auto auto 54%",
      width: 260,
      height: 260,
      borderRadius: 999,
      background: `radial-gradient(circle, ${accent}44, ${accent}00)`,
      filter: "blur(8px)",
    },
    heroTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    badge: {
      padding: "8px 12px",
      borderRadius: 999,
      background: "#fff",
      border: "1px solid rgba(16,24,38,0.06)",
      fontSize: 12,
      fontWeight: 800,
    },
    badgeAccent: {
      padding: "8px 12px",
      borderRadius: 999,
      background: isPro ? "rgba(76,175,122,0.12)" : "rgba(141,107,61,0.10)",
      color: isPro ? "#206f47" : "#7c5a2f",
      border: "1px solid rgba(16,24,38,0.06)",
      fontSize: 12,
      fontWeight: 800,
    },
    heroTitle: {
      fontSize: mobile ? 30 : 42,
      fontWeight: 950,
      letterSpacing: "-0.06em",
      lineHeight: 0.96,
      marginBottom: 10,
    },
    heroSub: {
      fontSize: mobile ? 14 : 15,
      color: "rgba(16,24,38,0.68)",
      maxWidth: 720,
    },
    heroMetrics: {
      display: "grid",
      gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(3, 1fr)",
      gap: 10,
      marginTop: 18,
    },
    metricCard: {
      borderRadius: 22,
      padding: 14,
      background: "rgba(255,255,255,0.70)",
      border: "1px solid rgba(16,24,38,0.07)",
    },
    metricValue: {
      fontSize: mobile ? 20 : 24,
      fontWeight: 900,
      lineHeight: 1,
    },
    metricLabel: {
      fontSize: 12,
      color: "rgba(16,24,38,0.56)",
      marginTop: 4,
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
      fontSize: 12,
    },
    pillAction: {
      padding: "8px 12px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.72)",
      border: "1px solid rgba(16,24,38,0.06)",
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
    },
    memoryCard: {
      borderRadius: 26,
      padding: 16,
      background: "linear-gradient(180deg, rgba(52,32,40,0.94), rgba(33,24,34,0.96))",
      border: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "0 20px 56px rgba(26,18,26,0.18)",
      color: "#fff",
      position: "relative",
      overflow: "hidden",
    },
    memoryHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    memoryTitleWrap: {
      display: "flex",
      alignItems: "center",
      gap: 10,
    },
    memoryIcon: {
      width: 32,
      height: 32,
      borderRadius: 12,
      background: "rgba(255,255,255,0.1)",
      display: "grid",
      placeItems: "center",
    },
    memoryQuote: {
      borderRadius: 20,
      padding: 14,
      background: "rgba(0,0,0,0.2)",
      fontSize: 13,
      lineHeight: 1.6,
      fontStyle: "italic",
    },
    moodSection: {
      display: "grid",
      gap: 8,
    },
    moodRow: {
      display: "grid",
      gridTemplateColumns: mobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
      gap: 10,
    },
    moodButton: {
      borderRadius: 20,
      padding: "14px 12px",
      background: "#fff",
      border: "1px solid rgba(16,24,38,0.06)",
      display: "grid",
      placeItems: "center",
      cursor: "pointer",
    },
    moodButtonActive: {
      borderRadius: 20,
      padding: "14px 12px",
      background: "#101826",
      color: "#fff",
      border: `1px solid ${accent}`,
      display: "grid",
      placeItems: "center",
      cursor: "pointer",
      boxShadow: `0 0 15px ${accent}44`,
    },
    aiPanel: {
      borderRadius: 26,
      padding: 16,
      background: "rgba(255,255,255,0.8)",
      border: "1px solid rgba(16,24,38,0.07)",
      display: "grid",
      gap: 12,
    },
    threadCard: {
      borderRadius: 34,
      background: "rgba(255,255,255,0.8)",
      border: "1px solid rgba(16,24,38,0.08)",
      minHeight: mobile ? 360 : 520,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    },
    composerShell: {
      borderRadius: 26,
      background: "#fff",
      border: "1px solid rgba(16,24,38,0.08)",
      padding: 12,
    },
    composerTextarea: {
      width: "100%",
      border: "1px solid rgba(0,0,0,0.05)",
      borderRadius: 16,
      padding: 12,
      resize: "none",
      fontSize: 14,
    },
    sendButton: {
      background: accent,
      color: "#fff",
      border: 0,
      borderRadius: 16,
      padding: "10px 20px",
      fontWeight: 900,
      cursor: "pointer",
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 16,
      background: "#101826",
      color: "#fff",
      display: "grid",
      placeItems: "center",
      fontWeight: 900,
    },
  };
}

export default function Page() {
  const [mobile, setMobile] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [mood, setMood] = useState<Mood>("honest");
  const [loading, setLoading] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [usage, setUsage] = useState<Usage>(defaultUsage());
  const [user, setUser] = useState<User | null>(null);
  const [memorySummary, setMemorySummary] = useState("");
  const [showSaveSheet, setShowSaveSheet] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const accentMap: Record<Mood, string> = {
    calm: "#5b8def",
    honest: "#f3a85f",
    direct: "#3bc6a1",
    wise: "#8f67f2",
  };
  const accent = accentMap[mood];

  const hasConversationStarted = messages.some((m) => m.id !== "welcome");
  const remainingToday = usage.date === todayKey() ? Math.max(0, FREE_LIMIT - usage.count) : FREE_LIMIT;

  useEffect(() => {
    const update = () => setMobile(window.innerWidth < 900);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const styles = useMemo(
    () => createStyles(mobile, isPro, hasConversationStarted, loading, mood, accent),
    [mobile, isPro, hasConversationStarted, loading, mood, accent]
  );

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg: Message = { id: uid(), role: "me", text: input, time: formatClock() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    setTimeout(() => {
      const aiMsg: Message = { 
        id: uid(), 
        role: "future me", 
        text: fallbackReply(userMsg.text, mood, isPro), 
        time: formatClock() 
      };
      setMessages((prev) => [...prev, aiMsg]);
      setLoading(false);
    }, 1000);
  }

  return (
    <main style={styles.page}>
      <style jsx global>{`
        body { margin: 0; background: #ebe4d8; }
        @keyframes floatIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div style={styles.glowA} />
      <div style={styles.glowB} />

      {showSaveSheet && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 40 }} onClick={() => setShowSaveSheet(false)} />}

      <div style={styles.shell}>
        <header style={styles.topBar}>
          <button style={styles.iconButton}>≡</button>
          <div style={styles.topTitle}>
            <div style={styles.brand}>Future Me</div>
            <div style={styles.brandSub}>{user ? "synced cloud memory" : "guest mode · local memory"}</div>
          </div>
          <button style={styles.iconButton}>⋯</button>
        </header>

        {!hasConversationStarted ? (
          <section style={styles.hero}>
            <div style={styles.heroShine} />
            <div style={styles.heroTop}>
              <span style={styles.badge}>✦ AI Mode Active</span>
              <span style={styles.badgeAccent}>👑 Pro Mode</span>
            </div>
            <div style={styles.heroTitle}>Your future self, <br />but <span style={{ color: accent }}>sharper.</span></div>
            <div style={styles.heroSub}>A private space where AI remembers, understands your patterns, and tells you what you need to hear.</div>
            <div style={styles.heroMetrics}>
              <div style={styles.metricCard}>
                <div style={styles.metricValue}>{remainingToday}</div>
                <div style={styles.metricLabel}>Messages today</div>
              </div>
              <div style={styles.metricCard}>
                <div style={styles.metricValue}>Pro</div>
                <div style={styles.metricLabel}>Feature Level</div>
              </div>
              <div style={styles.metricCard}>
                <div style={styles.metricValue}>{memorySummary ? "Live" : "—"}</div>
                <div style={styles.metricLabel}>Memory</div>
              </div>
            </div>
          </section>
        ) : (
          <section style={styles.hero}>
            <div style={styles.heroTop}><span style={styles.badge}>Conversation in motion</span></div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>The thread is alive.</div>
            <div style={{ marginTop: 8, opacity: 0.7 }}>AI is processing your thoughts in {mood} mode.</div>
          </section>
        )}

        <div style={styles.statusRow}>
          <span style={styles.pill}>{isPro ? "Pro active" : `Free: ${remainingToday} left`}</span>
          <span style={styles.pill}>{user ? "Cloud synced" : "Guest"}</span>
          <button style={styles.pillAction} onClick={() => setShowSaveSheet(true)}>Save with email</button>
        </div>

        <section style={styles.memoryCard}>
          <div style={styles.memoryHeader}>
            <div style={styles.memoryTitleWrap}>
              <div style={styles.memoryIcon}>🧠</div>
              <div>
                <div style={{ fontWeight: 900 }}>Memory Snapshot</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>AI remembers the thread</div>
              </div>
            </div>
          </div>
          <div style={styles.memoryQuote}>
            “{memorySummary || "Focus on what stays true when the noise stops. You are building something real, step by step."}”
          </div>
        </section>

        <section>
          <div style={styles.moodSection}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Choose Mood</div>
            <div style={styles.moodRow}>
              {(Object.keys(moodLabels) as Mood[]).map((m) => (
                <button key={m} onClick={() => setMood(m)} style={mood === m ? styles.moodButtonActive : styles.moodButton}>
                  <div style={{ fontSize: 20 }}>{moodIcons[m]}</div>
                  <div style={{ fontWeight: 800, fontSize: 12 }}>{moodLabels[m]}</div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section style={styles.aiPanel}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={styles.avatar}>FM</div>
            <div>
              <div style={{ fontWeight: 900 }}>Future Me</div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>{loading ? "responding..." : "online & listening"}</div>
            </div>
          </div>
        </section>

        <section style={styles.threadCard}>
          <div style={{ padding: 16, borderBottom: '1px solid rgba(0,0,0,0.05)', fontWeight: 900 }}>Thread</div>
          <div style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((m) => (
              <div key={m.id} style={{ alignSelf: m.role === 'me' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                <div style={{ 
                  background: m.role === 'me' ? '#101826' : '#fff', 
                  color: m.role === 'me' ? '#fff' : '#101826',
                  padding: '12px 16px', borderRadius: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                }}>
                  {m.text}
                </div>
                <div style={{ fontSize: 10, opacity: 0.4, marginTop: 4, textAlign: m.role === 'me' ? 'right' : 'left' }}>{m.time}</div>
              </div>
            ))}
            {loading && <div style={{ opacity: 0.5, fontSize: 12 }}>Future Me is thinking...</div>}
            <div ref={bottomRef} />
          </div>
        </section>

        <section style={styles.composerShell}>
          <textarea 
            ref={textareaRef}
            style={styles.composerTextarea} 
            placeholder={moodPlaceholders[mood]}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            rows={2}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 11, opacity: 0.5 }}>{moodLabels[mood]} mode active</div>
            <button style={styles.sendButton} onClick={sendMessage}>Send</button>
          </div>
        </section>
      </div>
    </main>
  );
}
