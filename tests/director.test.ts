import { describe, it, expect } from "vitest";
import {
  compileDirections,
  developerSnippet,
  directionFields,
  recipeSchema,
  requestForRecipe,
  vibes,
} from "../lib/director";
import { inputSchema } from "../lib/script";
const input = inputSchema.parse({
  text: 'It\'s a "beautiful" day.\nA backtick: ` and ${untrusted}.',
  voice: "parler:Lea",
});
const recipe = {
  version: 1,
  name: "Saved performance",
  input,
  directions: vibes[0].directions,
};
describe("voice playground recipes and requests", () => {
  it("roundtrips a recipe without losing its script or structured direction", () => {
    const parsed = recipeSchema.parse(JSON.parse(JSON.stringify(recipe)));
    const request = requestForRecipe(parsed);
    expect(request.text).toBe(input.text);
    expect(request.voice).toBe(input.voice);
    for (const field of directionFields)
      expect(request.style).toContain(field + ":");
    expect(inputSchema.safeParse(request).success).toBe(true);
  });
  it("rejects unsupported voices, legacy fallbacks and unexpected import fields", () => {
    for (const voice of ["https://remote.example/voice", "bn", "unknown"]) {
      expect(
        recipeSchema.safeParse({ ...recipe, input: { ...input, voice } })
          .success,
      ).toBe(false);
    }
    expect(
      recipeSchema.safeParse({
        ...recipe,
        providerUrl: "https://remote.example",
      }).success,
    ).toBe(false);
  });
  it("bounds direction fields before using imported data", () =>
    expect(
      recipeSchema.safeParse({
        ...recipe,
        directions: { ...recipe.directions, Tone: "a".repeat(141) },
      }).success,
    ).toBe(false));
  it("keeps every built-in vibe within the real model instruction budget", () => {
    for (const v of vibes) {
      expect(compileDirections(v.directions).length).toBeLessThanOrEqual(1200);
      expect(
        inputSchema.safeParse({
          ...input,
          emotion: v.emotion,
          style: compileDirections(v.directions),
        }).success,
      ).toBe(true);
    }
  });
  it("rejects an oversized expressive script before generation", () =>
    expect(
      inputSchema.safeParse({ ...input, text: "a".repeat(601) }).success,
    ).toBe(false));
  it("exports JavaScript user text as data, not executable template interpolation", () => {
    const snippet = developerSnippet(input, "JavaScript");
    expect(snippet).toContain(JSON.stringify(input, null, 2));
    expect(
      () => new Function("return async function(){\n" + snippet + "\n}"),
    ).not.toThrow();
    expect(snippet).not.toContain("api.openai.com");
  });
  it("uses a local request file for cURL instead of interpolating script into a shell command", () => {
    const snippet = developerSnippet(input, "cURL");
    expect(snippet).toContain("@request.json");
    expect(snippet).not.toContain(input.text);
    expect(snippet).toContain("127.0.0.1:3000");
  });
});
