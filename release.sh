#!/usr/bin/env bash
set -euo pipefail

# Release helper for inat-widget:
# 1) commit local changes (if any)
# 2) push to origin/main
# 3) purge jsDelivr cache for main + current commit SHA

REPO_OWNER="${REPO_OWNER:-andreaadelfio}"
REPO_NAME="${REPO_NAME:-inat-widget}"
DEFAULT_BRANCH="${DEFAULT_BRANCH:-main}"

usage(){
  cat <<'EOF'
Usage: ./release.sh [-m "commit message"]

Options:
  -m, --message   Custom commit message.
  -h, --help      Show this help.
EOF
}

COMMIT_MESSAGE=""
while (($#)); do
  case "$1" in
    -m|--message)
      shift
      COMMIT_MESSAGE="${1:-}"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: release.sh must run inside a git repository." >&2
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "$DEFAULT_BRANCH" ]]; then
  echo "Error: current branch is '$CURRENT_BRANCH'. Switch to '$DEFAULT_BRANCH' before releasing." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  if [[ -z "$COMMIT_MESSAGE" ]]; then
    COMMIT_MESSAGE="release: $(date +'%Y-%m-%d %H:%M:%S %Z')"
  fi
  git commit -m "$COMMIT_MESSAGE"
else
  echo "Working tree clean: skipping commit."
fi

echo "Pushing to origin/$DEFAULT_BRANCH..."
git push origin "$DEFAULT_BRANCH"

COMMIT_SHA="$(git rev-parse HEAD)"

if ! command -v curl >/dev/null 2>&1; then
  echo "Warning: curl not found; skipping jsDelivr purge."
  exit 0
fi

PURGE_URLS=(
  "https://purge.jsdelivr.net/gh/${REPO_OWNER}/${REPO_NAME}@${DEFAULT_BRANCH}/inat-widget-custom.js"
  "https://purge.jsdelivr.net/gh/${REPO_OWNER}/${REPO_NAME}@${DEFAULT_BRANCH}/inat-widget-custom.css"
  "https://purge.jsdelivr.net/gh/${REPO_OWNER}/${REPO_NAME}@${COMMIT_SHA}/inat-widget-custom.js"
  "https://purge.jsdelivr.net/gh/${REPO_OWNER}/${REPO_NAME}@${COMMIT_SHA}/inat-widget-custom.css"
)

FAILED=0
for URL in "${PURGE_URLS[@]}"; do
  echo "Purging: $URL"
  if ! curl -fsS "$URL" >/dev/null; then
    echo "Warning: purge failed for $URL" >&2
    FAILED=1
  fi
done

echo "Release done on commit $COMMIT_SHA"
if [[ "$FAILED" -ne 0 ]]; then
  echo "Done with purge warnings." >&2
fi
