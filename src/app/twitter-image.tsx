import { OG_SIZE, renderSiteImage } from "@/lib/og";

export const alt = "Haka — screener teknikal seluruh saham BEI";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderSiteImage();
}
