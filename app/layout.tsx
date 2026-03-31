import "./globals.css";
import type { Metadata, Viewport } from "next";
import ThemeSwitcher from "../components/ThemeSwitcher";

export const metadata: Metadata = {
  title: "Future Me",
  description: "Talk to your future self in a clean, persistent chat."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050508"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ThemeSwitcher />
        {children}
      </body>
    </html>
  );
}
