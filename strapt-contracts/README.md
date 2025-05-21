# STRAPT Smart Contracts

Smart contracts for the STRAPT (Secure Transfer and Payment) platform.

## Features

### Protected Transfer
- Send tokens with claim code protection
- Create transfers claimable via link/QR code
- Auto-refund for expired transfers
- Supports IDRX and USDC tokens

### STRAPT Drop
- Distribute IDRX tokens to multiple recipients
- Fixed or random amount distribution
- Claim via link/QR code

### Payment Stream
- Stream payments over time to recipients
- Configurable milestones
- Pause/resume/cancel functionality

### USDC Faucet
- Testnet USDC distribution for testing
- Configurable claim amounts and cooldown periods
- Anti-spam protection

## Development

### Prerequisites
- Node.js
- Bun (package manager)
- Hardhat

### Setup

1. Install dependencies:
```bash
bun install
```

2. Compile contracts:
```bash
npx hardhat compile
```

3. Run tests:
```bash
npx hardhat test
```

4. Deploy contracts:
```bash
npx hardhat run scripts/deploy.js --network <network-name>
```

5. Deploy USDC Faucet:
```bash
# Make the script executable
chmod +x scripts/deploy-usdc-faucet.sh

# Run the deployment script
./scripts/deploy-usdc-faucet.sh
```

## Contract Architecture

### Tokens
- `IDRX.sol`: Indonesian Rupiah stablecoin (ERC20)
- `USDC.sol`: USD Coin mock for testing (ERC20)

### Core Contracts
- `ProtectedTransfer.sol`: Handles protected transfers with claim codes and expiry times
- `ProtectedTransferV2.sol`: Enhanced version with additional features
- `PaymentStream.sol`: Handles streaming payments with milestones
- `StraptDrop.sol`: Manages token distribution to multiple recipients
- `USDCFaucet.sol`: Testnet USDC distribution for testing

## Security Features

- Uses OpenZeppelin's SafeERC20 for secure token transfers
- Implements ReentrancyGuard to prevent reentrancy attacks
- Proper validation of inputs and state transitions
- Secure handling of claim codes (only stores hashes)

## License
MIT
