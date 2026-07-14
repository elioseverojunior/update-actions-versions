import { describe, expect, test } from "bun:test";

import { checkCoverage } from "../check-coverage";

describe("checkCoverage", () => {
  test("passes when all metrics are 100%", () => {
    const summary = {
      total: {
        lines: { pct: 100 },
        statements: { pct: 100 },
        functions: { pct: 100 },
        branches: { pct: 100 },
      },
    };
    expect(() => checkCoverage(summary, 100)).not.toThrow();
  });

  test("throws when lines < threshold", () => {
    const summary = {
      total: {
        lines: { pct: 99.5 },
        statements: { pct: 100 },
        functions: { pct: 100 },
        branches: { pct: 100 },
      },
    };
    expect(() => checkCoverage(summary, 100)).toThrow(
      /lines coverage 99\.5% below threshold 100/,
    );
  });

  test("throws when branches < threshold", () => {
    const summary = {
      total: {
        lines: { pct: 100 },
        statements: { pct: 100 },
        functions: { pct: 100 },
        branches: { pct: 99 },
      },
    };
    expect(() => checkCoverage(summary, 100)).toThrow(
      /branches coverage 99% below threshold 100/,
    );
  });
});
