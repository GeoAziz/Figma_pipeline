#!/bin/bash

# Script to validate GitHub secrets are correctly set for Vercel deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Validating GitHub Secrets for Vercel${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if gh is installed
if ! command -v gh &> /dev/null; then
  echo -e "${RED}✗ Error: 'gh' (GitHub CLI) is not installed${NC}"
  echo "  Install: brew install gh"
  exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
  echo -e "${RED}✗ Error: 'jq' is not installed${NC}"
  echo "  Install: brew install jq"
  exit 1
fi

# Get repository info
REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null || echo "")

if [ -z "$REPO" ]; then
  echo -e "${RED}✗ Error: Not in a GitHub repository${NC}"
  echo "  Please run this script from your GitHub repository root"
  exit 1
fi

echo -e "${BLUE}Repository: $REPO${NC}"
echo ""

# Check required secrets
REQUIRED_SECRETS=("VERCEL_TOKEN" "VERCEL_PROJECT_ID" "VERCEL_ORG_ID")
MISSING_SECRETS=()
FOUND_SECRETS=()

echo -e "${BLUE}Checking GitHub secrets...${NC}"
for secret in "${REQUIRED_SECRETS[@]}"; do
  if gh secret list | grep -q "$secret"; then
    echo -e "${GREEN}✓ $secret is set${NC}"
    FOUND_SECRETS+=("$secret")
  else
    echo -e "${RED}✗ $secret is NOT set${NC}"
    MISSING_SECRETS+=("$secret")
  fi
done

echo ""

# Check .vercel/project.json
if [ -f ".vercel/project.json" ]; then
  echo -e "${GREEN}✓ .vercel/project.json exists${NC}"
  VERCEL_PROJECT_ID=$(jq -r '.projectId' .vercel/project.json)
  VERCEL_ORG_ID=$(jq -r '.orgId' .vercel/project.json)
  echo "  Project ID: $VERCEL_PROJECT_ID"
  echo "  Org ID: $VERCEL_ORG_ID"
else
  echo -e "${YELLOW}⚠ .vercel/project.json not found${NC}"
  echo "  Run: npx vercel pull --yes"
fi

echo ""

# Summary
if [ ${#MISSING_SECRETS[@]} -eq 0 ]; then
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}✓ All secrets are properly configured!${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""
  echo "Your GitHub Actions CI/CD workflow is ready to deploy to Vercel."
  exit 0
else
  echo -e "${RED}========================================${NC}"
  echo -e "${RED}✗ Missing secrets: ${MISSING_SECRETS[@]}${NC}"
  echo -e "${RED}========================================${NC}"
  echo ""
  echo "To set up the missing secrets, run:"
  echo "  ./scripts/setup-github-secrets.sh"
  exit 1
fi
