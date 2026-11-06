# HeroForge

> Own your character. Own your progress.

HeroForge is a dApp for a blockchain game where players own their characters and items as NFTs. A player mints a character, equips items and spends XP from a web page using MetaMask, while a backend game-master service grants XP and items after a match. Every change appears on screen without a refresh.

<!-- TODO: add docs/screenshots/main.png and uncomment the next line -->
<!-- ![HeroForge main screen](docs/screenshots/main.png) -->

**Demo video:** TODO (3 to 5 minutes)

## Contract

Deployed and verified on Sepolia: [`0xa574CbE7b3CD4e082D518141E64AF3e795dA487A`](https://sepolia.etherscan.io/address/0xa574CbE7b3CD4e082D518141E64AF3e795dA487A#code)

## How it works

- **Frontend** (Next.js + TypeScript + ethers.js): connects MetaMask, shows characters, and sends the player's own transactions (mint, equip, unequip, upgrade) with Pending / Confirmed / Failed states, wrong-network and rejection handling.
- **Backend** (FastAPI + web3.py): serves contract data as JSON, indexes contract events into SQLite, pushes them to the browser over a WebSocket, and, as the custodial extension, holds the game-master key and signs `earnXP` / `mintItem` when the game server calls it.
- **Contracts** (Hardhat): the HeroForge ERC-721 contract from the Solidity course, unchanged.

Full design: [docs/TECHNICAL.md](docs/TECHNICAL.md) ([Google Docs](https://docs.google.com/document/d/1-w6f3dKs9EGIyGjrehPiOCJph8cEi3OXbbPGUumgeuY/edit?usp=sharing)). Plan and acceptance criteria: [docs/SCOPE.md](docs/SCOPE.md) ([Google Docs](https://docs.google.com/document/d/15LQRsBv9h5M02ScN9V2BRSakxwXtk6LQgjqKcAx_9AY/edit?usp=sharing)).

## Repository layout

```
heroforge-dapp/
├── contracts/   Hardhat project: contract, tests, deploy and helper scripts
├── backend/     FastAPI service, requirements.txt, .env.example, scripts/game_server.py
├── frontend/    Next.js + TypeScript app, .env.example
├── docs/        SCOPE.md, TECHNICAL.md, screenshots/
├── .gitignore
└── README.md
```

## Quick start

### Prerequisites

- Node.js 20+ and Python 3.11+ (the backend was tested on 3.12)
- MetaMask with a Sepolia test wallet that has some test ETH
- A Sepolia RPC URL (`https://ethereum-sepolia-rpc.publicnode.com` works, or an Alchemy / Infura key)

### 1. Environment files

Copy each example and fill in the values. Never commit the real files.

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

In `backend/.env`, set `START_BLOCK` to the block the contract was deployed in (open the contract on Etherscan, then its creation transaction). The backend refuses to start on Sepolia with `START_BLOCK=0`.

### 2. One-time game-master setup

The contract was deployed with the deployer wallet as game master. The backend must use its own wallet so it never holds the owner key.

1. Create a new testnet-only wallet for the backend (after step 3's `pip install`):
   ```bash
   python -c "from eth_account import Account; a = Account.create(); print(a.address); print(a.key.hex())"
   ```
2. Put the private key in `backend/.env` as `GAME_MASTER_PRIVATE_KEY`, and send the address some Sepolia ETH from a faucet.
3. In `contracts/.env`, set `NEW_GAME_MASTER_ADDRESS` to that address, then from `contracts/`:
   ```bash
   npx hardhat run scripts/set-game-master.js --network sepolia
   ```
4. Set `MATCH_API_KEY` in `backend/.env` to a long random string.

### 3. Run the backend

`backend/app/abi/HeroForge.json` is included. To regenerate it from your own compile: `cd contracts && npx hardhat compile && node scripts/export-abi.js`.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Check <http://localhost:8000/api/health> (`isGameMaster` should be `true`). Interactive API docs: <http://localhost:8000/docs>.

### 4. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000> with MetaMask on Sepolia.

## Simulating the game server

The "match completed" and "grant item" endpoints are called by a game server, not the browser. In the demo, a script plays that role (run from `backend/`):

```bash
python scripts/game_server.py item  --to 0xPLAYER_ADDRESS --type sword   # grant a loot item
python scripts/game_server.py match --char 1 --xp 20                     # grant XP after a match
python scripts/game_server.py match --char 1 --xp 20 --bad-key           # 401, nothing is sent
python scripts/game_server.py match --char 1 --xp 20 --match-id demo-1   # run twice: second is 409
```

## Main user flow

TODO: replace with a walkthrough of the built app (add screenshots to `docs/screenshots/`).

1. Connect MetaMask on Sepolia and mint a character.
2. The game server grants an item; it appears in the inventory live.
3. Equip the item. The character is now locked against transfer.
4. A match completes; XP appears live without a refresh.
5. Spend XP to upgrade a stat.

## Documentation

- **Scope document**: [Local Markdown](docs/SCOPE.md) · [Google Docs](https://docs.google.com/document/d/15LQRsBv9h5M02ScN9V2BRSakxwXtk6LQgjqKcAx_9AY/edit?usp=sharing)
- **Technical design document**: [Local Markdown](docs/TECHNICAL.md) · [Google Docs](https://docs.google.com/document/d/1-w6f3dKs9EGIyGjrehPiOCJph8cEi3OXbbPGUumgeuY/edit?usp=sharing)

## Tech stack

Solidity 0.8.24 · Hardhat · OpenZeppelin · Python · FastAPI · web3.py · SQLite · Next.js · TypeScript · ethers.js

## Acknowledgements

- Libraries: OpenZeppelin Contracts, Hardhat, ethers.js, Next.js, React, FastAPI, web3.py, Pydantic.
- Course material: the dApp Development with Python sessions.
- AI assistance: Claude (Anthropic) was used for planning, drafting the scope and technical documents, and writing and testing the backend and frontend. See `docs/TECHNICAL.md`, section 14. I reviewed the code and can explain it.
