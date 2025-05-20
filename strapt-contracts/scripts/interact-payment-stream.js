// Script untuk berinteraksi dengan PaymentStream contract
const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  // Mendapatkan alamat contract dari environment variable atau file deployment
  let contractAddress;
  
  try {
    // Coba baca dari file deployment
    const fs = require("fs");
    const deploymentFile = `./deployments/PaymentStream-liskSepolia.json`;
    
    if (fs.existsSync(deploymentFile)) {
      const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
      contractAddress = deploymentInfo.contractAddress;
    } else {
      // Jika file tidak ada, gunakan dari environment variable
      contractAddress = process.env.PAYMENT_STREAM_ADDRESS;
    }
  } catch (error) {
    console.error("Error reading deployment info:", error);
    contractAddress = process.env.PAYMENT_STREAM_ADDRESS;
  }
  
  if (!contractAddress) {
    throw new Error("Contract address not found. Please set PAYMENT_STREAM_ADDRESS in .env file or deploy the contract first.");
  }

  console.log(`Interacting with PaymentStream at: ${contractAddress}`);

  // Mendapatkan signer
  const [signer] = await ethers.getSigners();
  console.log(`Using account: ${signer.address}`);

  // Mendapatkan instance contract
  const PaymentStream = await ethers.getContractFactory("PaymentStream");
  const paymentStream = await PaymentStream.attach(contractAddress);

  // Mendapatkan informasi contract
  const feeCollector = await paymentStream.feeCollector();
  const feeInBasisPoints = await paymentStream.feeInBasisPoints();
  const owner = await paymentStream.owner();
  const maxFee = await paymentStream.MAX_FEE();

  console.log("\nContract Information:");
  console.log("---------------------");
  console.log(`Owner: ${owner}`);
  console.log(`Fee Collector: ${feeCollector}`);
  console.log(`Fee in Basis Points: ${feeInBasisPoints} (${Number(feeInBasisPoints)/100}%)`);
  console.log(`Maximum Fee: ${maxFee} (${Number(maxFee)/100}%)`);

  // Mendapatkan informasi token yang didukung
  const usdcAddress = "0x72db95F0716cF79C0efe160F23fB17bF1c161317"; // USDC di Lisk Sepolia
  const idrxAddress = "0xD63029C1a3dA68b51c67c6D1DeC3DEe50D681661"; // IDRX di Lisk Sepolia

  const isUsdcSupported = await paymentStream.supportedTokens(usdcAddress);
  const isIdrxSupported = await paymentStream.supportedTokens(idrxAddress);

  console.log("\nSupported Tokens:");
  console.log("----------------");
  console.log(`USDC (${usdcAddress}): ${isUsdcSupported ? "Supported" : "Not Supported"}`);
  console.log(`IDRX (${idrxAddress}): ${isIdrxSupported ? "Supported" : "Not Supported"}`);

  // Jika token belum didukung, tambahkan dukungan
  if (!isUsdcSupported) {
    console.log("\nEnabling support for USDC...");
    const tx = await paymentStream.setTokenSupport(usdcAddress, true);
    await tx.wait();
    console.log("USDC support enabled successfully");
  }

  if (!isIdrxSupported) {
    console.log("\nEnabling support for IDRX...");
    const tx = await paymentStream.setTokenSupport(idrxAddress, true);
    await tx.wait();
    console.log("IDRX support enabled successfully");
  }

  console.log("\nInteraction completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
