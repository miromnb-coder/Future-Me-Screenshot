"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";

type Tone = "calm" | "honest" | "direct" | "hopeful" | "chaotic";

type Message = {
  from: "me" | "future me";
  text: string;
  time: string;
};

type SavedItem = {
  id: string;
  title: string;
  tone: Tone;
  time: string;
};

const templates = [
  "Should I buy this?",
  "Should I text them?",
  "Should I post this?",
  "Should I skip the gym?",
  "Should I go for it?",
  "Should I trust this?",
  "Should I stay up tonight?",
  "Should I send this message?"
];

const toneLabels: Record<Tone, string> = {
  calm: "Calm",
  honest: "Honest",
  direct: "Direct",
  hopeful: "Hopeful",
  chaotic: "Chaotic"
};

const fallbackMessages = (decision: string, horizon: string): Message[] => [
  { from: "me", text: decision || "Should I do this?", time: "now" },
  { from: "future me", text: "Pause first. Clarity usually arrives before regret.", time: "soon" },
  { from: "me", text: "So what now?", time: "soon" },
  { from: "future me", text: `Give it ${horizon || "2 weeks"}.`, time: horizon || "2 weeks" }
];

function captionFor(tone: Tone) {
  switch (tone) {
    case "calm":
      return "I paused before I decided.";
    case "honest":
      return "Future me was more honest than I was.";
    case "direct":
      return "A simple answer was enough.";
    case "hopeful":
      return "A small pause changed the outcome.";
    case "chaotic":
      return "Future me turned it into a story.";
  }
}

