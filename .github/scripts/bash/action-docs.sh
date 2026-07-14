#!/usr/bin/env bash

set -euo pipefail

shopt -s nullglob

mapfile -t actions < <(find "$(pwd)" -mindepth 2 -maxdepth 2 -name action.yml)
if (( ${#actions[@]} == 0 )); then
  echo "No actions present; action-docs check is a no-op."
  exit 0
fi
fail=0
for f in "${actions[@]}"; do
  dir="$(dirname "$f")"
  echo "::group::Checking $dir"
  if [[ ! -f "$dir/README.md" ]]; then
    echo "::error file=$f::Missing README.md for $dir. Create it with action-docs markers, then run: npx action-docs --update-readme --source $f"
    fail=1
    echo "::endgroup::"
    continue
  fi
  cp "$dir/README.md" "$dir/README.md.bak"
  if ! npx --yes action-docs@^2 --no-banner --source "$f" --update-readme; then
    echo "::error file=$f::action-docs failed to process $f"
    mv "$dir/README.md.bak" "$dir/README.md"
    fail=1
    echo "::endgroup::"
    continue
  fi
  if ! diff -q "$dir/README.md" "$dir/README.md.bak" >/dev/null; then
    echo "::error file=$dir/README.md::README.md is out of sync with action.yml. Run: npx action-docs --update-readme --source $f"
    diff -u "$dir/README.md.bak" "$dir/README.md" || true
    fail=1
  fi
  mv "$dir/README.md.bak" "$dir/README.md"
  echo "::endgroup::"
done
exit "$fail"
