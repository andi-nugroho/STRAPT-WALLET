# ProtectedTransferV2 Smart Contract

## Overview

ProtectedTransferV2 is an enhanced version of the original ProtectedTransfer contract, designed to provide more flexible and user-friendly token transfer options. It supports ERC20 tokens and offers various protection mechanisms for transfers.

## Key Features

1. **Direct Transfers**: Send tokens to a specific recipient address
   - Recipient must claim the transfer (for security, to prevent wrong address mistakes)
   - Optional password/claim code protection (on by default in frontend)
   - 24-hour refund window for unclaimed transfers

2. **Link/QR Transfers**: Generate a link or QR code that can be shared with anyone
   - Optional password/claim code protection (on by default in frontend)
   - No recipient address required
   - 24-hour refund window for unclaimed transfers

3. **Password Protection**: Add an extra layer of security with custom claim codes
   - "Password" and "Claim Code" refer to the same concept
   - Can be enabled/disabled for both direct and link transfers
   - Enabled by default in the frontend UI
   - Frontend-friendly implementation

4. **Transfer Status Tracking**: Monitor the status of all transfers
   - Pending: Transfer created but not claimed
   - Claimed: Transfer has been claimed by recipient
   - Refunded: Transfer has been refunded to sender
   - Expired: Transfer has expired (future auto-expiry feature)

5. **Fee System**: Configurable fee system for platform revenue
   - Fee in basis points (1/100 of a percent, e.g. 20 = 0.2%)
   - Customizable fee collector address (defaults to deployer)

## Contract Functions

### Transfer Creation

```solidity
// Create a direct transfer to a specific recipient
function createDirectTransfer(
    address recipient,
    address tokenAddress,
    uint256 amount,
    uint256 expiry,
    bool hasPassword,
    bytes32 claimCodeHash
) external returns (bytes32);

// Create a link/QR transfer that can be claimed with just the transfer ID
function createLinkTransfer(
    address tokenAddress,
    uint256 amount,
    uint256 expiry,
    bool hasPassword,
    bytes32 claimCodeHash
) external returns (bytes32);
```

### Transfer Claiming and Refunding

```solidity
// Claim a transfer (works for both direct and link transfers)
function claimTransfer(bytes32 transferId, string calldata claimCode) external;

// Refund an expired transfer back to the sender
function refundTransfer(bytes32 transferId) external;
```

### Transfer Information

```solidity
// Get transfer details
function getTransfer(bytes32 transferId) external view returns (...);

// Check if a transfer is claimable
function isTransferClaimable(bytes32 transferId) external view returns (bool);

// Check if a transfer requires a password
function isPasswordProtected(bytes32 transferId) external view returns (uint8);

// Get all transfers intended for a specific recipient
function getRecipientTransfers(address recipient) external view returns (bytes32[] memory);
```

### Admin Functions

```solidity
// Set token support status
function setTokenSupport(address tokenAddress, bool isSupported) external;

// Set the fee in basis points
function setFee(uint16 newFeeInBasisPoints) external;

// Set the fee collector address
function setFeeCollector(address newFeeCollector) external;
```

## Frontend Integration Improvements

This contract includes several improvements for better frontend integration:

1. **Explicit Password Protection Flag**: The `hasPassword` field makes it clear whether a transfer requires a password.

2. **Frontend-Friendly Return Types**:
   - `isPasswordProtected` returns `uint8` (1 for true, 0 for false) instead of `bool`
   - `getTransfer` returns `status` as `uint8` instead of an enum

3. **Simplified Claim Process**: A single `claimTransfer` function handles both password-protected and non-password-protected transfers.

## Deployment

To deploy the contract:

1. Set up your environment variables in `.env`:
   ```
   PRIVATE_KEY=your_private_key_here
   LISK_SEPOLIA_RPC_URL=https://rpc.sepolia-api.lisk.com
   FEE_BASIS_POINTS=20  # 0.2% fee
   ```

2. Run the deployment script:
   ```
   npx hardhat run scripts/deploy-protected-transfer-v2.js --network liskSepolia
   ```

3. Verify the contract on Blockscout:
   ```
   npx hardhat verify --network liskSepolia <CONTRACT_ADDRESS> <FEE_COLLECTOR> <FEE_IN_BASIS_POINTS>
   ```

   Or using Foundry:
   ```
   forge verify-contract <CONTRACT_ADDRESS> ProtectedTransferV2 --constructor-args $(cast abi-encode "constructor(address,uint16)" "<FEE_COLLECTOR>" <FEE_IN_BASIS_POINTS>) --rpc-url https://rpc.sepolia-api.lisk.com --verify --verifier blockscout --verifier-url 'https://sepolia-blockscout.lisk.com/api/'
   ```

## Usage Examples

### Creating a Direct Transfer with Password Protection (Default)

```javascript
// Generate a claim code/password
const claimCode = "my-secret-code";
const claimCodeHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(claimCode));

// Create a direct transfer with password protection (default in frontend)
const tx = await protectedTransferV2.createDirectTransfer(
  recipientAddress,
  tokenAddress,
  ethers.utils.parseUnits("100", decimals), // 100 tokens
  Math.floor(Date.now() / 1000) + 86400,    // 24 hours expiry
  true,                                     // Has password protection (default in frontend)
  claimCodeHash
);

// Get the transfer ID from the event
const receipt = await tx.wait();
const transferCreatedEvent = receipt.events.find(e => e.event === "TransferCreated");
const transferId = transferCreatedEvent.args.transferId;

console.log("Transfer created with ID:", transferId);
console.log("Share this claim code with the recipient:", claimCode);
```

