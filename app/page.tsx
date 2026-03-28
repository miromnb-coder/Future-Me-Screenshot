"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

type Tone = "calm" | "honest" | "direct" | "hopeful" | "chaotic";

type Message = {
  from: "me" | "future me";
  text: string;
  time: string;
};

const presets = [
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

function buildMessages(decision: string, tone: Tone, horizon: string): Message[] {
  const d = decision.trim() || "Should I do this?";
  const h = horizon.trim() || "2 weeks";

  const replies: Record<Tone, Message[]> = {
    calm: [
      { from: "me", text: d, time: "now" },
      { from: "future me", text: "Take a second before deciding.", time: "soon" },
      { from: "me", text: "So… maybe not?", time: "soon" },
      { from: "future me", text: `Probably not. ${h} later, you'll appreciate the pause.`, time: h }
    ],
    honest: [
      { from: "me", text: d, time: "now" },
      { from: "future me", text: "Be honest with yourself.", time: "soon" },
      { from: "me", text: "I am.", time: "soon" },
      { from: "future me", text: `Then you already know the answer. ${h} later, you'll still think about this.`, time: h }
    ],
    direct: [
      { from: "me", text: d, time: "now" },
      { from: "future me", text: "No. That's the answer.", time: "soon" },
      { from: "me", text: "That simple?", time: "soon" },
      { from: "future me", text: `Yes. ${h} later, you'll see why.`, time: h }
    ],
    hopeful: [
      { from: "me", text: d, time: "now" },
      { from: "future me", text: "Maybe. But move carefully.", time: "soon" },
      { from: "me", text: "So not a hard no?", time: "soon" },
      { from: "future me", text: `Not a hard no. Just a reminder to choose with clarity. ${h} later, that matters.`, time: h }
    ],
    chaotic: [
      { from: "me", text: d, time: "now" },
      { from: "future me", text: "This is already getting interesting.", time: "soon" },
      { from: "me", text: "Should I do it?", time: "soon" },
      { from: "future me", text: `Maybe. ${h} later, this will either be a lesson or a story.`, time: h }
    ]
  };

  return replies[tone];
}

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
      padding: mobile ? 12 : 20,
      background:
        "radial-gradient(circle at top left, rgba(224, 204, 168, 0.28), transparent 22%), radial-gradient(circle at top right, rgba(150, 180, 160, 0.22), transparent 20%), linear-gradient(180deg, #f4efe7 0%, #ebe4d8 100%)",
      color: "#18202b",
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    },
    shell: {
      maxWidth: 1320,
      margin: "0 auto",
      display: mobile ? "flex" : "grid",
      flexDirection: mobile ? "column-reverse" : undefined,
      gridTemplateColumns: mobile ? undefined : "320px 1fr",
      gap: 18,
      alignItems: "start"
    },
    sidebar: {
      background: "rgba(255,255,255,0.60)",
      border: "1px solid rgba(24,32,43,0.08)",
      borderRadius: 28,
      padding: mobile ? 16 : 18,
      backdropFilter: "blur(14px)",
      boxShadow: "0 18px 50px rgba(24,32,43,0.08)",
      display: "grid",
      gap: 14,
      position: mobile ? "relative" : "sticky",
      top: mobile ? 0 : 20
    },
    brandBlock: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginBottom: 4
    },
    brandMark: {
      width: 44,
      height: 44,
      borderRadius: 14,
      display: "grid",
      placeItems: "center",
      background: "#18202b",
      color: "#f4efe7",
      fontWeight: 800,
      letterSpacing: "-0.03em"
    },
    brandName: {
      fontWeight: 800,
      fontSize: 16,
      letterSpacing: "-0.02em"
    },
    brandSub: {
      fontSize: 12,
      color: "rgba(24,32,43,0.62)",
      marginTop: 2
    },
    menuSection: {
      display: "grid",
      gap: 8
    },
    menuLabel: {
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
    actionMenu: {
      display: "grid",
      gap: 10
    },
    menuButton: {
      width: "100%",
      border: "1px solid rgba(24,32,43,0.10)",
      background: "rgba(255,255,255,0.76)",
      color: "#18202b",
      borderRadius: 16,
      padding: "12px 14px",
      textAlign: "left",
      fontWeight: 600
    },
    captionBox: {
      marginTop: 2,
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
    },
    chatArea: {
      display: "grid",
      gap: 16
    },
    headerRow: {
      display: "grid",
      gridTemplateColumns: mobile ? "1fr" : "1fr auto",
      gap: 16,
      alignItems: "end"
    },
    kicker: {
      display: "inline-flex",
      padding: "8px 12px",
      borderRadius: 999,
      background: "rgba(24,32,43,0.06)",
      border: "1px solid rgba(24,32,43,0.08)",
      color: "rgba(24,32,43,0.72)",
      fontSize: 13,
      marginBottom: 12,
      width: "fit-content"
    },
    title: {
      margin: 0,
      fontSize: mobile ? "34px" : "clamp(34px, 4.5vw, 62px)",
      lineHeight: 0.96,
      letterSpacing: "-0.05em",
      maxWidth: mobile ? 14 : 12
    },
    subtitle: {
      marginTop: 12,
      marginBottom: 0,
      maxWidth: 640,
      fontSize: 17,
      lineHeight: 1.65,
      color: "rgba(24,32,43,0.72)"
    },
    statusCard: {
      borderRadius: 22,
      padding: 16,
      background: "rgba(255,255,255,0.54)",
      border: "1px solid rgba(24,32,43,0.08)",
      boxShadow: "0 16px 40px rgba(24,32,43,0.06)",
      minWidth: mobile ? "auto" : 160
    },
    statusLabel: {
      fontSize: 12,
      color: "rgba(24,32,43,0.6)"
    },
    statusValue: {
      marginTop: 6,
      fontWeight: 800,
      fontSize: 18
    },
    statusSmall: {
      marginTop: 4,
      fontSize: 12,
      color: "rgba(24,32,43,0.55)"
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
    chatTitle: {
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
    msgRow: {
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
    footerButtons: {
      display: "grid",
      gap: 10
    },
    footerHint: {
      marginTop: 8,
      fontSize: 12,
      color: "rgba(24,32,43,0.56)"
    }
  };
}

export default function Page() {
  const [decision, setDecision] = useState("Should I buy this?");
  const [tone, setTone] = useState<Tone>("honest");
  const [horizon, setHorizon] = useState("2 weeks");
  const [preset, setPreset] = useState(presets[1]);
  const [messages, setMessages] = useState<Message[]>(
    buildMessages("Should I buy this?", "honest", "2 weeks")
  );
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 900);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const styles = useMemo(() => createStyles(isMobile), [isMobile]);
  const caption = useMemo(() => captionFor(tone), [tone]);

  const regenerate = (nextDecision = decision, nextTone = tone, nextHorizon = horizon) => {
    setMessages(buildMessages(nextDecision, nextTone, nextHorizon));
  };

  const handlePresetChange = (value: string) => {
    setPreset(value);
    setDecision(value);
    regenerate(value, tone, horizon);
  };

  const handleToneChange = (value: Tone) => {
    setTone(value);
    regenerate(decision, value, horizon);
  };

  const handleHorizonChange = (value: string) => {
    setHorizon(value);
    regenerate(decision, tone, value);
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
        <aside style={styles.sidebar}>
          <div style={styles.brandBlock}>
            <div style={styles.brandMark}>FM</div>
            <div>
              <div style={styles.brandName}>Future Me</div>
              <div style={styles.brandSub}>Quiet decision screenshots</div>
            </div>
          </div>

          <div style={styles.menuSection}>
            <div style={styles.menuLabel}>Template</div>
            <select
              value={preset}
              onChange={(e) => handlePresetChange(e.target.value)}
              style={styles.select}
            >
              {presets.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.menuSection}>
            <div style={styles.menuLabel}>Tone</div>
            <select
              value={tone}
              onChange={(e) => handleToneChange(e.target.value as Tone)}
              style={styles.select}
            >
              {Object.entries(toneLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.menuSection}>
            <div style={styles.menuLabel}>Time jump</div>
            <select
              value={horizon}
              onChange={(e) => handleHorizonChange(e.target.value)}
              style={styles.select}
            >
              <option>Tomorrow</option>
              <option>2 weeks</option>
              <option>1 month</option>
              <option>6 months</option>
            </select>
          </div>

          <div style={styles.menuSection}>
            <div style={styles.menuLabel}>Decision</div>
            <textarea
              value={decision}
              onChange={(e) => {
                setDecision(e.target.value);
                regenerate(e.target.value, tone, horizon);
              }}
              placeholder="Write one decision..."
              style={styles.textarea}
            />
          </div>

          <div style={styles.menuSection}>
            <div style={styles.menuLabel}>Actions</div>
            <div style={styles.footerButtons}>
              <button onClick={() => regenerate()} style={styles.menuButton}>
                Refresh conversation
              </button>
              <button onClick={downloadOrShareScreenshot} style={styles.menuButton}>
                Save or share screenshot
              </button>
              <button onClick={copyCaption} style={styles.menuButton}>
                {copied ? "Caption copied" : "Copy caption"}
              </button>
            </div>
            <div style={styles.footerHint}>
              Puhelimella “Save or share screenshot” avaa myös jakamisen, jos laite tukee sitä.
            </div>
          </div>

          <div style={styles.captionBox}>
            <div style={styles.captionLabel}>Suggested caption</div>
            <div style={styles.captionText}>{caption}</div>
          </div>
        </aside>

        <section style={styles.chatArea}>
          <div style={styles.headerRow}>
            <div>
              <div style={styles.kicker}>See your decision from the future</div>
              <h1 style={styles.title}>A quiet conversation.</h1>
              <p style={styles.subtitle}>
                One decision. One future reply. Built to feel calm, simple, and intelligent.
              </p>
            </div>

            <div style={styles.statusCard}>
              <div style={styles.statusLabel}>Mode</div>
              <div style={styles.statusValue}>{toneLabels[tone]}</div>
              <div style={styles.statusSmall}>{horizon} later</div>
            </div>
          </div>

          <div ref={previewRef} style={styles.chatCard}>
            <div style={styles.chatTop}>
              <div>
                <div style={styles.chatTitle}>Future Me</div>
                <div style={styles.chatMeta}>private conversation · minimal mode</div>
              </div>
              <div style={styles.chatPill}>quiet</div>
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
                    ...styles.msgRow,
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
        </section>
      </div>
    </main>
  );
}
