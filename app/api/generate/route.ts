import { NextResponse } from "next/server";
import Groq from "groq-sdk";

type Tone = "calm" | "honest" | "direct" | "hopeful" | "chaotic";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const decision = String(body.decision ?? "").trim();
  const tone = String(body.tone ?? "honest").trim();
  const horizon = String(body.horizon ?? "2 weeks").trim();

  const systemPrompt = `
You write short, intelligent, minimalist chat screenshots.
Style:
- calm, wise, concise
- realistic future-self tone
- 4 messages total max
- no emojis unless the user tone is chaotic
- no extra explanations
- each line should feel like a real chat
- make the future self sound insightful, not generic

Return only JSON with:
{
  "title": string,
  "horizon": string,
  "tone": string,
  "messages": [{"from":"me"|"future me","text":string,"time":string}],
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
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 500
    });

    const content = completion.choices[0]?.message?.content ?? "";

    const parsed = JSON.parse(content);

    return NextResponse.json({
      title: parsed.title ?? "Future Me",
      horizon: parsed.horizon ?? horizon,
      tone: parsed.tone ?? tone,
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      caption: parsed.caption ?? "A quieter kind of answer."
    });
  } catch {
    return NextResponse.json(
      {
        title: "Future Me",
        horizon,
        tone,
        messages: [
          { from: "me", text: decision || "Should I do this?", time: "now" },
          { from: "future me", text: "Pause first. Clarity usually arrives before regret.", time: horizon }
        ],
        caption: "A quieter kind of answer."
      },
      { status: 200 }
    );
  }
}
