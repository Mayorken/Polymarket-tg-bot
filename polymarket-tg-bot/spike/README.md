# Trade Spike — prove the Polymarket loop end-to-end

A one-off, **single-user** script that runs the full trade loop with **your own funds**:
deploy a gasless deposit wallet → fund it → approve → place a **builder-attributed** order → confirm it's credited to your builder code.

This is a throwaway proof, not the product. Once it works, the proven trade module gets lifted into the real (non-custodial) app.

> ⚠️ **This spends real money on Polygon mainnet.** Use a **dedicated throwaway wallet** with a few dollars in it — never your main wallet. The script holds a private key locally; that's fine for a solo spike, but it is **not** the pattern for onboarding other people (that's the non-custodial Mini App, Phase 2 proper).

---

## What you need first

1. **A dedicated EOA private key.** Make a fresh wallet (e.g. a new MetaMask account), export its private key. Put a few dollars of **pUSD** on it later (step 3).
2. **Builder / Relayer API credentials** — generate at [polymarket.com/settings?tab=api-keys](https://polymarket.com/settings?tab=api-keys). You get a `key`, `secret`, and `passphrase`.
3. **Your builder code** (bytes32, `0x...`) — from [polymarket.com/settings?tab=builder](https://polymarket.com/settings?tab=builder).
4. **A token id to trade** — pick a liquid market, grab one outcome's `clobTokenId`. The browsing bot already surfaces these, or use the Gamma API.

---

## Setup

```powershell
cd spike
npm install
copy .env.example .env
```

Fill in `.env`: `PRIVATE_KEY`, `BUILDER_API_KEY`, `BUILDER_SECRET`, `BUILDER_PASSPHRASE`, `BUILDER_CODE`, `TOKEN_ID`. Leave `CONFIRM=no` for now.

---

## Run it (four stages)

**1. Deploy your deposit wallet + approvals (gasless):**

```powershell
npm run setup
```

This prints your **deposit wallet address**. Gas is covered by Polymarket's relayer.

**2. Fund it.** Send a few dollars of **pUSD** to that deposit wallet address, then check:

```powershell
npm run balance
```

Repeat until it shows a balance.

**3. Place the attributed trade.** Set `CONFIRM=yes` in `.env`, then:

```powershell
npm run trade
```

It buys the lowest ask (so it fills) for ~`SIZE_USD`, with your `builderCode` attached.

**4. Confirm attribution:**

```powershell
npm run verify
```

`getBuilderTrades` should list the trade under your builder code. Volume can take up to ~24h to appear on the public leaderboard, but the API confirms attribution immediately.

---

## If something errors

- **insufficient balance** → pUSD must be in the *deposit wallet*, not the owner EOA. Re-check `npm run balance`.
- **insufficient allowance** → re-run `npm run setup` (it re-sends the approval batch).
- **L2 AUTH NOT AVAILABLE / invalid signature** → the signer, signature type, or funder don't line up; the script uses `POLY_1271` + deposit wallet, which is correct for this flow.
- **no asks on this market** → pick a more liquid `TOKEN_ID`.

Paste any error and we'll sort it.

---

## Verified facts this script is built on

- Hosts: CLOB `https://clob.polymarket.com`, relayer `https://relayer-v2.polymarket.com`
- Contract addresses: from [docs.polymarket.com/resources/contracts](https://docs.polymarket.com/resources/contracts) (`src/contracts.ts`)
- SDK calls: checked against the installed `@polymarket/clob-client-v2` and `@polymarket/builder-relayer-client` type definitions, not the docs (the docs pages disagreed on the relayer constructor; the installed package uses the positional form this script uses).
