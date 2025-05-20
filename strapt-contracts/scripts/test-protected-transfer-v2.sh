#!/bin/bash

# Script to run tests for ProtectedTransferV2

# Compile contracts
echo "Compiling contracts..."
npx hardhat compile

# Run tests
echo "Running tests for ProtectedTransferV2..."
npx hardhat test test/ProtectedTransferV2.test.js --network hardhat

# Generate coverage report (optional)
if [ "$1" == "--coverage" ]; then
  echo "Generating coverage report..."
  npx hardhat coverage --testfiles "test/ProtectedTransferV2.test.js"
fi

echo "Testing complete!"
