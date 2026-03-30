import "./globals.css"; // Tärkeää: pieni i-kirjain
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Future Me",
  description: "Talk to your future self in a clean, persistent chat."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050508" // Päivitetty vastaamaan uutta tummaa teemaa
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
