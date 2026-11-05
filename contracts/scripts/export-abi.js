/**
 * Copy the contract ABI from the Hardhat artifact into backend/ and frontend/.
 * Run after `npx hardhat compile`:
 *   node scripts/export-abi.js
 */
const fs = require("fs");
const path = require("path");

const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "HeroForgeCombined.sol", "HeroForge.json");

if (!fs.existsSync(artifactPath)) {
  console.error("Artifact not found: " + artifactPath);
  console.error("Run `npx hardhat compile` first (and check the contract file name).");
  process.exit(1);
}

const { abi } = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

const targets = [
  path.join(__dirname, "..", "..", "backend", "app", "abi", "HeroForge.json"),
  path.join(__dirname, "..", "..", "frontend", "src", "abi", "HeroForge.json"),
];

for (const target of targets) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(abi, null, 2) + "\n");
  console.log("wrote", path.relative(process.cwd(), target));
}
