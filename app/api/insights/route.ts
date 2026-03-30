import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get("user_id");

  const { data } = await supabase
    .from("messages")
    .select("content, created_at")
    .eq("user_id", user_id);

  // 🔹 super simple mood analysis
  const moodScore = data?.map((m) => {
    if (m.content.includes("happy")) return 1;
    if (m.content.includes("sad")) return -1;
    return 0;
  });

  return Response.json({
    total_messages: data?.length || 0,
    mood_average:
      moodScore?.reduce((a, b) => a + b, 0) / (moodScore?.length || 1),
  });
}
