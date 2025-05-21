const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("USDCFaucet", function () {
  let usdcFaucet;
  let usdcToken;
  let owner;
  let user1;
  let user2;
  
  const CLAIM_AMOUNT = ethers.parseUnits("10", 6); // 10 USDC with 6 decimals
  const COOLDOWN_PERIOD = 86400; // 24 hours in seconds
  const MAX_CLAIM_PER_ADDRESS = ethers.parseUnits("100", 6); // 100 USDC with 6 decimals
  const INITIAL_FAUCET_BALANCE = ethers.parseUnits("1000", 6); // 1000 USDC

  beforeEach(async function () {
    // Get signers
    [owner, user1, user2] = await ethers.getSigners();
    
    // Deploy mock USDC token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    usdcToken = await MockERC20.deploy("USD Coin", "USDC", 6);
    
    // Deploy USDC Faucet
    const USDCFaucet = await ethers.getContractFactory("USDCFaucet");
    usdcFaucet = await USDCFaucet.deploy(
      await usdcToken.getAddress(),
      CLAIM_AMOUNT,
      COOLDOWN_PERIOD,
      MAX_CLAIM_PER_ADDRESS,
      owner.address
    );
    
    // Fund the faucet with USDC
    await usdcToken.mint(await usdcFaucet.getAddress(), INITIAL_FAUCET_BALANCE);
  });

  describe("Deployment", function () {
    it("Should set the correct USDC token address", async function () {
      expect(await usdcFaucet.usdcToken()).to.equal(await usdcToken.getAddress());
    });

    it("Should set the correct claim amount", async function () {
      expect(await usdcFaucet.claimAmount()).to.equal(CLAIM_AMOUNT);
    });

    it("Should set the correct cooldown period", async function () {
      expect(await usdcFaucet.cooldownPeriod()).to.equal(COOLDOWN_PERIOD);
    });

    it("Should set the correct max claim per address", async function () {
      expect(await usdcFaucet.maxClaimPerAddress()).to.equal(MAX_CLAIM_PER_ADDRESS);
    });

    it("Should set the correct owner", async function () {
      expect(await usdcFaucet.owner()).to.equal(owner.address);
    });
  });

  describe("Claiming tokens", function () {
    it("Should allow a user to claim tokens", async function () {
      await usdcFaucet.connect(user1).claimTokens();
      
      expect(await usdcToken.balanceOf(user1.address)).to.equal(CLAIM_AMOUNT);
      expect(await usdcFaucet.totalClaimed(user1.address)).to.equal(CLAIM_AMOUNT);
      expect(await usdcFaucet.lastClaimTime(user1.address)).to.be.gt(0);
    });

    it("Should not allow a user to claim before cooldown period expires", async function () {
      await usdcFaucet.connect(user1).claimTokens();
      
      await expect(
        usdcFaucet.connect(user1).claimTokens()
      ).to.be.revertedWithCustomError(usdcFaucet, "CooldownNotExpired");
    });

    it("Should allow a user to claim after cooldown period expires", async function () {
      await usdcFaucet.connect(user1).claimTokens();
      
      // Fast forward time
      await time.increase(COOLDOWN_PERIOD + 1);
      
      await usdcFaucet.connect(user1).claimTokens();
      
      expect(await usdcToken.balanceOf(user1.address)).to.equal(CLAIM_AMOUNT * 2n);
      expect(await usdcFaucet.totalClaimed(user1.address)).to.equal(CLAIM_AMOUNT * 2n);
    });

    it("Should not allow a user to claim more than the max limit", async function () {
      // Set a smaller max claim to test the limit
      await usdcFaucet.setMaxClaimPerAddress(CLAIM_AMOUNT * 2n);
      
      // First claim
      await usdcFaucet.connect(user1).claimTokens();
      
      // Fast forward time
      await time.increase(COOLDOWN_PERIOD + 1);
      
      // Second claim
      await usdcFaucet.connect(user1).claimTokens();
      
      // Fast forward time again
      await time.increase(COOLDOWN_PERIOD + 1);
      
      // Third claim should fail
      await expect(
        usdcFaucet.connect(user1).claimTokens()
      ).to.be.revertedWithCustomError(usdcFaucet, "MaxClaimLimitReached");
    });

    it("Should not allow claims if faucet has insufficient balance", async function () {
      // Withdraw most of the faucet balance
      await usdcFaucet.withdrawTokens(owner.address, INITIAL_FAUCET_BALANCE - CLAIM_AMOUNT / 2n);
      
      await expect(
        usdcFaucet.connect(user1).claimTokens()
      ).to.be.revertedWithCustomError(usdcFaucet, "InsufficientFaucetBalance");
    });
  });

  describe("Admin functions", function () {
    it("Should allow owner to update claim amount", async function () {
      const newClaimAmount = ethers.parseUnits("20", 6);
      await usdcFaucet.setClaimAmount(newClaimAmount);
      
      expect(await usdcFaucet.claimAmount()).to.equal(newClaimAmount);
    });

    it("Should allow owner to update cooldown period", async function () {
      const newCooldownPeriod = 3600; // 1 hour
      await usdcFaucet.setCooldownPeriod(newCooldownPeriod);
      
      expect(await usdcFaucet.cooldownPeriod()).to.equal(newCooldownPeriod);
    });

    it("Should allow owner to update max claim per address", async function () {
      const newMaxClaim = ethers.parseUnits("200", 6);
      await usdcFaucet.setMaxClaimPerAddress(newMaxClaim);
      
      expect(await usdcFaucet.maxClaimPerAddress()).to.equal(newMaxClaim);
    });

    it("Should allow owner to withdraw tokens", async function () {
      const withdrawAmount = ethers.parseUnits("500", 6);
      await usdcFaucet.withdrawTokens(owner.address, withdrawAmount);
      
      expect(await usdcToken.balanceOf(owner.address)).to.equal(withdrawAmount);
      expect(await usdcToken.balanceOf(await usdcFaucet.getAddress())).to.equal(INITIAL_FAUCET_BALANCE - withdrawAmount);
    });

    it("Should not allow non-owner to call admin functions", async function () {
      await expect(
        usdcFaucet.connect(user1).setClaimAmount(ethers.parseUnits("20", 6))
      ).to.be.revertedWithCustomError(usdcFaucet, "OwnableUnauthorizedAccount");
      
      await expect(
        usdcFaucet.connect(user1).setCooldownPeriod(3600)
      ).to.be.revertedWithCustomError(usdcFaucet, "OwnableUnauthorizedAccount");
      
      await expect(
        usdcFaucet.connect(user1).setMaxClaimPerAddress(ethers.parseUnits("200", 6))
      ).to.be.revertedWithCustomError(usdcFaucet, "OwnableUnauthorizedAccount");
      
      await expect(
        usdcFaucet.connect(user1).withdrawTokens(user1.address, ethers.parseUnits("500", 6))
      ).to.be.revertedWithCustomError(usdcFaucet, "OwnableUnauthorizedAccount");
    });
  });

  describe("View functions", function () {
    it("Should correctly report time until next claim", async function () {
      // Initial claim
      await usdcFaucet.connect(user1).claimTokens();
      
      // Time until next claim should be close to COOLDOWN_PERIOD
      const timeUntilNext = await usdcFaucet.timeUntilNextClaim(user1.address);
      expect(timeUntilNext).to.be.closeTo(BigInt(COOLDOWN_PERIOD), 5n); // Allow small deviation due to block time
      
      // Fast forward half the cooldown period
      await time.increase(COOLDOWN_PERIOD / 2);
      
      // Time until next claim should be close to COOLDOWN_PERIOD / 2
      const timeUntilNextHalf = await usdcFaucet.timeUntilNextClaim(user1.address);
      expect(timeUntilNextHalf).to.be.closeTo(BigInt(COOLDOWN_PERIOD / 2), 5n);
      
      // Fast forward past the cooldown period
      await time.increase(COOLDOWN_PERIOD);
      
      // Time until next claim should be 0
      expect(await usdcFaucet.timeUntilNextClaim(user1.address)).to.equal(0);
    });

    it("Should correctly report remaining claim allowance", async function () {
      // Initial state
      expect(await usdcFaucet.remainingClaimAllowance(user1.address)).to.equal(MAX_CLAIM_PER_ADDRESS);
      
      // After one claim
      await usdcFaucet.connect(user1).claimTokens();
      expect(await usdcFaucet.remainingClaimAllowance(user1.address)).to.equal(MAX_CLAIM_PER_ADDRESS - CLAIM_AMOUNT);
      
      // Set max claim to exactly one more claim
      await usdcFaucet.setMaxClaimPerAddress(CLAIM_AMOUNT * 2n);
      
      // Fast forward time
      await time.increase(COOLDOWN_PERIOD + 1);
      
      // After second claim
      await usdcFaucet.connect(user1).claimTokens();
      expect(await usdcFaucet.remainingClaimAllowance(user1.address)).to.equal(0);
    });

    it("Should correctly report faucet balance", async function () {
      expect(await usdcFaucet.getFaucetBalance()).to.equal(INITIAL_FAUCET_BALANCE);
      
      // After a claim
      await usdcFaucet.connect(user1).claimTokens();
      expect(await usdcFaucet.getFaucetBalance()).to.equal(INITIAL_FAUCET_BALANCE - CLAIM_AMOUNT);
      
      // After withdrawal
      const withdrawAmount = ethers.parseUnits("500", 6);
      await usdcFaucet.withdrawTokens(owner.address, withdrawAmount);
      expect(await usdcFaucet.getFaucetBalance()).to.equal(INITIAL_FAUCET_BALANCE - CLAIM_AMOUNT - withdrawAmount);
    });
  });
});
