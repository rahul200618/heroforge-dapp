# HeroForge — Scope Document

> Own your character. Own your progress.

**Author:** Rahul

**Contract (Sepolia, verified):** [`0xa574CbE7b3CD4e082D518141E64AF3e795dA487A`](https://sepolia.etherscan.io/address/0xa574CbE7b3CD4e082D518141E64AF3e795dA487A#code)

**Network:** Sepolia (chain ID 11155111)

**Stack:** Next.js + TypeScript + ethers.js (frontend) · FastAPI + web3.py (backend) · existing Hardhat project (contracts)

---

## 1. One-liner

HeroForge lets a player mint a character, equip items and spend XP from a web page using MetaMask, while a backend game-master service grants XP and items after a match, and every change appears on screen without a refresh.

## 2. The problem

HeroForge is a game where characters, items and progression are owned by players as NFTs. The contract already enforces the rules, but on its own it is unusable for a real person:

- **Players cannot use it.** Calling `mintCharacter`, `equipItem` or `spendXP` from Etherscan means pasting numbers into raw forms, knowing the network, and reading errors like `0x7a3f…`. Nobody playing a game will do that.
- **Players cannot see their stuff.** The contract has no way to list "all characters owned by this address", and nothing tells a player when their XP changes.
- **Someone must hold the game-master key.** `earnXP` and `mintItem` can only be called by the game-master address. A human clicking through Etherscan after every match does not scale, and cannot react to a game event. A trusted backend has to hold that key and act when a match completes.

The app is the layer that turns the deployed contract into something a player can use, and gives the game operator a safe way to reward them.

## 3. Users and roles

| Role | Needs a wallet? | What they can do in the app |
|---|---|---|
| Player | Yes: MetaMask on Sepolia | Mint characters, view their characters, items and activity, equip and unequip items, spend XP to upgrade a stat |
| Visitor | No | View any character page and the live activity feed, read-only. All action buttons are disabled |
| Game master (backend service) | No MetaMask. The backend holds its own key | Grant XP and mint items, only through the backend API. Has no screen |
| Game operator / game server | No wallet. Uses an API key | Calls the "match completed" and "grant item" endpoints. In the demo this is `curl` or the FastAPI `/docs` page |
| Contract owner (deployer) | Yes: MetaMask, outside the app | One-time setup and emergency use: `setGameMaster()` to rotate the game-master key. Not part of any screen |

## 4. User flows

**Flow 1: Player mints a character**
1. Player opens the app and clicks **Connect wallet**; MetaMask asks to connect.
2. The header shows their shortened address and a green "Sepolia" indicator.
3. On the home page they type a name (1–32 characters) and click **Mint character**.
4. MetaMask shows the transaction. They confirm.
5. The button shows **Pending** with a link to the transaction on Etherscan.
6. When the transaction is mined it shows **Confirmed**, and a new card appears under "My characters" with STR 1 / SPD 1 / DEF 1 and XP 0.

**Flow 2: Player equips and unequips an item**
1. The game master (via the backend) has granted the player a "sword". It appears in their inventory live, with no refresh.
2. Player opens their character page. The sword is listed under **Inventory** with an **Equip** button.
3. They click **Equip** and confirm in MetaMask. Status goes Pending, then Confirmed.
4. The sword moves to **Equipped items**. A notice reads "Locked: this character cannot be transferred while items are equipped."
5. They click **Unequip** and confirm. The sword returns to Inventory and the lock notice disappears.

**Flow 3: A match completes and XP arrives live (the custodial flow)**
1. The player has their character page open.
2. The game server sends `POST /api/match/complete` with an API key, a unique match ID, the character ID and an XP amount.
3. The backend validates the request, signs `earnXP` with the game-master key and submits it.
4. The player sees a notification "+20 XP" and the XP number on the page increases. They did not refresh and did not sign anything.
5. A new "XP earned" row appears in the activity feed.

**Flow 4: Player upgrades a stat**
1. Player has at least 10 XP. The **Upgrade** buttons next to Strength, Speed and Defence are enabled.
2. They click **Upgrade** next to Strength and confirm in MetaMask.
3. Status goes Pending, then Confirmed.
4. Strength changes from 1 to 2 and XP drops by 10. If XP is below 10, or the stat is already 100, the button is disabled and says why.

**Flow 5: Wrong network, rejection and failure**
1. Player opens the app with MetaMask on Ethereum Mainnet.
2. A banner reads "Wrong network: HeroForge runs on Sepolia" with a **Switch to Sepolia** button. All write buttons are disabled.
3. They click **Switch**, approve in MetaMask, and the banner disappears.
4. They click **Mint character** and press **Reject** in MetaMask. The app shows "You rejected the transaction in MetaMask. Nothing was sent." and returns to idle.
5. Failed transaction: with two browser tabs open on a character with exactly 10 XP, they upgrade in both. The contract rejects the second transaction (usually while MetaMask estimates gas, before anything is sent) and the app shows **Failed: you don't have enough XP**, translated from the contract's `InsufficientXP` error.

## 5. Screens

Three screens. A shared header appears on all of them.

**Shared header and banners**
- App name, navigation links (Characters, Activity), **Connect wallet** button, shortened address once connected.
- Network indicator: green "Sepolia" or a red wrong-network banner with a **Switch to Sepolia** button.
- "MetaMask not found" message with an install link if no wallet is present.
- If the player changes account in MetaMask, the page reloads its data for the new account.
- A toast area for live notifications such as "+20 XP".

**Screen 1: Characters (`/`)**
- Shows: a grid of "My characters" cards (name, token ID, STR / SPD / DEF, XP, "N items equipped"). Each card links to its detail page.
- Lets the user: mint a character (name field with validation, **Mint character** button, transaction status area).
- States: not connected ("Connect your wallet to see your characters"), connected with none ("You have no characters yet"), loading, error.

**Screen 2: Character detail (`/characters/[id]`)**
- Shows: name, token ID and owner address; XP balance; three stat rows (Strength, Speed, Defence) each as value out of 100; **Equipped items** list; **Inventory** list of items the owner holds that are not equipped; a transfer-lock notice when anything is equipped.
- Lets the owner: **Upgrade** a stat (costs 10 XP), **Equip** an inventory item, **Unequip** an equipped item.
- Visitors and non-owners see the same page with every button disabled.
- A transaction status area shows Pending, Confirmed or Failed, with the transaction hash linked to Etherscan, and the plain-English error on failure.
- XP, stats and item lists update live when the backend reports a matching event.

**Screen 3: Activity (`/activity`)**
- Shows: a live feed, newest first, of contract events: character minted, item minted, item equipped, item unequipped, XP earned, stat upgraded. Each row has an icon, a plain-English sentence, the block number and a link to the transaction.
- A connection indicator shows "Live" or "Reconnecting…".
- Lets the user: nothing to click except links. It is a read-only screen that proves the live-update path.

## 6. What lives where

| Responsibility | Contract | Backend | Frontend |
|---|---|---|---|
| Ownership of characters and items | ERC-721 ownership is the source of truth | Reads it; keeps an index of "which address owns which token" from `Transfer` events | Displays it |
| Stats, XP and equip state | Stores and enforces them | Reads and serves them as JSON | Displays them |
| Who may grant XP or mint items | `onlyGameMaster` check | Holds the game-master key; signs only after validating the request | Never touches this key or these functions |
| Who may mint, equip, unequip and spend XP | Ownership checks and access modifiers | Not involved | Sends the transaction through MetaMask |
| Rules: stat cap of 100, 10 XP per upgrade, no dual-equip, transfer lock | Enforces them (this is the real security) | None | Reads constants to disable buttons early (UX only, not security) |
| Validating a "match completed" request | None | API key check, input validation, XP bounds, duplicate match ID rejection | None |
| Detecting on-chain changes | Emits events | Polls for events, remembers the last block it processed, pushes updates over WebSocket | Listens to the WebSocket and updates the screen |
| Transaction states, wrong network, rejection | None | None | Pending / Confirmed / Failed, network banner, rejection message |
| Error messages | Reverts with custom errors | None | Translates custom errors into plain English |
| Secrets | None | Game-master key, RPC URL and API key live in `backend/.env` | Only public config: backend URL, contract address, chain ID |

## 7. Custody model

| Key | Held by | Stored | Signs | Why |
|---|---|---|---|---|
| Player key | The player | MetaMask on their device | `mintCharacter`, `equipItem`, `unequipItem`, `spendXP` | The contract checks `msg.sender` owns the character or item. Only the owner's own key can pass. The backend could not do this even if it wanted to, which is the point |
| Game-master key | The backend service | `backend/.env`, a dedicated testnet-only key | `earnXP`, `mintItem` | These are operator actions. They must happen when a match ends, without a human clicking, so the backend holds the key and the game operator pays the gas |
| Owner key | The deployer (me) | MetaMask, never on the backend | `setGameMaster` only | Separates the power to rotate the game master from the power to use it |

**Why this is the right choice:** a game studio really does run a server that rewards players, so custody of the *operator* role fits the product. Custody of the *player* role would not, since players must own their characters. Splitting the keys means a leaked backend key cannot touch player assets.

**Setup requirement:** the contract was deployed with the deployer wallet as game master. Before the demo I will create a separate backend wallet and call `setGameMaster(backendAddress)` from the owner account, so the backend never holds the owner key. The backend checks this at start-up and refuses to run if it is not the game master.

**If the game-master key leaks:** an attacker can grant XP and mint items until I rotate it with `setGameMaster`. They cannot move player NFTs, change the owner, or rotate the key themselves. Damage is limited further by a per-request XP cap and a funded balance of only a few test ETH.

## 8. Extension

**Chosen: Custodial service.** The backend holds the game-master key and performs contract actions on the game's behalf.

What it does in HeroForge:
- `POST /api/match/complete`: after a match, grants XP to a character via `earnXP`.
- `POST /api/items/grant`: grants a loot item to a player via `mintItem`. Needed so players have something to equip.
- Both endpoints require an API key, validate their input, and are called only by the game operator. In the demo they are called with `curl` or the FastAPI `/docs` page, never from the browser, so no secret reaches the frontend.
- Each match has a unique match ID, so the same match cannot grant XP twice.
- The backend sends one transaction at a time, so two simultaneous requests cannot collide on the same nonce.
- Every grant is logged with match ID, character, amount and transaction hash as an audit trail.

## 9. Contract changes

**None.** Everything the app needs already exists:
- All six gameplay events and the standard `Transfer` event are emitted.
- `getCharacter`, `getItem`, `getEquippedItems`, `isCharacter`, `hasEquippedItems`, `MAX_STAT` and `XP_PER_UPGRADE` are public.
- The one gap is that the contract cannot list "all tokens owned by an address". The backend solves this by indexing `Transfer` events, so no new contract function is needed.

Operational change, not a code change: the game master is rotated from the deployer wallet to a dedicated backend wallet using the existing `setGameMaster()`.

Fallback if the event index proves unreliable: add a `tokensOfOwner` view function, redeploy, re-verify, and record the change in `TECHNICAL.md`.

## 10. In scope / out of scope

**In scope**
- Wallet connection with MetaMask, network check and account-change handling
- Mint a character, equip, unequip and upgrade a stat, each with Pending / Confirmed / Failed states
- Custom-error messages translated into plain English
- Rejection and wrong-network handling
- Three screens: Characters, Character detail, Activity
- FastAPI backend with at least three read endpoints (characters, items, config) plus the two game-master endpoints
- Live updates: backend polls for events and pushes them to the browser over WebSocket
- Custodial extension: API-key-protected match-completed and grant-item endpoints
- Persisted last-processed block and processed match IDs, so a restart does not lose or repeat anything
- `.env.example` files, README, `SCOPE.md`, `TECHNICAL.md`, demo video

**Out of scope (deliberately not building)**
- **IPFS images and metadata.** That is a second extension. One extension done properly scores higher than two half-done.
- **Wallet sign-in and sessions.** The wallet is the identity. No accounts, no database of users.
- **Multi-signature or signed-voucher game master.** A good next step for the single-key risk, but a separate project's worth of work.
- **Transfer or marketplace UI.** The contract supports transfers and enforces the lock, but the app does not expose buying, selling or sending.
- **A real game or real match verification.** "Match completed" is simulated by an authenticated API call.
- **Hosting.** Everything runs on localhost.
- **Animations, themes, mobile layout.** They earn nothing and cost time.

## 11. Acceptance criteria

- [ ] Done when MetaMask is on a network other than Sepolia and the app shows the wrong-network banner, disables every write button, and the **Switch to Sepolia** button works
- [ ] Done when a player with fewer than 10 XP sees all three **Upgrade** buttons disabled with a reason
- [ ] Done when rejecting a MetaMask prompt shows "You rejected the transaction" and the UI returns to idle with no stuck Pending state
- [ ] Done when a transaction the contract rejects shows **Failed** with the plain-English meaning of the contract error (tested with the two-tab XP scenario)
- [ ] Done when minting a character shows Pending, then Confirmed, and the new character appears in "My characters" with STR 1 / SPD 1 / DEF 1 and XP 0
- [ ] Done when equipping an item moves it to **Equipped items** and shows the transfer-lock notice, and unequipping removes the notice
- [ ] Done when `POST /api/match/complete` with a valid key increases the XP on an open character page without a refresh
- [ ] Done when `POST /api/match/complete` with a missing or wrong API key returns 401 and no transaction is sent
- [ ] Done when sending the same match ID twice returns 409 and only one `earnXP` transaction exists on Etherscan
- [ ] Done when the backend is stopped, an XP grant is made, and after restarting the backend the missed event appears in the Activity feed
- [ ] Done when the backend refuses to start if its address is not the contract's current game master
- [ ] Done when the three read endpoints return data that matches Etherscan for the same character
- [ ] Done when a stranger can clone the repo, follow the README, and complete the main flow in under 15 minutes
- [ ] Done when no `.env`, key or seed phrase appears anywhere in the Git history, and `.env.example` files exist for `contracts/`, `backend/` and `frontend/`

## 12. Open questions and risks

| Risk or question | What I will do |
|---|---|
| The public RPC (`ethereum-sepolia-rpc.publicnode.com`) may limit `eth_getLogs` ranges and rate, and WebSocket subscriptions may drop | Poll in small block ranges instead of relying on subscriptions. If it is still unreliable, switch to an Alchemy or Infura key in `.env` |
| The contract cannot list tokens by owner | Build an index from `Transfer` events starting at the deployment block. Fallback: add `tokensOfOwner` and redeploy (see section 9) |
| The backend misses events while it is down | Save the last processed block to a JSON file or SQLite and resume from it on start-up |
| Two simultaneous grants collide on the same nonce | Process game-master transactions one at a time behind a lock |
| The game master is currently the deployer wallet, so the backend could end up holding the owner key | Rotate to a dedicated backend key with `setGameMaster`, and add the start-up check from section 11 |
| The backend wallet runs out of test ETH | Show a clear error from the endpoint and log it. Top up from a faucet |
| "Verified gameplay" is only simulated, so the chain cannot prove a match happened | State this plainly in `TECHNICAL.md`: players trust the game operator to grant XP fairly. A multi-signature approval flow is the documented next step |
| Time runs short | Cut in this order: the Activity screen first (live XP on the character page still proves live updates), then the item-grant endpoint (seed items with a script instead) |
