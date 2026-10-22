import type { Metadata, Viewport } from "next";
import { AppProvider } from "@/components/AppProvider";
import { BottomBar, TopBar } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Haka — Screener Saham BEI", template: "%s · Haka" },
  description: "Screener teknikal gratis untuk seluruh saham Bursa Efek Indonesia: MA, RSI, MACD, volume, breakout, dan pola candlestick.",
  applicationName: "Haka",
  appleWebApp: { capable: true, title: "Haka", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#060a14" },
    { media: "(prefers-color-scheme: light)", color: "#edf1f8" },
  ],
};

// Applies the saved theme before first paint to avoid a flash.
const themeScript = `(function(){try{var t=JSON.parse(localStorage.getItem("haka:theme")||'"dark"');if(t!=="system")document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme","dark")}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <div className="mesh" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <AppProvider>
          <TopBar />
          <main className="mx-auto max-w-6xl px-4 pb-32 md:pb-12">{children}</main>
          <BottomBar />
        </AppProvider>
      </body>
    </html>
  );
}
