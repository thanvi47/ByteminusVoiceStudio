import { z } from "zod";
import { inputSchema, voices, type SynthesisInput } from "./script";

export const directionFields = [
  "Voice affect",
  "Tone",
  "Pacing",
  "Emotion",
  "Pronunciation",
  "Pauses",
] as const;
export type Directions = Record<(typeof directionFields)[number], string>;
export type Vibe = {
  id: string;
  name: string;
  summary: string;
  emotion: SynthesisInput["emotion"];
  directions: Directions;
};
function vibe(
  id: string,
  name: string,
  summary: string,
  emotion: Vibe["emotion"],
  affect: string,
  tone: string,
  pacing: string,
  feeling: string,
): Vibe {
  return {
    id,
    name,
    summary,
    emotion,
    directions: {
      "Voice affect": affect,
      Tone: tone,
      Pacing: pacing,
      Emotion: feeling,
      Pronunciation: "Speak clearly; keep names and consonants intelligible.",
      Pauses:
        "Use sentence boundaries for natural breaths. Avoid long artificial gaps.",
    },
  };
}
export const vibes: Vibe[] = [
  vibe(
    "natural",
    "Natural conversation",
    "Easygoing, clear and human",
    "Neutral",
    "Relaxed and present, like talking to one person.",
    "Friendly without sounding promotional.",
    "Comfortable conversational rhythm.",
    "Understated interest and warmth.",
  ),
  vibe(
    "sunny",
    "Bright optimist",
    "Warm, encouraging and upbeat",
    "Happy",
    "Bright and gently animated.",
    "Encouraging and reassuring.",
    "Lively, with space to finish each thought.",
    "A sincere smile in the voice; avoid shouting.",
  ),
  vibe(
    "comic",
    "Playful storyteller",
    "Light comic timing and surprise",
    "Funny",
    "Amused, playful and expressive.",
    "Witty and affectionate; never mocking.",
    "Give punchlines room; vary the rhythm.",
    "Light amusement and small moments of surprise.",
  ),
  vibe(
    "radio",
    "Midnight radio",
    "Intimate, smooth and unhurried",
    "Calm",
    "Smooth and relaxed, with a close recording.",
    "Inviting and quietly confident.",
    "Unhurried, connecting thoughts smoothly.",
    "Quiet enjoyment rather than dramatic excitement.",
  ),
  vibe(
    "energy",
    "Big energy",
    "An animated pep talk",
    "Excited",
    "Energetic and animated, while remaining clear.",
    "Enthusiastic and motivating.",
    "Brisk phrases balanced by short breaths.",
    "Excitement that builds towards important lines.",
  ),
  vibe(
    "cinema",
    "Dramatic scene",
    "Tension, contrast and anticipation",
    "Serious",
    "Focused and expressive, with controlled intensity.",
    "Serious, cinematic and suspenseful.",
    "Deliberate; let significant words land.",
    "Build anticipation without a constant exaggerated voice.",
  ),
  vibe(
    "soft",
    "Soft spoken",
    "Quiet, gentle and close",
    "Whisper",
    "Quiet and intimate; gently breathy if the model supports it.",
    "Reassuring and delicate.",
    "Slow enough to feel personal, without dragging.",
    "Gentle care, never theatrical sadness.",
  ),
  vibe(
    "news",
    "News desk",
    "Composed, direct and precise",
    "News Presenter",
    "Clear and composed, with consistent projection.",
    "Professional and factual.",
    "Measured and steady, with concise sentence endings.",
    "Calm confidence; keep personal emotion restrained.",
  ),
  vibe(
    "wonder",
    "Storybook wonder",
    "Curiosity and colorful narration",
    "Storytelling",
    "Animated, warm and easy to follow.",
    "Curious, welcoming and imaginative.",
    "Vary emphasis for discoveries and character moments.",
    "A sense of wonder without a cartoonish pitch.",
  ),
  vibe(
    "rest",
    "Quiet reflection",
    "Space to think and breathe",
    "Calm",
    "Soft, grounded and steady.",
    "Patient and reassuring.",
    "Gentle and spacious; complete words clearly.",
    "A calm, settled mood.",
  ),
  vibe(
    "care",
    "Helpful guide",
    "Empathy and practical reassurance",
    "Hopeful",
    "Warm, attentive and confident.",
    "Helpful and respectful, without a sales pitch.",
    "Steady; emphasize the next useful action.",
    "Empathy followed by realistic reassurance.",
  ),
  vibe(
    "documentary",
    "Documentary",
    "Thoughtful, textured narration",
    "Documentary Narration",
    "Engaged, articulate and grounded.",
    "Thoughtful, informative and quietly compelling.",
    "Measured, with contrast between context and discoveries.",
    "Curiosity and understated awe.",
  ),
];
export const demoScripts = [
  {
    id: "welcome",
    name: "Warm welcome",
    text: "Every story starts with a small idea. Give it a little room, a little curiosity, and a voice of its own. Let's see where yours takes us.",
  },
  {
    id: "story",
    name: "Short story",
    text: "Maya found a tiny door behind the bookshelf. It had a brass handle, a blue light, and a sign that said: please knock. So, of course, she knocked.",
  },
  {
    id: "comedy",
    name: "A little funny",
    text: "I bought a planner to organize my life. It's going beautifully. I've already scheduled three separate times to find the planner.",
  },
  {
    id: "guide",
    name: "Helpful explainer",
    text: "Take a moment to settle in. [pause 500ms] We'll work through this one step at a time. You don't need to know everything before you begin.",
  },
];
export function compileDirections(directions: Directions) {
  return directionFields
    .map((key) => `${key}: ${directions[key].trim()}`)
    .filter((_, i) => directions[directionFields[i]].trim())
    .join("\n");
}
const directionsSchema = z
  .object(
    Object.fromEntries(
      directionFields.map((key) => [key, z.string().max(140)]),
    ) as Record<keyof Directions, z.ZodString>,
  )
  .strict();
