/** Raise quiet speech and apply optional gain without changing duration.
 * This is RMS-based level correction, not a calibrated LUFS meter.
 * @param {Int16Array} pcm
 * @param {number} sampleRate
 * @param {{normalize?:boolean,gain?:number}} options
 */
export function masterPcm(
  pcm,
  sampleRate,
  { normalize = true, gain = 1 } = {},
) {
  if (!Number.isFinite(gain) || gain < 0 || gain > 3)
    throw new Error("Invalid output volume");
  if (!Number.isFinite(sampleRate) || sampleRate < 8000)
    throw new Error("Invalid sample rate");
  if (gain === 0) return new Int16Array(pcm.length);
  if (!normalize && gain === 1) return new Int16Array(pcm);
  const frame = Math.max(1, Math.round(sampleRate * 0.02));
  const blocks = [];
  let maxRms = 0;
  for (let start = 0; start < pcm.length; start += frame) {
    let energy = 0;
    const end = Math.min(start + frame, pcm.length);
    for (let i = start; i < end; i++) {
      const v = pcm[i] / 32768;
      energy += v * v;
    }
    const rms = Math.sqrt(energy / (end - start));
    maxRms = Math.max(maxRms, rms);
    blocks.push({ energy, count: end - start, rms });
  }
  let energy = 0,
    count = 0;
  const gate = Math.max(0.003, maxRms * 0.1);
  for (const block of blocks)
    if (block.rms >= gate) {
      energy += block.energy;
      count += block.count;
    }
  const speechRms = count ? Math.sqrt(energy / count) : 0;
  const auto =
    normalize && speechRms > 0 ? Math.min(8, Math.max(1, 0.14 / speechRms)) : 1;
  const multiplier = auto * gain;
  const result = new Int16Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    let v = (pcm[i] / 32768) * multiplier;
    // Smooth peak limiting keeps manual boost audible instead of cancelling it globally.
    const a = Math.abs(v);
    if (a > 0.8)
      v = Math.sign(v) * (0.8 + 0.15 * (1 - Math.exp(-(a - 0.8) / 0.15)));
    result[i] = Math.round(Math.max(-0.95, Math.min(0.95, v)) * 32767);
  }
  return result;
}
