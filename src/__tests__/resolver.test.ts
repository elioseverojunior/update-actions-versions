import { describe, expect, test } from "bun:test";

import type { GitHubApiClient } from "../api";
import type { ActionRef, PinsConfig } from "../types";

const FAKE_SHA = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

class FakeApiClient implements GitHubApiClient {
  readonly urls: string[] = [];

  async get<T>(url: string): Promise<T> {
    this.urls.push(url);
    if (url.includes("git/ref/tags/v4")) {
      return {
        ref: "refs/tags/v4",
        object: { sha: FAKE_SHA, type: "commit" },
      } as T;
    }
    if (url.includes("git/ref/tags/v3")) {
      return {
        ref: "refs/tags/v3",
        object: { sha: "3333333", type: "commit" },
      } as T;
    }
    if (url.includes("git/ref/heads/main")) {
      return { ref: "refs/heads/main", object: { sha: "mainbranchsha" } } as T;
    }
    if (url.includes("releases/latest")) {
      return { tag_name: "v4.0.0" } as T;
    }
    if (url.includes("releases?per_page=1")) {
      return [{ tag_name: "v4.0.0" }] as T;
    }
    if (url.includes("git/ref/tags/v4.0.0")) {
      return {
        ref: "refs/tags/v4.0.0",
        object: { sha: FAKE_SHA, type: "commit" },
      } as T;
    }
    if (url.includes("git/tags/")) {
      return { object: { sha: "annotatedsha" } } as T;
    }
    throw new Error(`Unexpected URL: ${url}`);
  }
}

const defaultConfig: PinsConfig = {
  branchOnlyRepos: {},
  branchOverrides: {},
  refOverrides: {},
  reusablePaths: [],
  maxConcurrentApi: 10,
};

function makeTagRef(overrides: Partial<ActionRef> = {}): ActionRef {
  return {
    file: "test.yml",
    lineIndex: 0,
    raw: "actions/checkout@v4",
    repo: "actions/checkout",
    pathSuffix: "",
    refType: "tag",
    currentRef: "v4",
    major: 4,
    ...overrides,
  };
}

describe("RefResolver", () => {
  test("resolves a tag ref to its SHA", async () => {
    const { RefResolver } = await import("../resolver");
    const client = new FakeApiClient();
    const resolver = new RefResolver(client, defaultConfig);
    const result = await resolver.resolveRef(makeTagRef());
    expect(result.newSha).toBe(FAKE_SHA);
    expect(result.status).toBe("updated");
    expect(result.tag).toBe("v4.0.0");
  });

  test("returns uptodate when SHA matches", async () => {
    const { RefResolver } = await import("../resolver");
    const client = new FakeApiClient();
    const resolver = new RefResolver(client, defaultConfig);
    const result = await resolver.resolveRef(
      makeTagRef({ refType: "sha", currentRef: FAKE_SHA, major: null }),
    );
    expect(result.status).toBe("uptodate");
  });

  test("resolves a branch ref to latest release SHA", async () => {
    const { RefResolver } = await import("../resolver");
    const client = new FakeApiClient();
    const resolver = new RefResolver(client, defaultConfig);
    const result = await resolver.resolveRef(
      makeTagRef({ refType: "branch", currentRef: "main", major: null }),
    );
    expect(result.newSha).toBe(FAKE_SHA);
    expect(result.status).toBe("updated");
  });

  test("detects major version bump", async () => {
    const { RefResolver } = await import("../resolver");
    const client = new FakeApiClient();
    const resolver = new RefResolver(client, defaultConfig);
    const result = await resolver.resolveRef(
      makeTagRef({ major: 3, currentRef: "v3" }),
    );
    expect(result.status).toBe("major-bump");
    expect(result.message).toContain("major bump");
  });

  test("returns error on API failure", async () => {
    const { RefResolver } = await import("../resolver");
    const _client = new FakeApiClient();
    const failingClient: GitHubApiClient = {
      get: async () => {
        throw new Error("API error");
      },
    };
    const resolver = new RefResolver(failingClient, defaultConfig);
    const result = await resolver.resolveRef(makeTagRef());
    expect(result.status).toBe("error");
    expect(result.message).toContain("API error");
  });

  test("uses refOverrides when configured", async () => {
    const { RefResolver } = await import("../resolver");
    const client = new FakeApiClient();
    const config: PinsConfig = {
      ...defaultConfig,
      refOverrides: { "actions/checkout": "v3" },
    };
    const resolver = new RefResolver(client, config);
    const result = await resolver.resolveRef(makeTagRef());
    expect(result.tag).toBe("v3");
  });

  test("caches resolved SHAs across calls", async () => {
    const { RefResolver } = await import("../resolver");
    const client = new FakeApiClient();
    const resolver = new RefResolver(client, defaultConfig);
    await resolver.resolveRef(makeTagRef());
    const countAfterFirst = client.urls.length;
    await resolver.resolveRef(makeTagRef());
    expect(client.urls.length).toBe(countAfterFirst);
  });

  test("handles repos with annotated tags", async () => {
    const { RefResolver } = await import("../resolver");
    class AnnotatedTagApi extends FakeApiClient {
      override async get<T>(url: string): Promise<T> {
        if (url.includes("git/ref/tags/v4")) {
          return {
            ref: "refs/tags/v4",
            object: { sha: "annotatedobj", type: "tag" },
          } as T;
        }
        return super.get(url);
      }
    }
    const client = new AnnotatedTagApi();
    const resolver = new RefResolver(client, defaultConfig);
    const result = await resolver.resolveRef(makeTagRef());
    expect(result.newSha).toBe("annotatedsha");
  });
});
