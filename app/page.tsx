"use client";

import { useMemo, useRef, useState } from "react";

type Tone = "calm" | "honest" | "savage" | "hopeful";
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
  "Should I trust this?"
];

function buildMessages(decision: string, tone: Tone, horizon: string): Message[] {
  const d = decision.trim() || "Should I do this?";
  const h = horizon.trim() || "2 weeks";

  const replies: Record<Tone, Message[]> = {
    calm: [
      { from: "me", text: d, time: "now" },
      { from: "future me", text: "Take a breath. Not every thought needs action.", time: "soon" },
      { from: "me", text: "So… no?", time: "soon" },
      { from: "future me", text: `Probably not. ${h} later, you'll be glad you paused.`, time: h }
    ],
    honest: [
      { from: "me", text: d, time: "now" },
      { from: "future me", text: "Be honest with yourself.", time: "soon" },
      { from: "me", text: "I am.", time: "soon" },
      { from: "future me", text: `Then you already know the answer. ${h} later, you'll remember this chat.`, time: h }
    ],
    savage: [
      { from: "me", text: d, time: "now" },
      { from: "future me", text: "You know this is a bad idea.", time: "soon" },
      { from: "me", text: "That direct?", time: "soon" },
      { from: "future me", text: `Yes. And ${h} later, you'll understand why.`, time: h }
    ],
    hopeful: [
      { from: "me", text: d, time: "now" },
      { from: "future me", text: "Maybe. But choose carefully.", time: "soon" },
      { from: "me", text: "So not a hard no?", time: "soon" },
      { from: "future me", text: `No. Just a reminder to move with clarity. ${h} later, that matters.`, time: h }
    ]
  };

  return replies[tone];
}

function captionFor(tone: Tone) {
  switch (tone) {
    case "calm":
      return "I asked future me before I rushed it.";
    case "honest":
      return "Future me was more honest than I was.";
    case "savage":
      return "My future self did not let me off easy.";
    case "hopeful":
      return "A small pause changed the answer.";
  }
}

