import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse as parseToml } from "@iarna/toml";
import { parse as parseYaml } from "yaml";

import type { PinsConfig } from "./types";

const CONFIG_DIRS = [".github", "."];
const CONFIG_FILES = [
  "update-actions-versions.yaml",
  "update-actions-versions.yml",
  "update-actions-versions.json",
  "update-actions-versions.toml",
];

function tryLoadJson(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function tryLoadYaml(path: string): Record<string, unknown> | null {
  try {
    return parseYaml(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function tryLoadToml(path: string): Record<string, unknown> | null {
  try {
    return parseToml(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const LOADERS: Record<
  string,
  (path: string) => Record<string, unknown> | null
> = {
  ".yaml": tryLoadYaml,
  ".yml": tryLoadYaml,
  ".json": tryLoadJson,
  ".toml": tryLoadToml,
};

function findConfigFile(root: string): string | null {
  for (const dir of CONFIG_DIRS) {
    for (const name of CONFIG_FILES) {
      const p = resolve(root, dir, name);
      try {
        readFileSync(p, "utf8");
        return p;
      } catch {
        continue;
      }
    }
  }
  return null;
}

function fromRaw(raw: Record<string, unknown>): Partial<PinsConfig> {
  const cfg: Partial<PinsConfig> = {};
  if (raw.branchOnlyRepos)
    cfg.branchOnlyRepos = raw.branchOnlyRepos as Record<string, string[]>;
  if (raw.branchOverrides)
    cfg.branchOverrides = raw.branchOverrides as Record<string, string>;
  if (raw.refOverrides)
    cfg.refOverrides = raw.refOverrides as Record<string, string>;
  if (raw.reusablePaths) cfg.reusablePaths = raw.reusablePaths as string[];
  if (raw.maxConcurrentApi != null)
    cfg.maxConcurrentApi = raw.maxConcurrentApi as number;
  return cfg;
}

function getExt(p: string): string {
  const i = p.lastIndexOf(".");
  return i >= 0 ? p.slice(i) : "";
}

function parseInlineConfig(inline: string): Partial<PinsConfig> | null {
  const trimmed = inline.trim();
  if (!trimmed) return null;
  try {
    return fromRaw(JSON.parse(trimmed));
  } catch {
    let yamlResult: Record<string, unknown> | string;
    try {
      yamlResult = parseYaml(trimmed) as Record<string, unknown> | string;
    } catch {
      // YAML parsing threw an error, try TOML
      try {
        return fromRaw(parseToml(trimmed) as Record<string, unknown>);
      } catch {
        return null;
      }
    }
    // If YAML returned an object, use it
    if (
      typeof yamlResult === "object" &&
      yamlResult !== null &&
      !Array.isArray(yamlResult)
    ) {
      return fromRaw(yamlResult as Record<string, unknown>);
    }
    // YAML returned a string (likely TOML), try parsing as TOML
    try {
      return fromRaw(parseToml(trimmed) as Record<string, unknown>);
    } catch {
      return null;
    }
  }
}

export interface LoadedConfig {
  config: PinsConfig;
  source: string;
}

export function loadConfig(
  root: string,
  pathHint?: string,
  inlineConfig?: string,
): LoadedConfig {
  let raw: Partial<PinsConfig> = {};
  let source: string | null = null;

  // 1. Auto-discover config file (always run unless pathHint is provided)
  if (!pathHint) {
    const found = findConfigFile(root);
    if (found) {
      const loader = LOADERS[getExt(found)];
      if (loader) {
        const overrides = loader(found);
        if (overrides) {
          raw = fromRaw(overrides);
          source = found;
        }
      }
    }
  }

  // 2. If no auto-discovered config, check pathHint
  if (!source && pathHint) {
    const p = resolve(root, pathHint);
    const loader = LOADERS[getExt(p)];
    if (loader) {
      const overrides = loader(p);
      if (overrides) {
        raw = fromRaw(overrides);
        source = p;
      }
    }
  }

  // 3. Apply inline config (takes precedence, merges with file config)
  if (inlineConfig) {
    const inlineOverrides = parseInlineConfig(inlineConfig);
    if (inlineOverrides) {
      raw = { ...raw, ...inlineOverrides };
      source = (source ? `${source}, ` : "") + "inline";
    }
  }

  // Validate that we have at least some config
  if (!source) {
    throw new Error(
      "No configuration found. Provide a config file (update-actions-versions.yaml/yml/json/toml), " +
        "use --config/--inline-config, or set inline-config in the GitHub Action.",
    );
  }

  // Validate required fields
  const required: (keyof PinsConfig)[] = [
    "branchOnlyRepos",
    "branchOverrides",
    "refOverrides",
    "reusablePaths",
    "maxConcurrentApi",
  ];

  for (const key of required) {
    if (raw[key] === undefined) {
      throw new Error(`Missing required config field: ${key}`);
    }
  }

  return { config: raw as PinsConfig, source };
}
