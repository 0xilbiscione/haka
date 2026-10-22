import type { MetadataRoute } from "next";
import { getUniverse } from "@/lib/server/universe";
import { siteUrl } from "@/lib/site";

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();
  const { tickers } = await getUniverse();
  return [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/builder`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    ...tickers.map((t) => ({
      url: `${base}/stock/${t.code}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
