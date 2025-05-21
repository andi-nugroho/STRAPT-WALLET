#!/bin/bash

# Script to set all contract fees to zero

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Setting all contract fees to zero...${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
  echo -e "${RED}Error: .env file not found. Please create it with your PRIVATE_KEY.${NC}"
  echo "Example: PRIVATE_KEY=your_private_key_here"
  exit 1
fi

# Run the JavaScript script
echo -e "${YELLOW}Running update script...${NC}"
node scripts/update-all-fees-to-zero.js

# Check if the script executed successfully
if [ $? -eq 0 ]; then
  echo -e "${GREEN}All fees have been set to zero successfully!${NC}"
else
  echo -e "${RED}Error occurred while updating fees.${NC}"
  exit 1
fi

# Update frontend config
echo -e "${YELLOW}Updating frontend configuration...${NC}"
node scripts/update-frontend-abi.js

echo -e "${GREEN}Done!${NC}"
