"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";

type Tone = "calm" | "honest" | "direct" | "hopeful" | "chaotic";

type Message = {
  from: "me" | "future me";
  text: string;
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
      padding: mobile ? 10 : 18
    },
    shell: {
      maxWidth: 760,
      margin: "0 auto",
      display: "grid",
      gap: 14
    },
    topBar: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: "2px 2px 8px"
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
      boxShadow: "0 12px 26px rgba(16,24,38,0.05)"
    },
    chatCard: {
      borderRadius: 28,
      background: "rgba(255,255,255,0.58)",
      border: "1px solid rgba(16,24,38,0.06)",
      boxShadow: "0 18px 50px rgba(16,24,38,0.08)",
      overflow: "hidden"
    },
    chatHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: mobile ? 14 : 16,
      borderBottom: "1px solid rgba(16,24,38,0.06)",
      background: "rgba(255,255,255,0.34)",
      backdropFilter: "blur(10px)"
    },
    chatHeaderLeft: {
      display: "flex",
      alignItems: "center",
      gap: 10
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 999,
      background: "#101826",
      color: "#f5efe6",
      display: "grid",
      placeItems: "center",
      fontSize: 14,
      fontWeight: 800
    },
    chatNameWrap: {
      display: "flex",
      flexDirection: "column",
      gap: 2
    },
    chatName: {
      fontWeight: 800,
      fontSize: 16,
      letterSpacing: "-0.02em"
    },
    chatHint: {
      fontSize: 12,
      color: "rgba(16,24,38,0.56)"
    },
    chatHeaderRight: {
      display: "flex",
      alignItems: "center",
      gap: 8
    },
    chip: {
      padding: "8px 12px",
      borderRadius: 999,
      background: "rgba(16,24,38,0.05)",
      border: "1px solid rgba(16,24,38,0.06)",
      fontSize: 12,
      color: "rgba(16,24,38,0.68)",
      whiteSpace: "nowrap"
    },
    chatBody: {
      padding: mobile ? 14 : 16,
      minHeight: mobile ? 560 : 620,
      display: "flex",
      flexDirection: "column",
      gap: 12
    },
    divider: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      margin: "2px 0 2px"
    },
    dividerLine: {
      height: 1,
      flex: 1,
      background: "linear-gradient(90deg, transparent, rgba(16,24,38,0.16), transparent)"
    },
    dividerText: {
      fontSize: 12,
      color: "rgba(16,24,38,0.56)",
      padding: "5px 10px",
      borderRadius: 999,
      background: "rgba(16,24,38,0.04)",
      border: "1px solid rgba(16,24,38,0.06)"
    },
    messages: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
      flex: 1,
      justifyContent: "flex-start"
    },
    row: {
      display: "flex"
    },
    bubble: {
      maxWidth: mobile ? "84%" : "72%",
      padding: "12px 14px",
      borderRadius: 18,
      fontSize: 14,
      lineHeight: 1.5,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word"
    },
    bubbleMe: {
      background: "#101826",
      color: "#f5efe6",
      borderTopRightRadius: 8,
      marginLeft: "auto"
    },
    bubbleFuture: {
      background: "rgba(16,24,38,0.06)",
      color: "#101826",
      borderTopLeftRadius: 8,
      marginRight: "auto"
    },
    time: {
      marginTop: 6,
      fontSize: 11,
      color: "rgba(16,24,38,0.5)"
    },
    composerShell: {
      borderRadius: 28,
      background: "rgba(255,255,255,0.62)",
      border: "1px solid rgba(16,24,38,0.06)",
      boxShadow: "0 18px 50px rgba(16,24,38,0.06)",
      overflow: "hidden"
    },
    composerTop: {
      padding: mobile ? 14 : 16,
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
      gap: 6
    },
    label: {
      fontSize: 12,
      fontWeight: 600,
      color: "rgba(16,24,38,0.62)"
    },
    select: {
      width: "100%",
      borderRadius: 16,
      border: "1px solid rgba(16,24,38,0.08)",
      background: "rgba(255,255,255,0.88)",
      color: "#101826",
      padding: "11px 12px",
      outline: "none"
    },
    templateRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8
    },
    templateChip: {
      borderRadius: 999,
      padding: "9px 12px",
      border: "1px solid rgba(16,24,38,0.08)",
      background: "rgba(255,255,255,0.82)",
      color: "#101826",
      fontSize: 13,
      cursor: "pointer"
    },
    composerBottom: {
      padding: mobile ? 14 : 16,
      display: "grid",
      gap: 12
    },
    textarea: {
      width: "100%",
      minHeight: 86,
      resize: "vertical",
      borderRadius: 18,
      border: "1px solid rgba(16,24,38,0.08)",
      background: "rgba(255,255,255,0.92)",
      color: "#101826",
      padding: "14px 14px",
      outline: "none",
      lineHeight: 1.5,
      fontSize: 15
    },
    actions: {
      display: "flex",
      flexWrap: "wrap",
      gap: 10
    },
    primaryButton: {
      border: "0",
      borderRadius: 16,
      padding: "12px 16px",
      background: "#101826",
      color: "#f5efe6",
      fontWeight: 700,
      cursor: "pointer"
    },
    secondaryButton: {
      border: "1px solid rgba(16,24,38,0.08)",
      borderRadius: 16,
      padding: "12px 16px",
      background: "rgba(255,255,255,0.82)",
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
      background: "rgba(15, 23, 38, 0.26)",
      backdropFilter: "blur(4px)",
      zIndex: 40
    },
    menuSheet: {
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
    menuTitle: {
      fontSize: 18,
      fontWeight: 800,
      letterSpacing: "-0.03em"
    },
    menuSub: {
      fontSize: 12,
      color: "rgba(16,24,38,0.56)"
    },
    menuSection: {
      display: "grid",
      gap: 8
    },
    menuButton: {
      width: "100%",
      textAlign: "left",
      borderRadius: 16,
      padding: "12px 14px",
      border: "1px solid rgba(16,24,38,0.08)",
      background: "rgba(255,255,255,0.86)",
      color: "#101826",
      fontWeight: 600
    },
    proCard: {
      borderRadius: 22,
      padding: 16,
      background: "linear-gradient(180deg, rgba(16,24,38,0.96), rgba(27,37,54,0.96))",
      color: "#f5efe6",
      display: "grid",
      gap: 10
    },
    proTitle: {
      fontSize: 18,
      fontWeight: 800
    },
    proText: {
      color: "rgba(245,239,230,0.74)",
      lineHeight: 1.5,
      fontSize: 14
    },
    proActions: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap"
    },
    proButton: {
      border: "0",
      borderRadius: 16,
      padding: "12px 16px",
      background: "#f5efe6",
      color: "#101826",
      fontWeight: 800,
      cursor: "pointer"
    },
    proSecondary: {
      border: "1px solid rgba(245,239,230,0.16)",
      borderRadius: 16,
      padding: "12px 16px",
      background: "transparent",
      color: "#f5efe6",
      fontWeight: 700,
      cursor: "pointer"
    }
  };
}

