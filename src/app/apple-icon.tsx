import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #6ee7d8, #8b9cff)" }}>
        <svg width="120" height="120" viewBox="0 0 64 64">
          <path d="M8 46 24 30l10 9 22-23" stroke="#04121a" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
