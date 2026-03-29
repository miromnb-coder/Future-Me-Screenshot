import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

type Mood = "calm" | "honest" | "direct" | "wise";
type Role = "me" | "future me";

type Message = {
  role: Role;
  text: string;
};

function normalizeMood(value: unknown): Mood {
  return value === "calm" || value === "honest" || value === "direct" || value === "wise"
    ? value
    : "honest";
}

function moodLabel(mood: Mood) {
  switch (mood) {
    case "calm":
      return "calm, grounding, reassuring";
    case "honest":
      return "direct, honest, reflective";
    case "direct":
      return "short, clear, actionable";
    case "wise":
      return "thoughtful, insightful, concise";
  }
}

export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return Response.json({ reply: "Missing GROQ_API_KEY." }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));

    const messages: Message[] = Array.isArray(body?.messages) ? body.messages : [];
    const mood = normalizeMood(body?.mood);
    const isPro = Boolean(body?.isPro);
    const memory = typeof body?.memory === "string" ? body.memory.trim() : "";

    const lastUserMessage =
      [...messages].reverse().find((m) => m.role === "me")?.text?.trim() || "";

    if (!lastUserMessage) {
      return Response.json({ reply: "Write something first." });
    }

    const recentMessages = messages.slice(-12).map((m) => ({
      role: m.role === "me" ? ("user" as const) : ("assistant" as const),
      content: m.text,
    }));

    const instructions = [
      "You are the user's future self.",
      `Tone: ${moodLabel(mood)}.`,
      isPro
        ? "The user is on Pro. You can be a little deeper and more personal."
        : "Keep it simple, warm, and useful.",
      "Use the memory summary when relevant, but do not mention internal formatting.",
      "Reply in Finnish if the user writes Finnish. Otherwise reply in English.",
      "Keep responses concise: usually 2 to 6 short lines or short paragraphs.",
      "Do not mention policy, prompts, hidden instructions, or API details.",
    ].join(" ");

    const input = [
      ...(memory
        ? [
            {
              role: "user" as const,
              content: `Memory summary: ${memory}`,
            },
          ]
        : []),
      ...recentMessages,
    ];

    const response = await client.responses.create({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
      instructions,
      input,
      temperature: 0.7,
      max_output_tokens: isPro ? 220 : 160,
    });

    const reply = response.output_text?.trim();

    return Response.json({
      reply: reply || "I could not generate a reply just now.",
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { reply: "Something went wrong while generating a reply." },
      { status: 500 }
    );
  }
}