export default function Page() {
  const [mobile, setMobile] = useState(false);
  const [template, setTemplate] = useState(templates[1]);
  const [decision, setDecision] = useState("Should I text them?");
  const [tone, setTone] = useState<Tone>("honest");
  const [horizon, setHorizon] = useState("2 weeks");
  const [messages, setMessages] = useState<Message[]>(
    fallbackMessages("Should I text them?", "2 weeks")
  );
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [composerOpen, setComposerOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const update = () => setMobile(window.innerWidth < 900);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    sendToAI("Should I text them?", "honest", "2 weeks");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const styles = useMemo(() => createStyles(mobile), [mobile]);
  const caption = useMemo(() => captionFor(tone), [tone]);

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

  const handleSend = async () => {
    await sendToAI(decision, tone, horizon);
    setComposerOpen(false);
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

  return (
    <main style={styles.page}>
      {menuOpen && <div style={styles.overlay} onClick={() => setMenuOpen(false)} />}
      {proOpen && <div style={styles.overlay} onClick={() => setProOpen(false)} />}

      {menuOpen && (
        <div style={styles.menuSheet}>
          <div>
            <div style={styles.menuTitle}>Future Me</div>
            <div style={styles.menuSub}>Quick actions</div>
          </div>

          <div style={styles.menuSection}>
            <button
              style={styles.menuButton}
              onClick={() => {
                setComposerOpen(true);
                textareaRef.current?.focus();
                setMenuOpen(false);
              }}
            >
              New chat
            </button>
            <button
              style={styles.menuButton}
              onClick={() => {
                setComposerOpen((v) => !v);
                setMenuOpen(false);
              }}
            >
              {composerOpen ? "Hide composer" : "Show composer"}
            </button>
            <button
              style={styles.menuButton}
              onClick={() => {
                setProOpen(true);
                setMenuOpen(false);
              }}
            >
              Upgrade to Pro
            </button>
          </div>

          <div style={styles.menuSection}>
            <div style={styles.menuSub}>Templates</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {templates.slice(0, 6).map((t) => (
                <button
                  key={t}
                  style={styles.templateChip}
                  onClick={() => {
                    setTemplate(t);
                    setDecision(t);
                    setMenuOpen(false);
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {proOpen && (
        <div style={styles.menuSheet}>
          <div>
            <div style={styles.menuTitle}>Go Pro</div>
            <div style={styles.menuSub}>Unlock more generations and better exports</div>
          </div>

          <div style={styles.proCard}>
            <div style={styles.proTitle}>Pro features</div>
            <div style={styles.proText}>
              More generations, saved history, and cleaner export flow.
            </div>
          </div>

          <div style={styles.proActions}>
            <button style={styles.proButton}>Upgrade now</button>
            <button style={styles.proSecondary} onClick={() => setProOpen(false)}>
              Not now
            </button>
          </div>
        </div>
      )}

      <div style={styles.shell}>
        <header style={styles.topBar}>
          <button style={styles.iconButton} aria-label="Menu" onClick={() => setMenuOpen(true)}>
            ≡
          </button>

          <div style={styles.topTitle}>
            <div style={styles.brand}>Future Me</div>
            <div style={styles.brandSub}>quiet decision screenshots</div>
          </div>

          <button style={styles.iconButton} aria-label="Upgrade" onClick={() => setProOpen(true)}>
            ⋯
          </button>
        </header>

        <div style={styles.chatCard} ref={previewRef}>
          <div style={styles.chatHeader}>
            <div style={styles.chatHeaderLeft}>
              <div style={styles.avatar}>FM</div>
              <div style={styles.chatNameWrap}>
                <div style={styles.chatName}>Future Me</div>
                <div style={styles.chatHint}>iMessage-inspired private chat</div>
              </div>
            </div>

            <div style={styles.chatHeaderRight}>
              <div style={styles.chip}>{toneLabels[tone]}</div>
            </div>
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

              {isLoading && (
                <div style={{ ...styles.row, justifyContent: "flex-start" }}>
                  <div style={{ ...styles.bubble, ...styles.bubbleFuture, opacity: 0.8 }}>
                    typing…
                  </div>
                </div>
              )}
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

            <div style={styles.templateRow}>
              {templates.slice(0, 4).map((t) => (
                <button
                  key={t}
                  style={styles.templateChip}
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
                onKeyDown={handleKeyDown}
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
                Press Enter to send. Menu opens the bottom sheet. Three dots open Pro.
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
