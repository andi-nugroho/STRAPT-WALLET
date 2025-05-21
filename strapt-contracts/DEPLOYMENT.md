# Deployment Guide for ProtectedTransferV2

This guide explains how to deploy the ProtectedTransferV2 contract to the Lisk Sepolia testnet.

## Prerequisites

Before you begin, make sure you have:

1. Node.js (v16+) installed
2. Bun or npm installed
3. Git repository cloned and dependencies installed
4. A wallet with some testnet ETH on Lisk Sepolia

## Step 1: Set Up Environment Variables

1. Create a `.env` file by copying the example:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file and add your private key (without 0x prefix):
   ```
   PRIVATE_KEY=your_private_key_here_without_0x_prefix
   ```

   You can optionally set these variables as well:
   ```
   FEE_COLLECTOR=0x... # Address to collect fees (defaults to deployer)
   FEE_BASIS_POINTS=20 # Fee in basis points (0.2%, defaults to 20)
   ```

## Step 2: Get Testnet ETH

You need testnet ETH to deploy the contract. Get some from the [Lisk Sepolia faucet](https://faucet.sepolia-api.lisk.com/).

## Step 3: Deploy the Contract

Run the deployment script:

```bash
bash scripts/deploy-to-lisk-sepolia.sh
```

This script will:
1. Compile the contracts
2. Deploy ProtectedTransferV2 to Lisk Sepolia
3. Set token support for USDC and IDRX
4. Save deployment info to `deployments/ProtectedTransferV2-liskSepolia.json`
5. Verify the contract on Blockscout

## Step 4: Update Frontend

After deployment, update the frontend with the new contract ABI and address:

```bash
node scripts/update-frontend-abi.js
```

This will:
1. Copy the ABI to `../strapt-frontend/src/contracts/ProtectedTransferV2.json`
2. Create a config file at `../strapt-frontend/src/contracts/contract-config.json`

## Step 5: Verify the Contract (if needed)

The deployment script should automatically verify the contract. If it fails, you can manually verify:

Using Foundry:
```bash
bash scripts/verify-with-foundry.sh <contract_address> <fee_collector> <fee_basis_points>
```

Or using Hardhat:
```bash
npx hardhat verify --network liskSepolia <contract_address> <fee_collector> <fee_basis_points>
```

## All-in-One Script

Alternatively, you can use the all-in-one script that combines testing and deployment:

```bash
bash scripts/deploy-and-test.sh
```

This script will:
1. Compile the contracts
2. Run the tests
3. Ask if you want to deploy to Lisk Sepolia
4. Update the frontend ABI if deployed

## Troubleshooting

### Error: Cannot read properties of undefined (reading 'address')

This error occurs when the script can't find a valid signer. Make sure:
- You have created a `.env` file with your private key
- The private key is valid and has ETH on Lisk Sepolia
- The private key is entered without the '0x' prefix

### Error: Transaction reverted without a reason

This can happen if:
- You don't have enough ETH for gas
- There's an issue with the contract parameters

Check your wallet balance and try again.

### Error: Contract verification failed

If verification fails:
1. Wait a few minutes for the transaction to be fully confirmed
2. Try manual verification with the scripts mentioned above
3. Make sure you're using the correct constructor parameters

## After Deployment

After successful deployment:

1. The contract address will be saved in `deployments/ProtectedTransferV2-liskSepolia.json`
2. The ABI will be copied to the frontend directory
3. You can interact with the contract using the frontend or directly through Blockscout

## Contract Addresses

After deployment, you can find your contract at:
- Blockscout Explorer: `https://sepolia-blockscout.lisk.com/address/<your-contract-address>`
