// Unified deployment script for all Strapt contracts
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Contract types
const CONTRACT_TYPES = {
  PROTECTED_TRANSFER: "ProtectedTransferV2",
  PAYMENT_STREAM: "PaymentStream",
  STRAPT_DROP: "StraptDrop"
};

// Token addresses on Lisk Sepolia
const TOKENS = {
  USDC: "0x72db95F0716cF79C0efe160F23fB17bF1c161317",
  IDRX: "0xD63029C1a3dA68b51c67c6D1DeC3DEe50D681661"
};

async function main() {
  // Get contract type from command line arguments
  const contractType = process.env.CONTRACT_TYPE || CONTRACT_TYPES.PROTECTED_TRANSFER;

  if (!Object.values(CONTRACT_TYPES).includes(contractType)) {
    console.error(`Invalid contract type: ${contractType}`);
    console.error(`Valid contract types: ${Object.values(CONTRACT_TYPES).join(", ")}`);
    process.exit(1);
  }

  console.log(`Deploying ${contractType} to ${hre.network.name}...`);

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);

  // Get deployer balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log(`Account balance: ${hre.ethers.formatEther(balance)} ETH`);

  // Get fee parameters from environment variables or use defaults
  const feeCollector = process.env.FEE_COLLECTOR || deployer.address;
  const feeInBasisPoints = process.env.FEE_BASIS_POINTS ? Number.parseInt(process.env.FEE_BASIS_POINTS) : 20; // Default 0.2%

  console.log(`Fee collector: ${feeCollector}`);
  console.log(`Fee in basis points: ${feeInBasisPoints} (${feeInBasisPoints / 100}%)`);

  // Deploy the contract based on type
  let contract;
  let contractAddress;

  switch (contractType) {
    case CONTRACT_TYPES.PROTECTED_TRANSFER:
      contract = await deployProtectedTransfer(feeCollector, feeInBasisPoints);
      break;
    case CONTRACT_TYPES.PAYMENT_STREAM:
      contract = await deployPaymentStream(feeCollector, feeInBasisPoints);
      break;
    case CONTRACT_TYPES.STRAPT_DROP:
      contract = await deployStraptDrop(feeCollector, feeInBasisPoints);
      break;
  }

  contractAddress = await contract.getAddress();
  console.log(`${contractType} deployed to: ${contractAddress}`);

  // Save deployment info
  await saveDeploymentInfo(contractType, contractAddress, feeCollector, feeInBasisPoints);

  // Update frontend ABI
  await updateFrontendABI(contractType);

  // Verify contract on explorer if on a supported network
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    await verifyContract(contractType, contractAddress, feeCollector, feeInBasisPoints);
  }

  console.log("Deployment completed successfully");
}

async function deployProtectedTransfer(feeCollector, feeInBasisPoints) {
  console.log("Deploying ProtectedTransferV2...");
  const ProtectedTransferV2 = await hre.ethers.getContractFactory("ProtectedTransferV2");
  const protectedTransferV2 = await ProtectedTransferV2.deploy(feeCollector, feeInBasisPoints);
  await protectedTransferV2.waitForDeployment();

  // Set token support
  console.log("Setting token support...");
  await protectedTransferV2.setTokenSupport(TOKENS.USDC, true);
  await protectedTransferV2.setTokenSupport(TOKENS.IDRX, true);

  return protectedTransferV2;
}

async function deployPaymentStream(feeCollector, feeInBasisPoints) {
  console.log("Deploying PaymentStream...");
  const PaymentStream = await hre.ethers.getContractFactory("PaymentStream");
  const paymentStream = await PaymentStream.deploy(feeCollector, feeInBasisPoints);
  await paymentStream.waitForDeployment();

  // Set token support
  console.log("Setting token support...");
  await paymentStream.setTokenSupport(TOKENS.USDC, true);
  await paymentStream.setTokenSupport(TOKENS.IDRX, true);

  return paymentStream;
}

async function deployStraptDrop(feeCollector, feeInBasisPoints) {
  console.log("Deploying StraptDrop...");
  const StraptDrop = await hre.ethers.getContractFactory("StraptDrop");
  const straptDrop = await StraptDrop.deploy();
  await straptDrop.waitForDeployment();

  // Set fee collector if different from deployer
  const [deployer] = await hre.ethers.getSigners();
  if (feeCollector !== deployer.address) {
    console.log(`Setting fee collector to ${feeCollector}...`);
    await straptDrop.setFeeCollector(feeCollector);
  }

  // Set fee percentage if different from default
  if (feeInBasisPoints !== 10) { // StraptDrop default is 10 basis points
    console.log(`Setting fee percentage to ${feeInBasisPoints}...`);
    await straptDrop.setFeePercentage(feeInBasisPoints);
  }

  return straptDrop;
}

