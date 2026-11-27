/** Mark model-wide updates separately from profiles used in generated demo checks. */
export function voiceUpdateLabel(id: string): string {
  if (["parler:Jon", "parler:Lea", "indic:Arjun", "indic:Aditi"].includes(id))
    return "✓ TESTED · Excited / Scared";
  if (id.startsWith("parler:") || id.startsWith("indic:"))
    return "★ UPDATED · Excited / Scared";
  return "";
}

export function voiceEmotionSample(id: string, emotion: string): string | null {
  const files: Record<string, string> = {
    "parler:Jon": "english-jon",
    "parler:Lea": "english-lea",
    "indic:Arjun": "bengali-arjun",
    "indic:Aditi": "bengali-aditi",
  };
  const file = files[id];
  return file && (emotion === "Excited" || emotion === "Scared")
    ? `/delivery-previews/v1/${file}-${emotion.toLowerCase()}.mp3`
    : null;
}
