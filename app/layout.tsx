import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Future Me Screenshot",
  description: "Generate viral chat screenshots from your future self."
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
