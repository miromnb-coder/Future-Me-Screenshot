import { NextResponse } from "next/server";

type ChatRole = "me" | "future me";

type ChatMessage = {
  role: ChatRole;
  text: string;
  time?: string;
};

function looksFinnish(text: string) {
  const t = text.toLowerCase();
  return (
    /[äöå]/.test(t) ||
    /(suomeksi|voisitko|voinko|mikä|mitä|tämä|tätä|olen|ehkä|miksi|nyt|kyllä|ei|siksi|koska)/i.test(t)
  );
}

function fallbackReply(latestUserText: string) {
  if (looksFinnish(latestUserText)) {
    return "Et taida hakea vain vastausta. Haluat että päätös tuntuisi vähemmän raskaalta. Se on se kohta, jota kannattaa katsoa.";
  }

  return "You are not really asking for information. You are asking for permission. That is usually the useful part to notice.";
}

function extractReply(raw: string) {
  const trimmed = raw.trim();

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed.reply === "string") {
      return parsed.reply.trim();
    }
  } catch {
    // ignore
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1));
      if (parsed && typeof parsed.reply === "string") {
        return parsed.reply.trim();
      }
    } catch {
      // ignore
    }
  }

  const withoutFences = trimmed.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  return withoutFences || null;
}

function formatConversation(messages: ChatMessage[]) {
  return messages
    .map((message) => `${message.role === "me" ? "User" : "Future self"}: ${message.text}`)
    .join("\n");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const history: ChatMessage[] = incoming
    .filter(
      (message: unknown): message is ChatMessage =>
        Boolean(
          message &&
            typeof message === "object" &&
            (message as ChatMessage).role &&
            ((message as ChatMessage).role === "me" || (message as ChatMessage).role === "future me") &&
            typeof (message as ChatMessage).text === "string"
        )
    )
    .map((message) => ({
      role: message.role,
      text: message.text.trim(),
      time: typeof message.time === "string" ? message.time : undefined
    }))
    .slice(-12);

  const latestUserMessage =
    [...history].reverse().find((message) => message.role === "me")?.text.trim() ?? "";

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      reply: fallbackReply(latestUserMessage)
    });
  }

  const systemPrompt = `
You are the user's future self continuing an ongoing private chat.

Reply to the latest user message while using the full conversation for context.
Mirror the user's language naturally. If the latest user message is Finnish, reply in Finnish.
If the latest user message is English, reply in English.

Style:
- concise, human, intelligent, and slightly unsettling when appropriate
- 1 to 3 short sentences max
- specific, not generic
- no markdown
- no bullets
- no labels
- no narration like "as an AI"
- no clichés
- do not repeat the user's message unless it helps the reply

You must return exactly one JSON object:
{"reply":"..."}
`.trim();

  const userPrompt = `
Conversation:
${formatConversation(history)}

Latest user message:
${latestUserMessage}

Write the next reply as the future self.
Keep it short, natural, and emotionally precise.
`.trim();

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.85,
        max_tokens: 140,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("Groq error:", response.status, text);
      return NextResponse.json({
        reply: fallbackReply(latestUserMessage)
      });
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";
    const reply = extractReply(raw) || fallbackReply(latestUserMessage);

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Generate route error:", error);
    return NextResponse.json({
      reply: fallbackReply(latestUserMessage)
    });
  }
}
