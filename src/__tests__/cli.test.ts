import { describe, expect, test } from "bun:test";

describe("CliArgs", () => {
  test("parses default args", async () => {
    const { parseArgs } = await import("../cli");
    const args = parseArgs(["node", "script.ts"]);
    expect(args.write).toBe(false);
    expect(args.applyMajor).toBe(false);
    expect(args.verbose).toBe(0);
    expect(args.quiet).toBe(0);
    expect(args.config).toBeNull();
    expect(args.printConfig).toBe(false);
  });

  test("parses --write flag", async () => {
    const { parseArgs } = await import("../cli");
    const args = parseArgs(["node", "script.ts", "--write"]);
    expect(args.write).toBe(true);
  });

  test("parses --apply-major flag", async () => {
    const { parseArgs } = await import("../cli");
    const args = parseArgs(["node", "script.ts", "--apply-major"]);
    expect(args.applyMajor).toBe(true);
  });

  test("parses --verbose flag", async () => {
    const { parseArgs } = await import("../cli");
    const args = parseArgs(["node", "script.ts", "-v"]);
    expect(args.verbose).toBe(1);
  });

  test("parses --quiet flag", async () => {
    const { parseArgs } = await import("../cli");
    const args = parseArgs(["node", "script.ts", "-q"]);
    expect(args.quiet).toBe(1);
  });

  test("parses --config path", async () => {
    const { parseArgs } = await import("../cli");
    const args = parseArgs(["node", "script.ts", "--config", "my-pins.toml"]);
    expect(args.config).toBe("my-pins.toml");
  });

  test("parses --print-config flag", async () => {
    const { parseArgs } = await import("../cli");
    const args = parseArgs(["node", "script.ts", "--print-config"]);
    expect(args.printConfig).toBe(true);
  });

  test("handles -v -v for debug", async () => {
    const { parseArgs } = await import("../cli");
    const args = parseArgs(["node", "script.ts", "-v", "-v"]);
    expect(args.verbose).toBe(2);
  });
});

describe("PinResultBuilder", () => {
  test("builds an uptodate result", async () => {
    const { PinResultBuilder } = await import("../cli");
    const ref = {
      file: "test.yml",
      lineIndex: 0,
      raw: "actions/checkout@v4",
      repo: "actions/checkout",
      pathSuffix: "",
      refType: "tag" as const,
      currentRef: "v4",
      major: 4,
    };
    const result = new PinResultBuilder(ref).uptodate("v4.0.0").build();
    expect(result.status).toBe("uptodate");
    expect(result.tag).toBe("v4.0.0");
    expect(result.message).toContain("v4.0.0");
  });

  test("builds an updated result with SHA", async () => {
    const { PinResultBuilder } = await import("../cli");
    const ref = {
      file: "test.yml",
      lineIndex: 0,
      raw: "actions/checkout@v4",
      repo: "actions/checkout",
      pathSuffix: "",
      refType: "tag" as const,
      currentRef: "v4",
      major: 4,
    };
    const sha = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
    const result = new PinResultBuilder(ref).updated(sha, "v4.2.0").build();
    expect(result.status).toBe("updated");
    expect(result.newSha).toBe(sha);
    expect(result.tag).toBe("v4.2.0");
  });

  test("builds a major-bump result", async () => {
    const { PinResultBuilder } = await import("../cli");
    const ref = {
      file: "test.yml",
      lineIndex: 0,
      raw: "actions/checkout@v3",
      repo: "actions/checkout",
      pathSuffix: "",
      refType: "tag" as const,
      currentRef: "v3",
      major: 3,
    };
    const result = new PinResultBuilder(ref).majorBump(4, "v4.0.0").build();
    expect(result.status).toBe("major-bump");
    expect(result.message).toContain("4");
  });

  test("builds an error result", async () => {
    const { PinResultBuilder } = await import("../cli");
    const ref = {
      file: "test.yml",
      lineIndex: 0,
      raw: "actions/checkout@v4",
      repo: "actions/checkout",
      pathSuffix: "",
      refType: "tag" as const,
      currentRef: "v4",
      major: 4,
    };
    const result = new PinResultBuilder(ref).error("Network error").build();
    expect(result.status).toBe("error");
    expect(result.message).toBe("Network error");
  });
});
