#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/publish-site.sh [--dry-run]

Publishes the current non-main branch to origin/main for GitHub Pages.

Safety checks:
- refuses to run from main
- refuses to publish if there are uncommitted code changes
- ignores local runtime data files used by the sync server
- refuses a non-fast-forward publish

Use --dry-run to preview the pushes without updating GitHub.
EOF
}

dry_run=0
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--dry-run" ]]; then
  dry_run=1
elif [[ $# -gt 0 ]]; then
  echo "Unknown argument: $1" >&2
  usage >&2
  exit 1
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

source_branch="$(git branch --show-current)"
target_branch="main"

if [[ -z "$source_branch" ]]; then
  echo "Could not determine the current branch." >&2
  exit 1
fi

if [[ "$source_branch" == "$target_branch" ]]; then
  echo "Refusing to publish from main. Switch to your development branch first." >&2
  exit 1
fi

dirty_output="$(git status --porcelain --untracked-files=all -- . ':(exclude)data/compositions.json' ':(exclude)data/compositions.local.json')"
if [[ -n "$dirty_output" ]]; then
  echo "Uncommitted changes detected. Commit or stash them before publishing:" >&2
  printf '%s\n' "$dirty_output" >&2
  exit 1
fi

push_args=()
if [[ "$dry_run" -eq 1 ]]; then
  push_args+=(--dry-run)
fi

echo "Fetching latest remote refs..."
git fetch origin "$source_branch" "$target_branch"

if ! git merge-base --is-ancestor "origin/$target_branch" "$source_branch"; then
  echo "origin/$target_branch is not an ancestor of $source_branch." >&2
  echo "Merge or rebase $target_branch into $source_branch before publishing." >&2
  exit 1
fi

echo "Pushing $source_branch to origin/$source_branch..."
if [[ "${#push_args[@]}" -gt 0 ]]; then
  git push "${push_args[@]}" origin "$source_branch"
else
  git push origin "$source_branch"
fi

echo "Publishing $source_branch to origin/$target_branch..."
if [[ "${#push_args[@]}" -gt 0 ]]; then
  git push "${push_args[@]}" origin "$source_branch:$target_branch"
else
  git push origin "$source_branch:$target_branch"
fi

if [[ "$dry_run" -eq 1 ]]; then
  echo "Dry run complete. No changes were pushed."
else
  echo "Publish complete. GitHub Pages will rebuild from origin/$target_branch shortly."
fi
