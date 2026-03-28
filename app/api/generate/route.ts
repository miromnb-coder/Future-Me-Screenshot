import { NextResponse } from "next/server";

type Tone = "calm" | "honest" | "direct" | "hopeful" | "chaotic";

type Message = {
  from: "me" | "future me";
  text: string;
  time: string;
};

function fallback(decision: string, horizon: string) {
  return {
    messages: [
      { from: "me", text: decision || "Should I do this?", time: "now" },
      { from: "future me", text: "Pause first. Clarity usually arrives before regret.", time: "soon" },
      { from: "me", text: "So what now?", time: "soon" },
      { from: "future me", text: `Give it ${horizon || "2 weeks"}.`, time: horizon || "2 weeks" }
    ],
    caption: "A quieter kind of answer."
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const decision = String(body.decision ?? "").trim();
  const tone = String(body.tone ?? "honest").trim();
  const horizon = String(body.horizon ?? "2 weeks").trim();

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    const fb = fallback(decision, horizon);
    return NextResponse.json({
      title: "Future Me",
      horizon,
      tone,
      ...fb
    });
  }

  const systemPrompt = `
You are a future version of the user.

Style rules:
- short, real, sharp
- not generic
- not cheesy
- 3–4 messages total
- the last message should feel like a realization
- make it shareable
- no extra explanation

Return ONLY valid JSON:
{
  "title": "Future Me",
  "horizon": string,
  "tone": string,
  "messages": [
    {"from":"me","text":string,"time":string},
    {"from":"future me","text":string,"time":string}
  ],
  "caption": string
}
`;

  const userPrompt = `
Decision: ${decision || "Should I do this?"}
Tone: ${tone}
Time jump: ${horizon}

Make it feel smart, slightly unsettling, and very human.
`;

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
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.9,
        max_tokens: 450
      })
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("Groq error:", response.status, text);
      const fb = fallback(decision, horizon);
      return NextResponse.json({ title: "Future Me", horizon, tone, ...fb });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "";

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      const fb = fallback(decision, horizon);
      return NextResponse.json({ title: "Future Me", horizon, tone, ...fb });
    }

    return NextResponse.json({
      title: parsed.title ?? "Future Me",
      horizon: parsed.horizon ?? horizon,
      tone: parsed.tone ?? tone,
      messages: Array.isArray(parsed.messages) ? parsed.messages : fallback(decision, horizon).messages,
      caption: parsed.caption ?? fallback(decision, horizon).caption
    });
  } catch (err) {
    console.error("Route error:", err);
    const fb = fallback(decision, horizon);
    return NextResponse.json({ title: "Future Me", horizon, tone, ...fb });
  }
}
