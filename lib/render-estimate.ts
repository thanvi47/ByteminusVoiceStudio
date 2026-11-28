// Local process measurements only. No script or audio is retained here.
type Sample = { seconds: number; characters: number };
const samples = new Map<string, Sample[]>();
export function observeRender(key: string, characters: number, seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0 || characters <= 0) return;
  const recent = samples.get(key) ?? [];
  recent.push({ seconds, characters });
  samples.delete(key);
  samples.set(key, recent.slice(-8));
  if (samples.size > 256) samples.delete(samples.keys().next().value!);
}
export function estimateRender(key: string, characters: number) {
  const recent = samples.get(key);
  if (!recent?.length || characters <= 0) return null;
  const rates = recent.map((s) => s.seconds / s.characters).sort((a, b) => a - b);
  const median = rates[Math.floor(rates.length / 2)];
  return { low: Math.max(1, Math.round(median * characters * .5)), high: Math.max(2, Math.ceil(median * characters * 2 + 5)), samples: recent.length };
}
export function remainingEstimate(low: number, high: number, updated: number, now: number) {
  const elapsed = Math.max(0, (now - updated) / 1000);
  if (elapsed >= high) return null;
  return { low: Math.max(0, Math.ceil(low - elapsed)), high: Math.max(1, Math.ceil(high - elapsed)) };
}
