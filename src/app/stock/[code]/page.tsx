import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StockDetail } from "@/components/StockDetail";
import { findTicker } from "@/lib/server/universe";
import { jsonLd, SITE_NAME, siteUrl } from "@/lib/site";

type Props = { params: Promise<{ code: string }> };

const isCode = (c: string) => /^[A-Z]{4}$/.test(c);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const code = (await params).code.toUpperCase();
  if (!isCode(code)) return {};
  const tk = await findTicker(code);
  const name = tk?.name ?? code;
  const title = `${code} — ${name}: Analisa Teknikal & Sinyal`;
  const description = `Grafik dan analisa teknikal saham ${code} (${name}) di BEI: MA20/50/200, RSI, MACD, Stochastic, ADX, Bollinger Bands, volume, pola candlestick, serta batas ARA/ARB.`;
  return {
    title,
    description,
    keywords: [`saham ${code}`, `${code} saham`, `analisa teknikal ${code}`, `harga saham ${code}`, name],
    alternates: { canonical: `/stock/${code}` },
    openGraph: { type: "website", siteName: SITE_NAME, title, description, url: `/stock/${code}`, locale: "id_ID" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function StockPage({ params }: Props) {
  const code = (await params).code.toUpperCase();
  if (!isCode(code)) notFound();
  const tk = await findTicker(code);
  const url = `${siteUrl()}/stock/${code}`;
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Screener", item: siteUrl() },
        { "@type": "ListItem", position: 2, name: code, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: `${code} — ${tk?.name ?? code}`,
      url,
      inLanguage: "id-ID",
      about: {
        "@type": "Corporation",
        name: tk?.name ?? code,
        tickerSymbol: `IDX:${code}`,
        ...(tk?.sector ? { industry: tk.sector } : {}),
      },
    },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
      <StockDetail code={code} />
    </>
  );
}
