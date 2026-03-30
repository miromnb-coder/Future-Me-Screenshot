import OpenAI from "openai";

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File;

  const transcription = await groq.audio.transcriptions.create({
    file,
    model: "whisper-large-v3",
  });

  return Response.json({ text: transcription.text });
}
