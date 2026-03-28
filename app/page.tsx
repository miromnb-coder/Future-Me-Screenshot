"use client";

import { useMemo, useRef, useState } from "react";

type Tone = "regret" | "win" | "savage" | "wholesome";

type Message = {
  from: "me" | "future me";
  text: string;
};

const quickPrompts = [
  "Should I buy these shoes?",
  "Should I text them back?",
  "Should I skip the workout?",
  "Should I post this?",
  "Should I start this project?"
];

function buildConversation(decision: string, tone: Tone, horizon: string): Message[] {
  const clean = decision.trim().replace(/\s+/g, " ");
  const base = clean || "this";
  const hook = horizon.toLowerCase().includes("later") ? horizon : `${horizon} later`;

  const tones: Record<Tone, Message[]> = {
    regret: [
      { from: "me", text: `Should I do ${base}?` },
      { from: "future me", text: "You already know the answer." },
      { from: "me", text: "Tell me straight." },
      { from: "future me", text: `You did it. It looked good for 3 days.\nThen ${hook}, you were annoyed every time you saw it.` }
    ],
    win: [
      { from: "me", text: `Should I do ${base}?` },
      { from: "future me", text: "Yes. This one actually ages well." },
      { from: "me", text: "For real?" },
      { from: "future me", text: `For real. ${hook}, this ends up being one of your better calls.` }
    ],
    savage: [
      { from: "me", text: `Should I do ${base}?` },
      { from: "future me", text: "No. Be serious for one second." },
      { from: "me", text: "That bad?" },
      { from: "future me", text: `Not even close to worth it. ${hook}, you will cringe every time you remember this.` }
    ],
    wholesome: [
      { from: "me", text: `Should I do ${base}?` },
      { from: "future me", text: "You're asking the right question." },
      { from: "me", text: "So… yes?" },
      { from: "future me", text: `Yes. Small choice, big calm energy ${hook}.` }
    ]
  };

  return tones[tone];
}

function viralScore(decision: string, tone: Tone) {
  const text = decision.toLowerCase();
  let score = 42;

  if (text.includes("buy") || text.includes("ost") || text.includes("purchase")) score += 12;
  if (text.includes("text") || text.includes("msg") || text.includes("viesti")) score += 10;
  if (tone === "savage") score += 18;
  if (tone === "regret") score += 14;
  if (decision.length > 35) score += 8;
  if (decision.length < 16) score -= 4;

  return Math.max(1, Math.min(99, score));
}

function captionFor(tone: Tone) {
  switch (tone) {
    case "regret":
      return "I asked my future self and got cooked 💀";
    case "savage":
      return "My future self did NOT let me off easy.";
    case "win":
      return "Future me said this one was actually smart.";
    case "wholesome":
      return "Small choice, better future.";
  }
}

