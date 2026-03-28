"use client";

import { useEffect } from "react";

export default function Page() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const session_id = params.get("session_id");

    if (!session_id) return;

    fetch("/api/verify-session", {
      method: "POST",
      body: JSON.stringify({ session_id }),
      headers: { "Content-Type": "application/json" }
    }).then(() => {
      window.location.href = "/";
    });
  }, []);

  return (
    <div style={{ padding: 40 }}>
      Unlocking Pro...
    </div>
  );
}
