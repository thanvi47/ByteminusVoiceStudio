import { parseScript } from "./script";

/** Preserve words and explicit pauses while bounding each local inference job. */
export function speechBatches(text: string, limit: number): string[] {
  if (!Number.isInteger(limit) || limit < 40 || limit > 1200) throw new Error("Invalid batch budget");
  const tokens = parseScript(text).flatMap((part) => part.pause !== undefined
    ? [`[pause ${part.pause}s]`]
    : part.text?.match(/\S+/gu) ?? []);
  const batches: string[] = [];
  let current = "";
  for (const token of tokens) {
    if (token.length > limit) throw new Error("Use shorter words in your script.");
    if (current && current.length + token.length + 1 > limit) {
      batches.push(current); current = "";
    }
    current += (current ? " " : "") + token;
  }
  if (current) batches.push(current);
  return batches;
}
