#!/bin/bash

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Checking Environment Variables ===${NC}\n"

# Run the check-env.js script
node scripts/check-env.js

# Check if .env file exists
if [ -f .env ]; then
  echo -e "\n${GREEN}Found .env file at:${NC} $(pwd)/.env"
  echo -e "${YELLOW}File contents:${NC}"
  cat .env | grep -v "PRIVATE_KEY" # Don't show private key
  
  # Check if PRIVATE_KEY is in the file
  if grep -q "PRIVATE_KEY=" .env; then
    if grep -q "PRIVATE_KEY=$" .env; then
      echo -e "\n${RED}Warning: PRIVATE_KEY is empty in .env file${NC}"
    else
      echo -e "\n${GREEN}PRIVATE_KEY is set in .env file${NC}"
    fi
  else
    echo -e "\n${RED}PRIVATE_KEY not found in .env file${NC}"
  fi
else
  echo -e "\n${RED}No .env file found at:${NC} $(pwd)/.env"
fi
