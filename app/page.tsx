"use client";

import { useEffect, useState } from "react";

type Tone = "calm" | "honest" | "direct" | "hopeful" | "chaotic";

type Message = {
  from: "me" | "future me";
  text: string;
};

export default function Page() {
  const [decision, setDecision] = useState("Should I text them?");
  const [tone, setTone] = useState<Tone>("honest");
  const [horizon, setHorizon] = useState("2 weeks");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    send();
  }, []);

  async function send() {
    setLoading(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, tone, horizon }),
      });

      const data = await res.json();
      setMessages(data.messages);
    } catch {
      setMessages([
        { from: "me", text: decision },
        { from: "future me", text: "Wait. You'll see clearer soon." },
      ]);
    }

    setLoading(false);
  }

  return (
    <main className="app">
      {/* HEADER */}
      <header className="header">
        <button className="icon">≡</button>

        <div className="title">
          <div className="logo">Future Me</div>
          <div className="subtitle">quiet decision screenshots</div>
        </div>

        <button className="icon">⋯</button>
      </header>

      {/* CHAT */}
      <div className="chat">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`bubble ${m.from === "me" ? "me" : "future"}`}
          >
            {m.text}
          </div>
        ))}

        {loading && <div className="typing">typing…</div>}
      </div>

      {/* INPUT */}
      <div className="composer">
        <div className="controls">
          <select value={tone} onChange={(e) => setTone(e.target.value as Tone)}>
            <option value="calm">Calm</option>
            <option value="honest">Honest</option>
            <option value="direct">Direct</option>
            <option value="hopeful">Hopeful</option>
            <option value="chaotic">Chaotic</option>
          </select>

          <select value={horizon} onChange={(e) => setHorizon(e.target.value)}>
            <option>Tomorrow</option>
            <option>2 weeks</option>
            <option>1 month</option>
          </select>
        </div>

        <textarea
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          placeholder="Write one decision..."
        />

        <button onClick={send} className="send">
          Send →
        </button>
      </div>
    </main>
  );
}
