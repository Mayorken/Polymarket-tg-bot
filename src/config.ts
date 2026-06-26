import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value.trim();
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : fallback;
}

export const config = {
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  gammaApiBase: optional("GAMMA_API_BASE", "https://gamma-api.polymarket.com"),
  // Phase 1 (browsing) does not need a builder code, so it's optional here.
  // Phase 2 (trading) will require it — see src/trading/.
  builderCode: optional("BUILDER_CODE", ""),
  pageSize: Number(optional("PAGE_SIZE", "6")),
} as const;
