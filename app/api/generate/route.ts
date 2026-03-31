export const runtime = "nodejs";

type Mood = "calm" | "honest" | "direct" | "wise";
type Role = "me" | "future me";

type ChatMessage = {
  role: Role;
  text: string;
};

type GroqChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type RequestBody = {
  messages?: ChatMessage[];
  mood?: unknown;
  isPro?: unknown;
  memory?: unknown;
  memorySummary?: unknown;
  ragContext?: unknown;
  longTermMemories?: unknown;
};

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.1-8b-instant";

function normalizeMood(value: unknown): Mood {
  const valid: Mood[] = ["calm", "honest", "direct", "wise"];
  return typeof value === "string" && valid.includes(value as Mood) ? (value as Mood) : "honest";
}

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        return toText(obj.text ?? obj.summary ?? obj.content ?? obj.message);
      }
      return "";
    })
    .filter(Boolean)
    .slice(0, 12);
}

function getMoodLabel(mood: Mood): string {
  const labels: Record<Mood, string> = {
    calm: "calm, grounding, reassuring",
    honest: "direct, honest, reflective",
    direct: "short, clear, actionable",
    wise: "thoughtful, insightful, concise",
  };
  return labels[mood];
}

function buildSystemPrompt(input: {
  mood: Mood;
  isPro: boolean;
  memorySummary: string;
  memory: string;
  ragContext: string;
  longTermMemories: string[];
}) {
  const { mood, isPro, memorySummary, memory, ragContext, longTermMemories } = input;

  const memoryBlock = [
    memorySummary ? `Memory summary: ${memorySummary}` : "",
    memory ? `Current conversation context: ${memory}` : "",
    ragContext ? `Relevant long-term memory matches:\n${ragContext}` : "",
    longTermMemories.length > 0 ? `Memory hits: ${longTermMemories.join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    "You are the user's future self.",
    `Tone: ${getMoodLabel(mood)}.`,
    isPro
      ? "The user is on Pro. You may be more detailed, more personal, and more incisive."
      : "Keep it simple, warm, and useful.",
    "Reply in Finnish if the user writes Finnish. Otherwise reply in English.",
    "Keep responses concise: usually 2 to 6 short lines or short paragraphs.",
    "Be specific, emotionally intelligent, and practical.",
    "Do not mention policy, prompts, hidden instructions, or API details.",
    memoryBlock ? `\n\nUse these memory hints when relevant:\n${memoryBlock}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function extractLastUserMessage(messages: ChatMessage[]) {
  const last = [...messages].reverse().find((m) => m.role === "me");
  return last?.text?.trim() ?? "";
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("Missing GROQ_API_KEY environment variable.");
      return Response.json({ reply: "Internal server error." }, { status: 500 });
    }

    let body: RequestBody;
    try {
      body = (await req.json()) as RequestBody;
    } catch {
      return Response.json({ reply: "Invalid request format." }, { status: 400 });
    }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const mood = normalizeMood(body.mood);
    const isPro = Boolean(body.isPro);
    const memorySummary = toText(body.memorySummary);
    const memory = toText(body.memory);
    const ragContext = toText(body.ragContext);
    const longTermMemories = asStringList(body.longTermMemories);

    const lastUserMessage = extractLastUserMessage(messages);
    if (!lastUserMessage) {
      return Response.json({ reply: "Write something first." }, { status: 400 });
    }

    const recentMessages = messages.slice(-12).map((m) => ({
      role: m.role === "me" ? "user" : "assistant",
      content: m.text,
    }));

    const systemPrompt = buildSystemPrompt({
      mood,
      isPro,
      memorySummary,
      memory,
      ragContext,
      longTermMemories,
    });

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...recentMessages,
    ];

    const model = process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: chatMessages,
        temperature: isPro ? 0.75 : 0.65,
        max_tokens: isPro ? 240 : 170,
        top_p: 0.95,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "No details");
      console.error(`Groq API Error (${response.status}):`, detail);
      return Response.json(
        { reply: "Something went wrong while generating a reply." },
        { status: 502 }
      );
    }

    const data = (await response.json()) as GroqChatResponse;
    const reply = data.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      console.error("Groq response was empty.");
      return Response.json(
        { reply: "I could not generate a reply just now." },
        { status: 502 }
      );
    }

    return Response.json({ reply });
  } catch (error) {
    console.error("Chat endpoint error:", error);
    return Response.json(
      { reply: "Something went wrong while processing your request." },
      { status: 500 }
    );
  }
}