export const recipeSchema = z
  .object({
    version: z.literal(1),
    name: z.string().trim().min(1).max(60),
    input: inputSchema,
    directions: directionsSchema,
  })
  .strict()
  .refine(
    (r) =>
      voices.some(
        (v) =>
          v.id === r.input.voice &&
          v.neural &&
          ["parler", "kokoro", "mithi", "indic"].includes(v.engine),
      ),
    "Select a supported neural playground voice.",
  );
export type Recipe = z.infer<typeof recipeSchema>;
export function requestForRecipe(recipe: Recipe): SynthesisInput {
  return inputSchema.parse({
    ...recipe.input,
    style: compileDirections(recipe.directions),
  });
}
export function developerSnippet(
  input: SynthesisInput,
  language: "JavaScript" | "Python" | "cURL",
) {
  const body = JSON.stringify(input, null, 2);
  if (language === "JavaScript")
    return `// Run on the signed-in studio page, or from your same-origin app.\nconst input = ${body};\nconst response = await fetch('/api/tts/generate', {\n  method: 'POST', credentials: 'same-origin',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify(input)\n});\nif (!response.ok) throw new Error(await response.text());\nconst audio = await response.blob();\nnew Audio(URL.createObjectURL(audio)).play();`;
  if (language === "Python")
    return `# Standard library only. Set APP_ACCESS_PASSWORD for a protected server.\nimport json, os, urllib.request, http.cookiejar\njar = http.cookiejar.CookieJar()\nclient = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))\nbase = "http://127.0.0.1:3000"\ndef post(route, payload):\n    request = urllib.request.Request(base + route, data=json.dumps(payload).encode("utf-8"),\n        headers={"Content-Type": "application/json"}, method="POST")\n    return client.open(request, timeout=800)\npassword = os.environ.get("APP_ACCESS_PASSWORD")\nif password:\n    post("/api/auth/login", {"password": password}).close()\npayload = json.loads(${JSON.stringify(body)})\nwith post("/api/tts/generate", payload) as response:\n    with open("voice.${input.format}", "wb") as output:\n        output.write(response.read())`;
  return `# Download request.json from this panel first.\n# Local development: no cookie is needed. For protected deployments,\n# supply a valid session cookie using your HTTP client's cookie jar.\ncurl --fail-with-body http://127.0.0.1:3000/api/tts/generate \\\n  -H "Content-Type: application/json" \\\n  --data-binary @request.json \\\n  --output voice.${input.format}`;
}
