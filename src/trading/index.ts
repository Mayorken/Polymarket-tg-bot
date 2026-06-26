/**
 * PHASE 2 — TRADING (NOT IMPLEMENTED YET)
 * =======================================
 *
 * This file deliberately contains no signing or key-handling code. Trading is
 * gated on a custody decision, because that decision changes the whole design.
 *
 * The Polymarket mechanics are simple once a wallet exists:
 *   1. Deploy a per-user deposit wallet via the relayer (gasless, no user signature).
 *      pkg: @polymarket/builder-relayer-client  ->  relayer.deployDepositWallet()
 *   2. User funds that wallet with pUSD.
 *   3. Approve trading contracts from the wallet (a relayer WALLET batch).
 *   4. Sync CLOB balances (signatureType = 3 / POLY_1271).
 *   5. Place orders with the CLOB client:
 *      pkg: @polymarket/clob-client-v2  ->  client.createAndPostOrder(
 *             { tokenID, price, size, side, builderCode: config.builderCode },
 *             { tickSize, negRisk }, OrderType.GTC)
 *      Gas is covered by the relayer; the builderCode attributes volume to you.
 *
 * The ONLY hard question is who holds the key that owns each deposit wallet:
 *
 *   OPTION A — Non-custodial (recommended)
 *     A Telegram Mini App with an embedded wallet (Privy / Turnkey). The user
 *     controls their key; the backend never sees a raw private key. The bot
 *     deep-links to the mini app for any action that signs.
 *
 *   OPTION B — Custodial
 *     The backend holds signing keys. Only acceptable with encryption-at-rest,
 *     and it carries real security + regulatory liability. Use this only for a
 *     testnet / your-own-funds demo, never to onboard other people's money.
 *
 * Implement ONE of the adapters below after choosing. Until then, the bot stays
 * read-only and touches no funds.
 */

import type { Side } from "./side.js";

export interface TradeRequest {
  telegramUserId: number;
  tokenId: string; // clobTokenId of the chosen outcome
  side: Side;
  price: number; // limit price in [0,1]
  sizeUsd: number;
}

export interface TradeResult {
  orderId: string;
  status: string;
}

/** A custody adapter implements this. Pick A or B, build exactly one. */
export interface TradeService {
  /** Ensure the user has a funded, approved deposit wallet; return its address. */
  ensureWallet(telegramUserId: number): Promise<string>;
  /** Place an attributed order (builderCode attached inside the implementation). */
  placeOrder(req: TradeRequest): Promise<TradeResult>;
  /** Current pUSD buying power for the user's deposit wallet. */
  getBalance(telegramUserId: number): Promise<number>;
}

export const NOT_IMPLEMENTED = () => {
  throw new Error("Trading is not implemented. Choose a custody model first (see this file).");
};