async function saveDeploymentInfo(contractType, contractAddress, feeCollector, feeInBasisPoints) {
  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Create deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress,
    feeCollector,
    feeInBasisPoints,
    supportedTokens: {
      USDC: TOKENS.USDC,
      IDRX: TOKENS.IDRX
    },
    deploymentTime: new Date().toISOString()
  };

  // Save deployment info to file
  const deploymentPath = path.join(deploymentsDir, `${contractType}-${hre.network.name}.json`);
  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log(`Deployment info saved to ${deploymentPath}`);

  return deploymentInfo;
}

async function updateFrontendABI(contractType) {
  try {
    // Check if the frontend directory exists
    const frontendDir = path.join(__dirname, "../../strapt-frontend/src/contracts");
    if (!fs.existsSync(frontendDir)) {
      console.log("Creating frontend contracts directory...");
      fs.mkdirSync(frontendDir, { recursive: true });
    }

    // Get contract path based on type
    let contractPath;
    switch (contractType) {
      case CONTRACT_TYPES.PROTECTED_TRANSFER:
        contractPath = "transfers/ProtectedTransferV2.sol";
        break;
      case CONTRACT_TYPES.PAYMENT_STREAM:
        contractPath = "streams/PaymentStream.sol";
        break;
      case CONTRACT_TYPES.STRAPT_DROP:
        contractPath = "StraptDrop.sol";
        break;
    }

    // Read the contract artifact
    const artifactPath = path.join(__dirname, `../artifacts/contracts/${contractPath}/${contractType}.json`);
    if (!fs.existsSync(artifactPath)) {
      console.error(`Contract artifact not found for ${contractType}. Please compile the contracts first.`);
      return false;
    }

    const contractArtifact = require(artifactPath);

    // Write the ABI to the frontend
    const frontendPath = path.join(frontendDir, `${contractType}.json`);
    fs.writeFileSync(
      frontendPath,
      JSON.stringify(contractArtifact, null, 2)
    );

    console.log(`ABI updated successfully for ${contractType} at: ${frontendPath}`);

    // Update contract config
    await updateContractConfig(frontendDir);

    return true;
  } catch (error) {
    console.error("Error updating frontend:", error);
    return false;
  }
}

async function updateContractConfig(frontendDir) {
  const deploymentPath = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentPath)) {
    console.log("No deployments directory found. Skipping contract config update.");
    return;
  }

  // Get existing config or create new one
  const configPath = path.join(frontendDir, 'contract-config.json');
  let config = {};
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  // Update config for each contract type
  for (const contractType of Object.values(CONTRACT_TYPES)) {
    const files = fs.readdirSync(deploymentPath).filter(file => file.startsWith(`${contractType}-`));
    if (files.length > 0) {
      const latestFile = files.sort().pop();
      const deploymentInfo = require(path.join(deploymentPath, latestFile));

      config[contractType] = {
        address: deploymentInfo.contractAddress,
        network: deploymentInfo.network,
        supportedTokens: deploymentInfo.supportedTokens
      };

      console.log(`Updated config with ${contractType} deployment info.`);
    }
  }

  // Write updated config
  fs.writeFileSync(
    configPath,
    JSON.stringify(config, null, 2)
  );

  console.log("Contract config updated at:", configPath);
}

async function verifyContract(contractType, contractAddress, feeCollector, feeInBasisPoints) {
  console.log("Waiting for block confirmations before verification...");
  // Wait for 5 block confirmations
  await new Promise(resolve => setTimeout(resolve, 15000)); // 15 seconds

  console.log(`Verifying ${contractType} on explorer...`);
  try {
    let constructorArgs = [];
    let contractPath = "";

    switch (contractType) {
      case CONTRACT_TYPES.PROTECTED_TRANSFER:
        constructorArgs = [feeCollector, feeInBasisPoints];
        contractPath = `contracts/transfers/${contractType}.sol:${contractType}`;
        break;
      case CONTRACT_TYPES.PAYMENT_STREAM:
        constructorArgs = [feeCollector, feeInBasisPoints];
        contractPath = `contracts/streams/${contractType}.sol:${contractType}`;
        break;
      case CONTRACT_TYPES.STRAPT_DROP:
        constructorArgs = []; // StraptDrop has no constructor arguments
        contractPath = `contracts/${contractType}.sol:${contractType}`;
        break;
    }

    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: constructorArgs,
      contract: contractPath
    });

    console.log("Contract verified successfully");
  } catch (error) {
    console.error("Error verifying contract:", error);
  }
}

// Execute the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
