# ProtectedTransfer Smart Contract

ProtectedTransfer is a smart contract that enables secure token transfers with claim codes or link/QR codes. It allows users to send tokens that can only be claimed by someone who knows the claim code or has access to a specific link.

## Features

### Core Features
- **Direct Transfer with Claim Code**: Send tokens to a specific recipient who must provide the correct claim code to claim them.
- **Link/QR Transfer**: Create a transfer without specifying a recipient, allowing anyone with the link/QR code to claim the tokens.
- **Expiry Time**: Transfers expire after a set time, after which the sender can refund the tokens.

### Additional Features
- **Fee System**: Configurable fee (up to 5%) that can be collected on each transfer.
- **Token Whitelist**: Only whitelisted tokens can be used for transfers.
- **Security**: Uses OpenZeppelin's ReentrancyGuard and SafeERC20 for enhanced security.
- **Ownership**: Contract has an owner who can configure fees and token whitelist.

## How It Works

### Creating a Transfer with Claim Code

1. Generate a claim code (e.g., "ABC123")
2. Hash the claim code using keccak256
3. Call `createTransfer` with recipient address, token address, amount, expiry, and claim code hash
4. Share the claim code with the recipient securely

### Creating a Link/QR Transfer

1. Call `createLinkTransfer` with token address, amount, and expiry
2. The function returns a transfer ID
3. Create a link or QR code containing the transfer ID
4. Share the link/QR code with anyone who should be able to claim the tokens

### Claiming a Transfer

For transfers with claim code:
1. Recipient calls `claimTransfer` with the transfer ID and claim code
2. If the code is correct and the transfer hasn't expired, the tokens are transferred to the recipient

For link/QR transfers:
1. Anyone with the transfer ID calls `claimLinkTransfer` with the transfer ID
2. If the transfer hasn't expired, the tokens are transferred to the caller

### Refunding a Transfer

1. If a transfer expires without being claimed, the sender can call `refundTransfer` with the transfer ID
2. The tokens are returned to the sender

## Contract Interface

### Main Functions

```solidity
// Create a transfer with a claim code
function createTransfer(
    address recipient,
    address tokenAddress,
    uint256 amount,
    uint256 expiry,
    bytes32 claimCodeHash
) external returns (bytes32);

// Create a link/QR transfer
function createLinkTransfer(
    address tokenAddress,
    uint256 amount,
    uint256 expiry
) external returns (bytes32);

// Claim a transfer with a claim code
function claimTransfer(bytes32 transferId, string calldata claimCode) external;

// Claim a link transfer
function claimLinkTransfer(bytes32 transferId) external;

// Refund an expired transfer
function refundTransfer(bytes32 transferId) external;
```

### Admin Functions

```solidity
// Set fee percentage (in basis points, 100 = 1%)
function setFee(uint16 newFeeInBasisPoints) external onlyOwner;

// Set fee collector address
function setFeeCollector(address newFeeCollector) external onlyOwner;

// Add or remove a token from the whitelist
function setTokenSupport(address tokenAddress, bool isSupported) external onlyOwner;
```

### View Functions

```solidity
// Get transfer details
function getTransfer(bytes32 transferId) external view returns (...);

// Check if a transfer is claimable
function isTransferClaimable(bytes32 transferId) external view returns (bool);
```

## Deployment

To deploy the contract:

1. Set up your environment variables in `.env`:
   ```
   PRIVATE_KEY=your_private_key_here
   LISK_SEPOLIA_RPC_URL=https://rpc.sepolia-api.lisk.com
   ```

2. Run the deployment script:
   ```
   npx hardhat run scripts/deploy-protected-transfer.js --network liskSepolia
   ```

3. After deployment, update the contract address in the interaction script:
   ```
   const PROTECTED_TRANSFER_ADDRESS = "your_deployed_contract_address";
   ```

## Frontend Integration

To integrate with a frontend without a backend:

1. **Generate Claim Code**: Generate a random claim code in the browser
2. **Hash Claim Code**: Hash the claim code using keccak256
3. **Create Transfer**: Call `createTransfer` or `createLinkTransfer` with the appropriate parameters
4. **Share Claim Code**: For direct transfers, share the claim code with the recipient
5. **Generate Link**: For link transfers, create a link containing the transfer ID (and claim code if applicable)
6. **Claim Process**: Create a UI for recipients to enter the transfer ID and claim code (if applicable)

## Security Considerations

- Claim codes should be shared securely (e.g., encrypted messaging)
- Link/QR transfers can be claimed by anyone with the link/QR code
- Set appropriate expiry times to prevent tokens being locked for too long
- The contract uses ReentrancyGuard to prevent reentrancy attacks
- The contract uses SafeERC20 to safely handle token transfers

## License

This contract is licensed under the MIT License.
