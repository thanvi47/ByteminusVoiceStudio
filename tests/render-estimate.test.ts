import { expect, test } from "vitest";
import { observeRender, estimateRender, remainingEstimate } from "../lib/render-estimate";
test("does not invent an estimate before measuring a matching runtime", () => {
  expect(estimateRender("new-model", 100)).toBeNull();
  observeRender("cpu-test", 100, 20);
  expect(estimateRender("cpu-test", 200)).toEqual({ low: 20, high: 85, samples: 1 });
  expect(estimateRender("different-gpu", 200)).toBeNull();
});
test("expired estimates do not pretend the render has completed", () => {
  expect(remainingEstimate(10, 30, 1000, 11000)).toEqual({ low: 0, high: 20 });
  expect(remainingEstimate(10, 30, 1000, 32000)).toBeNull();
});
test("ignores invalid timings and bounds rolling samples", () => {
  observeRender("invalid", 100, NaN);
  expect(estimateRender("invalid", 100)).toBeNull();
  for (let i = 0; i < 12; i++) observeRender("bounded", 100, 10);
  expect(estimateRender("bounded", 100)?.samples).toBe(8);
});
