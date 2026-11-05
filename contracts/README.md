# contracts/

Copy your existing Hardhat project from the Solidity course into this folder
(`contracts/`, `test/`, `scripts/`, `hardhat.config.js`, `package.json`, ...).
Then:

1. **Keep the two scripts in `scripts/`** that came with this scaffold:
   - `set-game-master.js` moves the game-master role to the backend wallet
   - `export-abi.js` copies the ABI into `backend/` and `frontend/`
2. **Merge `.env.example`** with yours. This one adds `CONTRACT_ADDRESS` and `NEW_GAME_MASTER_ADDRESS`.
3. **Keep only one version of the contract.** The deployed one is
   `HeroForgeCombined.sol`. Delete the unused split version (`HeroForge.sol` and `base/`),
   otherwise Hardhat reports duplicate artifacts (HH701).
4. Never copy your real `.env` into the repo.

No contract code changes are planned (see `docs/SCOPE.md`, section 9).
