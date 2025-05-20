// Script to check if environment variables are properly loaded
require("dotenv").config();

console.log("Checking environment variables...");

// Check for PRIVATE_KEY
if (process.env.PRIVATE_KEY) {
  const maskedKey = process.env.PRIVATE_KEY.substring(0, 6) + "..." + 
                   process.env.PRIVATE_KEY.substring(process.env.PRIVATE_KEY.length - 4);
  console.log("✅ PRIVATE_KEY is set:", maskedKey);
} else {
  console.log("❌ PRIVATE_KEY is not set");
}

// Check for LISK_SEPOLIA_RPC_URL
if (process.env.LISK_SEPOLIA_RPC_URL) {
  console.log("✅ LISK_SEPOLIA_RPC_URL is set:", process.env.LISK_SEPOLIA_RPC_URL);
} else {
  console.log("⚠️ LISK_SEPOLIA_RPC_URL is not set, will use default: https://rpc.sepolia-api.lisk.com");
}

// Print all environment variables (for debugging)
console.log("\nAll environment variables:");
console.log("-------------------------");
Object.keys(process.env).forEach(key => {
  if (key === "PRIVATE_KEY") {
    const maskedKey = process.env[key].substring(0, 6) + "..." + 
                     process.env[key].substring(process.env[key].length - 4);
    console.log(`${key}: ${maskedKey}`);
  } else {
    console.log(`${key}: ${process.env[key]}`);
  }
});

console.log("\nEnvironment check complete.");
