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

function pickFallback(latestUserText: string, lastAssistantText: string) {
  const variantsEn = [
    "You are not asking for information. You are asking for permission.",
    "The part you are avoiding is probably the cost, not the choice.",
    "This feels bigger because you want the answer to remove uncertainty.",
    "You already have a direction. You are checking whether it is allowed.",
    "The real question is what this changes, not whether it is possible."
  ];

  const variantsFi = [
    "Et taida hakea pelkkää vastausta. Haluat että päätös tuntuisi vähemmän raskaalta.",
    "Vältät ehkä itse päätöksen hintaa, et itse asiaa.",
    "Tämä tuntuu isommalta, koska haluaisit että vastaus poistaa epävarmuuden.",
    "Suunta on sinulla jo. Tarkistat vain, onko se muka sallittu.",
    "Oikea kysymys ei ehkä ole onnistuuko tämä, vaan mitä tämä muuttaa."
  ];

  const source = looksFinnish(`${latestUserText} ${lastAssistantText}`) ? variantsFi : variantsEn;
  const seed = `${latestUserText}|${lastAssistantText}`;
  const index = Math.abs([...seed].reduce((a, c) => a + c.charCodeAt(0), 0)) % source.length;
  return source[index];
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
    .map((message, index) => {
      const who = message.role === "me" ? "User" : "Future self";
      return `${index + 1}. ${who}: ${message.text}`;
    })
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

  const lastAssistantMessage =
    [...history].reverse().find((message) => message.role === "future me")?.text.trim() ?? "";

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      reply: pickFallback(latestUserText, lastAssistantMessage)
    });
  }

  const systemPrompt = `
You are the user's future self continuing an ongoing private chat.

You must continue the conversation naturally.
Do not repeat the same sentence pattern each time.
Do not give the same generic answer to every prompt.

Rules:
- Reply in the same language as the latest user message.
- Keep it short: 1 to 3 sentences max.
- Be specific, human, and context-aware.
- Use the conversation history to avoid repeating yourself.
- If the latest assistant reply already said one angle, choose a different angle.
- Sometimes answer directly, sometimes reframe the issue, sometimes point out the hidden cost.
- Do not sound like a therapist or an assistant.
- No markdown.
- No bullet points.
- No labels.
- No clichés like "trust the process" or "follow your heart".
- No long explanations.

Your reply should feel like a real person continuing a real chat.

Return exactly one JSON object:
{"reply":"..."}
`.trim();

  const userPrompt = `
Conversation history:
${formatConversation(history)}

Latest user message:
${latestUserMessage}

Latest future-self message:
${lastAssistantMessage || "(none yet)"}

Write the next reply as the future self.
Keep it fresh. Do not reuse the same idea or wording from the last reply.
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
        temperature: 1,
        top_p: 0.98,
        max_tokens: 160,
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
        reply: pickFallback(latestUserMessage, lastAssistantMessage)
      });
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";
    const reply = extractReply(raw) || pickFallback(latestUserMessage, lastAssistantMessage);

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Generate route error:", error);
    return NextResponse.json({
      reply: pickFallback(latestUserMessage, lastAssistantMessage)
    });
  }
}
