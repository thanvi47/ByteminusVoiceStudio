import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ByteminusVoiceStudio — Your words, a new voice",
  description:
    "Free and open source Bangla and English speech studio. Runs locally with eSpeak NG. No API keys or subscriptions.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
