import { afterEach, expect, test, vi } from "vitest";
import { createJob, getJob, cancelJob, waitForTurn, throwIfCancelled, validJobId } from "../lib/generation-jobs";
afterEach(() => vi.unstubAllGlobals());
test("reports completed work without time-based fake progress", () => {
  const job = createJob(crypto.randomUUID());
  job.update({ total: 4, completed: 1, percent: 23 });
  expect(getJob(job.id)).toMatchObject({ percent: 23, completed: 1, total: 4 });
  expect(validJobId("../../cancel")).toBe(false);
});
test("queued job can be cancelled without waiting for another render", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
  const job = createJob(crypto.randomUUID());
  const waiting = waitForTurn(new Promise<void>(() => {}), job);
  const assertion = expect(waiting).rejects.toThrow("GENERATION_CANCELLED");
  await cancelJob(job.id);
  await assertion;
  expect(() => throwIfCancelled(job)).toThrow("GENERATION_CANCELLED");
  expect(getJob(job.id)?.status).toBe("cancelling");
  job.update({ status: "cancelled" });
});
