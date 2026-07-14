import { describe, expect, test } from "bun:test";

describe("parseUsesLine", () => {
  test("parses a simple tag ref: actions/checkout@v4", async () => {
    const { parseUsesLine } = await import("../scanner");
    const result = parseUsesLine(
      "    uses: actions/checkout@v4",
      "test.yml",
      0,
    );
    expect(result).not.toBeNull();
    expect(result!.repo).toBe("actions/checkout");
    expect(result!.pathSuffix).toBe("");
    expect(result!.refType).toBe("tag");
    expect(result!.currentRef).toBe("v4");
    expect(result!.major).toBe(4);
  });

  test("parses a semver tag: actions/checkout@v4.2.0", async () => {
    const { parseUsesLine } = await import("../scanner");
    const result = parseUsesLine(
      "uses: actions/checkout@v4.2.0",
      "test.yml",
      0,
    );
    expect(result).not.toBeNull();
    expect(result!.currentRef).toBe("v4.2.0");
    expect(result!.major).toBe(4);
  });

  test("parses a SHA ref", async () => {
    const { parseUsesLine } = await import("../scanner");
    const sha = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
    const result = parseUsesLine(
      `uses: actions/checkout@${sha}`,
      "test.yml",
      0,
    );
    expect(result).not.toBeNull();
    expect(result!.refType).toBe("sha");
    expect(result!.currentRef).toBe(sha);
    expect(result!.major).toBeNull();
  });

  test("parses a branch ref: actions/checkout@main", async () => {
    const { parseUsesLine } = await import("../scanner");
    const result = parseUsesLine("uses: actions/checkout@main", "test.yml", 0);
    expect(result).not.toBeNull();
    expect(result!.refType).toBe("branch");
    expect(result!.currentRef).toBe("main");
    expect(result!.major).toBeNull();
  });

  test("parses a ref with a reusable workflow path suffix", async () => {
    const { parseUsesLine } = await import("../scanner");
    const result = parseUsesLine(
      "uses: slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@v2.0.0",
      "test.yml",
      0,
    );
    expect(result).not.toBeNull();
    expect(result!.repo).toBe("slsa-framework/slsa-github-generator");
    expect(result!.pathSuffix).toBe(
      ".github/workflows/generator_generic_slsa3.yml",
    );
    expect(result!.refType).toBe("tag");
    expect(result!.major).toBe(2);
  });

  test("returns null for local actions: ./local/action", async () => {
    const { parseUsesLine } = await import("../scanner");
    const result = parseUsesLine("uses: ./local/action", "test.yml", 0);
    expect(result).toBeNull();
  });

  test("returns null for docker actions: docker://image", async () => {
    const { parseUsesLine } = await import("../scanner");
    const result = parseUsesLine("uses: docker://node:18", "test.yml", 0);
    expect(result).toBeNull();
  });

  test("returns null when there's no @ symbol", async () => {
    const { parseUsesLine } = await import("../scanner");
    const result = parseUsesLine("uses: actions/checkout", "test.yml", 0);
    expect(result).toBeNull();
  });

  test("parses a ref with quotes", async () => {
    const { parseUsesLine } = await import("../scanner");
    const result = parseUsesLine('uses: "actions/checkout@v4"', "test.yml", 0);
    expect(result).not.toBeNull();
    expect(result!.repo).toBe("actions/checkout");
    expect(result!.currentRef).toBe("v4");
  });
});

describe("WorkflowScanner", () => {
  test("discovers files from .github/workflows and .github/actions", async () => {
    const { WorkflowScanner } = await import("../scanner");
    const scanner = new WorkflowScanner();
    const result = await scanner.scan("test/fixtures/pins-repo");
    expect(result.fileCount).toBeGreaterThan(0);
    expect(result.refs.length).toBeGreaterThan(0);
  });
});
