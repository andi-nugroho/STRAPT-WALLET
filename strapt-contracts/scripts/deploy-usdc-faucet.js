// Script to deploy the USDC Faucet contract to Lisk Sepolia
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Load environment variables from .env file
const result = dotenv.config();
if (result.error) {
  console.error("Error loading .env file:", result.error);
  // Continue anyway, as hardhat might have already loaded the env vars
} else {
  console.log("Environment variables loaded from .env file");
}

// USDC token address on Lisk Sepolia
const USDC_ADDRESS = "0x72db95F0716cF79C0efe160F23fB17bF1c161317";

// Faucet configuration
const CLAIM_AMOUNT = "1000000000"; // 1000 USDC (with 6 decimals)
const COOLDOWN_PERIOD = 86400; // 24 hours in seconds
const MAX_CLAIM_PER_ADDRESS = "10000000000"; // 1000 USDC (with 6 decimals)

async function main() {
  // Check for required environment variables
  if (!process.env.PRIVATE_KEY) {
    console.error("Error: PRIVATE_KEY environment variable is not set");
    console.error("Please set it in your .env file");
    process.exit(1);
  }

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying USDC Faucet with account:", deployer.address);

  // Deploy USDCFaucet contract
  console.log("Deploying USDCFaucet...");
  const USDCFaucet = await hre.ethers.getContractFactory("USDCFaucet");
  const usdcFaucet = await USDCFaucet.deploy(
    USDC_ADDRESS,
    CLAIM_AMOUNT,
    COOLDOWN_PERIOD,
    MAX_CLAIM_PER_ADDRESS,
    deployer.address
  );
  await usdcFaucet.waitForDeployment();

  const usdcFaucetAddress = await usdcFaucet.getAddress();
  console.log("USDCFaucet deployed to:", usdcFaucetAddress);

  // Save deployment information
  const deploymentPath = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath, { recursive: true });
  }

  const network = hre.network.name;
  const deploymentInfo = {
    network,
    contractAddress: usdcFaucetAddress,
    owner: deployer.address,
    usdcAddress: USDC_ADDRESS,
    claimAmount: CLAIM_AMOUNT,
    cooldownPeriod: COOLDOWN_PERIOD,
    maxClaimPerAddress: MAX_CLAIM_PER_ADDRESS,
    deploymentTime: new Date().toISOString()
  };

  const deploymentFile = path.join(deploymentPath, `USDCFaucet-${network}.json`);
  fs.writeFileSync(
    deploymentFile,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`Deployment info saved to ${deploymentFile}`);

  // Wait for a few seconds before verification
  console.log("Waiting for block confirmations before verification...");
  await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds

  // Verify contract on Blockscout
  if (network === "liskSepolia") {
    try {
      console.log("Verifying contract on Blockscout...");
      await hre.run("verify:verify", {
        address: usdcFaucetAddress,
        constructorArguments: [
          USDC_ADDRESS,
          CLAIM_AMOUNT,
          COOLDOWN_PERIOD,
          MAX_CLAIM_PER_ADDRESS,
          deployer.address
        ],
      });
      console.log("Contract verified successfully");
    } catch (error) {
      console.error("Error verifying contract:", error);
    }
  }

  console.log("Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
