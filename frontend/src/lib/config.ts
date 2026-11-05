// Public configuration only. NEXT_PUBLIC_* values are visible in the browser.
// Each variable is read with a literal property access so Next.js can inline it at build time.

export const config = {
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000",
  wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/events",
  contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "",
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 11155111),
  etherscanBase: process.env.NEXT_PUBLIC_ETHERSCAN_BASE ?? "https://sepolia.etherscan.io",
} as const;
