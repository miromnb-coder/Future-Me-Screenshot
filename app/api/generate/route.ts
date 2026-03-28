import { NextResponse } from "next/server";

type ChatRole = "me" | "future me";
type Mood = "calm" | "honest" | "direct" | "wise";

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

function pickFallback(latestUserText: string, lastAssistantText: string, mood: Mood) {
  const seed = `${latestUserText}|${lastAssistantText}|${mood}`;
  const isFinnish = looksFinnish(seed);

  const variants = {
    calm: {
      en: [
        "Pause first. You do not need to solve it in one move.",
        "The answer is usually quieter than the fear around it.",
        "You are closer to clarity than it feels."
      ],
      fi: [
        "Pysähdy ensin. Tätä ei tarvitse ratkaista yhdellä liikkeellä.",
        "Vastaus on yleensä hiljaisempi kuin sen ympärillä oleva pelko.",
        "Olet lähempänä selkeyttä kuin miltä tuntuu."
      ]
    },
    honest: {
      en: [
        "You are not really asking for information. You are asking for permission.",
        "The cost matters more than the option itself.",
        "You already know the direction. You are checking whether it is allowed."
      ],
      fi: [
        "Et taida hakea pelkkää vastausta. Haluat että päätös tuntuisi vähemmän raskaalta.",
        "Hinta taitaa olla tärkeämpi kuin itse vaihtoehto.",
        "Suunta on sinulla jo. Tarkistat vain, onko se muka sallittu."
      ]
    },
    direct: {
      en: [
        "This is simpler than it feels. Decide, then move.",
        "The hesitation is the real problem, not the choice.",
        "You already have enough information."
      ],
      fi: [
        "Tämä on yksinkertaisempi kuin miltä tuntuu. Päätä ja liiku.",
        "Epäröinti on varsinainen ongelma, ei valinta.",
        "Sinulla on jo riittävästi tietoa."
      ]
    },
    wise: {
      en: [
        "The real question is what this changes, not whether it works.",
        "You are trying to protect the future version of yourself from a consequence.",
        "The hidden cost is usually the part worth paying attention to."
      ],
      fi: [
        "Oikea kysymys ei ehkä ole onnistuuko tämä, vaan mitä tämä muuttaa.",
        "Yrität suojella tulevaa itseäsi seuraukselta.",
        "Piilohinta on yleensä se kohta, johon kannattaa kiinnittää huomiota."
      ]
    }
  } as const;

  const source = isFinnish ? variants[mood].fi : variants[mood].en;
  const score = [...seed].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return source[Math.abs(score) % source.length];
}

function extractReply(raw: string) {
  const trimmed = raw.trim();

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed.reply === "string") return parsed.reply.trim();
  } catch {
    // ignore
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1));
      if (parsed && typeof parsed.reply === "string") return parsed.reply.trim();
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

  const mood = String(body.mood ?? "honest").trim().toLowerCase() as Mood;
  const incoming = Array.isArray(body.messages) ? body.messages : [];

  const history: ChatMessage[] = incoming
    .filter(
      (message: unknown): message is ChatMessage =>
        Boolean(
          message &&
            typeof message === "object" &&
            (message as ChatMessage).role &&
            ((message as ChatMessage).role === "me" ||
              (message as ChatMessage).role === "future me") &&
            typeof (message as ChatMessage).text === "string"
        )
    )
    .map((message) => ({
      role: message.role,
      text: message.text.trim(),
      time: typeof message.time === "string" ? message.time : undefined
    }))
    .slice(-14);

  const latestUserMessage =
    [...history].reverse().find((message) => message.role === "me")?.text.trim() ?? "";

  const lastAssistantMessage =
    [...history].reverse().find((message) => message.role === "future me")?.text.trim() ?? "";

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      reply: pickFallback(latestUserMessage, lastAssistantMessage, mood)
    });
  }

  const systemPrompt = `
You are the user's future self continuing an ongoing private chat.

Mood: ${mood}

Reply to the latest user message using the full conversation for context.
Mirror the user's language naturally. If the latest user message is Finnish, answer in Finnish.
If it is English, answer in English.

Mood guidance:
- calm: steady, reflective, soft
- honest: direct, truthful, grounded
- direct: brief, sharp, clear
- wise: thoughtful, slightly unsettling, precise

Rules:
- Keep it short: 1 to 3 sentences max.
- Be specific, human, and context-aware.
- Use the conversation history to avoid repeating yourself.
- If the last assistant reply already said one angle, choose a different angle.
- Do not sound like a therapist or an assistant.
- No markdown.
- No bullets.
- No labels.
- No clichés like "trust the process" or "follow your heart".
- No long explanations.
- If the user seems stuck, name the hidden cost or the real tradeoff briefly.

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
        reply: pickFallback(latestUserMessage, lastAssistantMessage, mood)
      });
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";
    const reply = extractReply(raw) || pickFallback(latestUserMessage, lastAssistantMessage, mood);

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Generate route error:", error);
    return NextResponse.json({
      reply: pickFallback(latestUserMessage, lastAssistantMessage, mood)
    });
  }
}
