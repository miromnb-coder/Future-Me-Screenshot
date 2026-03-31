export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";

type MemoryKind = "user" | "assistant" | "summary";

type IngestBody = {
  userId?: unknown;
  email?: unknown;
  kind?: unknown;
  text?: unknown;
};

type EmbeddingResponse = {
  data?: Array<{ embedding?: unknown }>;
  embedding?: unknown;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EMBEDDINGS_API_URL =
  process.env.EMBEDDINGS_API_URL?.trim() || "https://api.openai.com/v1/embeddings";
const EMBEDDINGS_API_KEY =
  process.env.EMBEDDINGS_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
const EMBEDDINGS_MODEL = process.env.EMBEDDINGS_MODEL?.trim() || "text-embedding-3-small";

function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeKind(value: unknown): MemoryKind {
  return value === "assistant" || value === "summary" ? value : "user";
}

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!EMBEDDINGS_API_KEY || !EMBEDDINGS_API_URL) return null;
  if (!text.trim()) return null;

  try {
    const response = await fetch(EMBEDDINGS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${EMBEDDINGS_API_KEY}`,
      },
      body: JSON.stringify({
        model: EMBEDDINGS_MODEL,
        input: text.slice(0, 8000),
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as EmbeddingResponse;

    const raw =
      data?.data?.[0]?.embedding ??
      data?.embedding ??
      null;

    if (!Array.isArray(raw)) return null;

    const embedding = raw
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    return embedding.length > 0 ? embedding : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getAdminClient();
    if (!supabase) {
      return Response.json({ ok: false, error: "Missing Supabase env vars." }, { status: 500 });
    }

    let body: IngestBody;
    try {
      body = (await req.json()) as IngestBody;
    } catch {
      return Response.json({ ok: false, error: "Invalid request format." }, { status: 400 });
    }

    const userId = toText(body.userId);
    const email = toText(body.email);
    const kind = normalizeKind(body.kind);
    const text = toText(body.text);

    if (!userId || !text) {
      return Response.json({ ok: false, error: "Missing userId or text." }, { status: 400 });
    }

    const embedding = await generateEmbedding(text);

    const payload: Record<string, unknown> = {
      user_id: userId,
      email: email || null,
      kind,
      text,
    };

    if (embedding) {
      payload.embedding = embedding;
    }

    const { error } = await supabase.from("messages").insert([payload]);

    if (error) {
      if (embedding) {
        const retry = await supabase.from("messages").insert([
          {
            user_id: userId,
            email: email || null,
            kind,
            text,
          },
        ]);

        if (retry.error) {
          console.error("Memory ingest failed:", retry.error);
          return Response.json(
            { ok: false, error: "Could not store memory." },
            { status: 500 }
          );
        }
      } else {
        console.error("Memory ingest failed:", error);
        return Response.json(
          { ok: false, error: "Could not store memory." },
          { status: 500 }
        );
      }
    }

    return Response.json({
      ok: true,
      embedded: Boolean(embedding),
    });
  } catch (error) {
    console.error("Memory ingest route error:", error);
    return Response.json(
      { ok: false, error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
