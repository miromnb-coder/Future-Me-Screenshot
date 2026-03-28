import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Future Me Screenshot',
  description: 'Create viral-style chats with your future self and export them as a screenshot.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
