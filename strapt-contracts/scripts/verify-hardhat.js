const { execSync } = require('child_process');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

async function main() {
  console.log('Starting contract verification using Hardhat...');

  // Load deployment info
  let deploymentInfo;
  try {
    deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
    console.log('Loaded deployment info from file');
  } catch (error) {
    console.error('Error loading deployment info:', error.message);
    console.error('Please make sure deployment-info.json exists');
    process.exit(1);
  }

  // Verify ProtectedTransfer contract
  if (deploymentInfo.protectedTransfer) {
    await verifyProtectedTransfer(deploymentInfo);
  } else {
    console.log('ProtectedTransfer address not found in deployment-info.json');
  }

  // Verify USDC Mock contract
  if (deploymentInfo.usdc) {
    await verifyUSDCMock(deploymentInfo);
  } else {
    console.log('USDC Mock address not found in deployment-info.json');
  }
}

async function verifyProtectedTransfer(deploymentInfo) {
  console.log('\n=== Verifying ProtectedTransfer Contract ===');
  const contractAddress = deploymentInfo.protectedTransfer;
  console.log('Contract address:', contractAddress);

  // Get constructor arguments
  const owner = deploymentInfo.owner;
  const feeCollector = deploymentInfo.feeCollector;
  const feeInBasisPoints = deploymentInfo.fee;

  console.log('Constructor arguments:');
  console.log('- Owner:', owner);
  console.log('- Fee Collector:', feeCollector);
  console.log('- Fee in Basis Points:', feeInBasisPoints);

  try {
    console.log('Running Hardhat verification...');
    const command = `npx hardhat verify --network liskSepolia ${contractAddress} "${owner}" "${feeCollector}" ${feeInBasisPoints}`;
    console.log('Executing command:', command);

    const output = execSync(command, { encoding: 'utf8' });
    console.log(output);

    console.log('ProtectedTransfer verification completed!');
  } catch (error) {
    console.error('Error verifying ProtectedTransfer:');
    console.error(error.message);
  }
}

async function verifyUSDCMock(deploymentInfo) {
  console.log('\n=== Verifying USDC Mock Contract ===');
  const contractAddress = deploymentInfo.usdc;
  console.log('Contract address:', contractAddress);

  // Get constructor arguments
  const owner = deploymentInfo.owner;

  console.log('Constructor arguments:');
  console.log('- Owner:', owner);

  try {
    console.log('Running Hardhat verification...');
    const command = `npx hardhat verify --network liskSepolia ${contractAddress} "${owner}"`;
    console.log('Executing command:', command);

    const output = execSync(command, { encoding: 'utf8' });
    console.log(output);

    console.log('USDC Mock verification completed!');
  } catch (error) {
    console.error('Error verifying USDC Mock:');
    console.error(error.message);
  }
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
