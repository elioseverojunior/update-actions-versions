// CLI bootstrap for the coverage gate. Excluded from coverage measurement via
// `coveragePathIgnorePatterns` in bunfig.toml because Bun 1.3 has no per-line
// coverage-ignore directive (the testable logic lives in ../check-coverage.ts
// and is covered there at 100%).
import { checkCoverage } from "../check-coverage";

type Metric = { pct: number };
type Summary = {
  total: {
    lines: Metric;
    statements: Metric;
    functions: Metric;
    branches: Metric;
  };
};

const file = process.argv[2] ?? "coverage/coverage-summary.json";
const threshold = Number(process.argv[3] ?? "100");
const summary: Summary = JSON.parse(await Bun.file(file).text());
try {
  checkCoverage(summary, threshold);
  console.log(`✓ Coverage ≥ ${threshold}%`);
} catch (err) {
  console.error(`✗ ${(err as Error).message}`);
  process.exit(1);
}
