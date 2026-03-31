export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";

type SearchBody = {
  query?: unknown;
  userId?: unknown;
  email?: unknown;
  limit?: unknown;
};

type EmbeddingResponse = {
  data?: Array<{ embedding?: unknown }>;
  embedding?: unknown;
};

type MatchRow = {
  id?: string;
  text?: string | null;
  content?: string | null;
  summary?: string | null;
  similarity?: number | null;
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

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toLimit(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 6;
  return Math.max(1, Math.min(12, Math.floor(n)));
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

    if (!response.ok) return null;

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

function normalizeRow(row: MatchRow) {
  const text = row.text ?? row.content ?? row.summary ?? "";
  return {
    id: row.id ?? crypto.randomUUID(),
    text,
    content: text,
    summary: row.summary ?? text,
    similarity: typeof row.similarity === "number" ? row.similarity : null,
  };
}

export async function POST(req: Request) {
  try {
    const supabase = getAdminClient();
    if (!supabase) {
      return Response.json({ memories: [], error: "Missing Supabase env vars." }, { status: 500 });
    }

    let body: SearchBody;
    try {
      body = (await req.json()) as SearchBody;
    } catch {
      return Response.json({ memories: [], error: "Invalid request format." }, { status: 400 });
    }

    const query = toText(body.query);
    const userId = toText(body.userId);
    const email = toText(body.email);
    const limit = toLimit(body.limit);

    if (!query || !userId) {
      return Response.json({ memories: [] }, { status: 200 });
    }

    const embedding = await generateEmbedding(query);

    if (embedding) {
      try {
        const { data, error } = await supabase.rpc("match_messages", {
          query_embedding: embedding,
          match_count: limit,
        });

        if (!error && Array.isArray(data)) {
          const memories = (data as MatchRow[]).map(normalizeRow).filter((item) => item.text);
          if (memories.length > 0) {
            return Response.json({ memories });
          }
        }
      } catch {
        // Fall through to text search
      }
    }

    const escaped = query.replace(/[%_]/g, "\\$&");
    const patterns = Array.from(
      new Set(
        [query, query.toLowerCase(), escaped]
          .map((value) => value.trim())
          .filter(Boolean)
      )
    );

    const [messagesRes, profileRes] = await Promise.all([
      supabase
        .from("messages")
        .select("id,text,content,summary,created_at")
        .eq("user_id", userId)
        .or(patterns.map((p) => `text.ilike.%${p}%,content.ilike.%${p}%,summary.ilike.%${p}%`).join(","))
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("profiles")
        .select("memory_summary,last_seen_at")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const memories = [
      ...(Array.isArray(messagesRes.data) ? (messagesRes.data as MatchRow[]).map(normalizeRow) : []),
      ...(profileRes.data?.memory_summary
        ? [
            {
              id: "profile-memory",
              text: profileRes.data.memory_summary,
              content: profileRes.data.memory_summary,
              summary: profileRes.data.memory_summary,
              similarity: null,
            },
          ]
        : []),
    ]
      .filter((item) => item.text)
      .slice(0, limit);

    return Response.json({
      memories,
      fallback: !embedding,
      usedEmail: Boolean(email),
    });
  } catch (error) {
    console.error("Memory search route error:", error);
    return Response.json({ memories: [], error: "Unexpected server error." }, { status: 500 });
  }
}
