import type { MetadataRoute } from "next";
import { publicSite } from "@/lib/site";
export default function sitemap(): MetadataRoute.Sitemap {
  return publicSite.index && publicSite.url ? [{ url: publicSite.url.href, changeFrequency: "monthly", priority: 1 }] : [];
}
