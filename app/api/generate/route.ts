import { NextResponse } from "next/server";

type Tone = "calm" | "honest" | "direct" | "hopeful" | "chaotic";

type Message = {
  from: "me" | "future me";
  text: string;
  time: string;
};

function fallback(decision: string, horizon: string): { messages: Message[]; caption: string } {
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
You write short, intelligent, minimalist chat screenshots.
Style:
- calm, wise, concise
- realistic future-self tone
- 4 messages total max
- no emojis unless tone is chaotic
- no extra explanations
- each line should feel like a real chat
- the future self should sound insightful, not generic

Return ONLY valid JSON in this exact shape:
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

Make the future self noticeably wiser than the current self.
Keep it minimal, elegant, and shareable.
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
        temperature: 0.8,
        max_tokens: 500,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "future_me_screenshot",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                horizon: { type: "string" },
                tone: { type: "string" },
                caption: { type: "string" },
                messages: {
                  type: "array",
                  minItems: 2,
                  maxItems: 4,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      from: { type: "string", enum: ["me", "future me"] },
                      text: { type: "string" },
                      time: { type: "string" }
                    },
                    required: ["from", "text", "time"]
                  }
                }
              },
              required: ["title", "horizon", "tone", "messages", "caption"]
            }
          }
        }
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

    const parsed = JSON.parse(content);

    return NextResponse.json({
      title: parsed.title ?? "Future Me",
      horizon: parsed.horizon ?? horizon,
      tone: parsed.tone ?? tone,
      messages: Array.isArray(parsed.messages) ? parsed.messages : fallback(decision, horizon).messages,
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
