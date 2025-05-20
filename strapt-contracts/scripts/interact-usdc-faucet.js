// Script to interact with the USDC Faucet contract
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
  // Get contract address from deployment file
  let contractAddress;

  try {
    // Try to read from deployment file
    const deploymentFile = path.join(__dirname, "../deployments/USDCFaucet-liskSepolia.json");

    if (fs.existsSync(deploymentFile)) {
      const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
      contractAddress = deploymentInfo.contractAddress;
      console.log(`Using contract address from deployment file: ${contractAddress}`);
    } else {
      console.error("Deployment file not found. Please deploy the contract first.");
      process.exit(1);
    }
  } catch (error) {
    console.error("Error reading deployment info:", error);
    process.exit(1);
  }

  // Get signer
  const [signer] = await hre.ethers.getSigners();
  console.log(`Using account: ${signer.address}`);

  // Get contract instance
  const USDCFaucet = await hre.ethers.getContractFactory("USDCFaucet");
  const usdcFaucet = USDCFaucet.attach(contractAddress);

  // Get USDC token address
  const usdcTokenAddress = await usdcFaucet.usdcToken();
  console.log(`USDC Token address: ${usdcTokenAddress}`);

  // Get USDC token instance using the ERC20 ABI
  const erc20Abi = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function transfer(address to, uint amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)"
  ];
  const usdcToken = await hre.ethers.getContractAt(erc20Abi, usdcTokenAddress);

  // Get faucet information
  const claimAmount = await usdcFaucet.claimAmount();
  const cooldownPeriod = await usdcFaucet.cooldownPeriod();
  const maxClaimPerAddress = await usdcFaucet.maxClaimPerAddress();
  const faucetBalance = await usdcFaucet.getFaucetBalance();
  const owner = await usdcFaucet.owner();

  console.log("\nFaucet Information:");
  console.log("------------------");
  console.log(`Owner: ${owner}`);
  console.log(`Claim Amount: ${hre.ethers.formatUnits(claimAmount, 6)} USDC`);
  console.log(`Cooldown Period: ${cooldownPeriod} seconds (${Number(cooldownPeriod) / 3600} hours)`);
  console.log(`Max Claim Per Address: ${hre.ethers.formatUnits(maxClaimPerAddress, 6)} USDC`);
  console.log(`Faucet Balance: ${hre.ethers.formatUnits(faucetBalance, 6)} USDC`);

  // Check if the faucet needs funding
  if (faucetBalance < claimAmount) {
    console.log("\n⚠️ Warning: Faucet balance is low!");
    console.log(`Please send USDC to the faucet address: ${contractAddress}`);
  }

  // Get user claim information
  const userAddress = signer.address;
  const lastClaimTime = await usdcFaucet.lastClaimTime(userAddress);
  const totalClaimed = await usdcFaucet.totalClaimed(userAddress);
  const timeUntilNextClaim = await usdcFaucet.timeUntilNextClaim(userAddress);
  const remainingAllowance = await usdcFaucet.remainingClaimAllowance(userAddress);

  console.log("\nYour Claim Information:");
  console.log("----------------------");
  console.log(`Address: ${userAddress}`);
  console.log(`Last Claim Time: ${lastClaimTime > 0 ? new Date(Number(lastClaimTime) * 1000).toLocaleString() : 'Never'}`);
  console.log(`Total Claimed: ${hre.ethers.formatUnits(totalClaimed, 6)} USDC`);
  console.log(`Time Until Next Claim: ${timeUntilNextClaim > 0 ? `${timeUntilNextClaim} seconds (${Number(timeUntilNextClaim) / 3600} hours)` : 'Can claim now'}`);
  console.log(`Remaining Claim Allowance: ${hre.ethers.formatUnits(remainingAllowance, 6)} USDC`);

  // Ask if user wants to claim tokens
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readline.question('\nDo you want to claim USDC tokens? (y/n): ', async (answer) => {
    if (answer.toLowerCase() === 'y') {
      try {
        if (timeUntilNextClaim > 0) {
          console.log(`Cannot claim yet. Please wait ${timeUntilNextClaim} seconds.`);
        } else if (remainingAllowance < claimAmount) {
          console.log(`Cannot claim. You have reached your maximum claim limit.`);
        } else {
          console.log(`Claiming ${hre.ethers.formatUnits(claimAmount, 6)} USDC...`);
          const tx = await usdcFaucet.claimTokens();
          console.log(`Transaction hash: ${tx.hash}`);
          await tx.wait();
          console.log(`Claim successful!`);

          // Check new balance
          const newBalance = await usdcToken.balanceOf(userAddress);
          console.log(`Your new USDC balance: ${hre.ethers.formatUnits(newBalance, 6)} USDC`);
        }
      } catch (error) {
        console.error(`Error claiming tokens: ${error.message}`);
      }
    } else {
      console.log('Claim cancelled.');
    }

    readline.close();
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
