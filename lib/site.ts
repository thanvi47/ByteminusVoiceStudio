export const siteTitle = "ByteminusVoiceStudio | Bangla & English AI Text to Speech";
export const siteDescription = "Free local AI voice studio for Bengali and English text to speech, expressive voice directions, WAV/MP3 export and estimated SRT subtitles. CPU and NVIDIA CUDA support.";
export function siteSettings(raw?: string, indexing?: string) {
  try {
    const url = new URL(raw ?? "");
    if (url.protocol !== "https:" || url.username || url.password ||
      /^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/.test(url.hostname) ||
      url.hostname.endsWith(".local")) return { url: undefined, index: false };
    return { url: new URL(url.origin), index: indexing === "true" };
  } catch { return { url: undefined, index: false }; }
}
export const publicSite = siteSettings(process.env.PUBLIC_SITE_URL, process.env.PUBLIC_INDEXING);
