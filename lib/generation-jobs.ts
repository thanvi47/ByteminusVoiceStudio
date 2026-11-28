export type JobProgress = { id: string; status: "running" | "cancelling" | "cancelled" | "complete" | "failed"; percent: number; stage: string; completed: number; total: number };
export type GenerationControl = { id: string; signal: AbortSignal; update: (progress: Partial<JobProgress>) => void };
type Job = { progress: JobProgress; controller: AbortController; updated: number };
const state = globalThis as typeof globalThis & { byteminusGenerationJobs?: Map<string, Job> };
const jobs = state.byteminusGenerationJobs ??= new Map<string, Job>();
export const validJobId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export function createJob(id: string): GenerationControl {
  for (const [key, job] of jobs) if (!["running", "cancelling"].includes(job.progress.status) && Date.now()-job.updated > 30*60*1000) jobs.delete(key);
  if (jobs.has(id)) throw new Error("JOB_EXISTS");
  if (jobs.size >= 1000) throw new Error("BUSY");
  const job: Job = { controller: new AbortController(), updated: Date.now(), progress: { id, status: "running", percent: 0, stage: "Waiting for the generation queue…", completed: 0, total: 0 } };
  jobs.set(id, job);
  return { id, signal: job.controller.signal, update: (value) => {
    job.progress = { ...job.progress, ...value };
    job.updated = Date.now();
  } };
}
export function getJob(id: string) { const job = jobs.get(id); return job ? { ...job.progress } : undefined; }
export async function cancelJob(id: string) {
  const job = jobs.get(id);
  if (!job) return undefined;
  if (["running", "cancelling"].includes(job.progress.status)) {
    job.progress.status = "cancelling";
    job.progress.stage = "Cancelling… waiting for the model to stop.";
    job.controller.abort();
    // The existing synthesis socket stays open until the backend acknowledges
    // cancellation, so the UI does not falsely report a native kernel stopped.
    try { await fetch("http://127.0.0.1:8123/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ generationId: id }), signal: AbortSignal.timeout(5000) }); } catch { /* A queued job is also cancelled by its signal. */ }
  }
  return { ...job.progress };
}
export function throwIfCancelled(control?: GenerationControl) {
  if (control?.signal.aborted) throw new Error("GENERATION_CANCELLED");
}
export async function waitForTurn(previous: Promise<void>, control?: GenerationControl) {
  if (!control) return previous;
  throwIfCancelled(control);
  await new Promise<void>((resolve, reject) => {
    const abort = () => { cleanup(); reject(new Error("GENERATION_CANCELLED")); };
    const cleanup = () => control.signal.removeEventListener("abort", abort);
    control.signal.addEventListener("abort", abort, { once: true });
    previous.then(() => { cleanup(); resolve(); }, (error) => { cleanup(); reject(error); });
    if (control.signal.aborted) abort();
  });
}