function createStyles(mobile: boolean): Record<string, CSSProperties> {
  return {
    page: {
      minHeight: "100vh",
      background:
        "linear-gradient(180deg, #f5efe6 0%, #efe7db 100%)",
      color: "#101826",
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: mobile ? 12 : 20
    },
    shell: {
      maxWidth: 1120,
      margin: "0 auto",
      display: "grid",
      gap: 14
    },
    topBar: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12
    },
    topLeft: {
      display: "flex",
      alignItems: "center",
      gap: 10
    },
    topCenter: {
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
      letterSpacing: "-0.03em"
    },
    brandSub: {
      fontSize: 12,
      color: "rgba(16,24,38,0.55)"
    },
    iconButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      border: "1px solid rgba(16,24,38,0.08)",
      background: "rgba(255,255,255,0.72)",
      color: "#101826",
      display: "grid",
      placeItems: "center",
      cursor: "pointer",
      boxShadow: "0 14px 30px rgba(16,24,38,0.05)"
    },
    hero: {
      display: "grid",
      gap: 8,
      padding: "6px 0 4px"
    },
    eyebrow: {
      display: "inline-flex",
      width: "fit-content",
      padding: "8px 12px",
      borderRadius: 999,
      background: "rgba(16,24,38,0.05)",
      border: "1px solid rgba(16,24,38,0.06)",
      fontSize: 13,
      color: "rgba(16,24,38,0.72)"
    },
    title: {
      margin: 0,
      fontSize: mobile ? "34px" : "clamp(40px, 5vw, 66px)",
      lineHeight: 0.95,
      letterSpacing: "-0.055em",
      maxWidth: mobile ? 12 : 11
    },
    subtitle: {
      margin: 0,
      maxWidth: 680,
      color: "rgba(16,24,38,0.68)",
      fontSize: 17,
      lineHeight: 1.6
    },
    metaRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: 10,
      alignItems: "center",
      marginTop: 4
    },
    metaPill: {
      padding: "10px 12px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.66)",
      border: "1px solid rgba(16,24,38,0.07)",
      color: "rgba(16,24,38,0.72)",
      fontSize: 13
    },
    chatCard: {
      borderRadius: 28,
      background: "rgba(255,255,255,0.72)",
      border: "1px solid rgba(16,24,38,0.08)",
      boxShadow: "0 20px 60px rgba(16,24,38,0.08)",
      overflow: "hidden"
    },
    chatHead: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: mobile ? 16 : 18,
      borderBottom: "1px solid rgba(16,24,38,0.06)"
    },
    chatHeadLeft: {
      display: "flex",
      flexDirection: "column",
      gap: 4
    },
    chatName: {
      fontWeight: 800,
      fontSize: 18,
      letterSpacing: "-0.03em"
    },
    chatHint: {
      fontSize: 12,
      color: "rgba(16,24,38,0.54)"
    },
    chatBadge: {
      padding: "8px 12px",
      borderRadius: 999,
      background: "rgba(16,24,38,0.05)",
      border: "1px solid rgba(16,24,38,0.06)",
      fontSize: 12,
      color: "rgba(16,24,38,0.68)"
    },
    chatBody: {
      padding: mobile ? 16 : 18,
      minHeight: mobile ? 480 : 560,
      display: "flex",
      flexDirection: "column",
      gap: 12
    },
    divider: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      margin: "2px 0 8px"
    },
    dividerLine: {
      height: 1,
      flex: 1,
      background: "linear-gradient(90deg, transparent, rgba(16,24,38,0.16), transparent)"
    },
    dividerText: {
      fontSize: 12,
      color: "rgba(16,24,38,0.56)",
      padding: "6px 10px",
      borderRadius: 999,
      background: "rgba(16,24,38,0.04)",
      border: "1px solid rgba(16,24,38,0.06)"
    },
    messages: {
      display: "flex",
      flexDirection: "column",
      gap: 12,
      flex: 1
    },
    row: {
      display: "flex"
    },
    bubble: {
      maxWidth: mobile ? "86%" : "74%",
      padding: "13px 15px",
      borderRadius: 20,
      fontSize: 14,
      lineHeight: 1.5,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word"
    },
    bubbleMe: {
      background: "#101826",
      color: "#f5efe6",
      borderTopRightRadius: 8
    },
    bubbleFuture: {
      background: "rgba(16,24,38,0.06)",
      color: "#101826",
      borderTopLeftRadius: 8
    },
    time: {
      marginTop: 6,
      fontSize: 11,
      color: "rgba(16,24,38,0.5)"
    },
    composerShell: {
      borderRadius: 28,
      background: "rgba(255,255,255,0.74)",
      border: "1px solid rgba(16,24,38,0.08)",
      boxShadow: "0 18px 50px rgba(16,24,38,0.06)",
      overflow: "hidden"
    },
    composerTop: {
      padding: mobile ? 16 : 18,
      display: "grid",
      gap: 10,
      borderBottom: "1px solid rgba(16,24,38,0.06)"
    },
    controlsRow: {
      display: "grid",
      gridTemplateColumns: mobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
      gap: 10
    },
    control: {
      display: "grid",
      gap: 7
    },
    label: {
      fontSize: 12,
      fontWeight: 600,
      color: "rgba(16,24,38,0.64)"
    },
    select: {
      width: "100%",
      borderRadius: 16,
      border: "1px solid rgba(16,24,38,0.08)",
      background: "rgba(255,255,255,0.86)",
      color: "#101826",
      padding: "11px 13px",
      outline: "none"
    },
    templatePills: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8
    },
    pill: {
      borderRadius: 999,
      padding: "9px 12px",
      border: "1px solid rgba(16,24,38,0.08)",
      background: "rgba(255,255,255,0.80)",
      color: "#101826",
      fontSize: 13,
      cursor: "pointer"
    },
    composerBottom: {
      padding: mobile ? 16 : 18,
      display: "grid",
      gap: 12
    },
    textarea: {
      width: "100%",
      minHeight: 110,
      resize: "vertical",
      borderRadius: 18,
      border: "1px solid rgba(16,24,38,0.08)",
      background: "rgba(255,255,255,0.92)",
      color: "#101826",
      padding: "14px 15px",
      outline: "none",
      lineHeight: 1.55
    },
    actions: {
      display: "flex",
      flexWrap: "wrap",
      gap: 10
    },
    primaryButton: {
      border: "0",
      borderRadius: 16,
      padding: "12px 15px",
      background: "#101826",
      color: "#f5efe6",
      fontWeight: 700,
      cursor: "pointer"
    },
    secondaryButton: {
      border: "1px solid rgba(16,24,38,0.08)",
      borderRadius: 16,
      padding: "12px 15px",
      background: "rgba(255,255,255,0.86)",
      color: "#101826",
      fontWeight: 600,
      cursor: "pointer"
    },
    footerHint: {
      fontSize: 12,
      color: "rgba(16,24,38,0.54)",
      lineHeight: 1.5
    },
    overlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(15, 23, 38, 0.28)",
      backdropFilter: "blur(4px)",
      zIndex: 50
    },
    drawer: {
      position: "fixed",
      top: 0,
      left: 0,
      bottom: 0,
      width: mobile ? "86vw" : 360,
      maxWidth: 360,
      background: "rgba(255,255,255,0.94)",
      borderRight: "1px solid rgba(16,24,38,0.08)",
      boxShadow: "24px 0 60px rgba(16,24,38,0.18)",
      zIndex: 60,
      padding: 18,
      display: "grid",
      gap: 16
    },
    drawerTitle: {
      fontSize: 18,
      fontWeight: 800,
      letterSpacing: "-0.03em"
    },
    drawerSub: {
      fontSize: 12,
      color: "rgba(16,24,38,0.56)"
    },
    drawerSection: {
      display: "grid",
      gap: 8
    },
    drawerLabel: {
      fontSize: 12,
      color: "rgba(16,24,38,0.58)",
      fontWeight: 600
    },
    drawerButton: {
      width: "100%",
      textAlign: "left",
      borderRadius: 16,
      padding: "12px 14px",
      border: "1px solid rgba(16,24,38,0.08)",
      background: "rgba(255,255,255,0.86)",
      color: "#101826",
      fontWeight: 600
    },
    drawerPillRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8
    },
    drawerPill: {
      borderRadius: 999,
      padding: "9px 12px",
      border: "1px solid rgba(16,24,38,0.08)",
      background: "rgba(255,255,255,0.82)",
      color: "#101826",
      fontSize: 13
    },
    proCard: {
      borderRadius: 24,
      padding: 18,
      background: "linear-gradient(180deg, rgba(16,24,38,0.96), rgba(27,37,54,0.96))",
      color: "#f5efe6",
      boxShadow: "0 24px 70px rgba(16,24,38,0.24)",
      display: "grid",
      gap: 12
    },
    proTitle: {
      fontSize: 20,
      fontWeight: 800,
      letterSpacing: "-0.03em"
    },
    proText: {
      color: "rgba(245,239,230,0.74)",
      lineHeight: 1.55,
      fontSize: 14
    },
    proList: {
      display: "grid",
      gap: 8,
      color: "rgba(245,239,230,0.88)",
      fontSize: 14
    },
    proButton: {
      border: "0",
      borderRadius: 16,
      padding: "13px 15px",
      background: "#f5efe6",
      color: "#101826",
      fontWeight: 800,
      cursor: "pointer"
    },
    proSecondary: {
      border: "1px solid rgba(245,239,230,0.18)",
      borderRadius: 16,
      padding: "13px 15px",
      background: "transparent",
      color: "#f5efe6",
      fontWeight: 700,
      cursor: "pointer"
    },
    modalWrap: {
      position: "fixed",
      inset: 0,
      zIndex: 70,
      display: "grid",
      placeItems: "center",
      padding: 16
    },
    modal: {
      width: "min(520px, 100%)",
      borderRadius: 28,
      padding: 18,
      background: "rgba(255,255,255,0.96)",
      border: "1px solid rgba(16,24,38,0.08)",
      boxShadow: "0 32px 100px rgba(16,24,38,0.24)",
      display: "grid",
      gap: 14
    },
    modalTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "start",
      gap: 12
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: 800,
      letterSpacing: "-0.03em"
    },
    modalText: {
      color: "rgba(16,24,38,0.68)",
      lineHeight: 1.55,
      fontSize: 14
    },
    modalActions: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap"
    }
  };
}

