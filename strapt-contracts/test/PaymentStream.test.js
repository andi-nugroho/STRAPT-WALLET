const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("PaymentStream", function () {
  let PaymentStream;
  let paymentStream;
  let MockToken;
  let token;
  let owner;
  let feeCollector;
  let sender;
  let recipient;
  let user3;
  let user4;

  const FEE_BASIS_POINTS = 20; // 0.2%

  beforeEach(async function () {
    // Get signers
    [owner, feeCollector, sender, recipient, user3, user4] = await ethers.getSigners();

    // Deploy mock token
    MockToken = await ethers.getContractFactory("MockERC20");
    token = await MockToken.deploy("Mock Token", "MTK", 18);
    await token.waitForDeployment();

    // Deploy PaymentStream contract
    PaymentStream = await ethers.getContractFactory("PaymentStream");
    paymentStream = await PaymentStream.deploy(feeCollector.address, FEE_BASIS_POINTS);
    await paymentStream.waitForDeployment();

    // Set token support
    await paymentStream.setTokenSupport(await token.getAddress(), true);

    // Mint tokens to sender
    await token.mint(sender.address, ethers.parseEther("1000"));

    // Approve tokens for PaymentStream
    await token.connect(sender).approve(await paymentStream.getAddress(), ethers.parseEther("1000"));
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await paymentStream.owner()).to.equal(owner.address);
    });

    it("Should set the right fee collector", async function () {
      expect(await paymentStream.feeCollector()).to.equal(feeCollector.address);
    });

    it("Should set the right fee in basis points", async function () {
      expect(await paymentStream.feeInBasisPoints()).to.equal(FEE_BASIS_POINTS);
    });
  });

  describe("Stream Creation", function () {
    it("Should create a stream successfully", async function () {
      const amount = ethers.parseEther("100");
      const duration = 3600; // 1 hour
      const milestonePercentages = [25, 50, 75];
      const milestoneDescriptions = ["First quarter", "Half way", "Three quarters"];

      // Create stream
      const tx = await paymentStream.connect(sender).createStream(
        recipient.address,
        await token.getAddress(),
        amount,
        duration,
        milestonePercentages,
        milestoneDescriptions
      );

      // Get stream ID from event
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return paymentStream.interface.parseLog(log)?.name === "StreamCreated";
        } catch (e) {
          return false;
        }
      });

      const streamId = event.args.streamId;

      // Check stream details
      const stream = await paymentStream.getStream(streamId);
      expect(stream.sender).to.equal(sender.address);
      expect(stream.recipient).to.equal(recipient.address);
      expect(stream.tokenAddress).to.equal(await token.getAddress());

      // Check fee calculation
      const expectedFee = amount * BigInt(FEE_BASIS_POINTS) / 10000n;
      const expectedAmount = amount - expectedFee;
      expect(stream.amount).to.equal(expectedAmount);

      // Check status
      expect(stream.status).to.equal(0); // Active

      // Check milestone count
      const milestoneCount = await paymentStream.getMilestoneCount(streamId);
      expect(milestoneCount).to.equal(3);

      // Check first milestone
      const milestone = await paymentStream.getMilestone(streamId, 0);
      expect(milestone.percentage).to.equal(25);
      expect(milestone.description).to.equal("First quarter");
      expect(milestone.released).to.equal(false);
    });

    it("Should fail to create a stream with invalid parameters", async function () {
      const amount = ethers.parseEther("100");
      const duration = 3600; // 1 hour
      const milestonePercentages = [25, 50, 75];
      const milestoneDescriptions = ["First quarter", "Half way", "Three quarters"];

      // Zero address recipient
      await expect(
        paymentStream.connect(sender).createStream(
          ethers.ZeroAddress,
          await token.getAddress(),
          amount,
          duration,
          milestonePercentages,
          milestoneDescriptions
        )
      ).to.be.revertedWithCustomError(paymentStream, "InvalidRecipient");

      // Zero amount
      await expect(
        paymentStream.connect(sender).createStream(
          recipient.address,
          await token.getAddress(),
          0,
          duration,
          milestonePercentages,
          milestoneDescriptions
        )
      ).to.be.revertedWithCustomError(paymentStream, "InvalidAmount");

      // Zero duration
      await expect(
        paymentStream.connect(sender).createStream(
          recipient.address,
          await token.getAddress(),
          amount,
          0,
          milestonePercentages,
          milestoneDescriptions
        )
      ).to.be.revertedWithCustomError(paymentStream, "InvalidDuration");

      // Unsupported token
      const unsupportedToken = await MockToken.deploy("Unsupported Token", "UTK", 18);
      await unsupportedToken.waitForDeployment();

      await expect(
        paymentStream.connect(sender).createStream(
          recipient.address,
          await unsupportedToken.getAddress(),
          amount,
          duration,
          milestonePercentages,
          milestoneDescriptions
        )
      ).to.be.revertedWithCustomError(paymentStream, "TokenNotSupported");

      // Mismatched milestone arrays
      await expect(
        paymentStream.connect(sender).createStream(
          recipient.address,
          await token.getAddress(),
          amount,
          duration,
          [25, 50],
          ["First quarter", "Half way", "Three quarters"]
        )
      ).to.be.revertedWithCustomError(paymentStream, "InvalidMilestonePercentage");
    });
  });

  describe("Stream Operations", function () {
    let streamId;
    const amount = ethers.parseEther("100");
    const duration = 3600; // 1 hour
    const milestonePercentages = [25, 50, 75];
    const milestoneDescriptions = ["First quarter", "Half way", "Three quarters"];

    beforeEach(async function () {
      // Create a stream for testing
      const tx = await paymentStream.connect(sender).createStream(
        recipient.address,
        await token.getAddress(),
        amount,
        duration,
        milestonePercentages,
        milestoneDescriptions
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return paymentStream.interface.parseLog(log)?.name === "StreamCreated";
        } catch (e) {
          return false;
        }
      });

      streamId = event.args.streamId;
    });

    it("Should stream tokens over time", async function () {
      // Check initial streamed amount
      let stream = await paymentStream.getStream(streamId);
      expect(stream.streamed).to.equal(0);

      // Advance time by 25% of duration
      await time.increase(duration / 4);

      // Check streamed amount
      stream = await paymentStream.getStream(streamId);
      const expectedFee = amount * BigInt(FEE_BASIS_POINTS) / 10000n;
      const expectedAmount = amount - expectedFee;
      const expectedStreamed = expectedAmount / 4n;

      // Allow for small rounding differences
      const tolerance = ethers.parseEther("0.1");
      expect(stream.streamed).to.be.closeTo(expectedStreamed, tolerance);

      // Update stream
      await paymentStream.updateStream(streamId);

      // Check updated streamed amount
      stream = await paymentStream.getStream(streamId);
      expect(stream.streamed).to.be.closeTo(expectedStreamed, tolerance);
    });

    it("Should pause and resume a stream", async function () {
      // Advance time by 25% of duration
      await time.increase(duration / 4);

      // Pause stream
      await paymentStream.connect(sender).pauseStream(streamId);

      // Check stream status
      let stream = await paymentStream.getStream(streamId);
      expect(stream.status).to.equal(1); // Paused

      // Record streamed amount at pause
      const streamedAtPause = stream.streamed;

      // Advance time further
      await time.increase(duration / 4);

      // Check that streamed amount hasn't changed
      stream = await paymentStream.getStream(streamId);
      expect(stream.streamed).to.equal(streamedAtPause);

      // Resume stream
      await paymentStream.connect(sender).resumeStream(streamId);

      // Check stream status
      stream = await paymentStream.getStream(streamId);
      expect(stream.status).to.equal(0); // Active

      // Advance time further
      await time.increase(duration / 4);

      // Check that streamed amount has increased
      stream = await paymentStream.getStream(streamId);
      expect(stream.streamed).to.be.gt(streamedAtPause);
    });

    it("Should release milestones", async function () {
      // Release first milestone
      await paymentStream.connect(sender).releaseMilestone(streamId, 0);

      // Check milestone status
      let milestone = await paymentStream.getMilestone(streamId, 0);
      expect(milestone.released).to.equal(true);

      // Check streamed amount
      const expectedFee = amount * BigInt(FEE_BASIS_POINTS) / 10000n;
      const expectedAmount = amount - expectedFee;
      const expectedStreamed = (expectedAmount * 25n) / 100n;

      let stream = await paymentStream.getStream(streamId);
      // Allow for small rounding differences
      const tolerance = ethers.parseEther("0.1");
      expect(stream.streamed).to.be.closeTo(expectedStreamed, tolerance);

      // Try to release the same milestone again
      await expect(
        paymentStream.connect(sender).releaseMilestone(streamId, 0)
      ).to.be.revertedWithCustomError(paymentStream, "MilestoneAlreadyReleased");

      // Release second milestone
      await paymentStream.connect(sender).releaseMilestone(streamId, 1);

      // Check milestone status
      milestone = await paymentStream.getMilestone(streamId, 1);
      expect(milestone.released).to.equal(true);

      // Check streamed amount (should be 25% + 50% = 75% of total)
      const expectedStreamed2 = (expectedAmount * 75n) / 100n;

      stream = await paymentStream.getStream(streamId);
      expect(stream.streamed).to.be.closeTo(expectedStreamed2, tolerance);
    });

    it("Should cancel a stream", async function () {
      // Advance time by 25% of duration
      await time.increase(duration / 4);

      // Get initial balances
      const senderBalanceBefore = await token.balanceOf(sender.address);
      const recipientBalanceBefore = await token.balanceOf(recipient.address);

      // Cancel stream
      await paymentStream.connect(sender).cancelStream(streamId);

      // Check stream status
      const stream = await paymentStream.getStream(streamId);
      expect(stream.status).to.equal(3); // Canceled

      // Check balances
      const senderBalanceAfter = await token.balanceOf(sender.address);
      const recipientBalanceAfter = await token.balanceOf(recipient.address);

      // Sender should get back ~75% of the amount (minus fee)
      const expectedFee = amount * BigInt(FEE_BASIS_POINTS) / 10000n;
      const expectedAmount = amount - expectedFee;
      const expectedStreamed = expectedAmount / 4n;
      const expectedRefund = expectedAmount - expectedStreamed;

      // Allow for small rounding differences
      const tolerance = ethers.parseEther("0.1");
      expect(senderBalanceAfter - senderBalanceBefore).to.be.closeTo(expectedRefund, tolerance);

      // Recipient should get ~25% of the amount
      expect(recipientBalanceAfter - recipientBalanceBefore).to.be.closeTo(expectedStreamed, tolerance);
    });

    it("Should withdraw from a stream", async function () {
      // Advance time by 50% of duration
      await time.increase(duration / 2);

      // Get initial balances
      const recipientBalanceBefore = await token.balanceOf(recipient.address);

      // Withdraw from stream
      await paymentStream.connect(recipient).withdrawFromStream(streamId);

      // Check recipient balance
      const recipientBalanceAfter = await token.balanceOf(recipient.address);

      // Recipient should get ~50% of the amount
      const expectedFee = amount * BigInt(FEE_BASIS_POINTS) / 10000n;
      const expectedAmount = amount - expectedFee;
      const expectedStreamed = expectedAmount / 2n;

      // Allow for small rounding differences
      const tolerance = ethers.parseEther("0.1");
      expect(recipientBalanceAfter - recipientBalanceBefore).to.be.closeTo(expectedStreamed, tolerance);

      // Check streamed amount is reset
      const stream = await paymentStream.getStream(streamId);
      expect(stream.streamed).to.equal(0);
    });

    it("Should complete a stream after full duration", async function () {
      // Advance time beyond duration
      await time.increase(duration + 10);

      // Update stream
      await paymentStream.updateStream(streamId);

      // Check stream status
      const stream = await paymentStream.getStream(streamId);
      expect(stream.status).to.equal(2); // Completed

      // Check streamed amount
      const expectedFee = amount * BigInt(FEE_BASIS_POINTS) / 10000n;
      const expectedAmount = amount - expectedFee;
      expect(stream.streamed).to.equal(expectedAmount);
    });
  });

  describe("Additional Stream Scenarios", function () {
    let streamId;

    it("Should handle streams without milestones", async function () {
      // Create a stream without milestones
      const amount = ethers.parseEther("100");
      const duration = 3600; // 1 hour

      const tx = await paymentStream.connect(sender).createStream(
        recipient.address,
        await token.getAddress(),
        amount,
        duration,
        [], // No milestones
        [] // No milestone descriptions
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return paymentStream.interface.parseLog(log)?.name === "StreamCreated";
        } catch (e) {
          return false;
        }
      });

      streamId = event.args.streamId;

      // Check milestone count
      const milestoneCount = await paymentStream.getMilestoneCount(streamId);
      expect(milestoneCount).to.equal(0);

      // Advance time by 50% of duration
      await time.increase(duration / 2);

      // Check streamed amount
      const stream = await paymentStream.getStream(streamId);
      const expectedFee = amount * BigInt(FEE_BASIS_POINTS) / 10000n;
      const expectedAmount = amount - expectedFee;
      const expectedStreamed = expectedAmount / 2n;

      // Allow for small rounding differences
      const tolerance = ethers.parseEther("0.1");
      expect(stream.streamed).to.be.closeTo(expectedStreamed, tolerance);
    });

    it("Should not allow non-sender to pause stream", async function () {
      // Create a stream
      const amount = ethers.parseEther("100");
      const duration = 3600; // 1 hour

      const tx = await paymentStream.connect(sender).createStream(
        recipient.address,
        await token.getAddress(),
        amount,
        duration,
        [25, 50, 75],
        ["First quarter", "Half way", "Three quarters"]
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return paymentStream.interface.parseLog(log)?.name === "StreamCreated";
        } catch (e) {
          return false;
        }
      });

      streamId = event.args.streamId;

      // Try to pause stream as recipient (should fail)
      await expect(
        paymentStream.connect(recipient).pauseStream(streamId)
      ).to.be.revertedWithCustomError(paymentStream, "NotStreamSender");

      // Try to pause stream as random user (should fail)
      await expect(
        paymentStream.connect(user3).pauseStream(streamId)
      ).to.be.revertedWithCustomError(paymentStream, "NotStreamSender");
    });

    it("Should not allow non-recipient to withdraw", async function () {
      // Create a stream
      const amount = ethers.parseEther("100");
      const duration = 3600; // 1 hour

      const tx = await paymentStream.connect(sender).createStream(
        recipient.address,
        await token.getAddress(),
        amount,
        duration,
        [25, 50, 75],
        ["First quarter", "Half way", "Three quarters"]
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return paymentStream.interface.parseLog(log)?.name === "StreamCreated";
        } catch (e) {
          return false;
        }
      });

      streamId = event.args.streamId;

      // Try to withdraw as sender (should fail)
      await expect(
        paymentStream.connect(sender).withdrawFromStream(streamId)
      ).to.be.revertedWithCustomError(paymentStream, "NotStreamRecipient");

      // Try to withdraw as random user (should fail)
      await expect(
        paymentStream.connect(user3).withdrawFromStream(streamId)
      ).to.be.revertedWithCustomError(paymentStream, "NotStreamRecipient");
    });

    it("Should not allow pausing an already paused stream", async function () {
      // Create a stream
      const amount = ethers.parseEther("100");
      const duration = 3600; // 1 hour

      const tx = await paymentStream.connect(sender).createStream(
        recipient.address,
        await token.getAddress(),
        amount,
        duration,
        [25, 50, 75],
        ["First quarter", "Half way", "Three quarters"]
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return paymentStream.interface.parseLog(log)?.name === "StreamCreated";
        } catch (e) {
          return false;
        }
      });

      streamId = event.args.streamId;

      // Pause stream
      await paymentStream.connect(sender).pauseStream(streamId);

      // Try to pause again (should fail)
      await expect(
        paymentStream.connect(sender).pauseStream(streamId)
      ).to.be.revertedWithCustomError(paymentStream, "StreamNotActive");
    });

    it("Should not allow resuming an active stream", async function () {
      // Create a stream
      const amount = ethers.parseEther("100");
      const duration = 3600; // 1 hour

      const tx = await paymentStream.connect(sender).createStream(
        recipient.address,
        await token.getAddress(),
        amount,
        duration,
        [25, 50, 75],
        ["First quarter", "Half way", "Three quarters"]
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return paymentStream.interface.parseLog(log)?.name === "StreamCreated";
        } catch (e) {
          return false;
        }
      });

      streamId = event.args.streamId;

      // Try to resume an active stream (should fail)
      await expect(
        paymentStream.connect(sender).resumeStream(streamId)
      ).to.be.revertedWithCustomError(paymentStream, "StreamAlreadyActive");
    });
  });

  describe("Owner Functions", function () {
    it("Should allow owner to set fee collector", async function () {
      // Set new fee collector
      await paymentStream.connect(owner).setFeeCollector(user3.address);

      // Check fee collector
      expect(await paymentStream.feeCollector()).to.equal(user3.address);
    });

    it("Should allow owner to set fee in basis points", async function () {
      // Set new fee in basis points
      const newFee = 30; // 0.3%
      await paymentStream.connect(owner).setFeeInBasisPoints(newFee);

      // Check fee in basis points
      expect(await paymentStream.feeInBasisPoints()).to.equal(newFee);
    });

    it("Should not allow setting fee above maximum", async function () {
      // Try to set fee above maximum (5%)
      const maxFee = await paymentStream.MAX_FEE();
      const invalidFee = maxFee + 1n;

      await expect(
        paymentStream.connect(owner).setFeeInBasisPoints(invalidFee)
      ).to.be.revertedWithCustomError(paymentStream, "InvalidFee");
    });

    it("Should allow owner to set token support", async function () {
      // Deploy a new token
      const NewToken = await ethers.getContractFactory("MockERC20");
      const newToken = await NewToken.deploy("New Token", "NTK", 18);
      await newToken.waitForDeployment();

      // Set token support
      await paymentStream.connect(owner).setTokenSupport(await newToken.getAddress(), true);

      // Check token support
      expect(await paymentStream.supportedTokens(await newToken.getAddress())).to.equal(true);

      // Remove token support
      await paymentStream.connect(owner).setTokenSupport(await newToken.getAddress(), false);

      // Check token support
      expect(await paymentStream.supportedTokens(await newToken.getAddress())).to.equal(false);
    });

    it("Should not allow non-owner to set fee collector", async function () {
      await expect(
        paymentStream.connect(sender).setFeeCollector(user3.address)
      ).to.be.revertedWithCustomError(paymentStream, "OwnableUnauthorizedAccount");
    });

    it("Should not allow non-owner to set fee in basis points", async function () {
      await expect(
        paymentStream.connect(sender).setFeeInBasisPoints(30)
      ).to.be.revertedWithCustomError(paymentStream, "OwnableUnauthorizedAccount");
    });

    it("Should not allow non-owner to set token support", async function () {
      await expect(
        paymentStream.connect(sender).setTokenSupport(await token.getAddress(), false)
      ).to.be.revertedWithCustomError(paymentStream, "OwnableUnauthorizedAccount");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle streams with very small amounts", async function () {
      // Create a stream with small amount
      const amount = ethers.parseUnits("1", 6); // 1 USDC (assuming 6 decimals)
      const duration = 3600; // 1 hour

      const tx = await paymentStream.connect(sender).createStream(
        recipient.address,
        await token.getAddress(),
        amount,
        duration,
        [], // No milestones
        [] // No milestone descriptions
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return paymentStream.interface.parseLog(log)?.name === "StreamCreated";
        } catch (e) {
          return false;
        }
      });

      const streamId = event.args.streamId;

      // Advance time by 50% of duration
      await time.increase(duration / 2);

      // Check streamed amount
      const stream = await paymentStream.getStream(streamId);
      const expectedFee = amount * BigInt(FEE_BASIS_POINTS) / 10000n;
      const expectedAmount = amount - expectedFee;
      const expectedStreamed = expectedAmount / 2n;

      // For very small amounts, we need to be more lenient with rounding
      expect(stream.streamed).to.be.closeTo(expectedStreamed, 10n);
    });

    it("Should handle streams with very long durations", async function () {
      // Create a stream with long duration
      const amount = ethers.parseEther("100");
      const duration = 365 * 24 * 3600; // 1 year

      const tx = await paymentStream.connect(sender).createStream(
        recipient.address,
        await token.getAddress(),
        amount,
        duration,
        [], // No milestones
        [] // No milestone descriptions
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return paymentStream.interface.parseLog(log)?.name === "StreamCreated";
        } catch (e) {
          return false;
        }
      });

      const streamId = event.args.streamId;

      // Advance time by a small percentage of duration
      await time.increase(duration / 100); // 1% of duration

      // Check streamed amount
      const stream = await paymentStream.getStream(streamId);
      const expectedFee = amount * BigInt(FEE_BASIS_POINTS) / 10000n;
      const expectedAmount = amount - expectedFee;
      const expectedStreamed = expectedAmount / 100n;

      // Allow for small rounding differences
      const tolerance = ethers.parseEther("0.1");
      expect(stream.streamed).to.be.closeTo(expectedStreamed, tolerance);
    });

    it("Should handle multiple milestone releases in sequence", async function () {
      // Create a stream with multiple milestones
      const amount = ethers.parseEther("100");
      const duration = 3600; // 1 hour
      const milestonePercentages = [10, 20, 30, 40];
      const milestoneDescriptions = ["First", "Second", "Third", "Fourth"];

      const tx = await paymentStream.connect(sender).createStream(
        recipient.address,
        await token.getAddress(),
        amount,
        duration,
        milestonePercentages,
        milestoneDescriptions
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return paymentStream.interface.parseLog(log)?.name === "StreamCreated";
        } catch (e) {
          return false;
        }
      });

      const streamId = event.args.streamId;

      // Release milestones in sequence
      const expectedFee = amount * BigInt(FEE_BASIS_POINTS) / 10000n;
      const expectedAmount = amount - expectedFee;
      let totalReleased = 0n;
      const tolerance = ethers.parseEther("0.1");

      for (let i = 0; i < milestonePercentages.length; i++) {
        // Release milestone
        await paymentStream.connect(sender).releaseMilestone(streamId, i);

        // Check milestone status
        const milestone = await paymentStream.getMilestone(streamId, i);
        expect(milestone.released).to.equal(true);

        // Update total released
        totalReleased += (expectedAmount * BigInt(milestonePercentages[i])) / 100n;

        // Check streamed amount
        const stream = await paymentStream.getStream(streamId);
        expect(stream.streamed).to.be.closeTo(totalReleased, tolerance);
      }

      // Check stream status after all milestones are released
      const stream = await paymentStream.getStream(streamId);
      expect(stream.status).to.equal(2); // Completed
    });

    it("Should handle cancellation of a paused stream", async function () {
      // Create a stream
      const amount = ethers.parseEther("100");
      const duration = 3600; // 1 hour

      const tx = await paymentStream.connect(sender).createStream(
        recipient.address,
        await token.getAddress(),
        amount,
        duration,
        [], // No milestones
        [] // No milestone descriptions
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return paymentStream.interface.parseLog(log)?.name === "StreamCreated";
        } catch (e) {
          return false;
        }
      });

      const streamId = event.args.streamId;

      // Advance time by 25% of duration
      await time.increase(duration / 4);

      // Pause stream
      await paymentStream.connect(sender).pauseStream(streamId);

      // Check stream status
      let stream = await paymentStream.getStream(streamId);
      expect(stream.status).to.equal(1); // Paused

      // Record streamed amount at pause
      const streamedAtPause = stream.streamed;

      // Cancel stream
      await paymentStream.connect(sender).cancelStream(streamId);

      // Check stream status
      stream = await paymentStream.getStream(streamId);
      expect(stream.status).to.equal(3); // Canceled

      // Check that streamed amount hasn't changed
      expect(stream.streamed).to.equal(streamedAtPause);
    });
  });
});
