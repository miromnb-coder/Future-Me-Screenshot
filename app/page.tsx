"use client";

import { useMemo, useRef, useState } from "react";

type Tone = "regret" | "win" | "savage" | "wholesome" | "chaotic";

type Message = {
  from: "me" | "future me";
  text: string;
  time?: string;
};

const presets = [
  "Should I text my ex?",
  "Should I buy this?",
  "Should I post this?",
  "Should I skip the gym?",
  "Should I send this risky message?",
  "Should I stay up tonight?",
  "Should I trust this person?",
  "Should I go for it?"
];

function makeMessages(decision: string, tone: Tone, horizon: string): Message[] {
  const clean = decision.trim() || "Should I do this?";
  const later = horizon.toLowerCase().includes("later") ? horizon : `${horizon} later`;

  const map: Record<Tone, Message[]> = {
    regret: [
      { from: "me", text: clean, time: "now" },
      { from: "future me", text: "You already know this is a bad idea.", time: "soon" },
      { from: "me", text: "Be honest.", time: "soon" },
      { from: "future me", text: `You did it anyway.\n${later}, you kept thinking about it every time you saw it.`, time: later }
    ],
    win: [
      { from: "me", text: clean, time: "now" },
      { from: "future me", text: "This one actually works out.", time: "soon" },
      { from: "me", text: "For real?", time: "soon" },
      { from: "future me", text: `For real.\n${later}, you're glad you didn't overthink it.`, time: later }
    ],
    savage: [
      { from: "me", text: clean, time: "now" },
      { from: "future me", text: "No. Don't romanticize this.", time: "soon" },
      { from: "me", text: "That bad?", time: "soon" },
      { from: "future me", text: `Yes.\n${later}, you will cringe at this decision like it was a screenshot from another life.`, time: later }
    ],
    wholesome: [
      { from: "me", text: clean, time: "now" },
      { from: "future me", text: "You're asking the right question.", time: "soon" },
      { from: "me", text: "So… yes?", time: "soon" },
      { from: "future me", text: `Yes.\nSmall choice, calmer future.`, time: later }
    ],
    chaotic: [
      { from: "me", text: clean, time: "now" },
      { from: "future me", text: "Absolutely unhinged behavior.", time: "soon" },
      { from: "me", text: "Should I do it?", time: "soon" },
      { from: "future me", text: `No.\nWhich is exactly why you'll probably do it.\n${later}, this becomes a story.`, time: later }
    ]
  };

  return map[tone];
}

function viralScore(decision: string, tone: Tone) {
  let score = 41;
  const text = decision.toLowerCase();

  if (text.includes("text") || text.includes("msg") || text.includes("message")) score += 12;
  if (text.includes("buy") || text.includes("post") || text.includes("send")) score += 10;
  if (tone === "savage") score += 16;
  if (tone === "regret") score += 14;
  if (tone === "chaotic") score += 12;
  if (decision.length < 18) score += 4;
  if (decision.length > 50) score -= 6;

  return Math.max(1, Math.min(99, score));
}

function captionFor(tone: Tone) {
  switch (tone) {
    case "regret":
      return "I asked future me and got cooked 💀";
    case "win":
      return "Future me actually approved this one.";
    case "savage":
      return "My future self was brutally honest.";
    case "wholesome":
      return "Small decision, better future.";
    case "chaotic":
      return "Future me was not impressed.";
  }
}

export default function Page() {
  const [decision, setDecision] = useState("Should I buy this?");
  const [tone, setTone] = useState<Tone>("regret");
  const [horizon, setHorizon] = useState("2 weeks");
  const [messages, setMessages] = useState<Message[]>(
    makeMessages("Should I buy this?", "regret", "2 weeks")
  );
  const [copied, setCopied] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const score = useMemo(() => viralScore(decision, tone), [decision, tone]);
  const caption = useMemo(() => captionFor(tone), [tone]);

  const generate = () => {
    setMessages(makeMessages(decision, tone, horizon));
  };

  const surprise = () => {
    const randomDecision = presets[Math.floor(Math.random() * presets.length)];
    const tones: Tone[] = ["regret", "win", "savage", "wholesome", "chaotic"];
    const horizons = ["tomorrow", "2 weeks", "1 month", "6 months"];
    const nextTone = tones[Math.floor(Math.random() * tones.length)];
    const nextHorizon = horizons[Math.floor(Math.random() * horizons.length)];

    setDecision(randomDecision);
    setTone(nextTone);
    setHorizon(nextHorizon);
    setMessages(makeMessages(randomDecision, nextTone, nextHorizon));
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
          <div className="kicker">⚡ Future Me Screenshot</div>
          <h1 className="title">Make your future self roast your current self.</h1>
          <p className="subtitle">
            Kirjoita yksi päätös, valitse vibe ja saat näyttävän chat-kuvan, joka näyttää
            siltä kuin se olisi napattu suoraan puhelimesta.
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
              <div className="statLabel">Output</div>
              <div className="statValue">PNG screenshot</div>
            </div>
            <div className="stat">
              <div className="statLabel">Hook</div>
              <div className="statValue">Instant share</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid">
        <div className="panel">
          <h2>Build your screenshot</h2>

          <div className="presetRow">
            {presets.slice(0, 4).map((p) => (
              <button key={p} className="presetChip" onClick={() => setDecision(p)}>
                {p}
              </button>
            ))}
          </div>

          <div className="fieldGroup">
            <label>Decision</label>
            <textarea
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              placeholder="Should I buy this?"
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
                <option value="chaotic">Chaotic</option>
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
              Make viral screenshot
            </button>
            <button className="btn btnSecondary" onClick={surprise}>
              Surprise me
            </button>
            <button className="btn btnDark" onClick={downloadScreenshot}>
              Save PNG
            </button>
            <button className="btn btnDark" onClick={copyCaption}>
              {copied ? "Copied!" : "Copy TikTok caption"}
            </button>
          </div>

          <div className="captionBox">
            <div className="smallLabel">Suggested caption</div>
            <div>{caption}</div>
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
                  <div className="chatMeta">{horizon} later · iMessage-style screenshot</div>
                </div>
                <div className="badge">Viral {score}</div>
              </div>

              <div className="timeline">
                <div className="timelineLine" />
                <div className="timelineText">— {horizon.toLowerCase()} —</div>
              </div>

              <div className="messages">
                {messages.map((msg, index) => (
                  <div
                    key={`${msg.from}-${index}`}
                    className={`msgRow ${msg.from === "me" ? "msgRight" : "msgLeft"}`}
                  >
                    <div className={`bubble ${msg.from === "me" ? "bubbleRight" : "bubbleLeft"}`}>
                      {msg.text}
                      <div className="timeStamp">{msg.time ?? "now"}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="footerBar">
                <div className="mini">“{decision.trim() || "..."}”</div>
                <div className="meter">
                  <div className="smallLabel">Virality</div>
                  <div className="meterBar">
                    <div className="meterFill" style={{ width: `${score}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mini">
            Tää ulkoasu on rakennettu näyttämään enemmän oikealta screenshotilta kuin web-sivulta.
          </div>
        </div>
      </section>
    </main>
  );
}
