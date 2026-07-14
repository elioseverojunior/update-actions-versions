import { describe, expect, test } from "bun:test";

const TEST_SHA = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

describe("FileRewriter", () => {
  test("builds uses line with SHA and tag comment", async () => {
    const { FileRewriter } = await import("../rewriter");
    const line = FileRewriter.buildUsesLine(
      "actions/checkout",
      "",
      TEST_SHA,
      "v4.2.0",
    );
    expect(line).toBe(`uses: actions/checkout@${TEST_SHA}  # v4.2.0`);
  });

  test("builds uses line without tag comment when tag is null", async () => {
    const { FileRewriter } = await import("../rewriter");
    const line = FileRewriter.buildUsesLine(
      "actions/checkout",
      "",
      TEST_SHA,
      null,
    );
    expect(line).toBe(`uses: actions/checkout@${TEST_SHA}`);
  });

  test("builds uses line with path suffix", async () => {
    const { FileRewriter } = await import("../rewriter");
    const line = FileRewriter.buildUsesLine(
      "slsa-framework/slsa-github-generator",
      ".github/workflows/generator_generic_slsa3.yml",
      TEST_SHA,
      "v2.0.0",
    );
    expect(line).toBe(
      `uses: slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@${TEST_SHA}  # v2.0.0`,
    );
  });

  test("replaces SHA on a uses line", async () => {
    const { FileRewriter } = await import("../rewriter");
    const input = "    - uses: actions/checkout@v4";
    const output = FileRewriter.applyPin(
      input,
      "actions/checkout",
      "",
      TEST_SHA,
      "v4.2.0",
    );
    expect(output).toBe(`    - uses: actions/checkout@${TEST_SHA}  # v4.2.0`);
  });

  test("replaces existing SHA with new SHA preserving indent", async () => {
    const { FileRewriter } = await import("../rewriter");
    const input =
      "  - uses: actions/cache@abc123def456abc123def456abc123def456abc1";
    const output = FileRewriter.applyPin(
      input,
      "actions/cache",
      "",
      TEST_SHA,
      "v4.0.0",
    );
    expect(output).toBe(`  - uses: actions/cache@${TEST_SHA}  # v4.0.0`);
  });

  test("replaces existing SHA with tag comment already present", async () => {
    const { FileRewriter } = await import("../rewriter");
    const input = `- uses: actions/checkout@${TEST_SHA}  # v4.0.0`;
    const output = FileRewriter.applyPin(
      input,
      "actions/checkout",
      "",
      TEST_SHA,
      "v4.0.0",
    );
    expect(output).toBe(input);
  });

  test("strips old tag comment before rewriting", async () => {
    const { FileRewriter } = await import("../rewriter");
    const input = `- uses: actions/checkout@abc123def456abc123def456abc123def456abc1  # v3.0.0`;
    const output = FileRewriter.applyPin(
      input,
      "actions/checkout",
      "",
      TEST_SHA,
      "v4.2.0",
    );
    expect(output).toBe(`- uses: actions/checkout@${TEST_SHA}  # v4.2.0`);
  });

  test("handles line with path suffix and existing comment", async () => {
    const { FileRewriter } = await import("../rewriter");
    const input = `uses: slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@abc123  # v1.0.0`;
    const output = FileRewriter.applyPin(
      input,
      "slsa-framework/slsa-github-generator",
      ".github/workflows/generator_generic_slsa3.yml",
      TEST_SHA,
      "v2.0.0",
    );
    expect(output).toBe(
      `uses: slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@${TEST_SHA}  # v2.0.0`,
    );
  });
});
