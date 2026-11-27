import { mkdir, readFile, readdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  cloneProfileSchema,
  type CloneProfile,
  validateReferenceWav,
} from "./clone";
import { z } from "zod";
const root = path.join(process.cwd(), ".data", "voices");
export function profileFolder(id: string) {
  return path.join(root, z.string().uuid().parse(id));
}
export async function listClones(): Promise<CloneProfile[]> {
  await mkdir(root, { recursive: true });
  const result: CloneProfile[] = [];
  for (const id of await readdir(root)) {
    if (!z.string().uuid().safeParse(id).success) continue;
    try {
      result.push(
        cloneProfileSchema.parse(
          JSON.parse(
            await readFile(
              path.join(profileFolder(id), "profile.json"),
              "utf8",
            ),
          ),
        ),
      );
    } catch {}
  }
  return result.sort((a, b) => b.created.localeCompare(a.created));
}
export async function saveClone(name: string, transcript: string, pcm: Buffer) {
  if ((await listClones()).length >= 20)
    throw new Error("Delete an unused voice first (20 saved voices maximum).");
  const profile = cloneProfileSchema.parse({
    id: randomUUID(),
    name,
    transcript,
    duration: validateReferenceWav(pcm),
    created: new Date().toISOString(),
  });
  const folder = profileFolder(profile.id);
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, "reference.wav"), pcm, { mode: 0o600 });
  await writeFile(path.join(folder, "profile.json"), JSON.stringify(profile), {
    mode: 0o600,
  });
  return profile;
}
export async function deleteClone(id: string) {
  await rm(profileFolder(id), { recursive: true, force: true });
}
