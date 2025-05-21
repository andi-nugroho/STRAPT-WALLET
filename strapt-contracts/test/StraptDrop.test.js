const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("StraptDrop", function () {
  let straptDrop;
  let mockToken;
  let owner;
  let user1;
  let user2;
  let user3;
  let feeCollector;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const TOKEN_DECIMALS = 2;
  const INITIAL_SUPPLY = ethers.parseUnits("1000000", TOKEN_DECIMALS);
  const BASIS_POINTS = 100; // Match the contract's BASIS_POINTS constant

  beforeEach(async function () {
    // Get signers
    [owner, user1, user2, user3, feeCollector] = await ethers.getSigners();

    // Deploy mock token
    const MockToken = await ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy("IDRX Token", "IDRX", TOKEN_DECIMALS);

    // Mint tokens to users
    await mockToken.mint(owner.address, INITIAL_SUPPLY);
    await mockToken.mint(user1.address, INITIAL_SUPPLY);
    await mockToken.mint(user2.address, INITIAL_SUPPLY);

    // Deploy StraptDrop
    const StraptDrop = await ethers.getContractFactory("StraptDrop");
    straptDrop = await StraptDrop.deploy();

    // Set fee collector
    await straptDrop.setFeeCollector(feeCollector.address);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await straptDrop.owner()).to.equal(owner.address);
    });

    it("Should set the right fee collector", async function () {
      expect(await straptDrop.feeCollector()).to.equal(feeCollector.address);
    });

    it("Should set the default fee percentage", async function () {
      expect(await straptDrop.feePercentage()).to.equal(10); // 0.1%
    });
  });

  describe("Fee Configuration", function () {
    it("Should allow owner to set fee percentage", async function () {
      await straptDrop.setFeePercentage(30);
      expect(await straptDrop.feePercentage()).to.equal(30);
    });

    it("Should revert if fee percentage is too high", async function () {
      await expect(straptDrop.setFeePercentage(501)).to.be.revertedWithCustomError(
        straptDrop,
        "InvalidFeePercentage"
      );
    });

    it("Should allow owner to set fee collector", async function () {
      await straptDrop.setFeeCollector(user3.address);
      expect(await straptDrop.feeCollector()).to.equal(user3.address);
    });

    it("Should revert if fee collector is zero address", async function () {
      await expect(straptDrop.setFeeCollector(ZERO_ADDRESS)).to.be.revertedWithCustomError(
        straptDrop,
        "InvalidAddress"
      );
    });

    it("Should revert if non-owner tries to set fee percentage", async function () {
      await expect(straptDrop.connect(user1).setFeePercentage(30)).to.be.revertedWithCustomError(
        straptDrop,
        "OwnableUnauthorizedAccount"
      );
    });

    it("Should revert if non-owner tries to set fee collector", async function () {
      await expect(straptDrop.connect(user1).setFeeCollector(user3.address)).to.be.revertedWithCustomError(
        straptDrop,
        "OwnableUnauthorizedAccount"
      );
    });
  });

  describe("Create Drop", function () {
    const totalAmount = ethers.parseUnits("1000", TOKEN_DECIMALS);
    const totalRecipients = 10;
    let expiryTime;
    const message = "Happy New Year!";

    beforeEach(async function () {
      // Get contract addresses
      const mockTokenAddress = await mockToken.getAddress();
      const straptDropAddress = await straptDrop.getAddress();

      // Set expiry time to 1 day from now
      expiryTime = (await ethers.provider.getBlock('latest')).timestamp + 86400;

      // Approve token transfer
      await mockToken.approve(straptDropAddress, totalAmount);
    });

    it("Should create a fixed distribution drop", async function () {
      const mockTokenAddress = await mockToken.getAddress();

      const tx = await straptDrop.createDrop(
        mockTokenAddress,
        totalAmount,
        totalRecipients,
        false, // fixed distribution
        expiryTime,
        message
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          const decoded = straptDrop.interface.parseLog(log);
          return decoded && decoded.name === 'DropCreated';
        } catch (e) {
          return false;
        }
      });

      const parsedEvent = straptDrop.interface.parseLog(event);
      const dropId = parsedEvent.args[0];

      // Calculate expected fee
      const feePercentage = await straptDrop.feePercentage();
      const feeAmount = (totalAmount * feePercentage) / BigInt(BASIS_POINTS);
      const netAmount = totalAmount - feeAmount;

      // Check drop info
      const dropInfo = await straptDrop.getDropInfo(dropId);
      expect(dropInfo[0]).to.equal(owner.address); // creator
      expect(dropInfo[1]).to.equal(mockTokenAddress); // tokenAddress
      expect(dropInfo[2]).to.equal(netAmount); // totalAmount
      expect(dropInfo[3]).to.equal(netAmount); // remainingAmount
      expect(dropInfo[4]).to.equal(0); // claimedCount
      expect(dropInfo[5]).to.equal(totalRecipients); // totalRecipients
      expect(dropInfo[6]).to.equal(false); // isRandom
      expect(dropInfo[7]).to.equal(BigInt(expiryTime)); // expiryTime
      expect(dropInfo[8]).to.equal(message); // message
      expect(dropInfo[9]).to.equal(true); // isActive

      // Check fee transfer
      const feeCollectorAddress = await feeCollector.getAddress();
      expect(await mockToken.balanceOf(feeCollectorAddress)).to.equal(feeAmount);
    });

    it("Should revert if amount is zero", async function () {
      const mockTokenAddress = await mockToken.getAddress();

      await expect(straptDrop.createDrop(
        mockTokenAddress,
        0,
        totalRecipients,
        false,
        expiryTime,
        message
      )).to.be.revertedWithCustomError(straptDrop, "InvalidAmount");
    });

    it("Should revert if recipients is zero", async function () {
      const mockTokenAddress = await mockToken.getAddress();

      await expect(straptDrop.createDrop(
        mockTokenAddress,
        totalAmount,
        0,
        false,
        expiryTime,
        message
      )).to.be.revertedWithCustomError(straptDrop, "InvalidRecipients");
    });

    it("Should revert if expiry time is in the past", async function () {
      const mockTokenAddress = await mockToken.getAddress();
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

      await expect(straptDrop.createDrop(
        mockTokenAddress,
        totalAmount,
        totalRecipients,
        false,
        pastTime,
        message
      )).to.be.revertedWithCustomError(straptDrop, "InvalidExpiryTime");
    });

    it("Should revert if token address is zero", async function () {
      await expect(straptDrop.createDrop(
        ZERO_ADDRESS,
        totalAmount,
        totalRecipients,
        false,
        expiryTime,
        message
      )).to.be.revertedWithCustomError(straptDrop, "InvalidAddress");
    });

    it("Should create a random distribution drop", async function () {
      const mockTokenAddress = await mockToken.getAddress();

      const tx = await straptDrop.createDrop(
        mockTokenAddress,
        totalAmount,
        totalRecipients,
        true, // random distribution
        expiryTime,
        message
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          const decoded = straptDrop.interface.parseLog(log);
          return decoded && decoded.name === 'DropCreated';
        } catch (e) {
          return false;
        }
      });

      const parsedEvent = straptDrop.interface.parseLog(event);
      const dropId = parsedEvent.args[0];

      // Calculate expected fee
      const feePercentage = await straptDrop.feePercentage();
      const feeAmount = (totalAmount * feePercentage) / BigInt(BASIS_POINTS);
      const netAmount = totalAmount - feeAmount;

      // Check drop info
      const dropInfo = await straptDrop.getDropInfo(dropId);
      expect(dropInfo[0]).to.equal(owner.address); // creator
      expect(dropInfo[1]).to.equal(mockTokenAddress); // tokenAddress
      expect(dropInfo[2]).to.equal(netAmount); // totalAmount
      expect(dropInfo[3]).to.equal(netAmount); // remainingAmount
      expect(dropInfo[4]).to.equal(0); // claimedCount
      expect(dropInfo[5]).to.equal(totalRecipients); // totalRecipients
      expect(dropInfo[6]).to.equal(true); // isRandom
      expect(dropInfo[7]).to.equal(BigInt(expiryTime)); // expiryTime
      expect(dropInfo[8]).to.equal(message); // message
      expect(dropInfo[9]).to.equal(true); // isActive

      // Check fee transfer
      const feeCollectorAddress = await feeCollector.getAddress();
      expect(await mockToken.balanceOf(feeCollectorAddress)).to.equal(feeAmount);
    });
  });

  describe("Claim Drop", function () {
    let fixedDropId;
    let randomDropId;
    const totalAmount = ethers.parseUnits("1000", TOKEN_DECIMALS);
    const totalRecipients = 5;
    let expiryTime;
    const message = "Happy New Year!";

    beforeEach(async function () {
      // Get contract addresses
      const mockTokenAddress = await mockToken.getAddress();
      const straptDropAddress = await straptDrop.getAddress();

      // Set expiry time to 1 day from now
      expiryTime = (await ethers.provider.getBlock('latest')).timestamp + 86400;

      // Approve token transfer for both drops
      await mockToken.approve(straptDropAddress, totalAmount * BigInt(3));

      // Create a fixed distribution drop
      let tx = await straptDrop.createDrop(
        mockTokenAddress,
        totalAmount,
        totalRecipients,
        false, // fixed distribution
        expiryTime,
        message
      );

      let receipt = await tx.wait();
      let event = receipt.logs.find(log => {
        try {
          const decoded = straptDrop.interface.parseLog(log);
          return decoded && decoded.name === 'DropCreated';
        } catch (e) {
          return false;
        }
      });

      let parsedEvent = straptDrop.interface.parseLog(event);
      fixedDropId = parsedEvent.args[0];

      // Create a random distribution drop
      tx = await straptDrop.createDrop(
        mockTokenAddress,
        totalAmount,
        totalRecipients,
        true, // random distribution
        expiryTime,
        message
      );

      receipt = await tx.wait();
      event = receipt.logs.find(log => {
        try {
          const decoded = straptDrop.interface.parseLog(log);
          return decoded && decoded.name === 'DropCreated';
        } catch (e) {
          return false;
        }
      });

      parsedEvent = straptDrop.interface.parseLog(event);
      randomDropId = parsedEvent.args[0];
    });

    it("Should allow claiming from a fixed distribution drop", async function () {
      // Calculate expected fee
      const feePercentage = await straptDrop.feePercentage();
      const feeAmount = (totalAmount * feePercentage) / BigInt(BASIS_POINTS);
      const netAmount = totalAmount - feeAmount;

      // Calculate expected amount per recipient
      const expectedAmount = netAmount / BigInt(totalRecipients);

      // User1 claims from the drop
      const tx = await straptDrop.connect(user1).claimDrop(fixedDropId);
      const receipt = await tx.wait();

      // Find the DropClaimed event
      const event = receipt.logs.find(log => {
        try {
          const decoded = straptDrop.interface.parseLog(log);
          return decoded && decoded.name === 'DropClaimed';
        } catch (e) {
          return false;
        }
      });

      const parsedEvent = straptDrop.interface.parseLog(event);
      const claimedAmount = parsedEvent.args[2];

      // Check claimed amount
      expect(claimedAmount).to.equal(expectedAmount);

      // Check user1's token balance
      expect(await mockToken.balanceOf(user1.address)).to.equal(INITIAL_SUPPLY + expectedAmount);

      // Check drop state
      const dropInfo = await straptDrop.getDropInfo(fixedDropId);
      expect(dropInfo[3]).to.equal(netAmount - expectedAmount); // remainingAmount
      expect(dropInfo[4]).to.equal(1); // claimedCount
      expect(dropInfo[9]).to.equal(true); // isActive

      // Check that user1 has claimed
      expect(await straptDrop.hasClaimed(fixedDropId, user1.address)).to.equal(true);
      expect(await straptDrop.claimedAmounts(fixedDropId, user1.address)).to.equal(expectedAmount);
    });

    it("Should allow claiming from a random distribution drop", async function () {
      // User1 claims from the random drop
      const tx = await straptDrop.connect(user1).claimDrop(randomDropId);
      const receipt = await tx.wait();

      // Find the DropClaimed event
      const event = receipt.logs.find(log => {
        try {
          const decoded = straptDrop.interface.parseLog(log);
          return decoded && decoded.name === 'DropClaimed';
        } catch (e) {
          return false;
        }
      });

      const parsedEvent = straptDrop.interface.parseLog(event);
      const claimedAmount = parsedEvent.args[2];

      // Check that claimed amount is greater than 0
      expect(claimedAmount).to.be.gt(0);

      // Check drop state
      const dropInfo = await straptDrop.getDropInfo(randomDropId);
      expect(dropInfo[3]).to.equal(dropInfo[2] - claimedAmount); // remainingAmount
      expect(dropInfo[4]).to.equal(1); // claimedCount
      expect(dropInfo[9]).to.equal(true); // isActive

      // Check that user1 has claimed
      expect(await straptDrop.hasClaimed(randomDropId, user1.address)).to.equal(true);
      expect(await straptDrop.claimedAmounts(randomDropId, user1.address)).to.equal(claimedAmount);
    });

    it("Should revert if drop is not active", async function () {
      // Create a new drop
      const mockTokenAddress = await mockToken.getAddress();
      const tx = await straptDrop.createDrop(
        mockTokenAddress,
        totalAmount,
        totalRecipients,
        false,
        expiryTime,
        message
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          const decoded = straptDrop.interface.parseLog(log);
          return decoded && decoded.name === 'DropCreated';
        } catch (e) {
          return false;
        }
      });

      const parsedEvent = straptDrop.interface.parseLog(event);
      const dropId = parsedEvent.args[0];

      // Deactivate the drop by refunding it
      await time.increase(86401); // Increase time by more than 1 day
      await straptDrop.refundExpiredDrop(dropId);

      // Try to claim from the deactivated drop
      await expect(straptDrop.connect(user1).claimDrop(dropId))
        .to.be.revertedWithCustomError(straptDrop, "DropNotActive");
    });

    it("Should revert if drop has expired", async function () {
      // Increase time to after expiry
      await time.increase(86401); // Increase time by more than 1 day

      // Try to claim from the expired drop
      await expect(straptDrop.connect(user1).claimDrop(fixedDropId))
        .to.be.revertedWithCustomError(straptDrop, "DropExpired");
    });

    it("Should revert if all claims are taken", async function () {
      // Create a drop with only 1 recipient
      const mockTokenAddress = await mockToken.getAddress();
      const tx = await straptDrop.createDrop(
        mockTokenAddress,
        totalAmount,
        1, // Only 1 recipient
        false,
        expiryTime,
        message
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          const decoded = straptDrop.interface.parseLog(log);
          return decoded && decoded.name === 'DropCreated';
        } catch (e) {
          return false;
        }
      });

      const parsedEvent = straptDrop.interface.parseLog(event);
      const dropId = parsedEvent.args[0];

      // User1 claims the only spot
      await straptDrop.connect(user1).claimDrop(dropId);

      // Check drop state - should be inactive after all claims are taken
      const dropInfo = await straptDrop.getDropInfo(dropId);
      expect(dropInfo[9]).to.equal(false); // isActive

      // User2 tries to claim but drop is not active
      await expect(straptDrop.connect(user2).claimDrop(dropId))
        .to.be.revertedWithCustomError(straptDrop, "DropNotActive");
    });

    it("Should revert if user has already claimed", async function () {
      // User1 claims from the drop
      await straptDrop.connect(user1).claimDrop(fixedDropId);

      // User1 tries to claim again
      await expect(straptDrop.connect(user1).claimDrop(fixedDropId))
        .to.be.revertedWithCustomError(straptDrop, "AlreadyClaimed");
    });

    it("Should mark drop as inactive when all recipients have claimed", async function () {
      // Create a drop with only 2 recipients
      const mockTokenAddress = await mockToken.getAddress();
      const tx = await straptDrop.createDrop(
        mockTokenAddress,
        totalAmount,
        2, // Only 2 recipients
        false,
        expiryTime,
        message
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          const decoded = straptDrop.interface.parseLog(log);
          return decoded && decoded.name === 'DropCreated';
        } catch (e) {
          return false;
        }
      });

      const parsedEvent = straptDrop.interface.parseLog(event);
      const dropId = parsedEvent.args[0];

      // User1 claims
      await straptDrop.connect(user1).claimDrop(dropId);

      // Check drop is still active
      let dropInfo = await straptDrop.getDropInfo(dropId);
      expect(dropInfo[9]).to.equal(true); // isActive

      // User2 claims (last recipient)
      await straptDrop.connect(user2).claimDrop(dropId);

      // Check drop is now inactive
      dropInfo = await straptDrop.getDropInfo(dropId);
      expect(dropInfo[9]).to.equal(false); // isActive
    });
  });

  describe("Refund Expired Drop", function () {
    let dropId;
    const totalAmount = ethers.parseUnits("1000", TOKEN_DECIMALS);
    const totalRecipients = 5;
    let expiryTime;
    const message = "Happy New Year!";

    beforeEach(async function () {
      // Get contract addresses
      const mockTokenAddress = await mockToken.getAddress();
      const straptDropAddress = await straptDrop.getAddress();

      // Set expiry time to 1 day from now
      expiryTime = (await ethers.provider.getBlock('latest')).timestamp + 86400;

      // Approve token transfer
      await mockToken.approve(straptDropAddress, totalAmount);

      // Create a drop
      const tx = await straptDrop.createDrop(
        mockTokenAddress,
        totalAmount,
        totalRecipients,
        false,
        expiryTime,
        message
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          const decoded = straptDrop.interface.parseLog(log);
          return decoded && decoded.name === 'DropCreated';
        } catch (e) {
          return false;
        }
      });

      const parsedEvent = straptDrop.interface.parseLog(event);
      dropId = parsedEvent.args[0];
    });

    it("Should allow creator to refund an expired drop", async function () {
      // Calculate expected fee
      const feePercentage = await straptDrop.feePercentage();
      const feeAmount = (totalAmount * feePercentage) / BigInt(BASIS_POINTS);
      const netAmount = totalAmount - feeAmount;

      // Increase time to after expiry
      await time.increase(86401); // Increase time by more than 1 day

      // Get owner's balance before refund
      const balanceBefore = await mockToken.balanceOf(owner.address);

      // Refund the expired drop
      const tx = await straptDrop.refundExpiredDrop(dropId);
      const receipt = await tx.wait();

      // Find the DropsExpired event
      const event = receipt.logs.find(log => {
        try {
          const decoded = straptDrop.interface.parseLog(log);
          return decoded && decoded.name === 'DropsExpired';
        } catch (e) {
          return false;
        }
      });

      const parsedEvent = straptDrop.interface.parseLog(event);
      const refundedAmount = parsedEvent.args[2];

      // Check refunded amount
      expect(refundedAmount).to.equal(netAmount);

      // Check owner's balance after refund
      const balanceAfter = await mockToken.balanceOf(owner.address);
      expect(balanceAfter).to.equal(balanceBefore + netAmount);

      // Check drop state
      const dropInfo = await straptDrop.getDropInfo(dropId);
      expect(dropInfo[3]).to.equal(0); // remainingAmount
      expect(dropInfo[9]).to.equal(false); // isActive
    });

    it("Should revert if drop is not expired yet", async function () {
      // Try to refund before expiry
      await expect(straptDrop.refundExpiredDrop(dropId))
        .to.be.revertedWithCustomError(straptDrop, "NotExpiredYet");
    });

    it("Should revert if caller is not the creator", async function () {
      // Increase time to after expiry
      await time.increase(86401); // Increase time by more than 1 day

      // User1 tries to refund the drop
      await expect(straptDrop.connect(user1).refundExpiredDrop(dropId))
        .to.be.revertedWithCustomError(straptDrop, "NotCreator");
    });

    it("Should revert if drop is not active", async function () {
      // Increase time to after expiry
      await time.increase(86401); // Increase time by more than 1 day

      // Refund the drop
      await straptDrop.refundExpiredDrop(dropId);

      // Try to refund again
      await expect(straptDrop.refundExpiredDrop(dropId))
        .to.be.revertedWithCustomError(straptDrop, "DropNotActive");
    });

    it("Should refund the correct amount after some claims", async function () {
      // Calculate expected fee
      const feePercentage = await straptDrop.feePercentage();
      const feeAmount = (totalAmount * feePercentage) / BigInt(BASIS_POINTS);
      const netAmount = totalAmount - feeAmount;

      // Calculate expected amount per recipient
      const amountPerRecipient = netAmount / BigInt(totalRecipients);

      // User1 claims from the drop
      await straptDrop.connect(user1).claimDrop(dropId);

      // User2 claims from the drop
      await straptDrop.connect(user2).claimDrop(dropId);

      // Increase time to after expiry
      await time.increase(86401); // Increase time by more than 1 day

      // Get owner's balance before refund
      const balanceBefore = await mockToken.balanceOf(owner.address);

      // Refund the expired drop
      const tx = await straptDrop.refundExpiredDrop(dropId);
      const receipt = await tx.wait();

      // Find the DropsExpired event
      const event = receipt.logs.find(log => {
        try {
          const decoded = straptDrop.interface.parseLog(log);
          return decoded && decoded.name === 'DropsExpired';
        } catch (e) {
          return false;
        }
      });

      const parsedEvent = straptDrop.interface.parseLog(event);
      const refundedAmount = parsedEvent.args[2];

      // Expected remaining amount (netAmount - 2 claims)
      const expectedRemaining = netAmount - (amountPerRecipient * BigInt(2));

      // Check refunded amount
      expect(refundedAmount).to.equal(expectedRemaining);

      // Check owner's balance after refund
      const balanceAfter = await mockToken.balanceOf(owner.address);
      expect(balanceAfter).to.equal(balanceBefore + expectedRemaining);

      // Check drop state
      const dropInfo = await straptDrop.getDropInfo(dropId);
      expect(dropInfo[3]).to.equal(0); // remainingAmount
      expect(dropInfo[9]).to.equal(false); // isActive
    });
  });
});
