// Script for verifying contracts on Blockscout
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function main() {
  // Get contract address and name from command line arguments
  const contractAddress = process.argv[2];
  const contractName = process.argv[3];
  
  if (!contractAddress || !contractName) {
    console.error('Usage: node verify-blockscout.js <contract-address> <contract-name>');
    console.error('Example: node verify-blockscout.js 0x123... StraptDrop');
    process.exit(1);
  }
  
  console.log(`Verifying ${contractName} at ${contractAddress} on Blockscout...`);
  
  // Get contract source code
  const contractPath = findContractPath(contractName);
  if (!contractPath) {
    console.error(`Contract source file for ${contractName} not found.`);
    process.exit(1);
  }
  
  console.log(`Found contract at: ${contractPath}`);
  
  // Get constructor arguments if any
  let constructorArgs = '';
  if (contractName !== 'StraptDrop') {
    // For contracts with constructor arguments
    const deploymentFile = path.join(__dirname, `../deployments/${contractName}-liskSepolia.json`);
    if (fs.existsSync(deploymentFile)) {
      const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
      
      if (contractName === 'ProtectedTransferV2' || contractName === 'PaymentStream') {
        const feeCollector = deploymentInfo.feeCollector;
        const feeInBasisPoints = deploymentInfo.feeInBasisPoints;
        
        // Generate constructor arguments ABI-encoded
        constructorArgs = `--constructor-args $(cast abi-encode "constructor(address,uint16)" "${feeCollector}" ${feeInBasisPoints})`;
      }
    }
  }
  
  // Build the verification command
  const verifyCommand = `forge verify-contract ${contractAddress} ${contractName} ${constructorArgs} --rpc-url https://rpc.sepolia-api.lisk.com --verify --verifier blockscout --verifier-url 'https://sepolia-blockscout.lisk.com/api/'`;
  
  console.log(`Executing: ${verifyCommand}`);
  
  try {
    // Execute the verification command
    const output = execSync(verifyCommand, { stdio: 'inherit' });
    console.log('Verification successful!');
  } catch (error) {
    console.error('Verification failed:', error.message);
    
    // Try alternative verification method if the first one fails
    console.log('Trying alternative verification method...');
    
    try {
      const flattenCommand = `npx hardhat flatten ${contractPath} > ${contractName}_flattened.sol`;
      console.log(`Flattening contract: ${flattenCommand}`);
      execSync(flattenCommand);
      
      console.log('Contract flattened. Please verify manually using the flattened file:');
      console.log(`${contractName}_flattened.sol`);
      console.log('Visit https://sepolia-blockscout.lisk.com/address/' + contractAddress + '/contract_verification');
    } catch (flattenError) {
      console.error('Failed to flatten contract:', flattenError.message);
    }
  }
}

function findContractPath(contractName) {
  // Define possible locations for the contract
  const possiblePaths = [
    path.join(__dirname, `../contracts/${contractName}.sol`),
    path.join(__dirname, `../contracts/transfers/${contractName}.sol`),
    path.join(__dirname, `../contracts/streams/${contractName}.sol`),
    path.join(__dirname, `../contracts/drops/${contractName}.sol`)
  ];
  
  // Find the first path that exists
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  
  return null;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
