"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, KeyboardEvent, ReactNode } from "react";
import { createClient, type User } from "@supabase/supabase-js";

import {
  buildInsights,
  buildMemorySummary,
  defaultUsage,
  fallbackReply,
  FREE_LIMIT,
  formatClock,
  hexToRgba,
  ingestMemory,
  loadCloudState,
  loadDraft,
  MEMORY_SUMMARY_KEY,
  moodIcons,
  moodLabels,
  moodPlaceholders,
  saveCloudTurn,
  saveDraft,
  uid,
  vibrate,
  WELCOME_MESSAGE,
  type ContextMenuData,
  type Message,
  type Mood,
  type Usage,
  type ViewTab,
} from "@/lib/futureMe";
import { MessageBubble } from "@/components/future-me/MessageBubble";
import { QuickActionsMenu } from "@/components/future-me/QuickActionsMenu";
import { TopBar } from "@/components/future-me/TopBar";

// --- PERSPEKTIIVIT ---
type Perspective = "default" | "elder" | "coach" | "stoic";

const perspectiveConfig: Record<Perspective, { label: string; icon: string; prompt: string }> = {
  default: {
    label: "Tulevaisuuden minä",
    icon: "👤",
    prompt: "Olet käyttäjän tulevaisuuden minä. Ole empaattinen ja ymmärtäväinen."
  },
  elder: {
    label: "Viisas vanhus (80v)",
    icon: "👴",
    prompt: "Olet käyttäjä 50 vuotta vanhempana. Katso asioita valtavalla elämänkokemuksella ja perspektiivillä. Mikä on oikeasti tärkeää?"
  },
  coach: {
    label: "Suorasukainen koutsi",
    icon: "🎯",
    prompt: "Olet tavoitteellinen tulevaisuuden minäsi. Älä kiertele, vaan haasta käyttäjää toimimaan ja kysy vaikeita kysymyksiä."
  },
  stoic: {
    label: "Stoilainen minä",
    icon: "🏛️",
    prompt: "Olet stoalainen tulevaisuuden minäsi. Keskity siihen, mihin käyttäjä voi vaikuttaa ja auta häntä löytämään mielenrauha järjen kautta."
  }
};

