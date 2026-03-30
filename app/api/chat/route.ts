import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// 🔹 Luo embedding (voit vaihtaa myöhemmin parempaan)
async function embed(text: string) {
  const res = await groq.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}

// 🔹 Hae relevantit muistot
async function getRelevantMemories(user_id: string, query: string) {
  const queryEmbedding = await embed(query);

  const { data } = await supabase.rpc("match_messages", {
    query_embedding: queryEmbedding,
    match_threshold: 0.75,
    match_count: 5,
    user_id_input: user_id,
  });

  return data?.map((m: any) => m.content).join("\n") || "";
}

export async function POST(req: Request) {
  const { message, user_id } = await req.json();

  // 🔹 hae muisti
  const memory = await getRelevantMemories(user_id, message);

  // 🔹 AI vastaus
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `
You are Future Me.

You have access to long-term memory of the user:
${memory}

Speak like you KNOW the user deeply.
Be insightful, slightly emotional, but not cringe.
        `,
      },
      { role: "user", content: message },
    ],
  });

  const reply = completion.choices[0].message.content;

  // 🔹 tallenna muistiin
  const embedding = await embed(message);

  await supabase.from("messages").insert({
    user_id,
    content: message,
    embedding,
  });

  return Response.json({ reply });
}