export default function Page() {
  const [mobile, setMobile] = useState(false);
  const [template, setTemplate] = useState(templates[1]);
  const [decision, setDecision] = useState("Should I text them?");
  const [tone, setTone] = useState<Tone>("honest");
  const [horizon, setHorizon] = useState("2 weeks");
  const [messages, setMessages] = useState<Message[]>(fallbackMessages("Should I text them?", "2 weeks"));
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [composerOpen, setComposerOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const update = () => setMobile(window.innerWidth < 900);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem("future-me-saved");
    if (raw) {
      try {
        setSaved(JSON.parse(raw) as SavedItem[]);
      } catch {
        setSaved([]);
      }
    }
  }, []);

  useEffect(() => {
    sendToAI("Should I text them?", "honest", "2 weeks");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const styles = useMemo(() => createStyles(mobile), [mobile]);
  const caption = useMemo(() => captionFor(tone), [tone]);

  const upgradeUrl = process.env.NEXT_PUBLIC_PRO_UPGRADE_URL || "";

  async function sendToAI(nextDecision = decision, nextTone = tone, nextHorizon = horizon) {
    setIsLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: nextDecision,
          tone: nextTone,
          horizon: nextHorizon
        })
      });

      const data = await res.json();
      setMessages(Array.isArray(data?.messages) && data.messages.length > 0 ? data.messages : fallbackMessages(nextDecision, nextHorizon));
    } catch {
      setMessages(fallbackMessages(nextDecision, nextHorizon));
    } finally {
      setIsLoading(false);
    }
  }

  const saveCurrent = () => {
    const item: SavedItem = {
      id: `${Date.now()}`,
      title: decision || "Untitled",
      tone,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    const next = [item, ...saved].slice(0, 8);
    setSaved(next);
    window.localStorage.setItem("future-me-saved", JSON.stringify(next));
  };

  const handleSend = async () => {
    await sendToAI(decision, tone, horizon);
    setComposerOpen(false);
    saveCurrent();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyCaption = async () => {
    await navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const downloadOrShareScreenshot = async () => {
    if (!previewRef.current) return;

    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(previewRef.current, {
      backgroundColor: null,
      scale: 2
    });

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/png");
    });

    if (!blob) return;

    const file = new File([blob], `future-me-${Date.now()}.png`, { type: "image/png" });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Future Me Screenshot",
        text: caption
      });
      return;
    }

    const link = document.createElement("a");
    link.download = file.name;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const openPro = () => setProOpen(true);
  const closePro = () => setProOpen(false);

  const upgrade = () => {
    if (upgradeUrl) window.open(upgradeUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <main style={styles.page}>
      {drawerOpen && <div style={styles.overlay} onClick={() => setDrawerOpen(false)} />}

      {proOpen && <div style={styles.overlay} onClick={closePro} />}

      {drawerOpen && (
        <aside style={styles.drawer}>
          <div style={styles.drawerSection}>
            <div style={styles.drawerTitle}>Future Me</div>
            <div style={styles.drawerSub}>quiet decision screenshots</div>
          </div>

          <div style={styles.drawerSection}>
            <div style={styles.drawerLabel}>Quick templates</div>
            <div style={styles.drawerPillRow}>
              {templates.slice(0, 6).map((t) => (
                <button
                  key={t}
                  style={styles.drawerPill}
                  onClick={() => {
                    setTemplate(t);
                    setDecision(t);
                    setDrawerOpen(false);
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.drawerSection}>
            <div style={styles.drawerLabel}>Saved</div>
            {saved.length === 0 ? (
              <button style={styles.drawerButton} onClick={() => setDrawerOpen(false)}>
                No saved screenshots yet
              </button>
            ) : (
              saved.map((item) => (
                <button
                  key={item.id}
                  style={styles.drawerButton}
                  onClick={() => {
                    setTone(item.tone);
                    setDrawerOpen(false);
                  }}
                >
                  {item.title} · {toneLabels[item.tone]}
                </button>
              ))
            )}
          </div>

          <div style={styles.drawerSection}>
            <div style={styles.drawerLabel}>Actions</div>
            <button style={styles.drawerButton} onClick={openPro}>
              Upgrade to Pro
            </button>
            <button style={styles.drawerButton} onClick={() => setComposerOpen((v) => !v)}>
              {composerOpen ? "Hide composer" : "Show composer"}
            </button>
            <button style={styles.drawerButton} onClick={() => setDrawerOpen(false)}>
              Close
            </button>
          </div>
        </aside>
      )}

      {proOpen && (
        <div style={styles.modalWrap}>
          <div style={styles.modal}>
            <div style={styles.modalTop}>
              <div>
                <div style={styles.modalTitle}>Go Pro</div>
                <div style={styles.modalText}>
                  Unlock more generations, stronger AI responses, and cleaner exports.
                </div>
              </div>
              <button style={styles.iconButton} onClick={closePro} aria-label="Close">
                ×
              </button>
            </div>

            <div style={styles.proCard}>
              <div style={styles.proTitle}>Pro features</div>
              <div style={styles.proList}>
                <div>• more generations</div>
                <div>• better AI modes</div>
                <div>• saved history</div>
                <div>• clean export without friction</div>
              </div>
              <div style={styles.proText}>
                Connect your checkout link with <strong>NEXT_PUBLIC_PRO_UPGRADE_URL</strong> in Vercel.
              </div>
            </div>

            <div style={styles.modalActions}>
              <button style={styles.primaryButton} onClick={upgrade} disabled={!upgradeUrl}>
                {upgradeUrl ? "Upgrade now" : "Add upgrade link"}
              </button>
              <button style={styles.secondaryButton} onClick={closePro}>
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={styles.shell}>
        <header style={styles.topBar}>
          <div style={styles.topLeft}>
            <button style={styles.iconButton} aria-label="Menu" onClick={() => setDrawerOpen(true)}>
              ≡
            </button>
          </div>

          <div style={styles.topCenter}>
            <div style={styles.brand}>Future Me</div>
            <div style={styles.brandSub}>quiet decision screenshots</div>
          </div>

          <div style={styles.topLeft}>
            <button
              style={styles.iconButton}
              aria-label="New chat"
              onClick={() => {
                setComposerOpen(true);
                textareaRef.current?.focus();
              }}
            >
              ✎
            </button>
            <button style={styles.iconButton} aria-label="More" onClick={openPro}>
              ⋯
            </button>
          </div>
        </header>

        <section style={styles.hero}>
          <div style={styles.eyebrow}>See your decision from the future</div>
          <h1 style={styles.title}>A quiet conversation.</h1>
          <p style={styles.subtitle}>
            One decision. One future reply. Built to feel calm, simple, and intelligent.
          </p>

          <div style={styles.metaRow}>
            <div style={styles.metaPill}>{toneLabels[tone]}</div>
            <div style={styles.metaPill}>{horizon} later</div>
          </div>
        </section>

        <div style={styles.chatCard} ref={previewRef}>
          <div style={styles.chatHead}>
            <div style={styles.chatHeadLeft}>
              <div style={styles.chatName}>Future Me</div>
              <div style={styles.chatHint}>private conversation · minimal mode</div>
            </div>
            <div style={styles.chatBadge}>{isLoading ? "typing..." : "quiet"}</div>
          </div>

          <div style={styles.chatBody}>
            <div style={styles.divider}>
              <div style={styles.dividerLine} />
              <div style={styles.dividerText}>— {horizon.toLowerCase()} —</div>
              <div style={styles.dividerLine} />
            </div>

            <div style={styles.messages}>
              {messages.map((msg, index) => (
                <div
                  key={`${msg.from}-${index}`}
                  style={{
                    ...styles.row,
                    justifyContent: msg.from === "me" ? "flex-end" : "flex-start"
                  }}
                >
                  <div
                    style={{
                      ...styles.bubble,
                      ...(msg.from === "me" ? styles.bubbleMe : styles.bubbleFuture)
                    }}
                  >
                    {msg.text}
                    <div style={styles.time}>{msg.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={styles.composerShell}>
          <div style={styles.composerTop}>
            <div style={styles.controlsRow}>
              <div style={styles.control}>
                <div style={styles.label}>Template</div>
                <select
                  value={template}
                  onChange={(e) => {
                    setTemplate(e.target.value);
                    setDecision(e.target.value);
                  }}
                  style={styles.select}
                >
                  {templates.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.control}>
                <div style={styles.label}>Tone</div>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as Tone)}
                  style={styles.select}
                >
                  {Object.entries(toneLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.control}>
                <div style={styles.label}>Time jump</div>
                <select
                  value={horizon}
                  onChange={(e) => setHorizon(e.target.value)}
                  style={styles.select}
                >
                  <option>Tomorrow</option>
                  <option>2 weeks</option>
                  <option>1 month</option>
                  <option>6 months</option>
                </select>
              </div>
            </div>

            <div style={styles.templatePills}>
              {templates.slice(0, 4).map((t) => (
                <button
                  key={t}
                  style={styles.pill}
                  onClick={() => {
                    setTemplate(t);
                    setDecision(t);
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {composerOpen && (
            <div style={styles.composerBottom}>
              <textarea
                ref={textareaRef}
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Write one decision..."
                style={styles.textarea}
              />

              <div style={styles.actions}>
                <button onClick={handleSend} style={styles.primaryButton} disabled={isLoading}>
                  {isLoading ? "Sending..." : "Send"}
                </button>
                <button onClick={downloadOrShareScreenshot} style={styles.secondaryButton}>
                  Save / share
                </button>
                <button onClick={copyCaption} style={styles.secondaryButton}>
                  {copied ? "Caption copied" : "Copy caption"}
                </button>
              </div>

              <div style={styles.footerHint}>
                Press Enter to send. The menu button opens the side panel, and the three-dot button opens Pro.
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
