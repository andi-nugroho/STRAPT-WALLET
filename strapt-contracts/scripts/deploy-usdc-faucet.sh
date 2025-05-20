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

# First check environment variables
print_header "Checking Environment"
./scripts/check-env.sh
ENV_CHECK_STATUS=$?

if [ $ENV_CHECK_STATUS -ne 0 ]; then
  echo -e "${RED}Environment check failed. Please fix the issues above.${NC}"
  exit 1
fi

echo -e "${GREEN}Environment check passed. Proceeding with deployment...${NC}"

# Compile contracts
print_header "Compiling Contracts"
npx hardhat compile
check_status "Compilation"

# Deploy to Lisk Sepolia
print_header "Deploying USDC Faucet to Lisk Sepolia"
echo -e "Make sure you have:"
echo -e "1. Set your private key in the .env file"
echo -e "2. Have testnet ETH in your account (get from https://faucet.sepolia-api.lisk.com/)"

echo -e ""

# Deploy the contract
npx hardhat run scripts/deploy-usdc-faucet.js --network liskSepolia
check_status "Deployment to Lisk Sepolia"

# Get deployment info
DEPLOYMENT_FILE=$(ls -t deployments/USDCFaucet-liskSepolia.json 2>/dev/null)
if [ -f "$DEPLOYMENT_FILE" ]; then
  CONTRACT_ADDRESS=$(grep -o '"contractAddress": *"[^"]*"' "$DEPLOYMENT_FILE" | cut -d'"' -f4)
  echo -e "\n${GREEN}USDC Faucet deployed successfully!${NC}"
  echo -e "Contract address: ${YELLOW}$CONTRACT_ADDRESS${NC}"
  echo -e "Network: ${YELLOW}Lisk Sepolia${NC}"
  echo -e "\nTo fund the faucet, send USDC tokens to the contract address."
fi
