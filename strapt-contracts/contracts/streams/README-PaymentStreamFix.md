# PaymentStream Contract Fix

## Issue Description

The original `PaymentStream` contract has an issue with the `withdrawFromStream` function that can cause the "ERC20: transfer amount exceeds balance" error. This happens when:

1. The contract tries to transfer tokens to the recipient
2. The contract doesn't have enough tokens (possibly due to previous transfers or fee calculations)
3. The transaction reverts with "ERC20: transfer amount exceeds balance"

The error occurs in the `withdrawFromStream` function:

```solidity
function withdrawFromStream(bytes32 streamId) external nonReentrant {
    Stream storage stream = streams[streamId];
    if (stream.sender == address(0)) revert StreamNotFound();
    if (stream.recipient != msg.sender) revert NotStreamRecipient();

    // Update stream before withdrawal
    if (stream.status == StreamStatus.Active) {
        updateStream(streamId);
    }

    // Calculate withdrawable amount
    uint256 withdrawableAmount = stream.streamed;

    // Reset streamed amount
    stream.streamed = 0;

    // Transfer withdrawable amount to recipient
    if (withdrawableAmount > 0) {
        IERC20(stream.tokenAddress).safeTransfer(stream.recipient, withdrawableAmount);
    }

    emit StreamUpdated(streamId, 0, stream.status, block.timestamp);
}
```

The issue is that the function resets `stream.streamed = 0` before attempting the transfer, and if the transfer fails, the streamed amount is lost.

## Solution

The `PaymentStreamFix` contract addresses this issue by:

1. Adding a helper function `_safeTransferToken` that checks the contract's balance before transferring
2. Only transferring the amount that the contract actually has available
3. Updating the `stream.streamed` value to reflect what couldn't be transferred
4. Returning the actual amount withdrawn

```solidity
function _safeTransferToken(IERC20 token, address to, uint256 amount) private returns (uint256) {
    // Check contract balance
    uint256 contractBalance = token.balanceOf(address(this));
    
    // If contract has less than requested amount, transfer what we have
    uint256 transferAmount = amount;
    if (contractBalance < amount) {
        transferAmount = contractBalance;
    }
    
    // Only transfer if there's something to transfer
    if (transferAmount > 0) {
        token.safeTransfer(to, transferAmount);
    }
    
    return transferAmount;
}

function withdrawFromStream(bytes32 streamId) external nonReentrant returns (uint256) {
    Stream storage stream = streams[streamId];
    if (stream.sender == address(0)) revert StreamNotFound();
    if (stream.recipient != msg.sender) revert NotStreamRecipient();

    // Update stream before withdrawal
    if (stream.status == StreamStatus.Active) {
        updateStream(streamId);
    }

    // Calculate withdrawable amount
    uint256 withdrawableAmount = stream.streamed;
    
    // Check if there's anything to withdraw
    if (withdrawableAmount == 0) revert NoFundsToWithdraw();

    // Reset streamed amount
    stream.streamed = 0;

    // Transfer withdrawable amount to recipient (safely)
    IERC20 token = IERC20(stream.tokenAddress);
    uint256 actualWithdrawn = _safeTransferToken(token, stream.recipient, withdrawableAmount);
    
    // If we couldn't transfer the full amount, update the streamed amount to reflect what's left
    if (actualWithdrawn < withdrawableAmount) {
        stream.streamed = withdrawableAmount - actualWithdrawn;
    }

    emit StreamUpdated(streamId, stream.streamed, stream.status, block.timestamp);
    
    return actualWithdrawn;
}
```

## Deployment

To deploy the fixed contract:

1. Compile the contract:
   ```
   npx hardhat compile
   ```

2. Run the deployment script:
   ```
   node scripts/deploy-payment-stream-fix.js
   ```

3. Verify the contract on Blockscout:
   ```
   npx hardhat verify --network liskSepolia <CONTRACT_ADDRESS> <FEE_COLLECTOR_ADDRESS> 0
   ```

4. Update the frontend configuration to use the new contract address.

## Frontend Integration

After deploying the fixed contract, you'll need to update the frontend to use the new contract address. The `withdrawFromStream` function now returns the actual amount withdrawn, which can be used to provide better feedback to the user.

```typescript
// Example usage in the frontend
const actualWithdrawn = await paymentStreamContract.withdrawFromStream(streamId);
console.log(`Actually withdrawn: ${actualWithdrawn}`);
```

## Additional Improvements

The fixed contract also includes:

1. Better error handling with a new `NoFundsToWithdraw` error
2. Return values for functions to provide more information to the caller
3. Fee set to 0 by default to avoid fee-related issues
