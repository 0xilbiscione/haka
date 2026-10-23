import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  // Tests never hit the network: price data comes from the deterministic fixture.
  test: { include: ["src/**/*.test.ts"], env: { DATA_SOURCE: "fixture" } },
});
