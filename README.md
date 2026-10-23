# Haka — IDX Technical Screener

**Live:** https://haka-id.vercel.app

A free, mobile-first technical stock screener for the **Indonesia Stock Exchange (IDX / BEI)**, with a fluid-glass UI.
The interface is in Bahasa Indonesia, with an English toggle.

- **Full universe:** every listed IDX stock (~900), loaded live from TradingView's public scanner. If that fails, a bundled list is used.
- **Free data:** daily OHLCV from Yahoo Finance (`XXXX.JK`), fetched by Next.js API routes, so there are no CORS problems and no API keys.
- **Indicators:** SMA 5/10/20/50/100/200, EMA 9/21/50, RSI(14), MACD(12,26,9), Stochastic(14,3,3), ADX/DMI(14), Bollinger(20,2) with %B, width and squeeze, ATR, volume ratio, 52-week high/low, returns, and RSI divergence.
- **Candlestick patterns:** hammer, inverted hammer, shooting star, hanging man, doji, engulfing, piercing, dark cloud, morning/evening star.
- **25 built-in screens:** trend, momentum, volume/breakout, and candlestick. Each shows a live match count.
- **Screen builder:** combine indicator comparisons (`>`, `<`, crosses above/below a value or another indicator) and signals with AND/OR. Screens are saved on the device.
- **Interactive chart:** TradingView Lightweight Charts, with MA/EMA/Bollinger overlays, pattern markers, and RSI / MACD / Stochastic panes.
- **Watchlist,** sector, price, and liquidity filters, plus a column chooser on desktop.
- **IDX rules:** tick sizes, ARA/ARB limits (edit them in `src/lib/idx.ts` when IDX changes them), the lot size, and live session status in WIB.
- Installable as a PWA, with dark, light, and system themes.

## Run locally

```bash
npm install
npm run dev          # live data (needs internet access to Yahoo + TradingView)
npm run dev:demo     # offline demo with synthetic prices (DATA_SOURCE=fixture)
```

Open http://localhost:3000 and tap **Pindai pasar** (Scan market).
A full scan fetches about 900 symbols in parallel batches of 40 and finishes in roughly 10–30 seconds.
The results are cached in the browser, so switching screens afterwards is instant.

## Deploy (free)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2F0xilbiscione%2Fhaka&project-name=haka)

Or go to [vercel.com/new](https://vercel.com/new), import `0xilbiscione/haka`, and click **Deploy**.
No environment variables are needed.
`vercel.json` pins the API routes to the Singapore region (`sin1`), the closest one to IDX.
To deploy the offline demo instead, set `DATA_SOURCE=fixture`.

## SEO & share previews

- **Metadata:** each page has its own title, description and canonical URL, written in Indonesian and English. Open Graph and Twitter tags are included.
- **Structured data:** JSON-LD for `WebSite` / `WebApplication`, plus a breadcrumb and a `Corporation` with its IDX ticker on each stock page.
- **`/sitemap.xml`:** lists every IDX stock page and refreshes daily. **`/robots.txt`** blocks `/api/`, and the personal pages (watchlist, settings) are `noindex`.
- **Share images:** there's a branded site-wide image, and each `/stock/XXXX` page gets its own image showing price, % change, a 1-year sparkline, RSI, volume ratio and active signals. Stock images are cached for 1 hour. The Inter font is bundled in `assets/fonts`.
- **Canonical domain:** `https://haka-id.vercel.app` (`PRODUCTION_URL` in `src/lib/site.ts`). Preview deployments point there too. To use a custom domain, set `NEXT_PUBLIC_SITE_URL` (e.g. `https://haka.id`).
- **Testing a preview:** paste https://haka-id.vercel.app/stock/BBCA into https://www.opengraph.xyz, or open https://haka-id.vercel.app/stock/BBCA/opengraph-image directly.

## Use Haka from Claude (MCP)

Haka includes a public, read-only [MCP](https://modelcontextprotocol.io) server at **`https://haka-id.vercel.app/api/mcp`** (Streamable HTTP, no auth).

- **claude.ai** (web, desktop, mobile): Settings → Connectors → *Add custom connector*, then paste the URL.
- **Claude Code:** `claude mcp add --transport http haka https://haka-id.vercel.app/api/mcp`
- **Other clients:** point them at the URL. For stdio-only clients, use `npx mcp-remote https://haka-id.vercel.app/api/mcp`.

| Tool | What it does |
| --- | --- |
| `screen_stocks` | Run a preset or custom conditions across all IDX stocks, with liquidity, price, sector and code filters, sorting and a limit |
| `analyze_stocks` | Full indicator snapshot for 1–10 codes: signals, 52-week range, ARA/ARB/tick |
| `get_price_history` | Daily OHLCV with optional indicator columns (up to 1,250 bars) |
| `search_tickers` | Find stocks by code or company name, optionally within a sector |
| `list_screens` | Presets, fields, signals, operators and sectors accepted by `screen_stocks` |
| `market_status` | IDX session phase (WIB), data source and scan cache age |

The first market-wide scan takes roughly 15–40 seconds. After that, results are cached on the instance for 10 minutes during market hours and 60 minutes otherwise.
The endpoint is limited to 60 requests per minute per IP. The code is in `src/app/api/mcp/route.ts`, `src/lib/server/mcp-tools.ts` and `src/lib/server/market.ts`.
To try it offline, run `npm run dev:demo` and connect to `http://localhost:3000/api/mcp`.

## Checks

```bash
npm test           # unit tests: indicators, patterns, rule engine, IDX rules, Yahoo parsing
npm run lint
npm run typecheck
npm run build
npm run update-tickers   # refresh the bundled fallback list (src/data/tickers.json)
```

## Project layout

| Path | What |
| --- | --- |
| `src/lib/indicators/` | Indicator maths (pure TS, unit tested) |
| `src/lib/patterns.ts` | Candlestick pattern detection |
| `src/lib/snapshot.ts` | Builds each stock's screenable snapshot and signal flags |
| `src/lib/rules.ts`, `src/lib/presets.ts` | Screen engine and built-in screens |
| `src/lib/idx.ts` | IDX tick, ARA/ARB, session hours, Rupiah formatting |
| `src/lib/server/` | Yahoo fetcher, TradingView universe, demo fixture data |
| `src/app/api/` | `scan`, `history`, `universe` route handlers |
| `src/components/` | UI (glass components, screener, chart, builder) |
| `src/i18n/dict.ts` | Indonesian and English text |

## Caveats

Yahoo Finance and the TradingView scanner are free but **unofficial** sources. Their data can be delayed by about 10–15 minutes, can have gaps, and can be rate-limited.
Prices are not split-checked against IDX.
This tool is for education and screening only. **It is not investment advice.**
