import { configured, localMode } from "@/lib/auth";
export async function GET() {
  const ready = configured() || localMode();
  return Response.json(
    {
      status: ready ? "ok" : "configuration_required",
      provider: "eSpeak NG",
      paidServices: false,
    },
    { status: ready ? 200 : 503 },
  );
}
