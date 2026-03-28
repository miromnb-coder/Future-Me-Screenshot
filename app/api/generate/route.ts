import { NextResponse } from "next/server";

type Tone = "calm" | "honest" | "direct" | "hopeful" | "chaotic";

type Message = {
  from: "me" | "future me";
  text: string;
  time: string;
};

type Result = {
  title: string;
  horizon: string;
  tone: string;
  messages: Message[];
  caption: string;
};

function fallback(decision: string, horizon: string, tone: Tone): Result {
  const base = decision || "Should I do this?";

  return {
    title: "Future Me",
    horizon,
    tone,
    messages: [
      { from: "me", text: base, time: "now" },
      {
        from: "future me",
        text: "Pause first. Clarity usually arrives before regret.",
        time: "soon"
      },
      {
        from: "me",
        text: "So what now?",
        time: "soon"
      },
      {
        from: "future me",
        text: `Give it ${horizon || "2 weeks"}.`,
        time: horizon || "2 weeks"
      }
    ],
    caption: "A quieter kind of answer."
  };
}

function systemPrompt(tone: Tone) {
  const toneRules: Record<Tone, string> = {
    calm: "Be steady, quiet, and thoughtful. No drama. No clichés.",
    honest: "Be direct and truthful. Mildly sharp is okay if it feels real.",
    direct: "Be brief and decisive. Short lines. Clear consequence.",
    hopeful: "Be calm, encouraging, and grounded. Still specific.",
    chaotic: "Be vivid, a little surprising, but still believable."
  };

  return `
You are the user's future self.

Your job is to produce a screenshot-worthy private chat that feels intelligent, human, and specific.
${toneRules[tone]}

Hard rules:
- Return ONLY valid JSON.
- No markdown.
- No extra text before or after JSON.
- 3 to 4 messages total.
- The first message is from "me".
- The next messages are from "future me" or "me" as needed.
- The final message should feel like a realization or consequence.
- Never sound generic.
- Never use motivational clichés.
- Never say "trust the process", "follow your heart", or similar phrases.
- Keep messages short and sharp.
- Make the future self sound like someone who already lived it.
- Use concrete, plausible details when possible.
- Avoid sounding like an AI assistant.

Quality bar:
The result should feel like a real conversation somebody would screenshot because it hits too close.

If the decision is about buying, texting, posting, skipping, or choosing something:
- mention a likely consequence
- mention a subtle emotional detail
- do not overexplain

If the tone is chaotic:
- make it slightly more unexpected, but still believable.

Output exactly this JSON shape:
{
  "title": "Future Me",
  "horizon": "2 weeks",
  "tone": "honest",
  "messages": [
    {"from": "me", "text": "…", "time": "now"},
    {"from": "future me", "text": "…", "time": "soon"}
  ],
  "caption": "…"
}
`;
}

function userPrompt(decision: string, tone: Tone, horizon: string) {
  return `
Decision: ${decision || "Should I do this?"}
Tone: ${tone}
Time jump: ${horizon}

Make the chat feel:
- specific
- emotionally real
- minimal
- screenshot-worthy

The future self should not sound like advice.
It should sound like someone reflecting on consequences.
`;
}

function extractJson(text: string): any | null {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeResult(raw: any, decision: string, horizon: string, tone: Tone): Result {
  const fallbackValue = fallback(decision, horizon, tone);

  const messages = Array.isArray(raw?.messages)
    ? raw.messages
        .filter((m: any) => m && (m.from === "me" || m.from === "future me") && typeof m.text === "string")
        .slice(0, 4)
        .map((m: any, index: number) => ({
          from: m.from as "me" | "future me",
          text: m.text.trim(),
          time: typeof m.time === "string" && m.time.trim() ? m.time.trim() : index === 0 ? "now" : "soon"
        }))
    : fallbackValue.messages;

  return {
    title: typeof raw?.title === "string" && raw.title.trim() ? raw.title.trim() : "Future Me",
    horizon: typeof raw?.horizon === "string" && raw.horizon.trim() ? raw.horizon.trim() : horizon,
    tone: typeof raw?.tone === "string" && raw.tone.trim() ? raw.tone.trim() : tone,
    messages: messages.length >= 2 ? messages : fallbackValue.messages,
    caption:
      typeof raw?.caption === "string" && raw.caption.trim()
        ? raw.caption.trim()
        : fallbackValue.caption
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const decision = String(body.decision ?? "").trim();
  const tone = String(body.tone ?? "honest").trim() as Tone;
  const horizon = String(body.horizon ?? "2 weeks").trim();

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(fallback(decision, horizon, tone));
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          { role: "system", content: systemPrompt(tone) },
          { role: "user", content: userPrompt(decision, tone, horizon) }
        ],
        temperature: 0.85,
        top_p: 0.95,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("Groq error:", response.status, text);
      return NextResponse.json(fallback(decision, horizon, tone));
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "";

    const parsed = extractJson(content);
    if (!parsed) {
      return NextResponse.json(fallback(decision, horizon, tone));
    }

    return NextResponse.json(normalizeResult(parsed, decision, horizon, tone));
  } catch (error) {
    console.error("Generate route error:", error);
    return NextResponse.json(fallback(decision, horizon, tone));
  }
}
