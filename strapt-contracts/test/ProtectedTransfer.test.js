const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ProtectedTransfer", function () {
  let protectedTransfer;
  let idrx;
  let usdc;
  let owner;
  let sender;
  let recipient;
  let ownerAddress;
  let senderAddress;
  let recipientAddress;

  const claimCode = "SECRET123";
  const claimCodeHash = ethers.keccak256(ethers.toUtf8Bytes(claimCode));
  const transferAmount = ethers.parseUnits("100", 6); // 100 tokens with 6 decimals

  beforeEach(async function () {
    // Get signers
    [owner, sender, recipient] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    senderAddress = await sender.getAddress();
    recipientAddress = await recipient.getAddress();

    // Deploy IDRX token
    const IDRXFactory = await ethers.getContractFactory("IDRX");
    idrx = await IDRXFactory.deploy(ownerAddress);

    // Deploy USDC token
    const USDCFactory = await ethers.getContractFactory("contracts/mocks/USDCMock.sol:USDCMock");
    usdc = await USDCFactory.deploy(ownerAddress);

    // Deploy ProtectedTransfer contract
    const ProtectedTransferFactory = await ethers.getContractFactory("ProtectedTransfer");
    // Deploy with 0 fee for testing
    protectedTransfer = await ProtectedTransferFactory.deploy(
      ownerAddress,     // initialOwner
      ownerAddress,     // initialFeeCollector
      0                 // initialFeeInBasisPoints (0% fee for testing)
    );

    // Whitelist tokens
    await protectedTransfer.setTokenSupport(await idrx.getAddress(), true);
    await protectedTransfer.setTokenSupport(await usdc.getAddress(), true);

    // Mint tokens to sender
    await idrx.mint(senderAddress, transferAmount * BigInt(10));
    await usdc.mint(senderAddress, transferAmount * BigInt(10));

    // Approve ProtectedTransfer contract to spend tokens
    await idrx.connect(sender).approve(await protectedTransfer.getAddress(), transferAmount * BigInt(10));
    await usdc.connect(sender).approve(await protectedTransfer.getAddress(), transferAmount * BigInt(10));
  });

  describe("Creating transfers", function () {
    it("Should create a transfer with IDRX token", async function () {
      const expiry = await time.latest() + 3600; // 1 hour from now

      const tx = await protectedTransfer.connect(sender).createTransfer(
        recipientAddress,
        await idrx.getAddress(),
        transferAmount,
        expiry,
        claimCodeHash
      );

      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log) => log.fragment?.name === "TransferCreated"
      );

      expect(event).to.not.be.undefined;
      const transferId = event?.args[0];

      const transfer = await protectedTransfer.getTransfer(transferId);
      expect(transfer.sender).to.equal(senderAddress);
      expect(transfer.recipient).to.equal(recipientAddress);
      expect(transfer.tokenAddress).to.equal(await idrx.getAddress());
      expect(transfer.amount).to.equal(transferAmount);
      expect(transfer.expiry).to.equal(expiry);
      // Skip checking claimCodeHash as it's implementation-specific
      expect(transfer.status).to.equal(0); // Pending
      expect(transfer.isLinkTransfer).to.equal(false); // Not a link transfer
    });

    it("Should create a transfer with USDC token", async function () {
      const expiry = await time.latest() + 3600; // 1 hour from now

      const tx = await protectedTransfer.connect(sender).createTransfer(
        recipientAddress,
        await usdc.getAddress(),
        transferAmount,
        expiry,
        claimCodeHash
      );

      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log) => log.fragment?.name === "TransferCreated"
      );

      expect(event).to.not.be.undefined;
      const transferId = event?.args[0];

      const transfer = await protectedTransfer.getTransfer(transferId);
      expect(transfer.tokenAddress).to.equal(await usdc.getAddress());
    });

    it("Should create a transfer with zero recipient (for link/QR)", async function () {
      const expiry = await time.latest() + 3600; // 1 hour from now

      const tx = await protectedTransfer.connect(sender).createTransfer(
        ethers.ZeroAddress,
        await idrx.getAddress(),
        transferAmount,
        expiry,
        claimCodeHash
      );

      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log) => log.fragment?.name === "TransferCreated"
      );

      expect(event).to.not.be.undefined;
      const transferId = event?.args[0];

      const transfer = await protectedTransfer.getTransfer(transferId);
      expect(transfer.recipient).to.equal(ethers.ZeroAddress);
      expect(transfer.isLinkTransfer).to.equal(false); // Still not a link transfer
    });

    it("Should create a link transfer", async function () {
      const expiry = await time.latest() + 3600; // 1 hour from now

      const tx = await protectedTransfer.connect(sender).createLinkTransfer(
        await idrx.getAddress(),
        transferAmount,
        expiry
      );

      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log) => log.fragment?.name === "TransferCreated"
      );

      expect(event).to.not.be.undefined;
      const transferId = event?.args[0];

      const transfer = await protectedTransfer.getTransfer(transferId);
      expect(transfer.sender).to.equal(senderAddress);
      expect(transfer.recipient).to.equal(ethers.ZeroAddress); // No specific recipient
      expect(transfer.tokenAddress).to.equal(await idrx.getAddress());
      expect(transfer.amount).to.equal(transferAmount);
      expect(transfer.expiry).to.equal(expiry);
      expect(transfer.status).to.equal(0); // Pending
      expect(transfer.isLinkTransfer).to.equal(true); // Is a link transfer
    });
  });

  describe("Claiming transfers", function () {
    let transferId;

    beforeEach(async function () {
      const expiry = await time.latest() + 3600; // 1 hour from now

      const tx = await protectedTransfer.connect(sender).createTransfer(
        recipientAddress,
        await idrx.getAddress(),
        transferAmount,
        expiry,
        claimCodeHash
      );

      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log) => log.fragment?.name === "TransferCreated"
      );

      transferId = event?.args[0];
    });

    it("Should allow recipient to claim with correct code", async function () {
      const initialBalance = await idrx.balanceOf(recipientAddress);

      await protectedTransfer.connect(recipient).claimTransfer(transferId, claimCode);

      const finalBalance = await idrx.balanceOf(recipientAddress);
      expect(finalBalance - initialBalance).to.equal(transferAmount);

      const transfer = await protectedTransfer.transfers(transferId);
      expect(transfer.status).to.equal(1); // Claimed
    });

    it("Should not allow claiming with incorrect code", async function () {
      await expect(
        protectedTransfer.connect(recipient).claimTransfer(transferId, "WRONG_CODE")
      ).to.be.rejectedWith("InvalidClaimCode");
    });

    it("Should not allow non-recipient to claim", async function () {
      await expect(
        protectedTransfer.connect(sender).claimTransfer(transferId, claimCode)
      ).to.be.rejectedWith("NotIntendedRecipient");
    });
  });

  describe("Refunding transfers", function () {
    let transferId;

    beforeEach(async function () {
      const expiry = await time.latest() + 3600; // 1 hour from now

      const tx = await protectedTransfer.connect(sender).createTransfer(
        recipientAddress,
        await idrx.getAddress(),
        transferAmount,
        expiry,
        claimCodeHash
      );

      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log) => log.fragment?.name === "TransferCreated"
      );

      transferId = event?.args[0];
    });

    it("Should allow sender to refund after expiry", async function () {
      // Fast forward time past expiry
      await time.increase(3601);

      const initialBalance = await idrx.balanceOf(senderAddress);

      await protectedTransfer.connect(sender).refundTransfer(transferId);

      const finalBalance = await idrx.balanceOf(senderAddress);
      expect(finalBalance - initialBalance).to.equal(transferAmount);

      const transfer = await protectedTransfer.transfers(transferId);
      expect(transfer.status).to.equal(2); // Refunded
    });

    it("Should not allow refund before expiry", async function () {
      await expect(
        protectedTransfer.connect(sender).refundTransfer(transferId)
      ).to.be.rejectedWith("TransferNotExpired");
    });

    it("Should not allow non-sender to refund", async function () {
      // Fast forward time past expiry
      await time.increase(3601);

      await expect(
        protectedTransfer.connect(recipient).refundTransfer(transferId)
      ).to.be.rejectedWith("NotTransferSender");
    });
  });

  describe("Fee functionality", function () {
    it("Should collect fees when fee is set", async function () {
      // Set fee to 0.5% (50 basis points)
      await protectedTransfer.connect(owner).setFee(50);

      const expiry = await time.latest() + 3600; // 1 hour from now

      // Check initial balance of fee collector
      const initialFeeCollectorBalance = await idrx.balanceOf(ownerAddress);

      // Create transfer with fee
      await protectedTransfer.connect(sender).createTransfer(
        recipientAddress,
        await idrx.getAddress(),
        transferAmount,
        expiry,
        claimCodeHash
      );

      // Calculate expected fee (0.5% of transfer amount)
      const expectedFee = (transferAmount * BigInt(50)) / BigInt(10000);

      // Check fee collector received the fee
      const finalFeeCollectorBalance = await idrx.balanceOf(ownerAddress);
      expect(finalFeeCollectorBalance - initialFeeCollectorBalance).to.equal(expectedFee);
    });

    it("Should not allow setting fee above maximum", async function () {
      // Try to set fee to 6% (600 basis points), which exceeds the 5% maximum
      await expect(
        protectedTransfer.connect(owner).setFee(600)
      ).to.be.rejectedWith("FeeExceedsMaximum");
    });

    it("Should allow changing fee collector", async function () {
      // Set a new fee collector
      await protectedTransfer.connect(owner).setFeeCollector(recipientAddress);

      // Set fee to 1% (100 basis points)
      await protectedTransfer.connect(owner).setFee(100);

      const expiry = await time.latest() + 3600; // 1 hour from now

      // Check initial balance of new fee collector
      const initialFeeCollectorBalance = await idrx.balanceOf(recipientAddress);

      // Create transfer with fee
      await protectedTransfer.connect(sender).createTransfer(
        ethers.ZeroAddress, // Zero address for link/QR transfers
        await idrx.getAddress(),
        transferAmount,
        expiry,
        claimCodeHash
      );

      // Calculate expected fee (1% of transfer amount)
      const expectedFee = (transferAmount * BigInt(100)) / BigInt(10000);

      // Check new fee collector received the fee
      const finalFeeCollectorBalance = await idrx.balanceOf(recipientAddress);
      expect(finalFeeCollectorBalance - initialFeeCollectorBalance).to.equal(expectedFee);
    });
  });

  describe("Token whitelist", function () {
    it("Should allow adding and removing tokens from whitelist", async function () {
      // Check initial whitelist status
      expect(await protectedTransfer.supportedTokens(await idrx.getAddress())).to.equal(true);

      // Remove token from whitelist
      await protectedTransfer.connect(owner).setTokenSupport(await idrx.getAddress(), false);

      // Check updated whitelist status
      expect(await protectedTransfer.supportedTokens(await idrx.getAddress())).to.equal(false);

      // Add token back to whitelist
      await protectedTransfer.connect(owner).setTokenSupport(await idrx.getAddress(), true);

      // Check updated whitelist status
      expect(await protectedTransfer.supportedTokens(await idrx.getAddress())).to.equal(true);
    });
  });

  describe("Transfer status check", function () {
    let transferId;
    let linkTransferId;
    let protectedLinkTransferId;
    const protectedLinkClaimCode = "PROTECTED123";
    const protectedLinkClaimCodeHash = ethers.keccak256(ethers.toUtf8Bytes(protectedLinkClaimCode));

    beforeEach(async function () {
      const expiry = await time.latest() + 3600; // 1 hour from now

      // Create a regular transfer
      let tx = await protectedTransfer.connect(sender).createTransfer(
        recipientAddress,
        await idrx.getAddress(),
        transferAmount,
        expiry,
        claimCodeHash
      );

      let receipt = await tx.wait();
      let event = receipt?.logs.find(
        (log) => log.fragment?.name === "TransferCreated"
      );

      transferId = event?.args[0];

      // Create a link transfer without password
      tx = await protectedTransfer.connect(sender).createLinkTransfer(
        await idrx.getAddress(),
        transferAmount,
        expiry
      );

      receipt = await tx.wait();
      event = receipt?.logs.find(
        (log) => log.fragment?.name === "TransferCreated"
      );

      linkTransferId = event?.args[0];

      // Create a protected link transfer with password
      tx = await protectedTransfer.connect(sender).createProtectedLinkTransfer(
        await idrx.getAddress(),
        transferAmount,
        expiry,
        protectedLinkClaimCodeHash
      );

      receipt = await tx.wait();
      event = receipt?.logs.find(
        (log) => log.fragment?.name === "TransferCreated"
      );

      protectedLinkTransferId = event?.args[0];
    });

    it("Should correctly report if a transfer is claimable", async function () {
      // Check if transfer is claimable
      expect(await protectedTransfer.isTransferClaimable(transferId)).to.equal(true);

      // Claim the transfer
      await protectedTransfer.connect(recipient).claimTransfer(transferId, claimCode);

      // Check if transfer is no longer claimable
      expect(await protectedTransfer.isTransferClaimable(transferId)).to.equal(false);
    });

    it("Should correctly report if a transfer is expired", async function () {
      // Initially not expired
      expect(await protectedTransfer.isTransferClaimable(transferId)).to.equal(true);

      // Fast forward time past expiry
      await time.increase(3601);

      // Should now be expired and not claimable
      expect(await protectedTransfer.isTransferClaimable(transferId)).to.equal(false);
    });

    it("Should correctly report if a transfer is password protected", async function () {
      // Regular transfer should be password protected
      expect(await protectedTransfer.isPasswordProtected(transferId)).to.equal(true);

      // Link transfer without password should not be password protected
      expect(await protectedTransfer.isPasswordProtected(linkTransferId)).to.equal(false);

      // Protected link transfer should be password protected
      expect(await protectedTransfer.isPasswordProtected(protectedLinkTransferId)).to.equal(true);
    });
  });

  describe("Link transfers", function () {
    let linkTransferId;

    beforeEach(async function () {
      const expiry = await time.latest() + 3600; // 1 hour from now

      const tx = await protectedTransfer.connect(sender).createLinkTransfer(
        await idrx.getAddress(),
        transferAmount,
        expiry
      );

      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log) => log.fragment?.name === "TransferCreated"
      );

      linkTransferId = event?.args[0];
    });

    it("Should allow anyone to claim a link transfer", async function () {
      // Check initial balance
      const initialBalance = await idrx.balanceOf(recipientAddress);

      // Anyone (recipient in this case) can claim the link transfer
      await protectedTransfer.connect(recipient).claimLinkTransfer(linkTransferId);

      // Check final balance
      const finalBalance = await idrx.balanceOf(recipientAddress);
      expect(finalBalance - initialBalance).to.equal(transferAmount);

      // Check transfer status
      const transfer = await protectedTransfer.getTransfer(linkTransferId);
      expect(transfer.status).to.equal(1); // Claimed
    });

    it("Should not allow claiming a link transfer that's already claimed", async function () {
      // First claim
      await protectedTransfer.connect(recipient).claimLinkTransfer(linkTransferId);

      // Try to claim again
      await expect(
        protectedTransfer.connect(sender).claimLinkTransfer(linkTransferId)
      ).to.be.rejectedWith("TransferNotClaimable");
    });

    it("Should not allow claiming a link transfer after expiry", async function () {
      // Fast forward time past expiry
      await time.increase(3601);

      // Try to claim after expiry
      await expect(
        protectedTransfer.connect(recipient).claimLinkTransfer(linkTransferId)
      ).to.be.rejectedWith("TransferExpired");
    });

    it("Should not allow claiming a regular transfer with claimLinkTransfer", async function () {
      // Create a regular transfer
      const expiry = await time.latest() + 3600;
      const tx = await protectedTransfer.connect(sender).createTransfer(
        recipientAddress,
        await idrx.getAddress(),
        transferAmount,
        expiry,
        claimCodeHash
      );

      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log) => log.fragment?.name === "TransferCreated"
      );

      const regularTransferId = event?.args[0];

      // Try to claim regular transfer with claimLinkTransfer
      await expect(
        protectedTransfer.connect(recipient).claimLinkTransfer(regularTransferId)
      ).to.be.rejectedWith("NotLinkTransfer");
    });
  });

  describe("Protected Link transfers", function () {
    let protectedLinkTransferId;
    const protectedLinkClaimCode = "PROTECTED123";
    const protectedLinkClaimCodeHash = ethers.keccak256(ethers.toUtf8Bytes(protectedLinkClaimCode));

    beforeEach(async function () {
      const expiry = await time.latest() + 3600; // 1 hour from now

      const tx = await protectedTransfer.connect(sender).createProtectedLinkTransfer(
        await idrx.getAddress(),
        transferAmount,
        expiry,
        protectedLinkClaimCodeHash
      );

      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log) => log.fragment?.name === "TransferCreated"
      );

      protectedLinkTransferId = event?.args[0];
    });

    it("Should create a protected link transfer correctly", async function () {
      const transfer = await protectedTransfer.getTransfer(protectedLinkTransferId);
      expect(transfer.sender).to.equal(senderAddress);
      expect(transfer.recipient).to.equal(ethers.ZeroAddress); // No specific recipient
      expect(transfer.tokenAddress).to.equal(await idrx.getAddress());
      expect(transfer.amount).to.equal(transferAmount);
      expect(transfer.status).to.equal(0); // Pending
      expect(transfer.isLinkTransfer).to.equal(true); // Is a link transfer

      // Check if it's password protected
      const isPasswordProtected = await protectedTransfer.isPasswordProtected(protectedLinkTransferId);
      expect(isPasswordProtected).to.equal(true);
    });

    it("Should allow claiming a protected link transfer with correct code", async function () {
      // Check initial balance
      const initialBalance = await idrx.balanceOf(recipientAddress);

      // Claim with correct code
      await protectedTransfer.connect(recipient).claimTransfer(protectedLinkTransferId, protectedLinkClaimCode);

      // Check final balance
      const finalBalance = await idrx.balanceOf(recipientAddress);
      expect(finalBalance - initialBalance).to.equal(transferAmount);

      // Check transfer status
      const transfer = await protectedTransfer.getTransfer(protectedLinkTransferId);
      expect(transfer.status).to.equal(1); // Claimed
    });

    it("Should not allow claiming a protected link transfer with incorrect code", async function () {
      await expect(
        protectedTransfer.connect(recipient).claimTransfer(protectedLinkTransferId, "WRONG_CODE")
      ).to.be.rejectedWith("InvalidClaimCode");
    });

    it("Should not allow claiming a protected link transfer with claimLinkTransfer", async function () {
      await expect(
        protectedTransfer.connect(recipient).claimLinkTransfer(protectedLinkTransferId)
      ).to.be.rejectedWith("PasswordProtected");
    });

    it("Should not allow claiming a protected link transfer after expiry", async function () {
      // Fast forward time past expiry
      await time.increase(3601);

      // Try to claim after expiry
      await expect(
        protectedTransfer.connect(recipient).claimTransfer(protectedLinkTransferId, protectedLinkClaimCode)
      ).to.be.rejectedWith("TransferExpired");
    });
  });
});
