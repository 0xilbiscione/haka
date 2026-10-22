import { describe, expect, it } from "vitest";
import { araPrice, arbPrice, fmtCompact, marketPhase, tickSize } from "./idx";

describe("tickSize", () => {
  it("follows the IDX price fractions", () => {
    expect(tickSize(50)).toBe(1);
    expect(tickSize(199)).toBe(1);
    expect(tickSize(200)).toBe(2);
    expect(tickSize(499)).toBe(2);
    expect(tickSize(500)).toBe(5);
    expect(tickSize(1995)).toBe(5);
    expect(tickSize(2000)).toBe(10);
    expect(tickSize(4990)).toBe(10);
    expect(tickSize(5000)).toBe(25);
  });
});

describe("auto rejection", () => {
  it("rounds ARA down to a valid tick", () => {
    expect(araPrice(100)).toBe(135); // 35%
    expect(araPrice(1000)).toBe(1250); // 25%
    expect(araPrice(1010)).toBe(1260); // 1262.5 → tick 5
    expect(araPrice(9000)).toBe(10800); // 20%
  });
  it("rounds ARB up to a valid tick and never below Rp50", () => {
    expect(arbPrice(1000)).toBe(850);
    expect(arbPrice(1010)).toBe(860); // 858.5 → tick 5
    expect(arbPrice(55)).toBe(50);
  });
});

describe("marketPhase", () => {
  const wib = (iso: string) => new Date(`${iso}+07:00`);
  it("knows the regular sessions", () => {
    expect(marketPhase(wib("2026-10-21T08:50:00"))).toBe("pre"); // Wednesday
    expect(marketPhase(wib("2026-10-21T10:00:00"))).toBe("session1");
    expect(marketPhase(wib("2026-10-21T12:30:00"))).toBe("break");
    expect(marketPhase(wib("2026-10-21T14:00:00"))).toBe("session2");
    expect(marketPhase(wib("2026-10-21T15:55:00"))).toBe("preclose");
    expect(marketPhase(wib("2026-10-21T17:00:00"))).toBe("closed");
  });
  it("uses the longer Friday break", () => {
    expect(marketPhase(wib("2026-10-23T11:45:00"))).toBe("break");
    expect(marketPhase(wib("2026-10-23T13:45:00"))).toBe("break");
    expect(marketPhase(wib("2026-10-23T14:05:00"))).toBe("session2");
  });
  it("is closed on weekends", () => {
    expect(marketPhase(wib("2026-10-24T10:00:00"))).toBe("closed");
  });
});

describe("fmtCompact", () => {
  it("uses Indonesian units", () => {
    expect(fmtCompact(1_500_000_000, "id")).toBe("1,5 M");
    expect(fmtCompact(2_000_000_000_000, "id")).toBe("2 T");
    expect(fmtCompact(1_500_000_000, "en")).toBe("1.5B");
  });
});
