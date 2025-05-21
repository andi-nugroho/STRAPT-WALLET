// Script to update the ABI in the frontend
const fs = require('fs');
const path = require('path');

async function main() {
  try {
    // Check if the frontend directory exists
    const frontendDir = path.join(__dirname, '../../strapt-frontend/src/contracts');
    if (!fs.existsSync(frontendDir)) {
      console.log("Creating frontend contracts directory...");
      fs.mkdirSync(frontendDir, { recursive: true });
    }

    // Update ProtectedTransferV2 ABI
    console.log("Updating frontend ABI for ProtectedTransferV2...");
    await updateContractABI(
      'transfers/ProtectedTransferV2.sol',
      'ProtectedTransferV2',
      frontendDir
    );

    // Update PaymentStream ABI
    console.log("Updating frontend ABI for PaymentStream...");
    await updateContractABI(
      'streams/PaymentStream.sol',
      'PaymentStream',
      frontendDir
    );

    // Update StraptDrop ABI
    console.log("Updating frontend ABI for StraptDrop...");
    await updateContractABI(
      'StraptDrop.sol',
      'StraptDrop',
      frontendDir
    );

    // Update contract config
    await updateContractConfig(frontendDir);
    console.log("Frontend update completed successfully.");

    return true;
  } catch (error) {
    console.error("Error updating frontend:", error);
    return false;
  }
}

async function updateContractABI(contractPath, contractName, frontendDir) {
  // Check if the artifacts directory exists
  const artifactsDir = path.join(__dirname, `../artifacts/contracts/${contractPath}`);
  if (!fs.existsSync(artifactsDir)) {
    console.error(`Artifacts directory not found for ${contractName}. Please compile the contracts first.`);
    return false;
  }

  // Read the contract artifact
  const artifactPath = path.join(artifactsDir, `${contractName}.json`);
  if (!fs.existsSync(artifactPath)) {
    console.error(`Contract artifact not found for ${contractName}. Please compile the contracts first.`);
    return false;
  }

  const contractArtifact = require(artifactPath);

  // Write the ABI to the frontend
  const frontendPath = path.join(frontendDir, `${contractName}.json`);
  fs.writeFileSync(
    frontendPath,
    JSON.stringify(contractArtifact, null, 2)
  );

  console.log(`ABI updated successfully for ${contractName} at:`, frontendPath);
  return true;
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

    // Update ProtectedTransferV2 config
    const ptv2Files = fs.readdirSync(deploymentPath).filter(file => file.startsWith('ProtectedTransferV2-'));
    if (ptv2Files.length > 0) {
      const latestPtv2 = ptv2Files.sort().pop();
      const ptv2Info = require(path.join(deploymentPath, latestPtv2));

      config.ProtectedTransferV2 = {
        address: ptv2Info.contractAddress,
        network: ptv2Info.network,
        supportedTokens: ptv2Info.supportedTokens,
        feeInBasisPoints: ptv2Info.feeInBasisPoints || 0
      };

      console.log("Updated config with ProtectedTransferV2 deployment info.");
    }

    // Update PaymentStream config
    const psFiles = fs.readdirSync(deploymentPath).filter(file => file.startsWith('PaymentStream-'));
    if (psFiles.length > 0) {
      const latestPs = psFiles.sort().pop();
      const psInfo = require(path.join(deploymentPath, latestPs));

      config.PaymentStream = {
        address: psInfo.contractAddress,
        network: psInfo.network,
        supportedTokens: psInfo.supportedTokens,
        feeInBasisPoints: psInfo.feeInBasisPoints || 0
      };

      console.log("Updated config with PaymentStream deployment info.");
    }

    // Update StraptDrop config
    const sdFiles = fs.readdirSync(deploymentPath).filter(file => file.startsWith('StraptDrop-'));
    if (sdFiles.length > 0) {
      const latestSd = sdFiles.sort().pop();
      const sdInfo = require(path.join(deploymentPath, latestSd));

      config.StraptDrop = {
        address: sdInfo.contractAddress,
        network: sdInfo.network,
        supportedTokens: sdInfo.supportedTokens,
        feeInBasisPoints: sdInfo.feeInBasisPoints || 0
      };

      console.log("Updated config with StraptDrop deployment info.");
    }

    // Write updated config
    fs.writeFileSync(
      configPath,
      JSON.stringify(config, null, 2)
    );

    console.log("Contract config updated at:", configPath);
  }

// Execute the script
main()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
