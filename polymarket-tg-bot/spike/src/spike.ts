import "dotenv/config";
import {
  createWalletClient,
  createPublicClient,
  http,
  formatUnits,
  type Hex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";
import { RelayClient } from "@polymarket/builder-relayer-client";
import { BuilderConfig } from "@polymarket/builder-signing-sdk";
import {
  ClobClient,
  Chain,
  Side,
  OrderType,
  AssetType,
  SignatureTypeV2,
  COLLATERAL_TOKEN_DECIMALS,
} from "@polymarket/clob-client-v2";
import { ADDRESSES, HOSTS, CHAIN_ID } from "./contracts.js";
import { buildApprovalCalls } from "./approvals.js";

// ---------- env ----------
function req(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Missing env var ${name} (see spike/.env.example)`);
  return v.trim();
}
function opt(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : fallback;
}

const RPC_URL = opt("RPC_URL", "https://polygon-rpc.com");
const SIZE_USD = Number(opt("SIZE_USD", "1"));

// ---------- shared clients ----------
const account = privateKeyToAccount(req("PRIVATE_KEY") as Hex);
const walletClient = createWalletClient({ account, chain: polygon, transport: http(RPC_URL) });
const publicClient = createPublicClient({ chain: polygon, transport: http(RPC_URL) });

function makeRelayer(): RelayClient {
  const builderConfig = new BuilderConfig({
    localBuilderCreds: {
      key: req("BUILDER_API_KEY"),
      secret: req("BUILDER_SECRET"),
      passphrase: req("BUILDER_PASSPHRASE"),
    },
  });
  return new RelayClient(HOSTS.relayer, CHAIN_ID, walletClient, builderConfig);
}

/** Build a CLOB client bound to the deposit wallet (signatureType 3 / POLY_1271). */
async function makeClob(depositWallet: string): Promise<ClobClient> {
  const temp = new ClobClient({ host: HOSTS.clob, chain: Chain.POLYGON, signer: walletClient });
  const creds = await temp.createOrDeriveApiKey();
  return new ClobClient({
    host: HOSTS.clob,
    chain: Chain.POLYGON,
    signer: walletClient,
    creds,
    signatureType: SignatureTypeV2.POLY_1271,
    funderAddress: depositWallet,
  });
}

const erc20BalanceAbi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

async function readPusdBalance(wallet: string): Promise<number> {
  const raw = (await publicClient.readContract({
    address: ADDRESSES.pUSD as Address,
    abi: erc20BalanceAbi,
    functionName: "balanceOf",
    args: [wallet as Address],
  })) as bigint;
  return Number(formatUnits(raw, COLLATERAL_TOKEN_DECIMALS));
}

// ---------- stages ----------

async function setup(): Promise<void> {
  console.log("Owner EOA:        ", account.address);
  const relayer = makeRelayer();
  const depositWallet = await relayer.deriveDepositWalletAddress();
  console.log("Deposit wallet:   ", depositWallet);

  console.log("\nDeploying deposit wallet (gasless via relayer)...");
  try {
    const res = await relayer.deployDepositWallet();
    await res.wait();
    console.log("  deployed.");
  } catch (err) {
    console.log("  deploy skipped/failed (often means it already exists):", (err as Error).message);
  }

  console.log("\nApproving trading contracts (one deposit-wallet batch)...");
  const deadline = String(Math.floor(Date.now() / 1000) + 600);
  const res = await relayer.executeDepositWalletBatch(buildApprovalCalls(), depositWallet, deadline);
  await res.wait();
  console.log("  approvals confirmed.");

  const bal = await readPusdBalance(depositWallet);
  console.log(`\nCurrent pUSD in deposit wallet: $${bal.toFixed(2)}`);
  console.log("\nNEXT: send a few dollars of pUSD to the deposit wallet address above,");
  console.log("then run `npm run balance` to confirm it landed, then `npm run trade`.");
}

async function balance(): Promise<void> {
  const relayer = makeRelayer();
  const depositWallet = await relayer.deriveDepositWalletAddress();
  const bal = await readPusdBalance(depositWallet);
  console.log("Deposit wallet:", depositWallet);
  console.log(`pUSD balance:   $${bal.toFixed(2)}`);
  console.log(bal > 0 ? "Funded — you can run `npm run trade`." : "Not funded yet — send pUSD and re-check.");
}

async function trade(): Promise<void> {
  if (opt("CONFIRM", "no") !== "yes") {
    console.error("Refusing to trade: set CONFIRM=yes in .env once you're ready to spend real funds.");
    process.exit(1);
  }
  const tokenId = req("TOKEN_ID");
  const builderCode = req("BUILDER_CODE");

  const relayer = makeRelayer();
  const depositWallet = await relayer.deriveDepositWalletAddress();
  const clob = await makeClob(depositWallet);

  console.log("Syncing CLOB balance/allowance...");
  await clob.updateBalanceAllowance({ asset_type: AssetType.COLLATERAL });

  const tickSize = await clob.getTickSize(tokenId);
  const negRisk = await clob.getNegRisk(tokenId);

  const book = await clob.getOrderBook(tokenId);
  const asks = (book.asks ?? []).map((a) => Number(a.price)).filter((p) => p > 0);
  if (asks.length === 0) {
    console.error("No asks on this market right now — pick a more liquid TOKEN_ID.");
    process.exit(1);
  }
  // Buy at the lowest ask so the order crosses and fills (matched volume = what counts).
  const bestAsk = Math.min(...asks);
  const price = Math.min(bestAsk, 0.99);
  const size = Math.max(1, Math.round(SIZE_USD / price));

  console.log(`\nPlacing attributed BUY:`);
  console.log(`  token:   ${tokenId}`);
  console.log(`  price:   ${price}  (best ask)`);
  console.log(`  size:    ${size} shares  (~$${(price * size).toFixed(2)})`);
  console.log(`  builder: ${builderCode}`);

  const order = await clob.createAndPostOrder(
    { tokenID: tokenId, price, size, side: Side.BUY, builderCode },
    { tickSize, negRisk },
    OrderType.GTC,
  );
  console.log("\nOrder response:", JSON.stringify(order, null, 2));
  console.log("\nNow run `npm run verify` to confirm it's credited to your builder code.");
}

async function verify(): Promise<void> {
  const builderCode = req("BUILDER_CODE");
  const relayer = makeRelayer();
  const depositWallet = await relayer.deriveDepositWalletAddress();
  const clob = await makeClob(depositWallet);

  const builderTrades = await clob.getBuilderTrades({ builder_code: builderCode });
  console.log("Builder-attributed trades:", JSON.stringify(builderTrades, null, 2));

  const myTrades = await clob.getTrades();
  console.log(`\nYour wallet's trade count: ${myTrades.length}`);
}

async function main(): Promise<void> {
  const stage = process.argv[2];
  switch (stage) {
    case "setup":
      return setup();
    case "balance":
      return balance();
    case "trade":
      return trade();
    case "verify":
      return verify();
    default:
      console.log("Usage: tsx src/spike.ts <setup|balance|trade|verify>");
      console.log("Or: npm run setup | npm run balance | npm run trade | npm run verify");
  }
}

main().catch((err) => {
  console.error("\nSpike failed:", err);
  process.exit(1);
});
