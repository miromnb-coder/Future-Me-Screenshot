import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Future Me",
  description: "Talk to your future self in a clean, persistent chat."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
