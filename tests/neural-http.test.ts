import { createServer, type Server, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { postNeural } from "../lib/neural-http";

let server: Server | undefined;
afterEach(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  }
});
async function listen(handler: (res: ServerResponse) => void) {
  server = createServer((req, res) => { req.resume(); handler(res); });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  return (server.address() as { port: number }).port;
}
describe("long-running local neural HTTP", () => {
  it("waits for delayed headers and preserves audio and sample-rate headers", async () => {
    const port = await listen((res) => setTimeout(() => {
      res.setHeader("X-Sample-Rate", "24000");
      res.end(Buffer.from([1, 2, 3, 4]));
    }, 80));
    const response = await postNeural("{}", { port, timeoutMs: 2000 });
    expect(response.headers.get("X-Sample-Rate")).toBe("24000");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3, 4]);
  });
  it("identifies an inference deadline separately from connection refusal", async () => {
    const port = await listen(() => {});
    await expect(postNeural("{}", { port, timeoutMs: 80 })).rejects.toMatchObject({ code: "NEURAL_TIMEOUT" });
  });
  it("bounds oversized output even when the server keeps sending", async () => {
    const port = await listen((res) => res.end(Buffer.alloc(1024)));
    await expect(postNeural("{}", { port, maxBytes: 100 })).rejects.toMatchObject({ code: "NEURAL_RESPONSE_LIMIT" });
  });
  it("preserves structured provider errors", async () => {
    const port = await listen((res) => { res.writeHead(503, { "Content-Type": "application/json" }); res.end('{"detail":"Model unavailable"}'); });
    const response = await postNeural("{}", { port });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ detail: "Model unavailable" });
  });
});
