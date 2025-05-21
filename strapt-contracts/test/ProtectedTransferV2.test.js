const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ProtectedTransferV2", function () {
  // Test variables
  let ProtectedTransferV2;
  let protectedTransfer;
  let mockUSDC;
  let mockIDRX;
  let owner;
  let feeCollector;
  let sender;
  let recipient;
  let user3;
  let user4;

  // Constants
  const INITIAL_BALANCE = ethers.parseUnits("1000", 6); // 1000 USDC
  const TRANSFER_AMOUNT = ethers.parseUnits("100", 6);  // 100 USDC
  const FEE_BASIS_POINTS = 20; // 0.2%
  const ONE_DAY = 24 * 60 * 60; // 24 hours in seconds

  // Helper function to create a claim code hash
  function createClaimCodeHash(claimCode) {
    return ethers.keccak256(ethers.toUtf8Bytes(claimCode));
  }

  beforeEach(async function () {
    // Get signers
    [owner, feeCollector, sender, recipient, user3, user4] = await ethers.getSigners();

    // Deploy mock tokens
    const MockToken = await ethers.getContractFactory("MockERC20");
    mockUSDC = await MockToken.deploy("Mock USDC", "USDC", 6);
    mockIDRX = await MockToken.deploy("Mock IDRX", "IDRX", 2);

    // Deploy ProtectedTransferV2
    ProtectedTransferV2 = await ethers.getContractFactory("ProtectedTransferV2");
    protectedTransfer = await ProtectedTransferV2.deploy(feeCollector.address, FEE_BASIS_POINTS);

    // Set token support
    await protectedTransfer.setTokenSupport(await mockUSDC.getAddress(), true);
    await protectedTransfer.setTokenSupport(await mockIDRX.getAddress(), true);

    // Mint tokens to sender
    await mockUSDC.mint(sender.address, INITIAL_BALANCE);
    await mockIDRX.mint(sender.address, INITIAL_BALANCE);

    // Approve tokens for transfer
    await mockUSDC.connect(sender).approve(await protectedTransfer.getAddress(), INITIAL_BALANCE);
    await mockIDRX.connect(sender).approve(await protectedTransfer.getAddress(), INITIAL_BALANCE);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await protectedTransfer.owner()).to.equal(owner.address);
    });

    it("Should set the right fee collector", async function () {
      expect(await protectedTransfer.feeCollector()).to.equal(feeCollector.address);
    });

    it("Should set the right fee in basis points", async function () {
      expect(await protectedTransfer.feeInBasisPoints()).to.equal(FEE_BASIS_POINTS);
    });
  });

  describe("Direct Transfers with Password", function () {
    let transferId;
    const claimCode = "secret123";
    const claimCodeHash = createClaimCodeHash(claimCode);

    beforeEach(async function () {
      // Create a direct transfer with password protection
      const tx = await protectedTransfer.connect(sender).createDirectTransfer(
        recipient.address,
        await mockUSDC.getAddress(),
        TRANSFER_AMOUNT,
        0, // Use default expiry
        true, // Has password
        claimCodeHash
      );

      // Get the transfer ID from the event
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === 'TransferCreated'
      );
      transferId = event.args[0]; // First arg is transferId
    });

    it("Should create a direct transfer with password protection", async function () {
      // Get the transfer details
      const transfer = await protectedTransfer.getTransfer(transferId);

      expect(transfer[0]).to.equal(sender.address); // sender
      expect(transfer[1]).to.equal(recipient.address); // recipient
      expect(transfer[2]).to.equal(await mockUSDC.getAddress()); // tokenAddress

      // Calculate expected amount after fee
      const fee = TRANSFER_AMOUNT * BigInt(FEE_BASIS_POINTS) / 10000n;
      const expectedAmount = TRANSFER_AMOUNT - fee;

      expect(transfer[3]).to.equal(expectedAmount); // amount
      expect(transfer[4]).to.equal(TRANSFER_AMOUNT); // grossAmount
      expect(transfer[8]).to.equal(false); // isLinkTransfer
      expect(transfer[9]).to.equal(true); // hasPassword
    });

    it("Should require the correct password to claim", async function () {
      // Try to claim with wrong password
      await expect(
        protectedTransfer.connect(recipient).claimTransfer(transferId, "wrongpassword")
      ).to.be.revertedWithCustomError(protectedTransfer, "InvalidClaimCode");

      // Claim with correct password
      await protectedTransfer.connect(recipient).claimTransfer(transferId, claimCode);

      // Check recipient balance
      const fee = TRANSFER_AMOUNT * BigInt(FEE_BASIS_POINTS) / 10000n;
      const expectedAmount = TRANSFER_AMOUNT - fee;
      expect(await mockUSDC.balanceOf(recipient.address)).to.equal(expectedAmount);

      // Check transfer status
      const transfer = await protectedTransfer.getTransfer(transferId);
      expect(transfer[6]).to.equal(1); // status = Claimed
    });

    it("Should only allow the intended recipient to claim", async function () {
      // Try to claim as non-recipient
      await expect(
        protectedTransfer.connect(user3).claimTransfer(transferId, claimCode)
      ).to.be.revertedWithCustomError(protectedTransfer, "NotIntendedRecipient");
    });

    it("Should track transfers for the recipient", async function () {
      // Get recipient transfers
      const recipientTransfers = await protectedTransfer.getRecipientTransfers(recipient.address);

      // Check that the transfer is in the list
      expect(recipientTransfers).to.include(transferId);
    });
  });

  describe("Direct Transfers without Password", function () {
    let transferId;

    beforeEach(async function () {
      // Create a direct transfer without password protection
      const tx = await protectedTransfer.connect(sender).createDirectTransfer(
        recipient.address,
        await mockUSDC.getAddress(),
        TRANSFER_AMOUNT,
        0, // Use default expiry
        false, // No password
        ethers.ZeroHash // Empty claim code hash
      );

      // Get the transfer ID from the event
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === 'TransferCreated'
      );
      transferId = event.args[0]; // First arg is transferId
    });

    it("Should create a direct transfer without password protection", async function () {
      // Get the transfer details
      const transfer = await protectedTransfer.getTransfer(transferId);

      expect(transfer[0]).to.equal(sender.address); // sender
      expect(transfer[1]).to.equal(recipient.address); // recipient
      expect(transfer[8]).to.equal(false); // isLinkTransfer
      expect(transfer[9]).to.equal(false); // hasPassword
    });

    it("Should allow claiming without a password", async function () {
      // Claim without password (empty string)
      await protectedTransfer.connect(recipient).claimTransfer(transferId, "");

      // Check recipient balance
      const fee = TRANSFER_AMOUNT * BigInt(FEE_BASIS_POINTS) / 10000n;
      const expectedAmount = TRANSFER_AMOUNT - fee;
      expect(await mockUSDC.balanceOf(recipient.address)).to.equal(expectedAmount);
    });

    it("Should still only allow the intended recipient to claim", async function () {
      // Try to claim as non-recipient
      await expect(
        protectedTransfer.connect(user3).claimTransfer(transferId, "")
      ).to.be.revertedWithCustomError(protectedTransfer, "NotIntendedRecipient");
    });
  });

  describe("Link Transfers with Password", function () {
    let transferId;
    const claimCode = "linkpassword123";
    const claimCodeHash = createClaimCodeHash(claimCode);

    beforeEach(async function () {
      // Create a link transfer with password protection
      const tx = await protectedTransfer.connect(sender).createLinkTransfer(
        await mockUSDC.getAddress(),
        TRANSFER_AMOUNT,
        0, // Use default expiry
        true, // Has password
        claimCodeHash
      );

      // Get the transfer ID from the event
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === 'TransferCreated'
      );
      transferId = event.args[0]; // First arg is transferId
    });

    it("Should create a link transfer with password protection", async function () {
      // Get the transfer details
      const transfer = await protectedTransfer.getTransfer(transferId);

      expect(transfer[0]).to.equal(sender.address); // sender
      expect(transfer[1]).to.equal(ethers.ZeroAddress); // recipient (zero address for link transfers)
      expect(transfer[8]).to.equal(true); // isLinkTransfer
      expect(transfer[9]).to.equal(true); // hasPassword
    });

    it("Should require the correct password to claim", async function () {
      // Try to claim with wrong password
      await expect(
        protectedTransfer.connect(user3).claimTransfer(transferId, "wrongpassword")
      ).to.be.revertedWithCustomError(protectedTransfer, "InvalidClaimCode");

      // Claim with correct password
      await protectedTransfer.connect(user3).claimTransfer(transferId, claimCode);

      // Check claimer balance
      const fee = TRANSFER_AMOUNT * BigInt(FEE_BASIS_POINTS) / 10000n;
      const expectedAmount = TRANSFER_AMOUNT - fee;
      expect(await mockUSDC.balanceOf(user3.address)).to.equal(expectedAmount);
    });

    it("Should allow anyone with the correct password to claim", async function () {
      // Claim with correct password from a different user
      await protectedTransfer.connect(user4).claimTransfer(transferId, claimCode);

      // Check claimer balance
      const fee = TRANSFER_AMOUNT * BigInt(FEE_BASIS_POINTS) / 10000n;
      const expectedAmount = TRANSFER_AMOUNT - fee;
      expect(await mockUSDC.balanceOf(user4.address)).to.equal(expectedAmount);
    });
  });

  describe("Link Transfers without Password", function () {
    let transferId;

    beforeEach(async function () {
      // Create a link transfer without password protection
      const tx = await protectedTransfer.connect(sender).createLinkTransfer(
        await mockUSDC.getAddress(),
        TRANSFER_AMOUNT,
        0, // Use default expiry
        false, // No password
        ethers.ZeroHash // Empty claim code hash
      );

      // Get the transfer ID from the event
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === 'TransferCreated'
      );
      transferId = event.args[0]; // First arg is transferId
    });

    it("Should create a link transfer without password protection", async function () {
      // Get the transfer details
      const transfer = await protectedTransfer.getTransfer(transferId);

      expect(transfer[0]).to.equal(sender.address); // sender
      expect(transfer[1]).to.equal(ethers.ZeroAddress); // recipient (zero address for link transfers)
      expect(transfer[8]).to.equal(true); // isLinkTransfer
      expect(transfer[9]).to.equal(false); // hasPassword
    });

    it("Should allow anyone to claim without a password", async function () {
      // Claim without password
      await protectedTransfer.connect(user3).claimTransfer(transferId, "");

      // Check claimer balance
      const fee = TRANSFER_AMOUNT * BigInt(FEE_BASIS_POINTS) / 10000n;
      const expectedAmount = TRANSFER_AMOUNT - fee;
      expect(await mockUSDC.balanceOf(user3.address)).to.equal(expectedAmount);
    });
  });

  describe("Refund Functionality", function () {
    let transferId;

    beforeEach(async function () {
      // Create a direct transfer
      const tx = await protectedTransfer.connect(sender).createDirectTransfer(
        recipient.address,
        await mockUSDC.getAddress(),
        TRANSFER_AMOUNT,
        (await time.latest()) + ONE_DAY, // 1 day expiry
        true, // Has password
        createClaimCodeHash("refundtest")
      );

      // Get the transfer ID from the event
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === 'TransferCreated'
      );
      transferId = event.args[0]; // First arg is transferId
    });

    it("Should not allow refund before expiry", async function () {
      await expect(
        protectedTransfer.connect(sender).refundTransfer(transferId)
      ).to.be.revertedWithCustomError(protectedTransfer, "TransferNotExpired");
    });

    it("Should allow refund after expiry", async function () {
      // Get sender's initial balance
      const initialBalance = await mockUSDC.balanceOf(sender.address);

      // Fast forward time past expiry
      await time.increase(ONE_DAY + 1);

      // Refund the transfer
      await protectedTransfer.connect(sender).refundTransfer(transferId);

      // Check sender balance
      const fee = TRANSFER_AMOUNT * BigInt(FEE_BASIS_POINTS) / 10000n;
      const expectedRefund = TRANSFER_AMOUNT - fee;
      expect(await mockUSDC.balanceOf(sender.address)).to.equal(initialBalance + expectedRefund);

      // Check transfer status
      const transfer = await protectedTransfer.getTransfer(transferId);
      expect(transfer[6]).to.equal(2); // status = Refunded
    });

    it("Should not allow non-sender to refund", async function () {
      // Fast forward time past expiry
      await time.increase(ONE_DAY + 1);

      // Try to refund as non-sender
      await expect(
        protectedTransfer.connect(user3).refundTransfer(transferId)
      ).to.be.revertedWithCustomError(protectedTransfer, "NotTransferSender");
    });

    it("Should not allow refund of claimed transfer", async function () {
      // Claim the transfer
      await protectedTransfer.connect(recipient).claimTransfer(transferId, "refundtest");

      // Fast forward time past expiry
      await time.increase(ONE_DAY + 1);

      // Try to refund claimed transfer
      await expect(
        protectedTransfer.connect(sender).refundTransfer(transferId)
      ).to.be.revertedWithCustomError(protectedTransfer, "TransferNotRefundable");
    });
  });
});
