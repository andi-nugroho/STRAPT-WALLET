#!/bin/bash

# Script to verify ProtectedTransferV2 using Foundry

# Check if contract address is provided
if [ -z "$1" ]; then
  # Try to get the address from the deployment file
  DEPLOYMENT_FILE=$(ls -t deployments/ProtectedTransferV2-liskSepolia.json 2>/dev/null)
  
  if [ -f "$DEPLOYMENT_FILE" ]; then
    CONTRACT_ADDRESS=$(grep -o '"contractAddress": *"[^"]*"' "$DEPLOYMENT_FILE" | cut -d'"' -f4)
    FEE_COLLECTOR=$(grep -o '"feeCollector": *"[^"]*"' "$DEPLOYMENT_FILE" | cut -d'"' -f4)
    FEE_BASIS_POINTS=$(grep -o '"feeInBasisPoints": *[0-9]*' "$DEPLOYMENT_FILE" | awk '{print $2}')
  else
    echo "Error: No contract address provided and no deployment file found."
    echo "Usage: $0 <contract_address> [fee_collector] [fee_basis_points]"
    exit 1
  fi
else
  CONTRACT_ADDRESS=$1
  FEE_COLLECTOR=${2:-$(grep -o '"feeCollector": *"[^"]*"' deployments/ProtectedTransferV2-liskSepolia.json 2>/dev/null | cut -d'"' -f4)}
  FEE_BASIS_POINTS=${3:-$(grep -o '"feeInBasisPoints": *[0-9]*' deployments/ProtectedTransferV2-liskSepolia.json 2>/dev/null | awk '{print $2}')}
  
  if [ -z "$FEE_COLLECTOR" ] || [ -z "$FEE_BASIS_POINTS" ]; then
    echo "Error: Fee collector or fee basis points not provided and not found in deployment file."
    echo "Usage: $0 <contract_address> <fee_collector> <fee_basis_points>"
    exit 1
  fi
fi

echo "Verifying contract at address: $CONTRACT_ADDRESS"
echo "Fee collector: $FEE_COLLECTOR"
echo "Fee basis points: $FEE_BASIS_POINTS"

# Verify using Foundry
forge verify-contract "$CONTRACT_ADDRESS" ProtectedTransferV2 \
  --constructor-args $(cast abi-encode "constructor(address,uint16)" "$FEE_COLLECTOR" "$FEE_BASIS_POINTS") \
  --rpc-url https://rpc.sepolia-api.lisk.com \
  --verify \
  --verifier blockscout \
  --verifier-url 'https://sepolia-blockscout.lisk.com/api/'

echo "Verification complete!"
