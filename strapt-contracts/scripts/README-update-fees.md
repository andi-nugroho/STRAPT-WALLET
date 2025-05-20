# Update Fees to Zero

This directory contains scripts to update the fee percentage to zero for all Strapt contracts.

## Prerequisites

Before running the scripts, make sure you have:

1. Node.js installed
2. A `.env` file with your private key:
   ```
   PRIVATE_KEY=your_private_key_here
   ```
3. The private key must be for an account that has owner/admin access to the contracts

## Available Scripts

### update-fees-to-zero.sh

This is the main script that will:
1. Set the fee percentage to zero for all deployed contracts
2. Update the deployment files to reflect the new fee settings
3. Update the frontend configuration

```bash
# Run the script
bash scripts/update-fees-to-zero.sh
```

### update-all-fees-to-zero.js

This is the JavaScript implementation that:
1. Connects to the Lisk Sepolia network
2. Gets the current fee for each contract
3. Sets the fee to zero
4. Updates the deployment files

You can run this directly with:

```bash
node scripts/update-all-fees-to-zero.js
```

## Contracts Affected

The following contracts will have their fees set to zero:

1. ProtectedTransferV2 (0x33665BB084Eb3a01aA2E4eCE2FAd292dCe683e34)
2. ProtectedTransfer (0x225f179c0d57c3DF357f802BB40d5a4BeaFb4F0C)
3. PaymentStream (0xDFa0a6101f25630d3122e1b6b34590848ba35402)
4. StraptDrop (0x3d183CDCbF78BA6e39eb0e51C44d233265786e0A)

## Verification

After running the script, you can verify that the fees have been set to zero by:

1. Checking the console output for confirmation
2. Inspecting the updated deployment files in the `deployments` directory
3. Using a blockchain explorer to check the contract state
4. Testing the contracts with the frontend to ensure no fees are charged

## Troubleshooting

If you encounter any issues:

1. Make sure your private key has owner/admin access to the contracts
2. Check that you have enough ETH to pay for the transaction gas
3. Verify that the RPC URL is correct and the network is responsive
4. If a specific contract fails, you can modify the script to only update that contract
