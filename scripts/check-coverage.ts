type Metric = { pct: number };
type Summary = {
  total: {
    lines: Metric;
    statements: Metric;
    functions: Metric;
    branches: Metric;
  };
};

export function checkCoverage(summary: Summary, threshold: number): void {
  const metrics: (keyof Summary["total"])[] = [
    "lines",
    "statements",
    "functions",
    "branches",
  ];
  for (const m of metrics) {
    const pct = summary.total[m].pct;
    if (pct < threshold) {
      throw new Error(`${m} coverage ${pct}% below threshold ${threshold}%`);
    }
  }
}
