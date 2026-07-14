const GH_HEADERS = { Accept: "application/vnd.github+json" };

export interface GitHubApiClient {
  get<T>(url: string): Promise<T>;
}

export interface LiveClientOptions {
  token?: string;
  maxRetries?: number;
  maxConcurrent?: number;
}

export class LiveGitHubApiClient implements GitHubApiClient {
  private readonly token: string;
  private readonly maxRetries: number;
  private readonly maxConcurrent: number;
  private pending: Array<() => void> = [];
  private active = 0;

  constructor(opts: LiveClientOptions = {}) {
    this.token =
      opts.token ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";
    this.maxRetries = opts.maxRetries ?? 3;
    this.maxConcurrent = opts.maxConcurrent ?? 10;
  }

  async get<T>(url: string): Promise<T> {
    await this.acquire();

    try {
      return await this.fetchWithRetry<T>(url);
    } finally {
      this.release();
    }
  }

  private async fetchWithRetry<T>(url: string): Promise<T> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const resp = await fetch(url, {
        headers: {
          ...GH_HEADERS,
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        signal: AbortSignal.timeout(30_000),
      });

      if (resp.status === 200) {
        return (await resp.json()) as T;
      }

      const remaining = resp.headers.get("X-RateLimit-Remaining");
      if (remaining !== null && parseInt(remaining, 10) === 0) {
        const reset = parseInt(
          resp.headers.get("X-RateLimit-Reset") ?? "0",
          10,
        );
        const wait = Math.max(reset * 1000 - Date.now() + 2000, 0);
        if (wait > 0) {
          console.error(
            `Rate limit exhausted, sleeping ${(wait / 1000).toFixed(0)}s...`,
          );
          await this.sleep(wait);
          continue;
        }
      }

      if (
        attempt < this.maxRetries - 1 &&
        (resp.status === 403 || resp.status >= 500)
      ) {
        await this.sleep(2 ** attempt * 1000);
        continue;
      }

      const body = await resp.text().catch(() => "");
      throw Object.assign(
        new Error(`HTTP ${resp.status}: ${body.slice(0, 500)}`),
        { status: resp.status },
      );
    }

    throw new Error(`Max retries exceeded: ${url}`);
  }

  private async acquire(): Promise<void> {
    if (this.active >= this.maxConcurrent) {
      await new Promise<void>((resolve) => {
        this.pending.push(resolve);
      });
    }
    this.active++;
  }

  private release(): void {
    this.active--;
    const next = this.pending.shift();
    if (next) next();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
