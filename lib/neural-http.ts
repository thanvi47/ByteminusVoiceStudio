import { request } from "node:http";

// CPU inference can take longer than fetch's independent five-minute header deadline.
// Use a fresh loopback socket with an explicit total deadline and a bounded response.
export function postNeural(body: string, options: {
  port?: number; timeoutMs?: number; connectTimeoutMs?: number; maxBytes?: number;
} = {}): Promise<Response> {
  const { port = 8123, timeoutMs = 1_250_000, connectTimeoutMs = 5000,
    maxBytes = 600 * 48000 * 2 + 1024 } = options;
  return new Promise((resolve, reject) => {
    let settled = false;
    let connectTimer: ReturnType<typeof setTimeout> | undefined;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(totalTimer);
      clearTimeout(connectTimer);
      reject(error);
    };
    const req = request({
      hostname: "127.0.0.1", port, path: "/synthesize", method: "POST", agent: false,
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (res) => {
      clearTimeout(connectTimer);
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) {
          const error = Object.assign(new Error("Neural response too large"), { code: "NEURAL_RESPONSE_LIMIT" });
          fail(error);
          req.destroy(error);
        } else chunks.push(chunk);
      });
      res.on("aborted", () => fail(Object.assign(new Error("Neural connection closed"), { code: "ECONNRESET" })));
      res.on("error", fail);
      res.on("end", () => {
        if (settled) return;
        try {
          const headers = new Headers();
          for (const [key, value] of Object.entries(res.headers)) {
            if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
          }
          const response = new Response(new Uint8Array(Buffer.concat(chunks)), { status: res.statusCode ?? 502, headers });
          settled = true;
          clearTimeout(totalTimer);
          clearTimeout(connectTimer);
          resolve(response);
        } catch (error) { fail(error instanceof Error ? error : new Error("Invalid neural response")); }
      });
    });
    const totalTimer = setTimeout(() => {
      const error = Object.assign(new Error("CPU generation timed out"), { code: "NEURAL_TIMEOUT" });
      fail(error);
      req.destroy(error);
    }, timeoutMs);
    req.on("socket", (socket) => {
      if (!socket.connecting) return;
      connectTimer = setTimeout(() => {
        const error = Object.assign(new Error("Neural connect timed out"), { code: "ECONNREFUSED" });
        fail(error);
        req.destroy(error);
      }, connectTimeoutMs);
      socket.once("connect", () => clearTimeout(connectTimer));
    });
    req.on("error", fail);
    req.end(body);
  });
}
