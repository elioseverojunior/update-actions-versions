# Update Action Pins

Update GitHub Action pins to their latest release SHAs within the same major version. Keeps your workflows secure and up-to-date by pinning actions to immutable commit hashes instead of mutable tags.

## Features

- 🔒 **Security-first**: Pins actions to immutable SHA commits
- 📦 **Smart updates**: Only updates within the same major version (no breaking changes)
- 🚀 **Major bump detection**: Reports available major version upgrades without applying them
- ⚡ **Fast**: Parallel API requests with configurable concurrency and caching
- 📝 **Configurable**: JSON/YAML/TOML config with auto-discovery
- 🛡️ **GitHub Action + CLI**: Use in CI pipelines or locally via `npx`
- 🏷️ **Tag comments**: Adds `# vX.Y.Z` comments for readability

## Installation

```bash
# As a CLI tool
npx update-actions-versions

# As a GitHub Action
# Add to .github/workflows/update-pins.yml
```

## Quick Start

### CLI Usage

```bash
# Dry-run (default) - shows what would be updated
npx update-actions-versions

# Apply updates
npx update-actions-versions --write

# Apply major version bumps (use with caution)
npx update-actions-versions --write --apply-major

# Verbose output
npx update-actions-versions -v

# Custom config file
npx update-actions-versions --config my-pins.yaml
```

### GitHub Action Usage

Create `.github/workflows/update-pins.yml`:

```yaml
name: Update Action Pins
on:
  schedule:
    - cron: "0 0 * * 0" # Weekly
  workflow_dispatch: # Manual trigger

jobs:
  update-pins:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4

      - name: Update action pins
        uses: ./action.yml
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          write: true
          # apply-major: true  # Uncomment to auto-apply major bumps

      - name: Create PR if changes
        if: steps.update-pins.outputs.changes > 0
        uses: peter-evans/create-pull-request@v7
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          commit-message: "chore: update action pins"
          title: "chore: update action pins"
          body: |
            Automated update of GitHub Action pins to latest SHAs.

            Changes:
            - ${{ steps.update-pins.outputs.changes }} file(s) updated
            - ${{ steps.update-pins.outputs.major-bumps }} major bump(s) available
```

## Configuration

Create `update-actions-versions.yaml` (or `.json`, `.toml`) in your repo root or `.github/` directory:

```yaml
# update-actions-versions.yaml

# Repositories that only use branch-based refs (no version tags)
# These will be pinned to the latest commit of the specified branch
branch_only_repos:
  "dtolnay/rust-toolchain":
    - "stable"
    - "nightly"

# Override the branch to use for specific repositories
branch_overrides:
  "nightly": "nightly"

# Override the ref (tag/branch) to use for specific repositories
ref_overrides:
  "github/codeql-action": "v3"

# Reusable workflow paths that should be checked
reusable_paths:
  - "slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml"

# Maximum concurrent API requests to GitHub (default: 10)
max_concurrent_api: 10
```

### Configuration Options

| Option               | Type                       | Description                                                                                    |
| -------------------- | -------------------------- | ---------------------------------------------------------------------------------------------- |
| `branch_only_repos`  | `Record<string, string[]>` | Repos that only use branches (e.g., `dtolnay/rust-toolchain`). Pinned to latest branch commit. |
| `branch_overrides`   | `Record<string, string>`   | Override branch name for specific refs.                                                        |
| `ref_overrides`      | `Record<string, string>`   | Force a specific ref (tag/branch) for a repo.                                                  |
| `reusable_paths`     | `string[]`                 | Additional reusable workflow paths to scan.                                                    |
| `max_concurrent_api` | `number`                   | Max parallel GitHub API requests (default: 10).                                                |

## CLI Options

| Option            | Short | Description                                      |
| ----------------- | ----- | ------------------------------------------------ |
| `--write`         | `-w`  | Write changes to workflow files                  |
| `--apply-major`   |       | Apply major version bumps (default: report only) |
| `--config <path>` | `-c`  | Path to config file                              |
| `--verbose`       | `-v`  | Increase verbosity (repeat for debug)            |
| `--quiet`         | `-q`  | Decrease verbosity                               |
| `--print-config`  |       | Print effective config and exit                  |

## Exit Codes

| Code | Meaning                                                |
| ---- | ------------------------------------------------------ |
| `0`  | All pins up-to-date (or changes written successfully)  |
| `1`  | Stale pins found (dry-run), write failed, or API error |

## GitHub Action Inputs

| Input         | Required | Default               | Description                     |
| ------------- | -------- | --------------------- | ------------------------------- |
| `token`       | No       | `${{ github.token }}` | GitHub token for API access     |
| `write`       | No       | `false`               | Write changes to workflow files |
| `apply-major` | No       | `false`               | Apply major version bumps       |
| `config`      | No       |                       | Path to config file             |
| `verbose`     | No       | `false`               | Enable verbose output           |
| `quiet`       | No       | `false`               | Suppress non-error output       |

## GitHub Action Outputs

| Output           | Description                             |
| ---------------- | --------------------------------------- |
| `changes`        | Number of files updated                 |
| `comments-fixed` | Number of tag comments fixed            |
| `major-bumps`    | Number of major version bumps available |
| `errors`         | Number of errors encountered            |

## How It Works

1. **Scan**: Recursively finds all `.yml` files in `.github/workflows/` and `.github/actions/`
2. **Parse**: Extracts `uses:` references (ignores local `./` and Docker `docker://` actions)
3. **Resolve**: For each unique action ref:
   - **Tag ref** (`v4.2.0`): Fetches latest release SHA for same major version
   - **Branch ref** (`main`): Resolves to latest branch commit SHA
   - **SHA ref**: Checks if it matches the latest release
4. **Compare**: Determines if update is needed (within same major version)
5. **Report/Write**: Outputs changes or writes them with `# vX.Y.Z` comment

## Rate Limiting

The tool respects GitHub API rate limits:

- Uses authenticated requests when `GITHUB_TOKEN` or `GH_TOKEN` is set
- Automatically waits and retries when rate limited
- Configurable concurrency via `max_concurrent_api` (default: 10)
- Caches resolved SHAs to minimize API calls

## Examples

### Update pins locally

```bash
cd my-repo
npx update-actions-versions --write -v
```

### Weekly automated updates

```yaml
# .github/workflows/weekly-pins.yml
on:
  schedule:
    - cron: "0 6 * * 1" # Every Monday 6 AM
```

### PR automation

```yaml
# Creates a PR when pins need updating
- uses: peter-evans/create-pull-request@v7
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    branch: update/update-actions-versions
```

## Security

- Only updates within the same major version (prevents breaking changes)
- Pins to immutable SHA commits (prevents supply chain attacks)
- Uses GitHub's official API with proper authentication
- No external dependencies beyond GitHub API

## License

MIT
