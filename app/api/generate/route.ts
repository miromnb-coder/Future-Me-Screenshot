export async function POST(req: Request) {
  try {
    const { decision, tone, horizon } = await req.json();

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content:
              "You are the user's future self. Speak naturally, shortly, and wisely. No cringe."
          },
          {
            role: "user",
            content: `Decision: ${decision}\nTone: ${tone}\nTime later: ${horizon}`
          }
        ],
        temperature: 0.8
      })
    });

    const data = await response.json();

    const text =
      data?.choices?.[0]?.message?.content ||
      "I thought about it. You already know the answer.";

    return Response.json({
      messages: [
        { from: "me", text: decision, time: "now" },
        { from: "future me", text: text, time: horizon }
      ]
    });

  } catch (err) {
    console.error(err);

    return Response.json({
      messages: [
        { from: "me", text: "Should I do this?", time: "now" },
        {
          from: "future me",
          text: "Something broke. But honestly, you already know.",
          time: "soon"
        }
      ]
    });
  }
}
