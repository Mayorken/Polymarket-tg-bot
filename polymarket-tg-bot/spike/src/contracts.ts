import { Chain } from "@polymarket/clob-client-v2";

export const CHAIN_ID = 137; // Polygon mainnet
export const CHAIN = Chain.POLYGON;

export const HOSTS = {
  clob: "https://clob.polymarket.com",
  relayer: "https://relayer-v2.polymarket.com",
} as const;

/**
 * Verified against https://docs.polymarket.com/resources/contracts (Polygon mainnet).
 * Do not edit without re-checking that page.
 */
export const ADDRESSES = {
  pUSD: "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB",
  conditionalTokens: "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045",
  ctfExchange: "0xE111180000d2663C0091e4f400237545B87B996B",
  negRiskCtfExchange: "0xe2222d279d744050d28e00520010520000310F59",
  negRiskAdapter: "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296",
  depositWalletFactory: "0x00000000000Fb5C9ADea0298D729A0CB3823Cc07",
} as const;
