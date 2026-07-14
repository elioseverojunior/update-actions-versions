export type RefType = "tag" | "branch" | "sha";

export interface ActionRef {
  file: string;
  lineIndex: number;
  raw: string;
  repo: string;
  pathSuffix: string;
  refType: RefType;
  currentRef: string;
  major: number | null;
}

export interface PinsConfig {
  branchOnlyRepos: Record<string, string[]>;
  branchOverrides: Record<string, string>;
  refOverrides: Record<string, string>;
  reusablePaths: string[];
  maxConcurrentApi: number;
}

export type PinStatus = "uptodate" | "updated" | "major-bump" | "error";

export interface PinResult {
  ref: ActionRef;
  status: PinStatus;
  newSha: string | null;
  tag: string | null;
  message: string;
}

export interface ScanResult {
  refs: ActionRef[];
  fileCount: number;
}
