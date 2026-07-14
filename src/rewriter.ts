const USES_RE = /(uses:\s*["']?[^"'\s#]+)@([^\s"'#]+)/;
const TRAILING_RE = /\s+#\s*\S.*$/;

export class FileRewriter {
  static buildUsesLine(
    repo: string,
    pathSuffix: string,
    sha: string,
    tag: string | null,
  ): string {
    const prefix = pathSuffix ? `${repo}/${pathSuffix}` : repo;
    const line = `uses: ${prefix}@${sha}`;
    return tag ? `${line}  # ${tag}` : line;
  }

  static applyPin(
    line: string,
    repo: string,
    pathSuffix: string,
    sha: string,
    tag: string | null,
  ): string {
    const bare = line.replace(TRAILING_RE, "").trimEnd();
    const target = FileRewriter.buildUsesLine(repo, pathSuffix, sha, tag);
    const newLine = bare.replace(USES_RE, target);
    return newLine === line ? line : newLine;
  }
}
