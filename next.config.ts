import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: [
    "@echogarden/espeak-ng-emscripten",
    "@breezystack/lamejs",
  ],
  poweredByHeader: false,
  // Local inference assets stay on disk; never bundle private recordings or multi-GB weights.
  outputFileTracingExcludes: {
    "/*": [
      "./.models/**/*", "./.data/**/*", "./.cache/**/*",
      "./.venv/**/*", "./.runtime/**/*", "./.tools/**/*",
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