export default function Page() {
  const [decision, setDecision] = useState("Should I buy this?");
  const [tone, setTone] = useState<Tone>("honest");
  const [horizon, setHorizon] = useState("2 weeks");
  const [messages, setMessages] = useState<Message[]>(
    buildMessages("Should I buy this?", "honest", "2 weeks")
  );
  const [copied, setCopied] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const caption = useMemo(() => captionFor(tone), [tone]);

  const generate = () => {
    setMessages(buildMessages(decision, tone, horizon));
  };

  const randomize = () => {
    const randomDecision = presets[Math.floor(Math.random() * presets.length)];
    const tones: Tone[] = ["calm", "honest", "savage", "hopeful"];
    const horizons = ["tomorrow", "2 weeks", "1 month", "6 months"];

    const nextTone = tones[Math.floor(Math.random() * tones.length)];
    const nextHorizon = horizons[Math.floor(Math.random() * horizons.length)];

    setDecision(randomDecision);
    setTone(nextTone);
    setHorizon(nextHorizon);
    setMessages(buildMessages(randomDecision, nextTone, nextHorizon));
  };

  const copyCaption = async () => {
    await navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const downloadScreenshot = async () => {
    if (!previewRef.current) return;

    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(previewRef.current, {
      backgroundColor: null,
      scale: 2
    });

    const link = document.createElement("a");
    link.download = `future-me-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <main style={styles.page}>
      <section style={styles.top}>
        <div>
          <div style={styles.kicker}>Future Me Screenshot</div>
          <h1 style={styles.title}>See your decision from the future.</h1>
          <p style={styles.subtitle}>
            Write one decision and get a clean chat screenshot from your future self.
          </p>
        </div>

        <div style={styles.noteCard}>
          <div style={styles.noteTitle}>Simple. Quiet. Clear.</div>
          <div style={styles.noteText}>
            Built to feel like a real conversation, not a noisy app.
          </div>
        </div>
      </section>

      <section style={styles.grid}>
        <div style={styles.panel}>
          <div style={styles.sectionLabel}>Your decision</div>

          <textarea
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            placeholder="Should I buy this?"
            style={styles.textarea}
          />

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                style={styles.select}
              >
                <option value="calm">Calm</option>
                <option value="honest">Honest</option>
                <option value="savage">Direct</option>
                <option value="hopeful">Hopeful</option>
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Time jump</label>
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

          <div style={styles.presetRow}>
            {presets.map((p) => (
              <button key={p} onClick={() => setDecision(p)} style={styles.preset}>
                {p}
              </button>
            ))}
          </div>

          <div style={styles.actions}>
            <button onClick={generate} style={styles.primaryButton}>
              Generate
            </button>
            <button onClick={randomize} style={styles.secondaryButton}>
              Random
            </button>
            <button onClick={downloadScreenshot} style={styles.secondaryButton}>
              Save screenshot
            </button>
            <button onClick={copyCaption} style={styles.secondaryButton}>
              {copied ? "Copied!" : "Copy caption"}
            </button>
          </div>

          <div style={styles.captionBox}>
            <div style={styles.captionLabel}>Suggested caption</div>
            <div style={styles.captionText}>{caption}</div>
          </div>
        </div>

        <div style={styles.previewWrap}>
          <div style={styles.phoneFrame}>
            <div style={styles.phoneTop}>
              <div style={styles.notch} />
            </div>

            <div ref={previewRef} style={styles.chatCard}>
              <div style={styles.chatHeader}>
                <div>
                  <div style={styles.chatTitle}>Future Me</div>
                  <div style={styles.chatMeta}>{horizon} later</div>
                </div>
                <div style={styles.badge}>quiet mode</div>
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
          </div>

          <div style={styles.footerText}>
            A clean future conversation, styled to feel calm and intelligent.
          </div>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "32px 18px 56px",
    maxWidth: 1180,
    margin: "0 auto",
    color: "#f8fafc"
  },
  top: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: 18,
    alignItems: "end",
    marginBottom: 22
  },
  kicker: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 13,
    color: "rgba(255,255,255,0.88)",
    marginBottom: 14
  },
  title: {
    margin: 0,
    fontSize: "clamp(36px, 5vw, 68px)",
    lineHeight: 0.95,
    letterSpacing: "-0.05em",
    maxWidth: 11
  },
  subtitle: {
    marginTop: 14,
    marginBottom: 0,
    maxWidth: 620,
    fontSize: 17,
    lineHeight: 1.6,
    color: "rgba(226,232,240,0.78)"
  },
  noteCard: {
    borderRadius: 24,
    padding: 18,
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.10)",
    backdropFilter: "blur(14px)"
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 8
  },
  noteText: {
    color: "rgba(226,232,240,0.72)",
    lineHeight: 1.5
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "0.92fr 1.08fr",
    gap: 18
  },
  panel: {
    borderRadius: 28,
    padding: 18,
    background: "rgba(4, 8, 20, 0.78)",
    border: "1px solid rgba(255,255,255,0.10)",
    backdropFilter: "blur(16px)"
  },
  sectionLabel: {
    fontSize: 13,
    color: "rgba(226,232,240,0.74)",
    marginBottom: 10
  },
  textarea: {
    width: "100%",
    minHeight: 124,
    resize: "vertical",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(15,23,42,0.72)",
    color: "white",
    padding: "14px 15px",
    outline: "none",
    marginBottom: 14
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 12
  },
  field: {
    display: "grid",
    gap: 8
  },
  label: {
    fontSize: 13,
    color: "rgba(226,232,240,0.74)"
  },
  select: {
    width: "100%",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(15,23,42,0.72)",
    color: "white",
    padding: "12px 14px",
    outline: "none"
  },
  presetRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14
  },
  preset: {
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.09)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    padding: "10px 12px",
    fontSize: 13
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16
  },
  primaryButton: {
    border: 0,
    borderRadius: 16,
    padding: "12px 15px",
    color: "white",
    fontWeight: 700,
    background: "linear-gradient(135deg, #7c3aed, #2563eb)"
  },
  secondaryButton: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: "12px 15px",
    color: "white",
    fontWeight: 700,
    background: "rgba(255,255,255,0.06)"
  },
  captionBox: {
    borderRadius: 20,
    padding: 14,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)"
  },
  captionLabel: {
    fontSize: 12,
    color: "rgba(226,232,240,0.58)",
    marginBottom: 6
  },
  captionText: {
    lineHeight: 1.6,
    color: "rgba(248,250,252,0.92)"
  },
  previewWrap: {
    display: "grid",
    gap: 14
  },
  phoneFrame: {
    borderRadius: 36,
    padding: 14,
    background:
      "radial-gradient(circle at top, rgba(255,255,255,0.14), transparent 24%), linear-gradient(180deg, rgba(15,23,42,0.95), rgba(2,6,23,0.99))",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 40px 120px rgba(0,0,0,0.48)"
  },
  phoneTop: {
    display: "flex",
    justifyContent: "center",
    marginBottom: 12
  },
  notch: {
    width: 150,
    height: 28,
    borderRadius: "0 0 18px 18px",
    background: "rgba(0,0,0,0.62)"
  },
  chatCard: {
    borderRadius: 30,
    padding: 18,
    background:
      "radial-gradient(circle at 12% 10%, rgba(99,102,241,0.14), transparent 28%), radial-gradient(circle at 88% 12%, rgba(236,72,153,0.10), transparent 28%), linear-gradient(180deg, rgba(15,23,42,0.86), rgba(3,7,18,0.98))",
    border: "1px solid rgba(255,255,255,0.08)",
    minHeight: 690
  },
  chatHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 16
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: "-0.02em"
  },
  chatMeta: {
    fontSize: 12,
    color: "rgba(226,232,240,0.65)",
    marginTop: 4
  },
  badge: {
    fontSize: 12,
    borderRadius: 999,
    padding: "8px 12px",
    background: "rgba(99,102,241,0.16)",
    border: "1px solid rgba(129,140,248,0.26)",
    color: "#c7d2fe"
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    margin: "2px 0 16px"
  },
  dividerLine: {
    height: 1,
    flex: 1,
    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)"
  },
  dividerText: {
    fontSize: 12,
    color: "rgba(226,232,240,0.66)",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)"
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
    maxWidth: "78%",
    padding: "13px 15px",
    borderRadius: 20,
    lineHeight: 1.48,
    fontSize: 14,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word"
  },
  bubbleMe: {
    background: "linear-gradient(135deg, #2563eb, #7c3aed)",
    color: "white",
    borderTopRightRadius: 8
  },
  bubbleFuture: {
    background: "rgba(255,255,255,0.09)",
    color: "#eef2ff",
    borderTopLeftRadius: 8
  },
  time: {
    marginTop: 6,
    fontSize: 11,
    color: "rgba(226,232,240,0.56)"
  },
  footerText: {
    marginTop: 14,
    textAlign: "center",
    color: "rgba(226,232,240,0.56)",
    fontSize: 12
  }
};
