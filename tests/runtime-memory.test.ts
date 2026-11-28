import { expect, test, vi } from "vitest";
vi.mock("node:os", () => ({ totalmem: () => 16 * 1073741824, freemem: vi.fn(() => 1 * 1073741824) }));
import { freemem } from "node:os";
import { runtimeMemory } from "../lib/runtime-memory";
test("reports actual free RAM and warns at low headroom", () => {
  expect(runtimeMemory()).toEqual({ totalGB: 16, freeGB: 1, pressure: "high" });
  vi.mocked(freemem).mockReturnValueOnce(8 * 1073741824);
  expect(runtimeMemory()).toEqual({ totalGB: 16, freeGB: 8, pressure: "normal" });
});
