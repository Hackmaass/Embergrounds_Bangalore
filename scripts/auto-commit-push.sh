#!/usr/bin/env bash
#
# Automated Git Commit & Push script that runs on a recurring interval.
# Default interval: 15 minutes (900 seconds).
#

set -u

INTERVAL_MINUTES=${1:-15}
REMOTE=${2:-origin}
BRANCH=${3:-}
PREFIX=${4:-"Auto-commit"}

SLEEP_SECONDS=$((INTERVAL_MINUTES * 60))

# Find git repo root
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$REPO_ROOT" ]; then
  echo "Error: Not inside a git repository."
  exit 1
fi

cd "$REPO_ROOT" || exit 1

if [ -z "$BRANCH" ]; then
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
fi

echo "=========================================================="
echo "   GIT AUTO-COMMIT & PUSH WATCHER"
echo "   Repository : $REPO_ROOT"
echo "   Remote     : $REMOTE"
echo "   Branch     : $BRANCH"
echo "   Interval   : $INTERVAL_MINUTES minutes ($SLEEP_SECONDS seconds)"
echo "   Press Ctrl+C at any time to stop"
echo "=========================================================="
echo ""

while true; do
  NOW=$(date +"%Y-%m-%d %H:%M:%S")
  
  if [ -z "$(git status --porcelain)" ]; then
    echo "[$NOW] Working tree clean. No changes detected."
  else
    CHANGED_COUNT=$(git status --porcelain | wc -l | tr -d ' ')
    echo "[$NOW] Changes detected ($CHANGED_COUNT item(s)). Staging changes..."
    
    git add -A
    COMMIT_MSG="$PREFIX: $NOW ($CHANGED_COUNT file(s) updated)"
    
    if git commit -m "$COMMIT_MSG"; then
      echo "[$NOW] Committed: $COMMIT_MSG"
      echo "[$NOW] Pushing to $REMOTE/$BRANCH..."
      if git push "$REMOTE" "$BRANCH"; then
        echo "[$NOW] Push succeeded!"
      else
        echo "[$NOW] [WARNING] Push failed. Will retry next cycle."
      fi
    else
      echo "[$NOW] [WARNING] Commit failed or nothing new to commit."
    fi
  fi

  echo "Sleeping for $INTERVAL_MINUTES minutes... (Next check at $(date -d "+$SLEEP_SECONDS seconds" +"%H:%M:%S" 2>/dev/null || echo "in $INTERVAL_MINUTES min"))"
  echo ""
  sleep "$SLEEP_SECONDS"
done
