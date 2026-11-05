/**
 * Move the game-master role to the backend wallet.
 *
 * Must be run by the contract OWNER (the deployer wallet in PRIVATE_KEY).
 * The backend never holds the owner key; it only holds the game-master key.
 *
 * Usage:
 *   npx hardhat run scripts/set-game-master.js --network sepolia
 *
 * Needs in .env: PRIVATE_KEY, SEPOLIA_RPC_URL, CONTRACT_ADDRESS, NEW_GAME_MASTER_ADDRESS
 */
const { ethers } = require("hardhat");
require("dotenv").config();

// Fully qualified name: the deployed contract is HeroForgeCombined.sol
const CONTRACT_NAME = "contracts/HeroForgeCombined.sol:HeroForge";

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const newGameMaster = process.env.NEW_GAME_MASTER_ADDRESS;

  if (!contractAddress || !ethers.isAddress(contractAddress)) {
    throw new Error("CONTRACT_ADDRESS is missing or not a valid address");
  }
  if (!newGameMaster || !ethers.isAddress(newGameMaster)) {
    throw new Error("NEW_GAME_MASTER_ADDRESS is missing or not a valid address");
  }

  const [signer] = await ethers.getSigners();
  const heroforge = await ethers.getContractAt(CONTRACT_NAME, contractAddress, signer);

  const owner = await heroforge.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`Signer ${signer.address} is not the contract owner (${owner}). Use the deployer key.`);
  }

  const current = await heroforge.gameMaster();
  console.log("Current game master:", current);
  console.log("New game master    :", newGameMaster);

  if (current.toLowerCase() === newGameMaster.toLowerCase()) {
    console.log("Nothing to do: that address is already the game master.");
    return;
  }

  const tx = await heroforge.setGameMaster(newGameMaster);
  console.log("Transaction sent:", tx.hash);
  await tx.wait();

  const updated = await heroforge.gameMaster();
  console.log("Game master is now :", updated);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
