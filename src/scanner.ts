import { readFileSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import type { ActionRef, RefType, ScanResult } from "./types";

const USES_RE = /uses:\s*["']?([^"'\s#]+)/;
const SHA_RE = /^[0-9a-f]{40}$/;

export function parseUsesLine(
  line: string,
  file: string,
  lineIndex: number,
): ActionRef | null {
  const m = USES_RE.exec(line);
  if (!m) return null;

  const value = m[1]!;
  if (value.startsWith("./")) return null;
  if (value.startsWith("docker://")) return null;
  if (!value.includes("@")) return null;

  const atIdx = value.lastIndexOf("@");
  const prefix = value.slice(0, atIdx);
  const ref = value.slice(atIdx + 1);

  const parts = prefix.split("/");
  if (parts.length < 2) return null;

  let repo: string;
  let pathSuffix = "";
  if (parts.length === 2) {
    repo = `${parts[0]!}/${parts[1]!}`;
  } else {
    repo = `${parts[0]!}/${parts[1]!}`;
    pathSuffix = parts.slice(2).join("/");
  }

  let refType: RefType;
  let major: number | null = null;

  if (SHA_RE.test(ref)) {
    refType = "sha";
  } else if (
    ref.startsWith("v") &&
    ref
      .slice(1)
      .replace(/\./g, "")
      .split("")
      .every((c) => /\d/.test(c))
  ) {
    refType = "tag";
    const numPart = ref.slice(1);
    major = parseInt(
      numPart.includes(".") ? numPart.split(".")[0]! : numPart,
      10,
    );
  } else {
    refType = "branch";
  }

  return {
    file,
    lineIndex,
    raw: value,
    repo,
    pathSuffix,
    refType,
    currentRef: ref,
    major,
  };
}

export class WorkflowScanner {
  async scan(root: string): Promise<ScanResult> {
    const dirs = [
      join(root, ".github", "workflows"),
      join(root, ".github", "actions"),
    ];

    const files: string[] = [];
    for (const dir of dirs) {
      try {
        await stat(dir);
      } catch {
        continue;
      }
      await this.collectYamlFiles(dir, files);
    }

    const refs: ActionRef[] = [];
    for (const f of files) {
      const content = readFileSync(f, "utf8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const ar = parseUsesLine(lines[i]!, f, i);
        if (ar) refs.push(ar);
      }
    }

    return { refs, fileCount: files.length };
  }

  private async collectYamlFiles(dir: string, acc: string[]): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.collectYamlFiles(full, acc);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml"))
      ) {
        acc.push(full);
      }
    }
  }
}
