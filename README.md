# HeroForge

> Own your character. Own your progress.

HeroForge is a dApp for a blockchain game where players own their characters and items as NFTs. A player mints a character, equips items and spends XP from a web page using MetaMask, while a backend game-master service grants XP and items after a match. Every change appears on screen without a refresh.

**Status:** scaffold. The folder structure, configuration, a health endpoint and page shells exist. Everything else is built step by step; the plan is in [docs/SCOPE.md](docs/SCOPE.md) and [docs/TECHNICAL.md](docs/TECHNICAL.md).

<!-- TODO: add docs/screenshots/main.png and uncomment the next line -->
<!-- ![HeroForge main screen](docs/screenshots/main.png) -->

**Demo video:** TODO (3 to 5 minutes)

## Contract

Deployed and verified on Sepolia: [`0xa574CbE7b3CD4e082D518141E64AF3e795dA487A`](https://sepolia.etherscan.io/address/0xa574CbE7b3CD4e082D518141E64AF3e795dA487A#code)

## Repository layout

```
heroforge-dapp/
├── contracts/   Hardhat project: contract, tests, deploy and helper scripts
├── backend/     FastAPI service (Python), requirements.txt, .env.example
├── frontend/    Next.js + TypeScript app, .env.example
├── docs/        SCOPE.md, TECHNICAL.md, screenshots/
├── .gitignore
└── README.md
```

## Quick start

### Prerequisites

- Node.js 20+
- Python 3.11+ (the backend was tested on 3.12)
- MetaMask with a Sepolia test wallet that has some test ETH
- A Sepolia RPC URL (the public `https://ethereum-sepolia-rpc.publicnode.com` works, or an Alchemy / Infura key)

### 1. Environment files

Copy each example file and fill in the values. Never commit the real files.

```bash
# macOS / Linux
cp contracts/.env.example contracts/.env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

```powershell
# Windows PowerShell
Copy-Item contracts\.env.example contracts\.env
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env.local
```

### 2. One-time game-master setup

The contract was deployed with the deployer wallet as game master. The backend must use its own wallet so it never holds the owner key.

1. Create a new testnet-only wallet for the backend (with the backend dependencies installed, see step 3):
   ```bash
   python -c "from eth_account import Account; a = Account.create(); print(a.address); print(a.key.hex())"
   ```
2. Put the private key in `backend/.env` as `GAME_MASTER_PRIVATE_KEY`, and fund the address with Sepolia ETH from a faucet.
3. In `contracts/.env`, set `NEW_GAME_MASTER_ADDRESS` to that address, then run from `contracts/`:
   ```bash
   npx hardhat run scripts/set-game-master.js --network sepolia
   ```

### 3. Run the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Check it at <http://localhost:8000/api/health>. Interactive API docs are at <http://localhost:8000/docs>.

### 4. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000>.

### Copying the ABI

After compiling the contract, copy its ABI into the backend and frontend:

```bash
cd contracts
npx hardhat compile
node scripts/export-abi.js
```

## Main user flow

TODO: replace with a walkthrough of the built app. Planned flow (see `docs/SCOPE.md`, section 4):

1. Connect MetaMask on Sepolia.
2. Mint a character.
3. The game master grants an item; it appears in the inventory.
4. Equip the item. The character is now locked against transfer.
5. A match completes (`POST /api/match/complete`); XP appears live.
6. Spend XP to upgrade a stat.

## Documentation

- [Scope document](docs/SCOPE.md)
- [Technical design document](docs/TECHNICAL.md)

## Tech stack

Solidity 0.8.24 · Hardhat · OpenZeppelin · Python · FastAPI · web3.py · SQLite · Next.js · TypeScript · ethers.js

## Acknowledgements

- Libraries: OpenZeppelin Contracts, Hardhat, ethers.js, Next.js, React, FastAPI, web3.py, Pydantic.
- Course material: the dApp Development with Python sessions.
- AI assistance: Claude (Anthropic) was used for planning, drafting the scope and technical documents, and scaffolding. TODO: keep this list in step with `docs/TECHNICAL.md`, section 14.
