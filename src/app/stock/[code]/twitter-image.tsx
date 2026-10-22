import { OG_SIZE, renderStockImage } from "@/lib/og";

export const alt = "Grafik dan sinyal teknikal saham BEI";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return renderStockImage(code);
}
