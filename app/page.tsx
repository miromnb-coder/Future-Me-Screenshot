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
        "radial-gradient(circle at top left, rgba(255,255,255,0.70), transparent 28%), radial-gradient(circle at top right, rgba(255,255,255,0.35), transparent 24%), linear-gradient(180deg, #f4efe7 0%, #ebe4d8 100%)",
      color: "#0f1720",
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: mobile ? 12 : 20
    },
    shell: {
      maxWidth: 1120,
      margin: "0 auto",
      display: "grid",
      gap: 16
    },
    topBar: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: mobile ? "4px 2px" : "2px 0 8px"
    },
    brand: {
      display: "flex",
      flexDirection: "column",
      gap: 2
    },
    brandName: {
      fontSize: 16,
      fontWeight: 800,
      letterSpacing: "-0.03em"
    },
    brandSub: {
      fontSize: 12,
      color: "rgba(15,23,32,0.58)"
    },
    topActions: {
      display: "flex",
      alignItems: "center",
      gap: 8
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 14,
      border: "1px solid rgba(15,23,32,0.08)",
      background: "rgba(255,255,255,0.60)",
      color: "#0f1720",
      display: "grid",
      placeItems: "center",
      boxShadow: "0 12px 30px rgba(15,23,32,0.05)",
      cursor: "pointer"
    },
    hero: {
      display: "grid",
      gap: 10,
      padding: mobile ? "12px 0 2px" : "10px 0 4px"
    },
    eyebrow: {
      display: "inline-flex",
      width: "fit-content",
      padding: "8px 12px",
      borderRadius: 999,
      background: "rgba(15,23,32,0.05)",
      border: "1px solid rgba(15,23,32,0.06)",
      fontSize: 13,
      color: "rgba(15,23,32,0.70)"
    },
    title: {
      margin: 0,
      fontSize: mobile ? "34px" : "clamp(38px, 5vw, 64px)",
      lineHeight: 0.95,
      letterSpacing: "-0.055em",
      maxWidth: mobile ? 12 : 11
    },
    subtitle: {
      margin: 0,
      maxWidth: 680,
      color: "rgba(15,23,32,0.68)",
      fontSize: 17,
      lineHeight: 1.6
    },
    metaRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: 10,
      alignItems: "center"
    },
    metaPill: {
      padding: "10px 12px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.58)",
      border: "1px solid rgba(15,23,32,0.07)",
      color: "rgba(15,23,32,0.72)",
      fontSize: 13
    },
    layout: {
      display: "grid",
      gridTemplateColumns: mobile ? "1fr" : "1fr",
      gap: 14
    },
    chatCard: {
      borderRadius: 28,
      background: "rgba(255,255,255,0.62)",
      border: "1px solid rgba(15,23,32,0.08)",
      boxShadow: "0 24px 80px rgba(15,23,32,0.08)",
      overflow: "hidden"
    },
    chatHead: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: mobile ? 16 : 18,
      borderBottom: "1px solid rgba(15,23,32,0.06)"
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
      color: "rgba(15,23,32,0.54)"
    },
    chatBadge: {
      padding: "8px 12px",
      borderRadius: 999,
      background: "rgba(15,23,32,0.05)",
      border: "1px solid rgba(15,23,32,0.06)",
      fontSize: 12,
      color: "rgba(15,23,32,0.68)"
    },
    chatBody: {
      padding: mobile ? 16 : 18,
      minHeight: mobile ? 460 : 560,
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
      background: "linear-gradient(90deg, transparent, rgba(15,23,32,0.16), transparent)"
    },
    dividerText: {
      fontSize: 12,
      color: "rgba(15,23,32,0.56)",
      padding: "6px 10px",
      borderRadius: 999,
      background: "rgba(15,23,32,0.04)",
      border: "1px solid rgba(15,23,32,0.06)"
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
      background: "#0f1720",
      color: "#f4efe7",
      borderTopRightRadius: 8
    },
    bubbleFuture: {
      background: "rgba(15,23,32,0.06)",
      color: "#0f1720",
      borderTopLeftRadius: 8
    },
    time: {
      marginTop: 6,
      fontSize: 11,
      color: "rgba(15,23,32,0.52)"
    },
    composerShell: {
      borderRadius: 28,
      background: "rgba(255,255,255,0.62)",
      border: "1px solid rgba(15,23,32,0.08)",
      boxShadow: "0 18px 50px rgba(15,23,32,0.06)",
      overflow: "hidden"
    },
    composerTop: {
      padding: mobile ? 16 : 18,
      display: "flex",
      flexDirection: "column",
      gap: 12,
      borderBottom: "1px solid rgba(15,23,32,0.06)"
    },
    controlsRow: {
      display: "grid",
      gridTemplateColumns: mobile ? "1fr" : "repeat(4, minmax(0, 1fr))",
      gap: 10
    },
    control: {
      display: "grid",
      gap: 7
    },
    label: {
      fontSize: 12,
      fontWeight: 600,
      color: "rgba(15,23,32,0.64)"
    },
    select: {
      width: "100%",
      borderRadius: 16,
      border: "1px solid rgba(15,23,32,0.08)",
      background: "rgba(255,255,255,0.78)",
      color: "#0f1720",
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
      border: "1px solid rgba(15,23,32,0.08)",
      background: "rgba(255,255,255,0.72)",
      color: "#0f1720",
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
      border: "1px solid rgba(15,23,32,0.08)",
      background: "rgba(255,255,255,0.84)",
      color: "#0f1720",
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
      background: "#0f1720",
      color: "#f4efe7",
      fontWeight: 700,
      cursor: "pointer"
    },
    secondaryButton: {
      border: "1px solid rgba(15,23,32,0.08)",
      borderRadius: 16,
      padding: "12px 15px",
      background: "rgba(255,255,255,0.72)",
      color: "#0f1720",
      fontWeight: 600,
      cursor: "pointer"
    },
    footerHint: {
      fontSize: 12,
      color: "rgba(15,23,32,0.54)",
      lineHeight: 1.5
    },
    emptyState: {
      padding: "34px 18px",
      borderRadius: 22,
      border: "1px dashed rgba(15,23,32,0.10)",
      background: "rgba(15,23,32,0.02)",
      color: "rgba(15,23,32,0.58)",
      fontSize: 13,
      lineHeight: 1.6
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
  const previewRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const update = () => setMobile(window.innerWidth < 900);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const init = async () => {
      await sendToAI("Should I text them?", "honest", "2 weeks");
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const styles = useMemo(() => createStyles(mobile), [mobile]);
  const caption = useMemo(() => captionFor(tone), [tone]);

  async function sendToAI(
    nextDecision = decision,
    nextTone = tone,
    nextHorizon = horizon
  ) {
    setIsLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          decision: nextDecision,
          tone: nextTone,
          horizon: nextHorizon
        })
      });

      const data = await res.json();
      if (Array.isArray(data?.messages) && data.messages.length > 0) {
        setMessages(data.messages);
      } else {
        setMessages(fallbackMessages(nextDecision, nextHorizon));
      }
    } catch {
      setMessages(fallbackMessages(nextDecision, nextHorizon));
    } finally {
      setIsLoading(false);
    }
  }

  const handleTemplatePick = (value: string) => {
    setTemplate(value);
    setDecision(value);
  };

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
      <div style={styles.shell}>
        <header style={styles.topBar}>
          <button style={styles.iconButton} aria-label="Menu">
            ≡
          </button>

          <div style={styles.brand}>
            <div style={styles.brandName}>Future Me</div>
            <div style={styles.brandSub}>quiet decision screenshots</div>
          </div>

          <div style={styles.topActions}>
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
            <button style={styles.iconButton} aria-label="More">
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
            <div style={styles.metaPill}>Minimal UI</div>
          </div>
        </section>

        <section style={styles.layout}>
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

              {messages.length > 0 ? (
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
              ) : (
                <div style={styles.emptyState}>
                  Write one decision below and send it. The reply appears here like a real chat.
                </div>
              )}
            </div>
          </div>

          <div style={styles.composerShell}>
            <div style={styles.composerTop}>
              <div style={styles.controlsRow}>
                <div style={styles.control}>
                  <div style={styles.label}>Template</div>
                  <select
                    value={template}
                    onChange={(e) => handleTemplatePick(e.target.value)}
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

                <div style={styles.control}>
                  <div style={styles.label}>View</div>
                  <select
                    value={composerOpen ? "open" : "closed"}
                    onChange={(e) => setComposerOpen(e.target.value === "open")}
                    style={styles.select}
                  >
                    <option value="open">Composer open</option>
                    <option value="closed">Composer hidden</option>
                  </select>
                </div>
              </div>

              <div style={styles.templatePills}>
                {templates.slice(0, 4).map((t) => (
                  <button key={t} style={styles.pill} onClick={() => handleTemplatePick(t)}>
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
                  Press Enter to send. The screenshot is built to feel like a real conversation, not a demo.
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
