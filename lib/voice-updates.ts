/** Mark model-wide updates separately from profiles used in generated demo checks. */
export function voiceUpdateLabel(id: string): string {
  if (id === "parler:Jon" || id === "indic:Arjun")
    return "✓ TESTED · Excited / Scared";
  if (id.startsWith("parler:") || id.startsWith("indic:"))
    return "★ UPDATED · Excited / Scared";
  return "";
}
