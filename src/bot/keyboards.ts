import { Markup } from "telegraf";
import type { MarketEvent } from "../polymarket/markets.js";

/**
 * Build the inline keyboard under a trending page:
 * a row of numbered buttons to open each event, plus pagination.
 * Callback data is kept short (Telegram caps it at 64 bytes):
 *   "view:<slug>"  -> open an event
 *   "page:<n>"     -> jump to trending page n
 */
export function trendingKeyboard(events: MarketEvent[], page: number) {
  const numberRow = events.map((event, i) =>
    Markup.button.callback(String(i + 1), `view:${event.slug}`),
  );

  const nav = [];
  if (page > 0) nav.push(Markup.button.callback("‹ Prev", `page:${page - 1}`));
  nav.push(Markup.button.callback("Refresh", `page:${page}`));
  nav.push(Markup.button.callback("Next ›", `page:${page + 1}`));

  return Markup.inlineKeyboard([numberRow, nav]);
}

/** Keyboard under a single event detail. */
export function eventDetailKeyboard(event: MarketEvent) {
  return Markup.inlineKeyboard([
    [Markup.button.url("Open on Polymarket ↗", `https://polymarket.com/event/${event.slug}`)],
    [Markup.button.callback("‹ Back to trending", "page:0")],
    // Phase 2 will add a "Trade" button here once the custody model is chosen.
  ]);
}
