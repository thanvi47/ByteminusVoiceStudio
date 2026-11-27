import { z } from "zod";

export const cloneProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
  transcript: z.string().trim().min(2).max(1000),
  duration: z.number().min(3).max(10),
  created: z.string(),
});
export type CloneProfile = z.infer<typeof cloneProfileSchema>;
export const cloneCreateSchema = cloneProfileSchema
  .pick({ name: true, transcript: true })
  .extend({
    consent: z.literal(true),
    audio: z.string().min(1).max(640100),
  });
export const cloneGenerateSchema = z.object({
  id: z.string().uuid(),
  text: z.string().trim().min(2).max(600),
  language: z.enum(["bn", "en"]),
  format: z.enum(["wav", "mp3"]),
  rate: z.number().min(0.75).max(1.5).default(1),
  outputGain: z.number().min(0).max(3).default(1),
  normalizeAudio: z.boolean().default(true),
});
// Browser exports one exact PCM format; reject malformed or disguised uploads.
export function validateReferenceWav(b: Buffer) {
  if (
    b.length < 44 ||
    b.toString("ascii", 0, 4) !== "RIFF" ||
    b.toString("ascii", 8, 16) !== "WAVEfmt " ||
    b.readUInt32LE(4) !== b.length - 8 ||
    b.readUInt32LE(16) !== 16 ||
    b.readUInt16LE(20) !== 1 ||
    b.readUInt16LE(22) !== 1 ||
    b.readUInt32LE(24) !== 24000 ||
    b.readUInt32LE(28) !== 48000 ||
    b.readUInt16LE(32) !== 2 ||
    b.readUInt16LE(34) !== 16 ||
    b.toString("ascii", 36, 40) !== "data" ||
    b.readUInt32LE(40) !== b.length - 44 ||
    (b.length - 44) % 2
  )
    throw new Error("Invalid reference audio. Upload it again.");
  const duration = (b.length - 44) / 48000;
  if (duration < 3 || duration > 10)
    throw new Error("Select between 3 and 10 seconds of speech.");
  let energy = 0;
  for (let i = 44; i < b.length; i += 2)
    energy += (b.readInt16LE(i) / 32768) ** 2;
  if (Math.sqrt(energy / ((b.length - 44) / 2)) < 0.002)
    throw new Error("The selected audio is silent or too quiet.");
  return duration;
}
