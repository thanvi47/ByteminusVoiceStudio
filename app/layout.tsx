import type { Metadata } from "next";
import "./globals.css";
import { publicSite, siteTitle, siteDescription } from "@/lib/site";
export const metadata: Metadata = {
  metadataBase: publicSite.url ?? new URL("http://localhost:3000"),
  title: siteTitle,
  description: siteDescription,
  applicationName: "ByteminusVoiceStudio",
  keywords: ["Bengali text to speech", "Bangla TTS", "English text to speech", "local AI voice studio", "open source TTS", "SRT subtitles", "Parler TTS", "Kokoro", "Mithi"],
  authors: [{ name: "ByteminusVoiceStudio contributors", url: "https://github.com/thanvi47/ByteminusVoiceStudio" }],
  alternates: publicSite.url ? { canonical: publicSite.url.href } : undefined,
  robots: { index: publicSite.index, follow: publicSite.index },
  openGraph: { type: "website", title: siteTitle, description: siteDescription, siteName: "ByteminusVoiceStudio", locale: "en_US", url: publicSite.url?.href },
  twitter: { card: "summary_large_image", title: siteTitle, description: siteDescription },
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
