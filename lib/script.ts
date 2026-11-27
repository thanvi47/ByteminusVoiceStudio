import { z } from "zod";
import neuralVoices from "./voice-catalog.json";
import { voiceDelivery, type VoiceDelivery } from "./voice-delivery";
export type VoiceProfile = {
  id: string;
  name: string;
  language: string;
  accent: string;
  gender: string;
  engine: string;
  styleMode: string;
  neural: boolean;
  delivery: VoiceDelivery;
};
export const emotions = [
  "Neutral",
  "Happy",
  "Funny",
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
const legacyVoices = [
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
export const voices: VoiceProfile[] = [
  ...neuralVoices,
  ...legacyVoices.map((v) => ({
    ...v,
    name: v.name + " · Legacy",
    engine: "espeak",
    styleMode: "approximate",
    neural: false,
  })),
].map((v) => ({
  ...v,
  styleMode: v.neural && ["mithi", "kokoro"].includes(v.engine) ? "natural" : v.styleMode,
  delivery: voiceDelivery(v.id),
}));
export const inputSchema = z
  .object({
    text: z.string().trim().min(1).max(12000),
    voice: z
      .string()
      .refine((id) => voices.some((v) => v.id === id), "Unknown voice"),
    emotion: z.enum(emotions).default("Neutral"),
    intensity: z.number().min(0).max(100).default(50),
    rate: z.number().min(0.5).max(2).default(1),
    pitch: z.number().min(0.5).max(1.5).default(1),
    format: z.enum(["wav", "mp3"]).default("wav"),
    style: z.string().trim().max(1200).default(""),
    outputGain: z.number().min(0).max(3).default(1),
    normalizeAudio: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    const profile = voices.find((v) => v.id === data.voice);
    if (!profile?.neural && data.text.length > 3000)
      ctx.addIssue({ code: "custom", path: ["text"], message: "Legacy voices support at most 3,000 characters." });
    if (
      profile?.neural &&
      profile.language.startsWith("en") &&
      /[\u0980-\u09ff]/u.test(data.text)
    )
      ctx.addIssue({
        code: "custom",
        path: ["voice"],
        message:
          "Your script contains Bengali text. Select a Bengali voice or use an English script.",
      });
  })
  .transform((data) => {
    const profile = voices.find((v) => v.id === data.voice);
    // Old saved projects may still contain emotion settings for natural-only voices.
    return profile?.neural && profile.styleMode !== "prompted"
      ? { ...data, emotion: "Neutral" as const, intensity: 0 }
      : data;
  });
export type SynthesisInput = z.infer<typeof inputSchema>;
export function synthesisKey(input: SynthesisInput) {
  return JSON.stringify([
    input.text,
    input.voice,
    input.emotion,
    input.intensity,
    input.rate,
    input.pitch,
    input.format,
    input.style,
    input.outputGain ?? 1,
    input.normalizeAudio ?? true,
  ]);
}
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
  // Conservative prosody hints, not native emotional acting or whisper synthesis.
  const presets: Record<(typeof emotions)[number], [number, number]> = {
    Neutral: [0, 0],
    Happy: [0.15, 0.1],
    Funny: [0.12, 0.14],
    Sad: [-0.2, -0.12],
    Excited: [0.25, 0.14],
    Angry: [0.12, -0.05],
    Calm: [-0.18, -0.08],
    Serious: [-0.1, -0.1],
    Scared: [0.16, 0.15],
    Nervous: [0.12, 0.1],
    Surprised: [0.18, 0.17],
    Confused: [-0.08, 0.06],
    Disappointed: [-0.16, -0.1],
    Worried: [-0.07, 0.05],
    Relieved: [-0.1, 0.04],
    Frustrated: [0.1, -0.06],
    Embarrassed: [-0.1, 0.06],
    Proud: [0.06, -0.02],
    Hopeful: [0.08, 0.08],
    Whisper: [-0.15, -0.08],
    "News Presenter": [0.04, -0.04],
    "Documentary Narration": [-0.14, -0.1],
    Storytelling: [-0.06, 0.04],
  };
  const [rate, pitch] = presets[emotion as (typeof emotions)[number]] ?? [0, 0];
  return {
    rate: 1 + rate * amount,
    pitch: 1 + pitch * amount,
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
