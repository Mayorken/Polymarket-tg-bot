import { Telegraf } from "telegraf";
import { config } from "../config.js";
import { getTrendingEvents, getEventBySlug, searchEvents } from "../polymarket/markets.js";
import { formatEventCard, formatEventDetail, esc } from "../polymarket/format.js";
import { trendingKeyboard, eventDetailKeyboard } from "./keyboards.js";

const WELCOME = [
  "<b>Polymarket on Telegram</b>",
  "",
  "Browse live prediction markets right here.",
  "",
  "<b>Commands</b>",
  "/trending — top markets by 24h volume",
  "/search &lt;words&gt; — find a market by keyword",
  "/market &lt;slug&gt; — open a specific market",
  "/help — show this again",
  "",
  "<i>Trading is coming next. For now this is a read-only browser — no wallet, no funds.</i>",
].join("\n");

async function sendTrendingPage(ctx: any, page: number): Promise<void> {
  const offset = page * config.pageSize;
  const events = await getTrendingEvents(config.pageSize, offset);

  if (events.length === 0) {
    await ctx.reply("No more markets to show. Try /trending to start over.");
    return;
  }

  const body = events
    .map((event, i) => formatEventCard(event, offset + i + 1))
    .join("\n\n");

  const header = `<b>Trending markets</b> (page ${page + 1})\nTap a number to open one.\n\n`;
  await ctx.reply(header + body, {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...trendingKeyboard(events, page),
  });
}

export function registerHandlers(bot: Telegraf): void {
  bot.start((ctx) => ctx.reply(WELCOME, { parse_mode: "HTML" }));
  bot.help((ctx) => ctx.reply(WELCOME, { parse_mode: "HTML" }));

  bot.command("trending", async (ctx) => {
    try {
      await sendTrendingPage(ctx, 0);
    } catch (err) {
      console.error("trending error", err);
      await ctx.reply("Couldn't reach Polymarket just now. Try again in a moment.");
    }
  });

  bot.command("search", async (ctx) => {
    const query = ctx.message.text.replace(/^\/search(@\w+)?\s*/i, "").trim();
    if (!query) {
      await ctx.reply("Usage: /search election\nGive me a word or two to look for.");
      return;
    }
    try {
      const results = await searchEvents(query, config.pageSize);
      if (results.length === 0) {
        await ctx.reply(`No active markets matched “${esc(query)}”.`, { parse_mode: "HTML" });
        return;
      }
      const body = results.map((event, i) => formatEventCard(event, i + 1)).join("\n\n");
      await ctx.reply(`<b>Results for “${esc(query)}”</b>\n\n${body}`, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        ...trendingKeyboard(results, 0),
      });
    } catch (err) {
      console.error("search error", err);
      await ctx.reply("Search hiccuped. Try again in a moment.");
    }
  });

  bot.command("market", async (ctx) => {
    const slug = ctx.message.text.replace(/^\/market(@\w+)?\s*/i, "").trim();
    if (!slug) {
      await ctx.reply("Usage: /market fed-decision-in-october\nThe slug is the bit after /event/ in a Polymarket URL.");
      return;
    }
    try {
      const event = await getEventBySlug(slug);
      if (!event) {
        await ctx.reply(`Couldn't find an event with slug “${esc(slug)}”.`, { parse_mode: "HTML" });
        return;
      }
      await ctx.reply(formatEventDetail(event), {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        ...eventDetailKeyboard(event),
      });
    } catch (err) {
      console.error("market error", err);
      await ctx.reply("Couldn't load that market. Try again in a moment.");
    }
  });

  // Inline button: open a specific event.
  bot.action(/^view:(.+)$/, async (ctx) => {
    const slug = ctx.match[1];
    if (!slug) {
      await ctx.answerCbQuery().catch(() => {});
      return;
    }
    try {
      await ctx.answerCbQuery();
      const event = await getEventBySlug(slug);
      if (!event) {
        await ctx.reply("That market seems to have closed.");
        return;
      }
      await ctx.reply(formatEventDetail(event), {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        ...eventDetailKeyboard(event),
      });
    } catch (err) {
      console.error("view action error", err);
      await ctx.answerCbQuery("Couldn't load that one.").catch(() => {});
    }
  });

  // Inline button: paginate trending.
  bot.action(/^page:(\d+)$/, async (ctx) => {
    const page = Number(ctx.match[1]);
    try {
      await ctx.answerCbQuery();
      await sendTrendingPage(ctx, page);
    } catch (err) {
      console.error("page action error", err);
      await ctx.answerCbQuery("Couldn't load that page.").catch(() => {});
    }
  });
}
