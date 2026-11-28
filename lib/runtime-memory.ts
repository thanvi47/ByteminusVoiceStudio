import { freemem, totalmem } from "node:os";
export function runtimeMemory() {
  const total = totalmem(), free = freemem();
  return { totalGB: total / 1073741824, freeGB: free / 1073741824,
    pressure: free < Math.max(2 * 1073741824, total * .1) ? "high" as const : "normal" as const };
}
