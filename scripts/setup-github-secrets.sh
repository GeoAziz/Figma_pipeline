#!/bin/bash

# Script to set up GitHub secrets for Vercel deployment
# Requires: gh (GitHub CLI) and jq (JSON processor)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_FILE="$SCRIPT_DIR/.vercel/project.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}GitHub Secrets Setup for Vercel Deploy${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if required tools are installed
check_tool() {
  if ! command -v "$1" &> /dev/null; then
    echo -e "${RED}✗ Error: '$1' is not installed${NC}"
    echo "  Install: brew install $1"
    exit 1
  fi
}

check_tool "gh"
check_tool "jq"

# Check if .vercel/project.json exists
if [ ! -f "$PROJECT_FILE" ]; then
  echo -e "${RED}✗ Error: $PROJECT_FILE not found${NC}"
  echo "  Please run: npx vercel pull --yes"
  exit 1
fi

# Extract Vercel secrets from project.json
VERCEL_PROJECT_ID=$(jq -r '.projectId' "$PROJECT_FILE")
VERCEL_ORG_ID=$(jq -r '.orgId' "$PROJECT_FILE")

if [ -z "$VERCEL_PROJECT_ID" ] || [ -z "$VERCEL_ORG_ID" ]; then
  echo -e "${RED}✗ Error: Could not extract IDs from $PROJECT_FILE${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Extracted from .vercel/project.json:${NC}"
echo "  VERCEL_PROJECT_ID: $VERCEL_PROJECT_ID"
echo "  VERCEL_ORG_ID: $VERCEL_ORG_ID"
echo ""

# Get GitHub repo info
REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
echo -e "${BLUE}Setting secrets for repository: $REPO${NC}"
echo ""

# Prompt for VERCEL_TOKEN
echo -e "${YELLOW}Enter your Vercel token (from https://vercel.com/account/tokens):${NC}"
read -rs VERCEL_TOKEN
echo ""

if [ -z "$VERCEL_TOKEN" ]; then
  echo -e "${RED}✗ Error: VERCEL_TOKEN cannot be empty${NC}"
  exit 1
fi

# Set GitHub secrets
echo -e "${BLUE}Setting GitHub secrets...${NC}"

gh secret set VERCEL_TOKEN --body "$VERCEL_TOKEN" || {
  echo -e "${RED}✗ Failed to set VERCEL_TOKEN${NC}"
  exit 1
}
echo -e "${GREEN}✓ VERCEL_TOKEN set${NC}"

gh secret set VERCEL_PROJECT_ID --body "$VERCEL_PROJECT_ID" || {
  echo -e "${RED}✗ Failed to set VERCEL_PROJECT_ID${NC}"
  exit 1
}
echo -e "${GREEN}✓ VERCEL_PROJECT_ID set${NC}"

gh secret set VERCEL_ORG_ID --body "$VERCEL_ORG_ID" || {
  echo -e "${RED}✗ Failed to set VERCEL_ORG_ID${NC}"
  exit 1
}
echo -e "${GREEN}✓ VERCEL_ORG_ID set${NC}"

echo ""
echo -e "${BLUE}Validating secrets...${NC}"
echo ""

# Validate secrets are set
for secret in "VERCEL_TOKEN" "VERCEL_PROJECT_ID" "VERCEL_ORG_ID"; do
  if gh secret list | grep -q "^$secret\$"; then
    echo -e "${GREEN}✓ $secret is set${NC}"
  else
    echo -e "${RED}✗ $secret is NOT set${NC}"
    exit 1
  fi
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}All secrets configured successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Commit .vercel/project.json to your repository"
echo "2. Push to main or develop branch to trigger CI/CD"
echo "3. Check Actions tab to see the deployment workflow"
