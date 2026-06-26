# Polymarket Telegram Bot

A Telegram bot for Polymarket prediction markets, built for the **Polymarket Builder Program**. Route real order volume through your `builderCode` to become eligible for the Verified tier (weekly USDC rewards + grants).

**Phase 1 (this scaffold): read-only market browser.** No wallet, no keys, no funds. Safe to run today.
**Phase 2 (next): trading.** Gated on a custody decision — see below.

---

## What works now

- `/start`, `/help` — intro
- `/trending` — top active markets by 24h volume, with inline pagination
- `/search <words>` — keyword filter over active markets
- `/market <slug>` — open a specific market (slug = the part after `/event/` in a Polymarket URL)
- Tap a number under a trending list to open that market

All market data comes from Polymarket's public Gamma API (`gamma-api.polymarket.com`). No authentication required.

---

## Setup (Windows / PowerShell friendly)

1. Install dependencies:
   ```
   npm install
   ```
2. Create a bot and get a token from [@BotFather](https://t.me/BotFather) on Telegram.
3. Copy the env file and fill it in:
   ```
   copy .env.example .env
   ```
   Set `TELEGRAM_BOT_TOKEN`. Leave `BUILDER_CODE` blank for now (Phase 1 doesn't use it).
4. Run it:
   ```
   npm run dev
   ```
5. Message your bot on Telegram and send `/trending`.

Build for production with `npm run build` then `npm start`.

---

## Project structure

```
src/
  index.ts              entry point — launches the bot
  config.ts             env loading
  polymarket/
    markets.ts          Gamma API client (read-only)
    format.ts           Telegram message formatting
  bot/
    commands.ts         command + button handlers
    keyboards.ts        inline keyboards
  trading/
    index.ts            Phase 2 interface + the custody decision (NOT implemented)
    side.ts             BUY/SELL enum
```

---

## Phase 2: trading and the custody decision

Trading is intentionally **not** wired into the bot yet. To prove the Polymarket
trade loop works before building the real flow, there's a standalone spike in
[`spike/`](./spike) that runs the full loop with your own funds (deploy gasless
deposit wallet → fund → approve → place a builder-attributed order → confirm
attribution). Start there; see `spike/README.md`.

The Polymarket mechanics are easy
(deploy a gasless deposit wallet, fund with pUSD, place orders with
`signatureType: 3` and your `builderCode` attached). The hard part is **who holds
the key** that owns each user's deposit wallet.

- **Option A — Non-custodial (recommended).** Telegram Mini App with an embedded
  wallet (Privy / Turnkey, the same providers in Polymarket's demo apps). The
  user controls their key; the backend never sees a raw private key. The bot
  deep-links to the mini app for any signing action.

- **Option B — Custodial.** The backend holds keys. Only acceptable with
  encryption-at-rest, and it carries real security and regulatory liability. Use
  it strictly for a testnet / your-own-funds demo, never to onboard other
  people's money.

`src/trading/index.ts` defines the `TradeService` interface both options
implement, plus the exact SDK calls for each step. Pick a model, build one
adapter, then add a "Trade" button in `src/bot/keyboards.ts`.

### Packages you'll add in Phase 2
```
npm install @polymarket/builder-relayer-client @polymarket/clob-client-v2 @polymarket/builder-signing-sdk viem
```

---

## Path to a grant

1. Ship Phase 1, then Phase 2 with a custody model.
2. Get your builder code at `polymarket.com/settings?tab=builder` and attach it to every order.
3. Route real orders — volume is attributed to your profile (allow ~24h to appear on the leaderboard).
4. Email `builder@polymarket.com` with your builder key, use case, and volume to apply for the Verified tier, which unlocks weekly USDC rewards and grants (both subject to approval).

> Note: Polymarket geoblocks some countries. Nigeria is **not** on the blocked list, but verify with `GET https://polymarket.com/api/geoblock` before onboarding users elsewhere.
