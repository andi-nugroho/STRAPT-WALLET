#!/bin/bash

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check command status
check_status() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}$1 successful!${NC}"
  else
    echo -e "${RED}$1 failed!${NC}"
    exit 1
  fi
}

# Print header
print_header() {
  echo -e "\n${YELLOW}=== $1 ===${NC}\n"
}

# Check if deployment file exists
if [ ! -f deployments/USDCFaucet-liskSepolia.json ]; then
  echo -e "${RED}Error: USDCFaucet deployment file not found.${NC}"
  echo -e "Please deploy the contract first using: ./scripts/deploy-usdc-faucet.sh"
  exit 1
fi

# Run the interaction script
print_header "Interacting with USDC Faucet on Lisk Sepolia"
npx hardhat run scripts/interact-usdc-faucet.js --network liskSepolia
check_status "Interaction"
