#!/usr/bin/env bun
// Derive the repo root from the local tsconfig.json's `extends` path,
// then validate that root-level config files are present.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const localTsconfig = resolve(here, "tsconfig.json");
const { extends: extendsPath } = JSON.parse(
  readFileSync(localTsconfig, "utf8"),
) as { extends: string };
const repoRoot = resolve(here, extendsPath.replace("/tsconfig.base.json", ""));

readFileSync(resolve(repoRoot, "bunfig.toml"), "utf8");
readFileSync(resolve(repoRoot, "tsconfig.base.json"), "utf8");

process.stdout.write("config-sync: OK\n");
