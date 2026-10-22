// Regenerates src/data/tickers.json (the offline fallback universe) from
// TradingView's public scanner. Run: npm run update-tickers
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchTradingViewUniverse } from "../src/lib/server/universe";

async function main() {
  const tickers = await fetchTradingViewUniverse();
  if (tickers.length < 300) throw new Error(`Only ${tickers.length} tickers returned; refusing to overwrite`);
  const out = path.join(__dirname, "..", "src", "data", "tickers.json");
  await writeFile(out, JSON.stringify(tickers, null, 0).replace(/},{/g, "},\n{") + "\n");
  console.log(`Wrote ${tickers.length} tickers to ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
