// Script to set the fee percentage to 0 for the StraptDrop contract using ethers.js directly
require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// ABI for the setFeePercentage function
const abi = [
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

async function main() {
  console.log("Setting fee percentage to 0 for StraptDrop contract...");

  // Get the private key from environment variables
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("PRIVATE_KEY not found in environment variables");
    process.exit(1);
  }

  // Get the contract address from the deployment file
  const deploymentFilePath = path.join(__dirname, '../deployments/StraptDrop-liskSepolia.json');
  let deploymentFile;
  try {
    deploymentFile = JSON.parse(fs.readFileSync(deploymentFilePath, 'utf8'));
  } catch (error) {
    console.error(`Error reading deployment file: ${error.message}`);
    process.exit(1);
  }

  const contractAddress = deploymentFile.contractAddress;
  console.log(`StraptDrop contract address: ${contractAddress}`);

  // Connect to the Lisk Sepolia network
  const provider = new ethers.JsonRpcProvider('https://rpc.sepolia-api.lisk.com');
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Using wallet address: ${wallet.address}`);

  // Create a contract instance
  const contract = new ethers.Contract(contractAddress, abi, wallet);

  try {
    // Get current fee percentage
    const currentFee = await contract.feePercentage();
    console.log(`Current fee percentage: ${currentFee} basis points`);

    // Set the fee percentage to 0
    console.log("Setting fee percentage to 0 basis points (0%)");
    const tx = await contract.setFeePercentage(0);
    console.log(`Transaction hash: ${tx.hash}`);
    console.log("Waiting for transaction confirmation...");
    await tx.wait();

    // Verify the new fee percentage
    const newFee = await contract.feePercentage();
    console.log(`New fee percentage: ${newFee} basis points`);

    console.log("Fee percentage updated successfully to 0%!");
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