// --- PÄIVITETTY buildMemoryPrompt ---
function buildMemoryPrompt(
  messages: { role: string; text: string }[],
  mood: string,
  perspective: Perspective,
  memorySummary = ""
) {
  const recentUserMessages = messages
    .filter((m) => m.role === "me")
    .slice(-4)
    .map((m) => m.text)
    .join(" | ");

  const now = new Date();
  const perspectiveInfo = perspectiveConfig[perspective].prompt;

  return [
    `${perspectiveInfo}`,
    `Mieliala: ${mood}.`,
    `Aika: ${now.toLocaleString()}.`,
    `Viimeisimmät ajatukset: ${recentUserMessages}${memorySummary ? ` | Tiivistelmä historiasta: ${memorySummary}` : ""}`,
    `OHJE: Lisää vastauksesi loppuun aina 1-2 aiheeseen liittyvää hashtagia (esim. #stressi #kasvu).`
  ]
    .join(" ")
    .slice(0, 500);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

function InteractiveGlassCard({ children, accent, style }: { children: ReactNode; accent: string; style?: CSSProperties }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "rgba(255, 255, 255, 0.03)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRadius: "24px",
        border: `1px solid ${hexToRgba(accent, 0.1)}`,
        boxShadow: `0 8px 32px 0 ${hexToRgba("#000", 0.3)}`,
        padding: "24px",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
}

export function FutureMeClient() {
  const [activeTab, setActiveTab] = useState<ViewTab>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [mood, setMood] = useState<Mood>("calm");
  const [perspective, setPerspective] = useState<Perspective>("default");
  const [isTyping, setIsTyping] = useState(false);
  const [isPro] = useState(false);
  const [usage, setUsage] = useState<Usage>(defaultUsage());
  const [user, setUser] = useState<User | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuData | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const accent =
    mood === "calm" ? "#2dd4bf" : mood === "honest" ? "#3b82f6" : mood === "direct" ? "#f43f5e" : "#a855f7";

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
        loadCloudState(data.user, supabase).then((cloud) => {
          if (cloud) {
            setMessages(cloud.messages);
            setMood(cloud.mood);
            setUsage(cloud.usage);
          } else {
            const draft = loadDraft();
            if (draft) {
              setMessages(draft.messages);
              setMood(draft.mood);
              setUsage(draft.usage);
            } else {
              setMessages([WELCOME_MESSAGE]);
            }
          }
        });
      } else {
        const draft = loadDraft();
        if (draft) {
          setMessages(draft.messages);
          setMood(draft.mood);
          setUsage(draft.usage);
        } else {
          setMessages([WELCOME_MESSAGE]);
        }
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    saveDraft({ messages, input, mood, isPro, usage });
  }, [messages, input, mood, isPro, usage]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    if (!isPro && usage.count >= FREE_LIMIT) {
      alert("Päivittäinen raja täynnä.");
      return;
    }

    const userMsg: Message = {
      id: uid(),
      role: "me",
      text: input.trim(),
      time: formatClock(new Date()),
      createdAt: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsTyping(true);
    setUsage((prev) => ({ ...prev, count: prev.count + 1 }));

    try {
      const memorySummary = localStorage.getItem(MEMORY_SUMMARY_KEY) || "";
      const contextPrompt = buildMemoryPrompt(updatedMessages, mood, perspective, memorySummary);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role === "me" ? "user" : "assistant",
            content: m.text,
          })),
          contextPrompt,
          mood,
        }),
      });

      const data = await res.json();
      const replyText = data.choices?.[0]?.message?.content || fallbackReply(mood);

      const aiMsg: Message = {
        id: uid(),
        role: "future me",
        text: replyText,
        time: formatClock(new Date()),
        createdAt: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);

      if (user) {
        const newSummary = buildMemorySummary(finalMessages);
        localStorage.setItem(MEMORY_SUMMARY_KEY, newSummary);
        saveCloudTurn(user, finalMessages, mood, usage, newSummary, supabase);
        ingestMemory(user, userMsg.text, "user");
        ingestMemory(user, aiMsg.text, "assistant");
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { id: uid(), role: "future me", text: fallbackReply(mood), time: formatClock(new Date()), createdAt: new Date().toISOString() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    vibrate(10);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenMenu = (msg: Message, x: number, y: number) => {
    setContextMenu({ messageId: msg.id, text: msg.text, role: msg.role, x, y });
  };

  const insights = useMemo(() => buildInsights(messages), [messages]);

  const styles: Record<string, CSSProperties> = {
    main: { display: "flex", flexDirection: "column", height: "100dvh", background: "#050505", color: "#fff", overflow: "hidden", position: "relative" },
    bgGlow: { position: "absolute", top: "-10%", right: "-10%", width: "60%", height: "60%", background: `radial-gradient(circle, ${hexToRgba(accent, 0.15)} 0%, transparent 70%)`, filter: "blur(80px)", pointerEvents: "none", zIndex: 0 },
    container: { flex: 1, display: "flex", flexDirection: "column", width: "100%", maxWidth: "800px", margin: "0 auto", position: "relative", zIndex: 1 },
    scrollArea: { flex: 1, overflowY: "auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: "24px" },
    inputSection: { padding: "16px", background: "linear-gradient(to top, #050505 80%, transparent)" },
    inputWrapper: { background: "rgba(255, 255, 255, 0.05)", backdropFilter: "blur(10px)", borderRadius: "20px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px", border: "1px solid rgba(255, 255, 255, 0.1)" },
    textarea: { background: "transparent", border: "none", color: "#fff", fontSize: "16px", resize: "none", outline: "none", width: "100%", padding: "4px" },
    perspectiveRow: { display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px", msOverflowStyle: "none", scrollbarWidth: "none" },
    perspectiveBtn: { padding: "6px 12px", borderRadius: "10px", fontSize: "11px", whiteSpace: "nowrap", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.5)", cursor: "pointer" },
    perspectiveBtnActive: { background: hexToRgba(accent, 0.2), borderColor: accent, color: "#fff" },
    inputActions: { display: "flex", justifyContent: "space-between", alignItems: "center" },
    moodSelector: { display: "flex", gap: "4px", background: "rgba(0,0,0,0.2)", padding: "4px", borderRadius: "12px" },
    moodBtn: { background: "transparent", border: "none", padding: "6px 10px", borderRadius: "8px", color: "rgba(255,255,255,0.4)", fontSize: "12px" },
    moodBtnActive: { background: hexToRgba(accent, 0.2), color: accent },
    sendBtn: { background: accent, color: "#000", border: "none", width: "36px", height: "36px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" },
    typing: { fontSize: "12px", color: "rgba(255,255,255,0.4)", padding: "0 10px", marginBottom: "8px" },
    insightGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" },
    insightCard: { display: "flex", flexDirection: "column", gap: "12px" },
    insightTitle: { fontSize: "14px", fontWeight: 600, opacity: 0.5, textTransform: "uppercase" },
    insightValue: { fontSize: "32px", fontWeight: 700 },
    insightSub: { fontSize: "13px", opacity: 0.6 },
    bubbleGrid: { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" },
    bubbleItem: { padding: "8px 12px", borderRadius: "16px", fontSize: "12px", color: "#fff", fontWeight: 600 },
  };

  return (
    <main style={styles.main}>
      <div style={styles.bgGlow} />
      <div style={styles.container}>
        <TopBar styles={styles} activeTab={activeTab} setActiveTab={setActiveTab} user={user} onOpenMenu={() => setShowMenu(true)} />

        <AnimatePresence mode="wait">
          {activeTab === "chat" ? (
            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={styles.scrollArea} ref={scrollRef}>
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} isUser={msg.role === "me"} styles={styles} copiedId={copiedId} onCopy={handleCopy} onOpenMenu={handleOpenMenu} onLongPressStart={() => () => {}} onLongPressEnd={() => {}} />
                ))}
                {isTyping && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.typing}>
                    Future Me pohtii vastausta...
                  </motion.div>
                )}
              </div>

              <div style={styles.inputSection}>
                {/* PERSPEKTIIVIVALITSIN */}
                <div style={styles.perspectiveRow}>
                  {(Object.keys(perspectiveConfig) as Perspective[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => { setPerspective(p); vibrate(5); }}
                      style={{ ...styles.perspectiveBtn, ...(perspective === p ? styles.perspectiveBtnActive : {}) }}
                    >
                      {perspectiveConfig[p].icon} {perspectiveConfig[p].label}
                    </button>
                  ))}
                </div>

                <div style={styles.inputWrapper}>
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={moodPlaceholders[mood]}
                    style={styles.textarea}
                  />
                  <div style={styles.inputActions}>
                    <div style={styles.moodSelector}>
                      {(["calm", "honest", "direct", "wise"] as Mood[]).map((m) => (
                        <button key={m} onClick={() => { setMood(m); vibrate(5); }} style={{ ...styles.moodBtn, ...(mood === m ? styles.moodBtnActive : {}) }}>
                          {moodIcons[m]} {moodLabels[m]}
                        </button>
                      ))}
                    </div>
                    <button onClick={handleSend} disabled={!input.trim() || isTyping} style={{ ...styles.sendBtn, opacity: !input.trim() || isTyping ? 0.5 : 1 }}>
                      ↑
                    </button>
                  </div>
                </div>
              </div>

              <QuickActionsMenu
                styles={styles}
                position={contextMenu ? { left: contextMenu.x, top: contextMenu.y } : null}
                onCopy={() => { if (contextMenu) handleCopy(contextMenu.text, contextMenu.messageId); setContextMenu(null); }}
                onDelete={() => { setMessages(prev => prev.filter(m => m.id !== contextMenu?.messageId)); setContextMenu(null); }}
                canDelete={contextMenu?.role === "me"}
              />
            </motion.div>
          ) : (
            <motion.div key="insights" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ flex: 1, overflowY: "auto", padding: "20px 16px" }}>
              <div style={styles.insightGrid}>
                <InteractiveGlassCard accent={accent} style={styles.insightCard}>
                  <div style={styles.insightTitle}>Vallitseva sävy</div>
                  <div style={{ ...styles.insightValue, color: accent }}>{insights.dominantTone}</div>
                  <div style={styles.insightSub}>Analysoitu viimeisimmistä viesteistäsi.</div>
                </InteractiveGlassCard>

                <InteractiveGlassCard accent={accent} style={styles.insightCard}>
                  <div style={styles.insightTitle}>Itsetutkiskelun taso</div>
                  <div style={styles.insightValue}>{insights.totalUserMessages}</div>
                  <div style={styles.insightSub}>Viestejä jaettuna tulevaisuuden minälle.</div>
                </InteractiveGlassCard>
              </div>

              <InteractiveGlassCard accent={accent} style={{ ...styles.insightCard, marginTop: "16px" }}>
                <div style={styles.insightTitle}>Toistuvat teemat (Hashtagit)</div>
                <div style={styles.insightSub}>Asiat, joita olette tekoälyn kanssa käsitelleet.</div>
                <div style={styles.bubbleGrid}>
                  {insights.topThemes.map((item, idx) => (
                    <div key={idx} style={{ ...styles.bubbleItem, background: hexToRgba(accent, 0.3), border: `1px solid ${accent}` }}>
                      {item.label} ({item.count})
                    </div>
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

export default FutureMeClient;
