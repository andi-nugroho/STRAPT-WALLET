# Payment Stream Feature

The Payment Stream feature allows users to create token streams with customizable rates and milestones. This document provides an overview of the feature, its implementation, and how to use it.

## Overview

The Payment Stream feature enables:

- Creating token streams with customizable rates
- Setting up milestones for project-based payments
- Pausing, resuming, and canceling streams
- Real-time tracking of stream progress
- Milestone-based releases of funds

This feature is ideal for:
- Paying freelancers
- Project-based work
- Continuous service payments
- Any scenario requiring gradual fund release

## Smart Contract

The `PaymentStream` contract is the core of this feature. It handles the creation, management, and tracking of payment streams.

### Key Features

1. **Stream Creation**: Create a stream with a specified recipient, token, amount, duration, and optional milestones.
2. **Stream Management**: Pause, resume, or cancel streams as needed.
3. **Milestone Management**: Release funds based on milestone completion.
4. **Real-time Tracking**: Track the amount streamed in real-time.
5. **Fee System**: Configurable fee system for platform revenue.

### Contract Structure

- **Stream**: The main data structure that stores stream information.
- **Milestone**: A data structure for milestone information.
- **StreamStatus**: An enum to track the status of a stream (Active, Paused, Completed, Canceled).

### Key Functions

- `createStream`: Create a new payment stream
- `pauseStream`: Pause an active stream
- `resumeStream`: Resume a paused stream
- `cancelStream`: Cancel a stream and refund remaining funds
- `releaseMilestone`: Release funds for a specific milestone
- `withdrawFromStream`: Withdraw streamed tokens
- `getStreamedAmount`: Calculate the amount streamed so far

## Frontend Integration

The frontend integration provides a user-friendly interface for interacting with the `PaymentStream` contract.

### Components

- **Streams Page**: Main page for viewing and managing streams
- **Stream Creation Form**: Form for creating new streams
- **Stream Card**: Card for displaying stream information
- **Milestone Release Dialog**: Dialog for releasing milestone funds

### Hooks

- **usePaymentStream**: Hook for interacting with the `PaymentStream` contract

## Deployment

The `PaymentStream` contract can be deployed to any EVM-compatible blockchain. The deployment script is provided in `scripts/deploy-payment-stream.js`.

### Deployment Steps

1. Set environment variables in `.env` file:
   ```
   PRIVATE_KEY=your_private_key
   FEE_COLLECTOR=fee_collector_address
   FEE_BASIS_POINTS=20 # 0.2%
   ```

2. Run the deployment script:
   ```bash
   cd strapt-contracts
   npx hardhat run scripts/deploy-payment-stream.js --network liskSepolia
   ```

3. Update the frontend with the new contract address:
   ```bash
   cd strapt-contracts
   node scripts/update-frontend-abi.js
   ```

## Usage Examples

### Creating a Stream

```typescript
// Frontend example
const { createStream } = usePaymentStream();

// Create a stream with 100 USDC over 30 days with 3 milestones
const streamId = await createStream(
  recipientAddress,
  'USDC',
  '100',
  30 * 86400, // 30 days in seconds
  [25, 50, 75], // Milestone percentages
  ['First quarter', 'Half way', 'Three quarters'] // Milestone descriptions
);
```

### Releasing a Milestone

```typescript
// Frontend example
const { releaseMilestone } = usePaymentStream();

// Release the first milestone (index 0)
await releaseMilestone(streamId, 0);
```

### Pausing and Resuming a Stream

```typescript
// Frontend example
const { pauseStream, resumeStream } = usePaymentStream();

// Pause a stream
await pauseStream(streamId);

// Resume a stream
await resumeStream(streamId);
```

## Testing

The `PaymentStream` contract includes comprehensive tests to ensure its functionality. The tests are located in `test/PaymentStream.test.js`.

To run the tests:

```bash
cd strapt-contracts
npx hardhat test
```

## Future Improvements

1. **Stream Discovery**: Implement a way to discover streams for a user.
2. **Stream Notifications**: Add notifications for stream events.
3. **Stream Analytics**: Add analytics for streams.
4. **Stream Templates**: Add templates for common stream configurations.
5. **Stream Sharing**: Add the ability to share streams with others.

## Conclusion

The Payment Stream feature provides a flexible and powerful way to create and manage token streams. It is ideal for a wide range of use cases, from paying freelancers to project-based work.
