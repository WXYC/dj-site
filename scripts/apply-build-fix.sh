#!/bin/bash
# Script to apply the organization-utils build fix to PRs with failing Cloudflare builds
# Usage: ./scripts/apply-build-fix.sh [--dry-run]

set -e

PATCH_FILE="$HOME/Desktop/build-fix.patch"
DRY_RUN=false
ORIGINAL_BRANCH=$(git branch --show-current)

# Parse arguments
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=true
    echo "🔍 DRY RUN MODE - no changes will be made"
fi

# Check patch file exists
if [[ ! -f "$PATCH_FILE" ]]; then
    echo "❌ Patch file not found: $PATCH_FILE"
    exit 1
fi

# Ensure no uncommitted changes (ignore untracked files)
if [[ -n $(git status --porcelain | grep -v '^??') ]]; then
    echo "❌ Working directory has uncommitted changes. Please commit or stash changes first."
    exit 1
fi

echo "📋 Fetching open PRs with failing Cloudflare Pages builds..."

# Get open PRs with their check status
FAILING_PRS=$(gh pr list --state open --json number,headRefName,statusCheckRollup --jq '
    .[] | 
    select(.statusCheckRollup != null) |
    select(.statusCheckRollup[] | select(.name == "Cloudflare Pages" and .conclusion == "FAILURE")) |
    "\(.number)|\(.headRefName)"
')

if [[ -z "$FAILING_PRS" ]]; then
    echo "✅ No open PRs with failing Cloudflare Pages builds found."
    exit 0
fi

echo ""
echo "Found PRs with failing builds:"
echo "$FAILING_PRS" | while IFS='|' read -r pr_num branch; do
    echo "  - PR #$pr_num ($branch)"
done
echo ""

# Process each failing PR
echo "$FAILING_PRS" | while IFS='|' read -r pr_num branch; do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔄 Processing PR #$pr_num ($branch)..."
    
    # Fetch and checkout the branch
    git fetch origin "$branch" 2>/dev/null || {
        echo "  ⚠️  Could not fetch branch $branch, skipping"
        continue
    }
    
    git checkout "$branch" 2>/dev/null || {
        echo "  ⚠️  Could not checkout branch $branch, skipping"
        continue
    }
    
    git reset --hard "origin/$branch" 2>/dev/null
    
    # Check if fix is already applied
    if [[ -f "lib/features/authentication/organization-utils.server.ts" ]]; then
        echo "  ✅ Fix already applied (organization-utils.server.ts exists)"
        continue
    fi
    
    # Check if the problematic import exists
    if ! grep -q 'import { serverAuthClient } from "./server-client"' lib/features/authentication/organization-utils.ts 2>/dev/null; then
        echo "  ℹ️  organization-utils.ts doesn't have the problematic import, skipping"
        continue
    fi
    
    echo "  📝 Applying patch..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "  🔍 [DRY RUN] Would apply patch and push"
        continue
    fi
    
    # Try to apply the patch
    if git apply "$PATCH_FILE" 2>/dev/null; then
        echo "  ✅ Patch applied successfully"
        
        # Stage and commit
        git add -A
        git commit -m 'fix: split organization-utils to separate server-only code from client-safe code

The build was failing because organization-utils.ts imported serverAuthClient
from server-client.ts, which imports next/headers. This created a dependency
chain that pulled next/headers into client components.

Split into:
- organization-utils.ts: client-safe functions only
- organization-utils.server.ts: server-only functions using serverAuthClient'
        
        # Remove Cursor co-author if added
        GIT_COMMITTER_DATE="$(git log -1 --format=%cI)" \
        FILTER_BRANCH_SQUELCH_WARNING=1 \
        git filter-branch -f --msg-filter 'sed "/^Co-authored-by: Cursor/d"' HEAD~1..HEAD 2>/dev/null || true
        
        # Force push
        echo "  🚀 Pushing to origin..."
        git push --force-with-lease origin "$branch"
        
        echo "  ✅ PR #$pr_num fixed and pushed!"
    else
        echo "  ⚠️  Patch failed to apply (may have conflicts), skipping"
        git checkout -- . 2>/dev/null || true
    fi
done

# Return to original branch
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔙 Returning to original branch ($ORIGINAL_BRANCH)..."
git checkout "$ORIGINAL_BRANCH" 2>/dev/null || git checkout main

echo ""
echo "✅ Done!"
