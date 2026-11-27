import { z } from "zod";
export const previewManifestSchema = z.object({
  version: z.literal(1),
  mode: z.literal("neutral"),
  samples: z.record(
    z.string(),
    z.object({
      url: z
        .string()
        .regex(/^\/voice-previews\/v1\/[A-Za-z0-9_-]+\.[a-f0-9]{12}\.mp3$/),
      duration: z.number().positive().max(90),
      text: z.string().min(1).max(300),
    }),
  ),
});
export type PreviewSamples = z.infer<typeof previewManifestSchema>["samples"];
