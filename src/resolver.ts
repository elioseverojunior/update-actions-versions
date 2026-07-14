import type { GitHubApiClient } from "./api";
import type { ActionRef, PinResult, PinsConfig } from "./types";

const GH_API = "https://api.github.com";

export class RefResolver {
  private readonly client: GitHubApiClient;
  private readonly config: PinsConfig;
  private readonly shaCache = new Map<string, string>();
  private readonly latestReleaseCache = new Map<string, [string, string]>();

  constructor(client: GitHubApiClient, config: PinsConfig) {
    this.client = client;
    this.config = config;
  }

  async resolveRef(ar: ActionRef): Promise<PinResult> {
    try {
      const [tag, sha] = await this.resolveTarget(ar);
      return this.buildResult(ar, tag, sha);
    } catch (err) {
      return {
        ref: ar,
        status: "error",
        newSha: null,
        tag: null,
        message: (err as Error).message,
      };
    }
  }

  private async resolveTarget(ar: ActionRef): Promise<[string, string]> {
    const repo = ar.repo;

    if (repo in this.config.branchOnlyRepos) {
      const branches = this.config.branchOnlyRepos[repo]!;
      for (const branch of branches) {
        const sha = await this.getBranchSha(repo, branch);
        if (sha === ar.currentRef) return [branch, sha];
      }
      const defaultBranch = branches[0]!;
      const sha = await this.getBranchSha(repo, defaultBranch);
      return [defaultBranch, sha];
    }

    if (repo in this.config.refOverrides) {
      const ref = this.config.refOverrides[repo]!;
      const sha = await this.getTagSha(repo, ref);
      return [ref, sha];
    }

    const [tag, sha] = await this.getLatestRelease(repo);
    return [tag, sha];
  }

  private buildResult(ar: ActionRef, tag: string, sha: string): PinResult {
    if (ar.refType === "branch") {
      if (sha === ar.currentRef) {
        return {
          ref: ar,
          status: "uptodate",
          newSha: null,
          tag,
          message: `already at ${tag}`,
        };
      }
      return {
        ref: ar,
        status: "updated",
        newSha: sha,
        tag,
        message: `${tag} (${sha.slice(0, 12)})`,
      };
    }

    if (sha === ar.currentRef) {
      return {
        ref: ar,
        status: "uptodate",
        newSha: null,
        tag,
        message: `already at ${tag}`,
      };
    }

    if (ar.major !== null) {
      const latestMajor = parseMajor(tag);
      if (latestMajor !== null && latestMajor > ar.major) {
        return {
          ref: ar,
          status: "major-bump",
          newSha: sha,
          tag,
          message: `major bump: v${ar.major} -> v${latestMajor} (${tag})`,
        };
      }
    }

    return {
      ref: ar,
      status: "updated",
      newSha: sha,
      tag,
      message: `${tag} (${sha.slice(0, 12)})`,
    };
  }

  private async getTagSha(repo: string, tag: string): Promise<string> {
    const key = `${repo}@tag:${tag}`;
    const cached = this.shaCache.get(key);
    if (cached) return cached;

    const refData = await this.client.get<{
      object: { sha: string; type: string };
    }>(`${GH_API}/repos/${repo}/git/ref/tags/${tag}`);
    const obj = refData.object;
    if (obj.type === "commit") {
      this.shaCache.set(key, obj.sha);
      return obj.sha;
    }

    const tagData = await this.client.get<{ object: { sha: string } }>(
      `${GH_API}/repos/${repo}/git/tags/${obj.sha}`,
    );
    this.shaCache.set(key, tagData.object.sha);
    return tagData.object.sha;
  }

  private async getBranchSha(repo: string, branch: string): Promise<string> {
    const key = `${repo}@branch:${branch}`;
    const cached = this.shaCache.get(key);
    if (cached) return cached;

    const refData = await this.client.get<{ object: { sha: string } }>(
      `${GH_API}/repos/${repo}/git/ref/heads/${branch}`,
    );
    this.shaCache.set(key, refData.object.sha);
    return refData.object.sha;
  }

  private async getLatestRelease(repo: string): Promise<[string, string]> {
    const cached = this.latestReleaseCache.get(repo);
    if (cached) return cached;

    try {
      const release = await this.client.get<{ tag_name: string }>(
        `${GH_API}/repos/${repo}/releases/latest`,
      );
      const tag = release.tag_name;
      const sha = await this.getTagSha(repo, tag);
      this.latestReleaseCache.set(repo, [tag, sha]);
      return [tag, sha];
    } catch {
      const releases = await this.client.get<Array<{ tag_name: string }>>(
        `${GH_API}/repos/${repo}/releases?per_page=1`,
      );
      if (!releases || releases.length === 0) {
        throw new Error("No releases found");
      }
      const tag = releases[0]!.tag_name;
      const sha = await this.getTagSha(repo, tag);
      this.latestReleaseCache.set(repo, [tag, sha]);
      return [tag, sha];
    }
  }
}

function parseMajor(tag: string): number | null {
  const m = /^v?(\d+)/.exec(tag);
  return m ? parseInt(m[1]!, 10) : null;
}
