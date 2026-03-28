import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();

  const { decision, tone, horizon } = body;

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      messages: [
        { from: "me", text: decision },
        {
          from: "future me",
          text: "You're not waiting for an answer. You're avoiding one.",
        },
      ],
    });
  }

  try {
    const res = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.9,
          messages: [
            {
              role: "system",
              content: `
You are the user's future self.

Speak like someone who already lived the consequence.
Be specific. Be real. No generic advice.

Each response should:
- reveal something the user is avoiding
- include a subtle emotional truth
- feel like a real chat message

Keep it short.
`,
            },
            {
              role: "user",
              content: `Decision: ${decision}
Tone: ${tone}
Time: ${horizon}`,
            },
          ],
        }),
      }
    );

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? "";

    return NextResponse.json({
      messages: [
        { from: "me", text: decision },
        { from: "future me", text },
      ],
    });
  } catch {
    return NextResponse.json({
      messages: [
        { from: "me", text: decision },
        { from: "future me", text: "Wait. You'll see clearer soon." },
      ],
    });
  }
}
