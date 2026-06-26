import type { MarketEvent, Market } from "./markets.js";

/** Escape the characters Telegram HTML parse mode cares about. */
export function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtUsd(value: number | undefined): string {
  if (value === undefined) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

/** Price in [0,1] -> "63%". */
function fmtPct(price: number | undefined): string {
  if (price === undefined || Number.isNaN(price)) return "—";
  return `${Math.round(price * 100)}%`;
}

/** One-line summary of a market's leading outcome, e.g. "Yes 63% · No 37%". */
function marketLine(market: Market): string {
  if (market.outcomes.length === 0) return esc(market.question);
  const parts = market.outcomes.map((outcome, i) => {
    const price = market.outcomePrices[i];
    return `${esc(outcome)} ${fmtPct(price)}`;
  });
  return parts.join(" · ");
}

/** Compact card for the trending list. */
export function formatEventCard(event: MarketEvent, index: number): string {
  const header = `<b>${index}. ${esc(event.title)}</b>`;
  const meta = `24h vol ${fmtUsd(event.volume24hr)} · liq ${fmtUsd(event.liquidity)}`;
  // For a binary event there's usually one market; show its outcome split.
  const first = event.markets[0];
  const line = first ? marketLine(first) : "";
  return [header, line, `<i>${meta}</i>`].filter(Boolean).join("\n");
}

/** Full detail view for a single event. */
export function formatEventDetail(event: MarketEvent): string {
  const lines: string[] = [`<b>${esc(event.title)}</b>`];
  lines.push(`24h vol ${fmtUsd(event.volume24hr)} · liquidity ${fmtUsd(event.liquidity)}`);
  lines.push("");

  const markets = event.markets.filter((m) => m.active && !m.closed);
  if (markets.length === 0) {
    lines.push("<i>No active markets in this event right now.</i>");
    return lines.join("\n");
  }

  for (const market of markets.slice(0, 12)) {
    lines.push(`• ${esc(market.question)}`);
    lines.push(`   ${marketLine(market)}`);
  }

  lines.push("");
  lines.push(`<a href="https://polymarket.com/event/${esc(event.slug)}">Open on Polymarket ↗</a>`);
  return lines.join("\n");
}
