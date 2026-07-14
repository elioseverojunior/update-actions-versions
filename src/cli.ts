import { resolve } from "node:path";

import { Command } from "commander";

import type { GitHubApiClient } from "./api";
import { LiveGitHubApiClient } from "./api";
import { loadConfig } from "./config";
import { RefResolver } from "./resolver";
import { FileRewriter } from "./rewriter";
import { WorkflowScanner } from "./scanner";
import type { ActionRef, PinResult } from "./types";

export interface CliArgs {
  write: boolean;
  applyMajor: boolean;
  verbose: number;
  quiet: number;
  config: string | null;
  inlineConfig: string | null;
  printConfig: boolean;
}

export function createProgram(): Command {
  const program = new Command();
  program
    .name("update-actions-versions")
    .description(
      "Update GitHub Action pins to latest release SHAs within the same major version",
    )
    .version("1.0.0")
    .option("-w, --write", "write changes to workflow files", false)
    .option(
      "-m, --apply-major",
      "apply major version bumps (default: report only)",
      false,
    )
    .option("-v, --verbose", "increase verbosity (repeat for debug)")
    .option("-q, --quiet", "decrease verbosity (errors only)")
    .option("-c, --config <path>", "path to config file (JSON/YAML/TOML)")
    .option(
      "--inline-config <json|yaml>",
      "inline config as JSON or YAML string (merged with file config, takes precedence)",
    )
    .option("--print-config", "print effective config and exit", false)
    .helpOption("-h, --help", "display help for command");
  return program;
}

export function parseArgs(argv: string[]): CliArgs {
  // Remove the first two elements if they are "node" and a script path (e.g., "script.ts")
  const userArgs =
    argv.length >= 2 && argv[0] === "node" && argv[1].endsWith(".ts")
      ? argv.slice(2)
      : argv;

  const program = createProgram();
  program.parse(userArgs, { from: "user" });

  const opts = program.opts<{
    write: boolean;
    applyMajor: boolean;
    verbose: number;
    quiet: number;
    config: string | undefined;
    inlineConfig: string | undefined;
    printConfig: boolean;
  }>();

  return {
    write: opts.write,
    applyMajor: opts.applyMajor,
    verbose: userArgs.filter((arg) => arg === "-v" || arg === "--verbose")
      .length,
    quiet: userArgs.filter((arg) => arg === "-q" || arg === "--quiet").length,
    config: opts.config ?? null,
    inlineConfig: opts.inlineConfig ?? null,
    printConfig: opts.printConfig,
  };
}

function logLevel(verbose: number, quiet: number): number {
  let level = 20;
  level -= verbose * 10;
  level += quiet * 10;
  return Math.max(10, Math.min(40, level));
}

function log(level: number, currentLevel: number, msg: string): void {
  if (level >= currentLevel) {
    const prefix = level >= 40 ? "ERR" : level >= 30 ? "WARN" : "";
    const output = prefix ? `${prefix} ${msg}` : msg;
    if (prefix) {
      process.stderr.write(output + "\n");
    } else {
      process.stdout.write(output + "\n");
    }
  }
}

export class PinResultBuilder {
  private result: PinResult;

  constructor(ref: ActionRef) {
    this.result = {
      ref,
      status: "error",
      newSha: null,
      tag: null,
      message: "",
    };
  }

  uptodate(tag: string): PinResultBuilder {
    this.result.status = "uptodate";
    this.result.tag = tag;
    this.result.message = `already at ${tag}`;
    return this;
  }

  updated(sha: string, tag: string): PinResultBuilder {
    this.result.status = "updated";
    this.result.newSha = sha;
    this.result.tag = tag;
    this.result.message = `${tag} (${sha.slice(0, 12)})`;
    return this;
  }

  majorBump(latestMajor: number, tag: string): PinResultBuilder {
    this.result.status = "major-bump";
    this.result.tag = tag;
    this.result.message = `major bump: v${this.result.ref.major} -> v${latestMajor} (${tag})`;
    return this;
  }

  error(message: string): PinResultBuilder {
    this.result.status = "error";
    this.result.message = message;
    return this;
  }

  build(): PinResult {
    return this.result;
  }
}

