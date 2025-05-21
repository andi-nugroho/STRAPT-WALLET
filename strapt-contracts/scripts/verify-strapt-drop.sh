#!/bin/bash

# Script to verify StraptDrop contract on Blockscout

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get contract address from command line or use default
CONTRACT_ADDRESS=${1:-"0x511033fC24F3d10f7649fAcb97a4Df95F5BfCCe5"}

echo -e "${YELLOW}Verifying StraptDrop at ${CONTRACT_ADDRESS} on Blockscout...${NC}"

# Try verification with Foundry
echo -e "Attempting verification with Foundry..."
forge verify-contract ${CONTRACT_ADDRESS} StraptDrop --chain-id 4202 --rpc-url https://rpc.sepolia-api.lisk.com --verifier blockscout --verifier-url 'https://sepolia-blockscout.lisk.com/api/'

# Check if verification was successful
if [ $? -eq 0 ]; then
  echo -e "${GREEN}Verification successful!${NC}"
  exit 0
fi

echo -e "${RED}Foundry verification failed. Trying alternative methods...${NC}"

# Try flattening the contract
echo -e "${YELLOW}Flattening contract...${NC}"
npx hardhat flatten contracts/StraptDrop.sol:StraptDrop > StraptDrop_flattened.sol

if [ $? -eq 0 ]; then
  echo -e "${GREEN}Contract flattened successfully.${NC}"
  echo -e "Flattened contract saved to: StraptDrop_flattened.sol"
  echo -e "${YELLOW}Please verify manually using the flattened file:${NC}"
  echo -e "1. Visit https://sepolia-blockscout.lisk.com/address/${CONTRACT_ADDRESS}/contract_verification"
  echo -e "2. Select 'Solidity (Single file)' as Contract Type"
  echo -e "3. Select compiler version 0.8.24"
  echo -e "4. Enable optimization with 200 runs"
  echo -e "5. Upload the flattened file: StraptDrop_flattened.sol"
else
  echo -e "${RED}Failed to flatten contract.${NC}"
fi

# Try verification with Hardhat using special config
echo -e "${YELLOW}Trying verification with Hardhat (viaIR disabled)...${NC}"
npx hardhat verify --config hardhat-verify.config.js --network liskSepolia ${CONTRACT_ADDRESS} --contract contracts/StraptDrop.sol:StraptDrop

if [ $? -eq 0 ]; then
  echo -e "${GREEN}Hardhat verification successful!${NC}"
  exit 0
else
  echo -e "${RED}All automatic verification methods failed.${NC}"
  echo -e "${YELLOW}Please try manual verification using the flattened contract.${NC}"
fi