### Creating a Direct Transfer without Password Protection (Optional)

```javascript
// Create a direct transfer without password protection (user unchecked the option)
const tx = await protectedTransferV2.createDirectTransfer(
  recipientAddress,
  tokenAddress,
  ethers.utils.parseUnits("100", decimals), // 100 tokens
  Math.floor(Date.now() / 1000) + 86400,    // 24 hours expiry
  false,                                    // No password protection (user unchecked the option)
  ethers.constants.HashZero                 // Empty claim code hash
);

// Get the transfer ID from the event
const receipt = await tx.wait();
const transferCreatedEvent = receipt.events.find(e => e.event === "TransferCreated");
const transferId = transferCreatedEvent.args.transferId;

console.log("Transfer created with ID:", transferId);
console.log("Recipient can claim without a password");
```

### Creating a Link/QR Transfer with Password Protection (Default)

```javascript
// Generate a claim code/password
const claimCode = "my-secret-code";
const claimCodeHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(claimCode));

// Create a link transfer with password protection (default in frontend)
const tx = await protectedTransferV2.createLinkTransfer(
  tokenAddress,
  ethers.utils.parseUnits("100", decimals), // 100 tokens
  Math.floor(Date.now() / 1000) + 86400,    // 24 hours expiry
  true,                                     // Has password protection (default in frontend)
  claimCodeHash
);

// Get the transfer ID from the event
const receipt = await tx.wait();
const transferCreatedEvent = receipt.events.find(e => e.event === "TransferCreated");
const transferId = transferCreatedEvent.args.transferId;

// Generate link with claim code
const transferLink = `https://strapt.app/claim/${transferId}?code=${encodeURIComponent(claimCode)}`;
console.log("Share this link with anyone:", transferLink);
```

### Creating a Link/QR Transfer without Password Protection (Optional)

```javascript
// Create a link transfer without password protection (user unchecked the option)
const tx = await protectedTransferV2.createLinkTransfer(
  tokenAddress,
  ethers.utils.parseUnits("100", decimals), // 100 tokens
  Math.floor(Date.now() / 1000) + 86400,    // 24 hours expiry
  false,                                    // No password protection (user unchecked the option)
  ethers.constants.HashZero                 // Empty claim code hash
);

// Get the transfer ID from the event
const receipt = await tx.wait();
const transferCreatedEvent = receipt.events.find(e => e.event === "TransferCreated");
const transferId = transferCreatedEvent.args.transferId;

// Generate link without claim code
const transferLink = `https://strapt.app/claim/${transferId}`;
console.log("Share this link with anyone:", transferLink);
```

### Claiming a Transfer

```javascript
// Check if the transfer requires a password/claim code
const isPasswordProtected = await protectedTransferV2.isPasswordProtected(transferId);

// Claim the transfer
if (isPasswordProtected === 1) {
  // With password/claim code
  await protectedTransferV2.claimTransfer(transferId, claimCode);
  console.log("Transfer claimed successfully with password");
} else {
  // Without password/claim code (empty string)
  await protectedTransferV2.claimTransfer(transferId, "");
  console.log("Transfer claimed successfully without password");
}
```

### Refunding an Expired Transfer

```javascript
// Refund an expired transfer (after 24 hours)
await protectedTransferV2.refundTransfer(transferId);
console.log("Transfer refunded successfully");
```

### Getting Transfers to Claim (for Claims Page)

```javascript
// Get the current user's address
const userAddress = await signer.getAddress();

// Get all transfers intended for this user
const transferIds = await protectedTransferV2.getRecipientTransfers(userAddress);
console.log(`Found ${transferIds.length} transfers to claim`);

// Get details for each transfer
const transferDetails = await Promise.all(
  transferIds.map(async (id) => {
    // Get transfer details
    const details = await protectedTransferV2.getTransfer(id);

    // Check if the transfer is still claimable
    const isClaimable = await protectedTransferV2.isTransferClaimable(id);

    // Check if the transfer requires a password
    const requiresPassword = await protectedTransferV2.isPasswordProtected(id);

    // Format the details
    return {
      id,
      sender: details[0],
      recipient: details[1],
      tokenAddress: details[2],
      amount: ethers.utils.formatUnits(details[3], getTokenDecimals(details[2])),
      grossAmount: ethers.utils.formatUnits(details[4], getTokenDecimals(details[2])),
      expiry: new Date(Number(details[5]) * 1000).toLocaleString(),
      status: ['Pending', 'Claimed', 'Refunded', 'Expired'][details[6]],
      createdAt: new Date(Number(details[7]) * 1000).toLocaleString(),
      isLinkTransfer: details[8],
      hasPassword: details[9],
      isClaimable,
      requiresPassword: requiresPassword === 1
    };
  })
);

// Filter for only claimable transfers
const claimableTransfers = transferDetails.filter(t => t.isClaimable);

// Display in the UI
console.log("Transfers to claim:", claimableTransfers);
```
