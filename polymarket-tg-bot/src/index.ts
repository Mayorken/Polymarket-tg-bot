import { Telegraf } from "telegraf";
import { config } from "./config.js";
import { registerHandlers } from "./bot/commands.js";

const bot = new Telegraf(config.telegramBotToken);

registerHandlers(bot);

bot.catch((err, ctx) => {
  console.error(`Unhandled error for update ${ctx.updateType}:`, err);
});

async function main(): Promise<void> {
  if (!config.builderCode) {
    console.warn(
      "[warn] BUILDER_CODE is not set. Fine for Phase 1 (browsing); required before Phase 2 (trading).",
    );
  }
  await bot.launch(() => {
    console.log("Bot is running. Press Ctrl+C to stop.");
  });
}

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

main().catch((err) => {
  console.error("Failed to start bot:", err);
  process.exit(1);
});
