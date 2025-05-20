#!/bin/bash

# Script to run all deployment and testing steps for ProtectedTransferV2

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print section header
print_header() {
  echo -e "\n${YELLOW}==== $1 ====${NC}\n"
}

# Function to check if previous command succeeded
check_status() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ $1 completed successfully${NC}"
  else
    echo -e "${RED}✗ $1 failed${NC}"
    exit 1
  fi
}

# Make scripts executable
chmod +x scripts/*.sh

# Compile contracts
print_header "Compiling Contracts"
npx hardhat compile
check_status "Compilation"

# Run tests
print_header "Running Tests"
bash scripts/test-protected-transfer-v2.sh
check_status "Testing"

# Ask if user wants to deploy to Lisk Sepolia
print_header "Deployment"
echo -e "To deploy to Lisk Sepolia, you need to:"
echo -e "1. Create a .env file with your private key (copy .env.example to .env)"
echo -e "2. Have testnet ETH in your account (get from https://faucet.sepolia-api.lisk.com/)"
echo -e ""
read -p "Do you want to deploy to Lisk Sepolia? (y/n): " deploy_choice

if [[ $deploy_choice == "y" || $deploy_choice == "Y" ]]; then
  # Check if .env file exists
  if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found.${NC}"
    echo -e "Please create a .env file with your private key. You can copy .env.example to .env and fill in your private key."
    echo -e "Example:"
    echo -e "${YELLOW}cp .env.example .env${NC}"
    echo -e "${YELLOW}nano .env${NC}"
    exit 1
  fi

  # Deploy to Lisk Sepolia
  bash scripts/deploy-to-lisk-sepolia.sh
  check_status "Deployment to Lisk Sepolia"

  # Update frontend ABI
  print_header "Updating Frontend"
  node scripts/update-frontend-abi.js
  check_status "Frontend ABI update"

  # Get deployment info
  DEPLOYMENT_FILE=$(ls -t deployments/ProtectedTransferV2-liskSepolia.json 2>/dev/null)
  if [ -f "$DEPLOYMENT_FILE" ]; then
    CONTRACT_ADDRESS=$(grep -o '"contractAddress": *"[^"]*"' "$DEPLOYMENT_FILE" | cut -d'"' -f4)
    echo -e "\n${GREEN}Contract deployed successfully!${NC}"
    echo -e "Contract address: ${YELLOW}$CONTRACT_ADDRESS${NC}"
    echo -e "Network: ${YELLOW}Lisk Sepolia${NC}"
    echo -e "\nFrontend files have been updated."
  fi
else
  echo "Skipping deployment."
fi

print_header "All Tasks Completed"
echo -e "${GREEN}The ProtectedTransferV2 contract is ready to use!${NC}"
