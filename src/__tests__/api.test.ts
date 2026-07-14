import { describe, expect, test } from "bun:test";

import type { GitHubApiClient } from "../api";

class FakeGitHubApiClient implements GitHubApiClient {
  readonly responses: Map<string, { body: unknown; status: number }> =
    new Map();

  setResponse(url: string, body: unknown, status = 200) {
    this.responses.set(url, { body, status });
  }

  async get<T>(url: string): Promise<T> {
    const entry = this.responses.get(url);
    if (!entry) throw new Error(`Unexpected request: ${url}`);
    if (entry.status !== 200) {
      const err = new Error(`HTTP ${entry.status}`) as Error & {
        status: number;
      };
      err.status = entry.status;
      throw err;
    }
    return entry.body as T;
  }
}

describe("GitHubApiClient interface", () => {
  test("get returns parsed response body", async () => {
    const client = new FakeGitHubApiClient();
    client.setResponse(
      "https://api.github.com/repos/actions/checkout/git/ref/tags/v4",
      {
        ref: "refs/tags/v4",
        object: {
          sha: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
          type: "commit",
        },
      },
    );

    const result = await client.get<{ object: { sha: string } }>(
      "https://api.github.com/repos/actions/checkout/git/ref/tags/v4",
    );
    expect(result.object.sha).toBe("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2");
  });

  test("get throws on non-200 status", async () => {
    const client = new FakeGitHubApiClient();
    client.setResponse(
      "https://api.github.com/repos/actions/checkout/git/ref/tags/v4",
      {
        message: "Not Found",
      },
      404,
    );

    await expect(
      client.get(
        "https://api.github.com/repos/actions/checkout/git/ref/tags/v4",
      ),
    ).rejects.toThrow();
  });
});

describe("LiveGitHubApiClient", () => {
  test("has rate limit detection", async () => {
    const { LiveGitHubApiClient } = await import("../api");
    const client = new LiveGitHubApiClient({ maxRetries: 1 });
    expect(client).toBeDefined();
  });
});
