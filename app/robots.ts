import type { MetadataRoute } from "next";
import { publicSite } from "@/lib/site";
export default function robots(): MetadataRoute.Robots {
  return publicSite.index && publicSite.url
    ? { rules: { userAgent: "*", allow: "/", disallow: ["/api/"] }, sitemap: new URL("sitemap.xml", publicSite.url).href }
    : { rules: { userAgent: "*", disallow: "/" } };
}
