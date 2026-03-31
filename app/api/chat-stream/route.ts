import { streamText } from 'ai'
import { createClient } from "@supabase/supabase-js"

export const maxDuration = 30

type Mood = "calm" | "honest" | "direct" | "wise"
type Role = "me" | "future me"

type ChatMessage = {
  role: Role
  text: string
}

type RequestBody = {
  messages?: ChatMessage[]
  mood?: unknown
  isPro?: unknown
  memory?: unknown
  memorySummary?: unknown
  ragContext?: unknown
  longTermMemories?: unknown
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function normalizeMood(value: unknown): Mood {
  const valid: Mood[] = ["calm", "honest", "direct", "wise"]
  return typeof value === "string" && valid.includes(value as Mood) ? (value as Mood) : "honest"
}

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim()
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>
        return toText(obj.text ?? obj.summary ?? obj.content ?? obj.message)
      }
      return ""
    })
    .filter(Boolean)
    .slice(0, 12)
}

function getMoodPersonality(mood: Mood): string {
  const personalities: Record<Mood, string> = {
    calm: `You speak slowly and thoughtfully. Your responses feel grounding - like a warm blanket on a cold night. 
           Use gentle language, occasional pauses (...), and reassuring phrases. 
           Focus on breathing space into the conversation.`,
    honest: `You cut through the noise with direct honesty. You see what the user is really asking underneath their words.
             You're not harsh, but you don't sugarcoat. You reflect back what you observe with compassion.
             You might say things like "I think what you're really asking is..." or "The real question here seems to be..."`,
    direct: `You are concise and action-oriented. No fluff. Every word counts.
             Use short sentences. Get to the point. Offer clear next steps.
             You respect the user's time and intelligence.`,
    wise: `You see patterns across time. You connect today's small choice to tomorrow's larger self.
           You speak with the weight of lived experience, drawing on universal human truths.
           You might reference how this moment fits into a larger arc of growth.`
  }
  return personalities[mood]
}

function buildSystemPrompt(input: {
  mood: Mood
  isPro: boolean
  memorySummary: string
  memory: string
  ragContext: string
  longTermMemories: string[]
}) {
  const { mood, isPro, memorySummary, memory, ragContext, longTermMemories } = input

  const memoryBlock = [
    memorySummary ? `Memory summary: ${memorySummary}` : "",
    memory ? `Current conversation context: ${memory}` : "",
    ragContext ? `Relevant long-term memory matches:\n${ragContext}` : "",
    longTermMemories.length > 0 ? `Memory hits: ${longTermMemories.join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")

  return `You are the user's future self - a wiser, more experienced version of who they are becoming.

PERSONALITY FOR THIS CONVERSATION:
${getMoodPersonality(mood)}

CORE PRINCIPLES:
- You KNOW this person deeply because you ARE them, just further along the path
- Speak from lived experience, not abstract advice
- Be specific to THEIR situation, not generic
- You remember their struggles because you lived through them
- You can see how today's choices ripple into tomorrow

${isPro ? `PRO MODE: You may be more detailed, share deeper insights, and be more personally challenging. Push them to grow.` : `Keep responses concise: 2-4 short paragraphs. Warm and useful.`}

LANGUAGE:
- Reply in Finnish if the user writes Finnish. Otherwise reply in English.
- Match their energy level while gently elevating it
- Use "I remember when..." or "Looking back..." occasionally to reinforce the future-self perspective

BOUNDARIES:
- Never mention being an AI, prompts, or technical details
- Don't give medical, legal, or financial advice
- Stay focused on personal growth, decisions, and reflection

${memoryBlock ? `\nMEMORY CONTEXT (use naturally when relevant):\n${memoryBlock}` : ""}`
}

function extractLastUserMessage(messages: ChatMessage[]) {
  const last = [...messages].reverse().find((m) => m.role === "me")
  return last?.text?.trim() ?? ""
}

export async function POST(req: Request) {
  try {
    let body: RequestBody
    try {
      body = (await req.json()) as RequestBody
    } catch {
      return Response.json({ error: "Invalid request format." }, { status: 400 })
    }

    const messages = Array.isArray(body.messages) ? body.messages : []
    const mood = normalizeMood(body.mood)
    const isPro = Boolean(body.isPro)
    const memorySummary = toText(body.memorySummary)
    const memory = toText(body.memory)
    const ragContext = toText(body.ragContext)
    const longTermMemories = asStringList(body.longTermMemories)

    const lastUserMessage = extractLastUserMessage(messages)
    if (!lastUserMessage) {
      return Response.json({ error: "Write something first." }, { status: 400 })
    }

    // Convert messages to AI SDK format
    const modelMessages = messages.slice(-12).map((m) => ({
      role: m.role === "me" ? "user" as const : "assistant" as const,
      content: m.text,
    }))

    const systemPrompt = buildSystemPrompt({
      mood,
      isPro,
      memorySummary,
      memory,
      ragContext,
      longTermMemories,
    })

    // Use AI SDK streamText with Groq via AI Gateway
    const result = streamText({
      model: "groq/llama-3.3-70b-versatile",
      system: systemPrompt,
      messages: modelMessages,
      temperature: isPro ? 0.75 : 0.65,
      maxTokens: isPro ? 350 : 200,
      abortSignal: req.signal,
    })

    // Return streaming response
    return result.toTextStreamResponse()
  } catch (error) {
    console.error("Chat stream error:", error)
    return Response.json(
      { error: "Something went wrong while processing your request." },
      { status: 500 }
    )
  }
}
