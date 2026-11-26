import { z } from "zod";
export const emotions = [
  "Neutral",
  "Happy",
  "Sad",
  "Excited",
  "Angry",
  "Calm",
  "Serious",
  "Scared",
  "Nervous",
  "Surprised",
  "Confused",
  "Disappointed",
  "Worried",
  "Relieved",
  "Frustrated",
  "Embarrassed",
  "Proud",
  "Hopeful",
  "Whisper",
  "News Presenter",
  "Documentary Narration",
  "Storytelling",
] as const;
export const voices = [
  {
    id: "bn",
    name: "Bangla · Classic",
    language: "bn",
    accent: "Bengali (generic)",
    gender: "Male",
  },
  {
    id: "bn+f3",
    name: "Bangla · Bright",
    language: "bn",
    accent: "Bengali (generic)",
    gender: "Female",
  },
  {
    id: "en-us",
    name: "English · Classic",
    language: "en-US",
    accent: "United States",
    gender: "Male",
  },
  {
    id: "en-us+f3",
    name: "English · Bright",
    language: "en-US",
    accent: "United States",
    gender: "Female",
  },
  {
    id: "en-gb",
    name: "English · Classic",
    language: "en-GB",
    accent: "United Kingdom",
    gender: "Male",
  },
  {
    id: "en-gb+f3",
    name: "English · Bright",
    language: "en-GB",
    accent: "United Kingdom",
    gender: "Female",
  },
];
export const inputSchema = z.object({
  text: z.string().trim().min(1).max(3000),
  voice: z.enum(["bn", "bn+f3", "en-us", "en-us+f3", "en-gb", "en-gb+f3"]),
  emotion: z.enum(emotions).default("Neutral"),
  intensity: z.number().min(0).max(100).default(50),
  rate: z.number().min(0.5).max(2).default(1),
  pitch: z.number().min(0.5).max(1.5).default(1),
  format: z.enum(["wav", "mp3"]).default("wav"),
});
export type SynthesisInput = z.infer<typeof inputSchema>;
export function detectLanguage(text: string) {
  return /[\u0980-\u09ff]/u.test(text) ? "bn" : "en-US";
}
export function escapeXML(text: string) {
  return text.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
}
export function parseScript(text: string): { text?: string; pause?: number }[] {
  const result: { text?: string; pause?: number }[] = [];
  let last = 0;
  for (const m of text.matchAll(/\[(pause|break)\s+([^\]]+)\]/gi)) {
    if (m.index! > last) result.push({ text: text.slice(last, m.index) });
    const duration = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(m[2]);
    if (!duration) throw new Error("Use [pause 500ms] or [break 1.5s].");
    const seconds = Number(duration[1]) / (duration[2] === "ms" ? 1000 : 1);
    if (seconds > 10) throw new Error("A break can be at most 10 seconds.");
    result.push({ pause: seconds });
    last = m.index! + m[0].length;
  }
  if (last < text.length) result.push({ text: text.slice(last) });
  if (result.some((p) => p.text && /\[\s*(pause|break)\b/i.test(p.text)))
    throw new Error("Invalid pause tag.");
  if (result.filter((p) => p.pause !== undefined).length > 30)
    throw new Error("Use at most 30 breaks per request.");
  if (!result.some((p) => p.text?.trim()))
    throw new Error("Add some text to speak.");
  return result;
}
export function delivery(emotion: string, intensity: number) {
  const amount = intensity / 100;
  const fast = [
    "Happy",
    "Excited",
    "Angry",
    "Surprised",
    "Proud",
    "Hopeful",
  ].includes(emotion);
  const slow = [
    "Sad",
    "Calm",
    "Serious",
    "Whisper",
    "Documentary Narration",
    "Disappointed",
  ].includes(emotion);
  return {
    rate: 1 + (fast ? 0.22 : slow ? -0.2 : 0) * amount,
    pitch: 1 + (fast ? 0.12 : slow ? -0.1 : 0) * amount,
  };
}
export function sentences(text: string) {
  return (
    text
      .match(/[^.!?।\n]+[.!?।]?/gu)
      ?.map((t) => t.trim())
      .filter(Boolean) ?? []
  );
}
export function srt(text: string, duration: number) {
  const parts = sentences(text.replace(/\[(?:pause|break)[^\]]*\]/gi, ""));
  const total = parts.reduce((a, s) => a + s.length, 0);
  let time = 0;
  const stamp = (n: number) => {
    const ms = Math.round(n * 1000);
    return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
  };
  return parts
    .map((part, i) => {
      const start = time;
      time += (duration * part.length) / total;
      return `${i + 1}\n${stamp(start)} --> ${stamp(time)}\n${part}\n`;
    })
    .join("\n");
}
