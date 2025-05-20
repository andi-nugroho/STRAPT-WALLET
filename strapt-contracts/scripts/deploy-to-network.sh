#!/bin/bash

# Unified deployment script for all Strapt contracts
# Usage: ./scripts/deploy-to-network.sh [contract-type] [network] [--dry-run]
# Example: ./scripts/deploy-to-network.sh ProtectedTransferV2 liskSepolia
# Example: ./scripts/deploy-to-network.sh PaymentStream liskSepolia
# Example: ./scripts/deploy-to-network.sh StraptDrop liskSepolia

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default values
CONTRACT_TYPE=${1:-"ProtectedTransferV2"}
NETWORK=${2:-"liskSepolia"}
DRY_RUN=false

# Check for dry run flag
if [[ "$3" == "--dry-run" ]]; then
  DRY_RUN=true
  echo -e "${YELLOW}DRY RUN MODE: No actual deployment will be performed${NC}"
fi

# Validate contract type
VALID_CONTRACTS=("ProtectedTransferV2" "PaymentStream" "StraptDrop")
if [[ ! " ${VALID_CONTRACTS[@]} " =~ " ${CONTRACT_TYPE} " ]]; then
  echo -e "${RED}Error: Invalid contract type '${CONTRACT_TYPE}'.${NC}"
  echo -e "Valid contract types: ${VALID_CONTRACTS[*]}"
  exit 1
fi

# Validate network
VALID_NETWORKS=("hardhat" "localhost" "liskSepolia")
if [[ ! " ${VALID_NETWORKS[@]} " =~ " ${NETWORK} " ]]; then
  echo -e "${RED}Error: Invalid network '${NETWORK}'.${NC}"
  echo -e "Valid networks: ${VALID_NETWORKS[*]}"
  exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
  echo -e "${RED}Error: .env file not found.${NC}"
  echo -e "Please create a .env file with your private key. You can copy .env.example to .env and fill in your private key."
  echo -e "Example:"
  echo -e "${YELLOW}cp .env.example .env${NC}"
  echo -e "${YELLOW}nano .env${NC}"
  exit 1
fi

# Check if PRIVATE_KEY is set in .env
if ! grep -q "PRIVATE_KEY=" .env || grep -q "PRIVATE_KEY=your_private_key_here_without_0x_prefix" .env; then
  echo -e "${RED}Error: PRIVATE_KEY not set in .env file.${NC}"
  echo -e "Please set your private key in the .env file."
  exit 1
fi

# Load environment variables from .env
echo -e "${YELLOW}Loading environment variables from .env...${NC}"
export $(grep -v '^#' .env | xargs)

# Display configuration
echo -e "${GREEN}Deployment Configuration:${NC}"
echo -e "Contract: ${CONTRACT_TYPE}"
echo -e "Network: ${NETWORK}"
echo -e "RPC URL: ${LISK_SEPOLIA_RPC_URL:-https://rpc.sepolia-api.lisk.com}"
echo -e "Fee Collector: ${FEE_COLLECTOR:-Deployer Address}"
echo -e "Fee Basis Points: ${FEE_BASIS_POINTS:-20} (${FEE_BASIS_POINTS:-20}/10000 = 0.2%)"

# Compile contracts
echo -e "${YELLOW}Compiling contracts...${NC}"
npx hardhat compile

# Deploy to network
echo -e "${YELLOW}Deploying to ${NETWORK}...${NC}"
echo -e "This will deploy the ${CONTRACT_TYPE} contract to ${NETWORK}."
echo -e "Make sure you have enough testnet ETH in your account if deploying to a testnet."
echo -e ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Pass environment variables to the deployment script
if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}DRY RUN: Skipping actual deployment${NC}"
  echo -e "Would run: CONTRACT_TYPE=${CONTRACT_TYPE} npx hardhat run scripts/deploy.js --network ${NETWORK}"
  echo -e "With environment variables:"
  echo -e "  PRIVATE_KEY=********"
  echo -e "  LISK_SEPOLIA_RPC_URL=${LISK_SEPOLIA_RPC_URL:-https://rpc.sepolia-api.lisk.com}"
  echo -e "  FEE_COLLECTOR=${FEE_COLLECTOR:-<deployer address>}"
  echo -e "  FEE_BASIS_POINTS=${FEE_BASIS_POINTS:-20}"
  exit 0
else
  PRIVATE_KEY=$PRIVATE_KEY \
  LISK_SEPOLIA_RPC_URL=${LISK_SEPOLIA_RPC_URL:-https://rpc.sepolia-api.lisk.com} \
  FEE_COLLECTOR=$FEE_COLLECTOR \
  FEE_BASIS_POINTS=${FEE_BASIS_POINTS:-20} \
  CONTRACT_TYPE=$CONTRACT_TYPE \
  npx hardhat run scripts/deploy.js --network $NETWORK
fi

# Get the deployed contract address
DEPLOYMENT_FILE=$(ls -t deployments/${CONTRACT_TYPE}-${NETWORK}.json 2>/dev/null)

if [ -f "$DEPLOYMENT_FILE" ]; then
  CONTRACT_ADDRESS=$(grep -o '"contractAddress": *"[^"]*"' "$DEPLOYMENT_FILE" | cut -d'"' -f4)
  FEE_COLLECTOR=$(grep -o '"feeCollector": *"[^"]*"' "$DEPLOYMENT_FILE" | cut -d'"' -f4)
  FEE_BASIS_POINTS=$(grep -o '"feeInBasisPoints": *[0-9]*' "$DEPLOYMENT_FILE" | awk '{print $2}')

  echo -e "${GREEN}Contract deployed at: $CONTRACT_ADDRESS${NC}"
  echo -e "${GREEN}Deployment complete!${NC}"
  echo -e "Contract address: ${YELLOW}$CONTRACT_ADDRESS${NC}"
  echo -e "Fee collector: ${YELLOW}$FEE_COLLECTOR${NC}"
  echo -e "Fee basis points: ${YELLOW}$FEE_BASIS_POINTS${NC}"
else
  echo -e "${RED}Deployment file not found. Verification skipped.${NC}"
fi
