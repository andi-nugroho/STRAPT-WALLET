// Script to deploy the fixed PaymentStream contract
require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("Deploying PaymentStreamFix contract...");

  // Get the private key from environment variables
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("PRIVATE_KEY not found in environment variables");
    process.exit(1);
  }

  // Connect to the Lisk Sepolia network
  const provider = new ethers.JsonRpcProvider('https://rpc.sepolia-api.lisk.com');
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Using wallet address: ${wallet.address}`);

  // Get the contract factory
  const PaymentStreamFixFactory = await ethers.getContractFactory(
    'PaymentStreamFix',
    wallet
  );

  // Deploy the contract with the fee collector set to the deployer and fee set to 0
  const paymentStreamFix = await PaymentStreamFixFactory.deploy(
    wallet.address, // Fee collector is the deployer
    0 // Fee is 0 basis points (0%)
  );

  // Wait for the contract to be deployed
  await paymentStreamFix.waitForDeployment();
  const contractAddress = await paymentStreamFix.getAddress();
  console.log(`PaymentStreamFix deployed to: ${contractAddress}`);

  // Get the network information
  const network = await provider.getNetwork();
  const networkName = network.name === 'unknown' ? 'liskSepolia' : network.name;

  // Save deployment information
  const deploymentInfo = {
    contractName: 'PaymentStreamFix',
    contractAddress: contractAddress,
    deploymentTime: new Date().toISOString(),
    deployer: wallet.address,
    network: networkName,
    feeInBasisPoints: 0,
    feeCollector: wallet.address,
    supportedTokens: {
      // Add the supported tokens here
      USDC: "0x72db95F0716cF79C0efe160F23fB17bF1c161317", // USDC on Lisk Sepolia
      IDRX: "0xD63029C1a3dA68b51c67c6D1DeC3DEe50D681661"  // IDRX on Lisk Sepolia
    }
  };

  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  // Save deployment information to a file
  const deploymentFilePath = path.join(
    deploymentsDir,
    `PaymentStreamFix-${networkName}.json`
  );
  fs.writeFileSync(
    deploymentFilePath,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`Deployment information saved to: ${deploymentFilePath}`);

  // Set token support for USDC and IDRX
  console.log("Setting token support...");
  
  // Set USDC support
  const usdcTx = await paymentStreamFix.setTokenSupport(
    deploymentInfo.supportedTokens.USDC,
    true
  );
  await usdcTx.wait();
  console.log(`USDC support set to true`);
  
  // Set IDRX support
  const idrxTx = await paymentStreamFix.setTokenSupport(
    deploymentInfo.supportedTokens.IDRX,
    true
  );
  await idrxTx.wait();
  console.log(`IDRX support set to true`);

  console.log("PaymentStreamFix deployment and setup completed successfully!");
  
  // Verify the contract on Blockscout
  console.log("\nTo verify the contract on Blockscout, run:");
  console.log(`npx hardhat verify --network liskSepolia ${contractAddress} ${wallet.address} 0`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
