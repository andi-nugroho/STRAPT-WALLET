// Script to set the fee percentage to 0 for all Strapt contracts
require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// ABIs for the fee-related functions
const abiProtectedTransfer = [
  {
    "inputs": [
      {
        "internalType": "uint16",
        "name": "newFeeInBasisPoints",
        "type": "uint16"
      }
    ],
    "name": "setFee",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "feeInBasisPoints",
    "outputs": [
      {
        "internalType": "uint16",
        "name": "",
        "type": "uint16"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

const abiStraptDrop = [
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_feePercentage",
        "type": "uint256"
      }
    ],
    "name": "setFeePercentage",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "feePercentage",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Contract configurations
const contracts = [
  {
    name: "ProtectedTransferV2",
    address: "0x33665BB084Eb3a01aA2E4eCE2FAd292dCe683e34",
    abi: abiProtectedTransfer,
    getFeeFunction: "feeInBasisPoints",
    setFeeFunction: "setFee",
    deploymentFile: "ProtectedTransferV2-liskSepolia.json"
  },
  {
    name: "ProtectedTransfer",
    address: "0x225f179c0d57c3DF357f802BB40d5a4BeaFb4F0C",
    abi: abiProtectedTransfer,
    getFeeFunction: "feeInBasisPoints",
    setFeeFunction: "setFee",
    deploymentFile: "ProtectedTransfer-liskSepolia.json"
  },
  {
    name: "PaymentStream",
    address: "0xDFa0a6101f25630d3122e1b6b34590848ba35402",
    abi: abiProtectedTransfer,
    getFeeFunction: "feeInBasisPoints",
    setFeeFunction: "setFee",
    deploymentFile: "PaymentStream-liskSepolia.json"
  },
  {
    name: "StraptDrop",
    address: "0x3d183CDCbF78BA6e39eb0e51C44d233265786e0A",
    abi: abiStraptDrop,
    getFeeFunction: "feePercentage",
    setFeeFunction: "setFeePercentage",
    deploymentFile: "StraptDrop-liskSepolia.json"
  }
];

async function updateFee(contract, wallet, provider) {
  console.log(`\nUpdating fee for ${contract.name}...`);
  
  // Create a contract instance
  const contractInstance = new ethers.Contract(contract.address, contract.abi, wallet);

  try {
    // Get current fee
    const currentFee = await contractInstance[contract.getFeeFunction]();
    console.log(`Current fee: ${currentFee} basis points`);

    if (currentFee == 0) {
      console.log("Fee is already set to 0. No update needed.");
      return true;
    }

    // Set the fee to 0
    console.log("Setting fee to 0 basis points (0%)");
    const tx = await contractInstance[contract.setFeeFunction](0);
    console.log(`Transaction hash: ${tx.hash}`);
    console.log("Waiting for transaction confirmation...");
    await tx.wait();

    // Verify the new fee
    const newFee = await contractInstance[contract.getFeeFunction]();
    console.log(`New fee: ${newFee} basis points`);

    if (newFee == 0) {
      console.log(`Fee for ${contract.name} updated successfully to 0%!`);
      
      // Update deployment file
      updateDeploymentFile(contract.deploymentFile);
      
      return true;
    } else {
      console.error(`Failed to update fee for ${contract.name}. New fee is still ${newFee}.`);
      return false;
    }
  } catch (error) {
    console.error(`Error updating fee for ${contract.name}: ${error.message}`);
    return false;
  }
}

function updateDeploymentFile(deploymentFileName) {
  const deploymentFilePath = path.join(__dirname, '../deployments', deploymentFileName);
  
  if (fs.existsSync(deploymentFilePath)) {
    try {
      const deploymentData = JSON.parse(fs.readFileSync(deploymentFilePath, 'utf8'));
      deploymentData.feeInBasisPoints = 0;
      
      fs.writeFileSync(deploymentFilePath, JSON.stringify(deploymentData, null, 2));
      console.log(`Updated deployment file: ${deploymentFileName}`);
    } catch (error) {
      console.error(`Error updating deployment file ${deploymentFileName}: ${error.message}`);
    }
  } else {
    console.log(`Deployment file not found: ${deploymentFileName}`);
  }
}

async function main() {
  console.log("Setting fee percentage to 0 for all Strapt contracts...");

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

  // Update fees for all contracts
  let successCount = 0;
  for (const contract of contracts) {
    const success = await updateFee(contract, wallet, provider);
    if (success) successCount++;
  }

  console.log(`\nSummary: Updated fees for ${successCount}/${contracts.length} contracts.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
