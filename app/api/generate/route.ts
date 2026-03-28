import { NextResponse } from "next/server";

type Message = {
  from: "me" | "future me";
  text: string;
  time: string;
};

function fallback(decision: string, horizon: string) {
  return {
    messages: [
      { from: "me", text: decision || "Should I do this?", time: "now" },
      {
        from: "future me",
        text: "If you have to ask, you probably already know.",
        time: "soon"
      },
      {
        from: "me",
        text: "Yeah…",
        time: "soon"
      },
      {
        from: "future me",
        text: `Give it ${horizon || "2 weeks"}. Clarity comes when you're not chasing it.`,
        time: horizon || "2 weeks"
      }
    ],
    caption: "Clarity doesn’t shout."
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

Your job is NOT to be nice.
Your job is to be accurate, observant, and slightly unsettling in a smart way.

Style rules:
- extremely concise (short messages)
- sounds like a real private chat
- avoid generic advice completely
- no clichés (NO "follow your heart", "trust the process", etc.)
- sometimes be brutally honest
- sometimes be calm and wise
- occasionally say less than expected (silence = power)
- create a subtle emotional impact

Structure:
- 3–4 messages total
- must feel like a real conversation, not AI text
- the last message should feel like a realization

Important:
The future self KNOWS what happened.
Hint at consequences without overexplaining.

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

Make it feel real, slightly uncomfortable, and insightful.
Avoid obvious answers.
Make it something people would screenshot and share.
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
        max_tokens: 400
      })
    });

    if (!response.ok) {
      const fb = fallback(decision, horizon);
      return NextResponse.json({
        title: "Future Me",
        horizon,
        tone,
        ...fb
      });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "";

    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch {
      const fb = fallback(decision, horizon);
      return NextResponse.json({
        title: "Future Me",
        horizon,
        tone,
        ...fb
      });
    }

    return NextResponse.json({
      title: parsed.title ?? "Future Me",
      horizon: parsed.horizon ?? horizon,
      tone: parsed.tone ?? tone,
      messages: Array.isArray(parsed.messages)
        ? parsed.messages
        : fallback(decision, horizon).messages,
      caption: parsed.caption ?? fallback(decision, horizon).caption
    });
  } catch {
    const fb = fallback(decision, horizon);
    return NextResponse.json({
      title: "Future Me",
      horizon,
      tone,
      ...fb
    });
  }
}