export default function Page() {
  const [decision, setDecision] = useState("Should I buy these shoes?");
  const [tone, setTone] = useState<Tone>("regret");
  const [horizon, setHorizon] = useState("2 weeks");
  const [generated, setGenerated] = useState<Message[]>(
    buildConversation("Should I buy these shoes?", "regret", "2 weeks")
  );
  const [copied, setCopied] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const score = useMemo(() => viralScore(decision, tone), [decision, tone]);
  const caption = useMemo(() => captionFor(tone), [tone]);

  const generate = () => {
    setGenerated(buildConversation(decision, tone, horizon));
  };

  const surpriseMe = () => {
    const prompt = quickPrompts[Math.floor(Math.random() * quickPrompts.length)];
    const tones: Tone[] = ["regret", "win", "savage", "wholesome"];
    const horizons = ["2 weeks", "1 month", "6 months", "tomorrow"];
    setDecision(prompt);
    setTone(tones[Math.floor(Math.random() * tones.length)]);
    setHorizon(horizons[Math.floor(Math.random() * horizons.length)]);
    setTimeout(() => {
      setGenerated(buildConversation(prompt, tone, horizon));
    }, 0);
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
    <main className="page">
      <section className="hero">
        <div>
          <div className="kicker">⚡ Viral screenshot generator · iPhone style</div>
          <h1 className="title">Future Me Screenshot</h1>
          <p className="subtitle">
            Kirjoita päätös, valitse vibe, ja saat näyttävän chat-kuvan tulevaisuuden itsesi kanssa.
            Täydellinen TikTokiin, Reelseihin ja kavereille lähetettäväksi.
          </p>
        </div>

        <div className="heroCard">
          <div className="heroStats">
            <div className="stat">
              <div className="statLabel">Viral score</div>
              <div className="statValue">{score}/99</div>
            </div>
            <div className="stat">
              <div className="statLabel">Mode</div>
              <div className="statValue">{tone}</div>
            </div>
            <div className="stat">
              <div className="statLabel">Hook</div>
              <div className="statValue">2–6 line chat</div>
            </div>
            <div className="stat">
              <div className="statLabel">Output</div>
              <div className="statValue">PNG screenshot</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid">
        <div className="panel">
          <h2>Build the screenshot</h2>

          <div className="fieldGroup">
            <label>Decision</label>
            <textarea
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              placeholder="Should I buy this? / Pitäisikö mun tehdä tämä?"
            />
          </div>

          <div className="row">
            <div className="fieldGroup">
              <label>Tone</label>
              <select value={tone} onChange={(e) => setTone(e.target.value as Tone)}>
                <option value="regret">Regret</option>
                <option value="win">Win</option>
                <option value="savage">Savage</option>
                <option value="wholesome">Wholesome</option>
              </select>
            </div>

            <div className="fieldGroup">
              <label>Time jump</label>
              <select value={horizon} onChange={(e) => setHorizon(e.target.value)}>
                <option>Tomorrow</option>
                <option>2 weeks</option>
                <option>1 month</option>
                <option>6 months</option>
              </select>
            </div>
          </div>

          <div className="actions">
            <button className="btn btnPrimary" onClick={generate}>
              Generate chat
            </button>
            <button className="btn btnSecondary" onClick={surpriseMe}>
              Surprise me
            </button>
            <button className="btn btnDark" onClick={downloadScreenshot}>
              Download PNG
            </button>
            <button className="btn btnDark" onClick={copyCaption}>
              {copied ? "Copied!" : "Copy TikTok caption"}
            </button>
          </div>

          <div style={{ marginTop: 16 }} className="captionBox">
            <div className="smallLabel">Suggested caption</div>
            <div>{caption}</div>
          </div>

          <div style={{ marginTop: 12 }} className="mini">
            Tip: short decision texts work best. Anything like “Should I buy this?” or “Should I text them back?”
            gives the strongest hook.
          </div>
        </div>

        <div className="previewWrap">
          <div className="phone">
            <div className="phoneTop">
              <div className="notch" />
            </div>

            <div ref={previewRef} className="chatCard">
              <div className="chatHeader">
                <div className="chatTitleBlock">
                  <div className="chatTitle">Future Me</div>
                  <div className="chatMeta">{horizon} later · live memory</div>
                </div>
                <div className="badge">Viral score {score}</div>
              </div>

              <div className="messages">
                {generated.map((msg, index) => (
                  <div
                    key={`${msg.from}-${index}`}
                    className={`msgRow ${msg.from === "me" ? "msgRight" : "msgLeft"}`}
                  >
                    <div className={`bubble ${msg.from === "me" ? "bubbleRight" : "bubbleLeft"}`}>
                      {msg.text}
                      <div className="timeStamp">{msg.from === "me" ? "You" : "Future Me"} · now</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="footerBar">
                <div className="mini">
                  “{decision.trim() || "..." }”
                </div>
                <div className="meter" style={{ minWidth: 180 }}>
                  <div className="smallLabel">Virality</div>
                  <div className="meterBar">
                    <div className="meterFill" style={{ width: `${score}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mini">
            This preview is built to feel like a screenshot first, app second. That is what makes it shareable.
          </div>
        </div>
      </section>

      <div className="credit">Built for Vercel + GitHub · clean, simple, fast</div>
    </main>
  );
}
