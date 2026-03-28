"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";

type Tone = "calm" | "honest" | "direct" | "hopeful" | "chaotic";
type ViewMode = "chat" | "screenshot";

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

export default function Page() {
  const [isMobile, setIsMobile] = useState(false);

  const [template, setTemplate] = useState("Should I buy this?");
  const [decision, setDecision] = useState("Should I buy this?");
  const [tone, setTone] = useState<Tone>("honest");
  const [horizon, setHorizon] = useState("2 weeks");
  const [viewMode, setViewMode] = useState<ViewMode>("chat");

  const [messages, setMessages] = useState<Message[]>(
    fallbackMessages("Should I buy this?", "2 weeks")
  );
  const [composerOpen, setComposerOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const previewRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 900);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const initial = async () => {
      await sendToAI("Should I buy this?", "honest", "2 weeks");
    };
    initial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const caption = useMemo(() => captionFor(tone), [tone]);

  const styles = useMemo(() => createStyles(isMobile), [isMobile]);

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
    } catch (err) {
      console.error(err);
      setMessages(fallbackMessages(nextDecision, nextHorizon));
    } finally {
      setIsLoading(false);
    }
  }

  const handleTemplateChange = (value: string) => {
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

    const file = new File([blob], `future-me-${Date.now()}.png`, {
      type: "image/png"
    });

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
      <header style={styles.topBar}>
        <button style={styles.iconButton} aria-label="Menu">
          ≡
        </button>

        <div style={styles.topTitleWrap}>
          <div style={styles.brandTitle}>Future Me</div>
          <div style={styles.brandSubtitle}>quiet decision screenshots</div>
        </div>

        <div style={styles.topIcons}>
          <button
            style={styles.iconButton}
            aria-label="New conversation"
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

      <section style={styles.chatShell}>
        <div style={styles.headerBlock}>
          <div style={styles.kicker}>See your decision from the future</div>
          <h1 style={styles.title}>A quiet conversation.</h1>
          <p style={styles.subtitle}>
            One decision. One future reply. Built to feel calm, simple, and intelligent.
          </p>
        </div>

        <div style={styles.modeCard}>
          <div style={styles.modeTopRow}>
            <div>
              <div style={styles.modeLabel}>Mode</div>
              <div style={styles.modeValue}>{toneLabels[tone]}</div>
            </div>
            <div style={styles.modeSmall}>{horizon} later</div>
          </div>
        </div>

        <div style={styles.controlsRow}>
          <div style={styles.control}>
            <label style={styles.controlLabel}>Template</label>
            <select
              value={template}
              onChange={(e) => handleTemplateChange(e.target.value)}
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
            <label style={styles.controlLabel}>Tone</label>
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
            <label style={styles.controlLabel}>Time jump</label>
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
            <label style={styles.controlLabel}>View</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              style={styles.select}
            >
              <option value="chat">Chat</option>
              <option value="screenshot">Screenshot</option>
            </select>
          </div>
        </div>

        <div ref={previewRef} style={styles.chatCard}>
          <div style={styles.chatTop}>
            <div>
              <div style={styles.chatName}>Future Me</div>
              <div style={styles.chatMeta}>private conversation · minimal mode</div>
            </div>
            <div style={styles.chatPill}>{isLoading ? "typing..." : "quiet"}</div>
          </div>

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
                  ...styles.messageRow,
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

          {viewMode === "screenshot" && (
            <div style={styles.screenshotFooter}>
              <div style={styles.screenshotText}>
                {decision.trim() || "Should I do this?"}
              </div>
            </div>
          )}
        </div>

        <div style={styles.composerCard}>
          <div style={styles.composerHeaderRow}>
            <button
              style={styles.composerToggle}
              onClick={() => setComposerOpen((v) => !v)}
            >
              {composerOpen ? "Hide composer" : "Show composer"}
            </button>

            <div style={styles.composerMeta}>
              Press Enter to send
            </div>
          </div>

          {composerOpen && (
            <>
              <textarea
                ref={textareaRef}
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Write one decision..."
                style={styles.textarea}
              />

              <div style={styles.actionRow}>
                <button
                  onClick={handleSend}
                  style={styles.sendButton}
                  disabled={isLoading}
                >
                  {isLoading ? "Sending..." : "Send message"}
                </button>

                <button
                  onClick={downloadOrShareScreenshot}
                  style={styles.secondaryButton}
                >
                  Save or share screenshot
                </button>

                <button onClick={copyCaption} style={styles.secondaryButton}>
                  {copied ? "Caption copied" : "Copy caption"}
                </button>
              </div>

              <div style={styles.captionBox}>
                <div style={styles.captionLabel}>Suggested caption</div>
                <div style={styles.captionText}>{caption}</div>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function createStyles(mobile: boolean): Record<string, CSSProperties> {
  return {
    page: {
      minHeight: "100vh",
      padding: mobile ? 12 : 20,
      background:
        "radial-gradient(circle at top left, rgba(224, 204, 168, 0.28), transparent 22%), radial-gradient(circle at top right, rgba(150, 180, 160, 0.22), transparent 20%), linear-gradient(180deg, #f4efe7 0%, #ebe4d8 100%)",
      color: "#18202b",
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    },
    topBar: {
      maxWidth: 1180,
      margin: "0 auto 18px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 14,
      border: "1px solid rgba(24,32,43,0.08)",
      background: "rgba(255,255,255,0.56)",
      color: "#18202b",
      fontSize: 20,
      display: "grid",
      placeItems: "center",
      boxShadow: "0 12px 30px rgba(24,32,43,0.05)"
    },
    topTitleWrap: {
      flex: 1,
      textAlign: "center"
    },
    brandTitle: {
      fontSize: 18,
      fontWeight: 800,
      letterSpacing: "-0.02em"
    },
    brandSubtitle: {
      fontSize: 12,
      color: "rgba(24,32,43,0.58)",
      marginTop: 3
    },
    topIcons: {
      display: "flex",
      alignItems: "center",
      gap: 10
    },
    chatShell: {
      maxWidth: 1180,
      margin: "0 auto",
      display: "grid",
      gap: 16
    },
    headerBlock: {
      display: "grid",
      gap: 10
    },
    kicker: {
      display: "inline-flex",
      width: "fit-content",
      padding: "8px 12px",
      borderRadius: 999,
      background: "rgba(24,32,43,0.06)",
      border: "1px solid rgba(24,32,43,0.08)",
      color: "rgba(24,32,43,0.72)",
      fontSize: 13
    },
    title: {
      margin: 0,
      fontSize: mobile ? "34px" : "clamp(34px, 4.5vw, 62px)",
      lineHeight: 0.96,
      letterSpacing: "-0.05em",
      maxWidth: mobile ? 14 : 12
    },
    subtitle: {
      marginTop: 2,
      marginBottom: 0,
      maxWidth: 640,
      fontSize: 17,
      lineHeight: 1.65,
      color: "rgba(24,32,43,0.72)"
    },
    modeCard: {
      borderRadius: 22,
      padding: 16,
      background: "rgba(255,255,255,0.54)",
      border: "1px solid rgba(24,32,43,0.08)",
      boxShadow: "0 16px 40px rgba(24,32,43,0.06)"
    },
    modeTopRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "end",
      gap: 10
    },
    modeLabel: {
      fontSize: 12,
      color: "rgba(24,32,43,0.58)"
    },
    modeValue: {
      marginTop: 6,
      fontSize: 18,
      fontWeight: 800
    },
    modeSmall: {
      fontSize: 12,
      color: "rgba(24,32,43,0.55)"
    },
    controlsRow: {
      display: "grid",
      gridTemplateColumns: mobile ? "1fr" : "repeat(4, minmax(0, 1fr))",
      gap: 12
    },
    control: {
      display: "grid",
      gap: 8
    },
    controlLabel: {
      fontSize: 12,
      color: "rgba(24,32,43,0.68)",
      fontWeight: 600
    },
    select: {
      width: "100%",
      borderRadius: 16,
      border: "1px solid rgba(24,32,43,0.10)",
      background: "rgba(255,255,255,0.76)",
      color: "#18202b",
      padding: "12px 14px",
      outline: "none"
    },
    chatCard: {
      borderRadius: 30,
      padding: mobile ? 16 : 18,
      background: "rgba(255,255,255,0.64)",
      border: "1px solid rgba(24,32,43,0.08)",
      boxShadow: "0 20px 60px rgba(24,32,43,0.08)",
      minHeight: mobile ? 560 : 720
    },
    chatTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      marginBottom: 16
    },
    chatName: {
      fontWeight: 800,
      fontSize: 18,
      letterSpacing: "-0.02em",
      color: "#18202b"
    },
    chatMeta: {
      fontSize: 12,
      color: "rgba(24,32,43,0.56)",
      marginTop: 4
    },
    chatPill: {
      padding: "8px 12px",
      borderRadius: 999,
      background: "rgba(24,32,43,0.05)",
      border: "1px solid rgba(24,32,43,0.08)",
      fontSize: 12,
      color: "rgba(24,32,43,0.74)"
    },
    divider: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      margin: "2px 0 18px"
    },
    dividerLine: {
      height: 1,
      flex: 1,
      background: "linear-gradient(90deg, transparent, rgba(24,32,43,0.16), transparent)"
    },
    dividerText: {
      fontSize: 12,
      color: "rgba(24,32,43,0.58)",
      padding: "6px 10px",
      borderRadius: 999,
      background: "rgba(24,32,43,0.04)",
      border: "1px solid rgba(24,32,43,0.06)"
    },
    messages: {
      display: "flex",
      flexDirection: "column",
      gap: 12
    },
    messageRow: {
      display: "flex"
    },
    bubble: {
      maxWidth: mobile ? "86%" : "76%",
      padding: "13px 15px",
      borderRadius: 20,
      lineHeight: 1.5,
      fontSize: 14,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word"
    },
    bubbleMe: {
      background: "#18202b",
      color: "#f4efe7",
      borderTopRightRadius: 8
    },
    bubbleFuture: {
      background: "rgba(24,32,43,0.06)",
      color: "#18202b",
      borderTopLeftRadius: 8
    },
    time: {
      marginTop: 6,
      fontSize: 11,
      color: "rgba(24,32,43,0.5)"
    },
    screenshotFooter: {
      marginTop: 18,
      paddingTop: 14,
      borderTop: "1px solid rgba(24,32,43,0.08)"
    },
    screenshotText: {
      fontSize: 12,
      color: "rgba(24,32,43,0.58)"
    },
    composerCard: {
      borderRadius: 28,
      padding: mobile ? 16 : 18,
      background: "rgba(255,255,255,0.60)",
      border: "1px solid rgba(24,32,43,0.08)",
      boxShadow: "0 18px 50px rgba(24,32,43,0.08)",
      display: "grid",
      gap: 14
    },
    composerHeaderRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12
    },
    composerToggle: {
      border: "1px solid rgba(24,32,43,0.10)",
      background: "rgba(255,255,255,0.76)",
      color: "#18202b",
      borderRadius: 16,
      padding: "10px 12px",
      fontWeight: 700
    },
    composerMeta: {
      fontSize: 12,
      color: "rgba(24,32,43,0.55)"
    },
    textarea: {
      width: "100%",
      minHeight: 110,
      resize: "vertical",
      borderRadius: 18,
      border: "1px solid rgba(24,32,43,0.10)",
      background: "rgba(255,255,255,0.80)",
      color: "#18202b",
      padding: "14px 15px",
      outline: "none"
    },
    actionRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: 10
    },
    sendButton: {
      border: "0",
      borderRadius: 16,
      padding: "12px 15px",
      color: "white",
      fontWeight: 700,
      background: "linear-gradient(135deg, #18202b, #2f3b4d)"
    },
    secondaryButton: {
      border: "1px solid rgba(24,32,43,0.10)",
      background: "rgba(255,255,255,0.76)",
      color: "#18202b",
      borderRadius: 16,
      padding: "12px 15px",
      fontWeight: 600
    },
    captionBox: {
      borderRadius: 20,
      padding: 14,
      background: "rgba(24,32,43,0.04)",
      border: "1px solid rgba(24,32,43,0.08)"
    },
    captionLabel: {
      fontSize: 12,
      color: "rgba(24,32,43,0.58)",
      marginBottom: 6
    },
    captionText: {
      lineHeight: 1.55,
      color: "#18202b"
    }
  };
}
