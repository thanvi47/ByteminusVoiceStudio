export function recordingTitle(text: string): string {
  const language = /[\u0980-\u09ff]/u.test(text) ? "bn" : "en";
  const words = text.replace(/\[(?:pause|break)[^\]]*\]/gi, " ")
    .normalize("NFC").replace(/[^\p{L}\p{M}\p{N}\s'-]/gu, " ").trim().split(/\s+/u).filter(Boolean).slice(0, 6);
  const title = Array.from(words.join(" ")).slice(0, 100).join("").trim() || "Recording";
  return `${title} ${language}`;
}

export const MATURE_DIRECTION = "Mature, warm and confident voice. Rich vocal texture. Human-like breathing and natural speech rhythm. No robotic or synthetic-sounding delivery.";