export async function run(args: CliArgs): Promise<number> {
  const level = logLevel(args.verbose, args.quiet);
  const root = resolve(".");
  const { config, source } = loadConfig(
    root,
    args.config ?? undefined,
    args.inlineConfig ?? undefined,
  );

  if (source) log(20, level, `config: ${source}`);

  if (args.printConfig) {
    process.stdout.write(JSON.stringify(config, null, 2) + "\n");
    return 0;
  }

  if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
    log(
      30,
      level,
      "no GITHUB_TOKEN / GH_TOKEN set — unauthenticated API is limited to 60 req/hr",
    );
  }

  const scanner = new WorkflowScanner();
  const { refs, fileCount } = await scanner.scan(".");

  if (refs.length === 0) {
    log(20, level, "No external action references found.");
    return 0;
  }

  log(
    10,
    level,
    `checking ${refs.length} reference(s) across ${fileCount} file(s)`,
  );

  const apiClient: GitHubApiClient = new LiveGitHubApiClient({
    maxConcurrent: config.maxConcurrentApi,
  });
  const resolver = new RefResolver(apiClient, config);

  const results = await Promise.all(refs.map((ar) => resolver.resolveRef(ar)));

  let changed = 0;
  let commentsFixed = 0;
  let majorBumps = 0;
  let errors = 0;

  for (const r of results) {
    const display = r.ref.pathSuffix
      ? `${r.ref.repo}/${r.ref.pathSuffix}`
      : r.ref.repo;

    if (r.status === "uptodate") {
      log(20, level, `  OK  ${display.padEnd(50)}  ${r.message}`);
      if (args.write && r.tag) {
        const content = await readFileContent(r.ref.file);
        const lines = content.split("\n");
        const oldLine = lines[r.ref.lineIndex]!;
        const newLine = FileRewriter.applyPin(
          oldLine,
          r.ref.repo,
          r.ref.pathSuffix,
          r.ref.currentRef,
          r.tag,
        );
        if (newLine !== oldLine) {
          lines[r.ref.lineIndex] = newLine;
          await writeFileContent(r.ref.file, lines.join("\n") + "\n");
          commentsFixed++;
          log(
            10,
            level,
            `       -> comment: ${r.ref.file}:${r.ref.lineIndex + 1}`,
          );
        }
      }
    } else if (r.status === "major-bump") {
      majorBumps++;
      const note = args.applyMajor ? "" : " (use --apply-major)";
      log(20, level, ` MAJOR ${display.padEnd(50)}  ${r.message}${note}`);
      if (args.applyMajor && r.newSha) {
        const content = await readFileContent(r.ref.file);
        const lines = content.split("\n");
        lines[r.ref.lineIndex] = FileRewriter.applyPin(
          lines[r.ref.lineIndex]!,
          r.ref.repo,
          r.ref.pathSuffix,
          r.newSha,
          r.tag ?? undefined,
        );
        await writeFileContent(r.ref.file, lines.join("\n") + "\n");
        changed++;
        log(10, level, `       -> ${r.ref.file}:${r.ref.lineIndex + 1}`);
      }
    } else if (r.status === "updated") {
      changed++;
      log(20, level, `  UP  ${display.padEnd(50)}  ${r.message}`);
      if (args.write && r.newSha) {
        const content = await readFileContent(r.ref.file);
        const lines = content.split("\n");
        lines[r.ref.lineIndex] = FileRewriter.applyPin(
          lines[r.ref.lineIndex]!,
          r.ref.repo,
          r.ref.pathSuffix,
          r.newSha,
          r.tag ?? undefined,
        );
        await writeFileContent(r.ref.file, lines.join("\n") + "\n");
        log(10, level, `       -> ${r.ref.file}:${r.ref.lineIndex + 1}`);
      }
    } else if (r.status === "error") {
      errors++;
      log(40, level, ` ERR  ${display.padEnd(50)}  ${r.message}`);
    }
  }

  if (errors) log(40, level, `\n${errors} error(s)`);

  if (!args.write && (changed > 0 || commentsFixed > 0)) {
    log(
      20,
      level,
      `\n${changed} update(s) available. Run with --write to apply.`,
    );
    return 1;
  }

  if (changed > 0) log(20, level, `\n${changed} file(s) updated.`);
  if (commentsFixed > 0) log(20, level, `${commentsFixed} comment(s) fixed.`);

  if (
    changed === 0 &&
    commentsFixed === 0 &&
    majorBumps > 0 &&
    !args.applyMajor
  ) {
    log(
      20,
      level,
      `\n${majorBumps} major-bump(s) available. Review manually or use --apply-major.`,
    );
  }

  return errors > 0 ? 1 : 0;
}

async function readFileContent(file: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  return readFile(file, "utf8");
}

async function writeFileContent(file: string, content: string): Promise<void> {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(file, content, "utf8");
}
