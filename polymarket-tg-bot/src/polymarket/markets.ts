import { config } from "../config.js";

/**
 * Thin client over Polymarket's public Gamma market-data API.
 * No auth, no keys, no funds — pure read access.
 * Docs: https://docs.polymarket.com/market-data/fetching-markets
 */

// ---- Types (only the fields we actually use) ----

export interface Market {
  question: string;
  slug: string;
  outcomes: string[]; // e.g. ["Yes", "No"]
  outcomePrices: number[]; // aligned with outcomes, each in [0,1]
  clobTokenIds: string[]; // aligned with outcomes; needed later for trading
  volume?: number;
  liquidity?: number;
  active?: boolean;
  closed?: boolean;
}

export interface MarketEvent {
  title: string;
  slug: string;
  volume24hr?: number;
  liquidity?: number;
  markets: Market[];
}

// ---- Raw shapes from the API (loose, defensively parsed) ----

interface RawMarket {
  question?: string;
  slug?: string;
  outcomes?: string | string[];
  outcomePrices?: string | string[];
  clobTokenIds?: string | string[];
  volume?: string | number;
  liquidity?: string | number;
  active?: boolean;
  closed?: boolean;
}

interface RawEvent {
  title?: string;
  slug?: string;
  volume24hr?: string | number;
  liquidity?: string | number;
  markets?: RawMarket[];
}

// ---- Helpers ----

/** Gamma sometimes returns arrays as JSON-encoded strings. Normalize both. */
function parseStringArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseNumberArray(value: string | string[] | undefined): number[] {
  return parseStringArray(value).map((v) => Number(v));
}

function toNumber(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeMarket(raw: RawMarket): Market {
  return {
    question: raw.question ?? "Untitled market",
    slug: raw.slug ?? "",
    outcomes: parseStringArray(raw.outcomes),
    outcomePrices: parseNumberArray(raw.outcomePrices),
    clobTokenIds: parseStringArray(raw.clobTokenIds),
    volume: toNumber(raw.volume),
    liquidity: toNumber(raw.liquidity),
    active: raw.active,
    closed: raw.closed,
  };
}

function normalizeEvent(raw: RawEvent): MarketEvent {
  return {
    title: raw.title ?? "Untitled event",
    slug: raw.slug ?? "",
    volume24hr: toNumber(raw.volume24hr),
    liquidity: toNumber(raw.liquidity),
    markets: (raw.markets ?? []).map(normalizeMarket),
  };
}

async function gammaGet<T>(path: string, params: Record<string, string | number | boolean>): Promise<T> {
  const url = new URL(path, config.gammaApiBase);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Gamma API ${path} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

// ---- Public functions ----

/** Top active events ordered by 24h volume — the "trending" feed. */
export async function getTrendingEvents(limit: number, offset = 0): Promise<MarketEvent[]> {
  const raw = await gammaGet<RawEvent[]>("/events", {
    active: true,
    closed: false,
    order: "volume_24hr",
    ascending: false,
    limit,
    offset,
  });
  return raw.map(normalizeEvent);
}

/** Fetch a single event by its slug (the bit after /event/ in a Polymarket URL). */
export async function getEventBySlug(slug: string): Promise<MarketEvent | null> {
  const raw = await gammaGet<RawEvent[]>("/events", { slug });
  if (!raw || raw.length === 0 || !raw[0]) return null;
  return normalizeEvent(raw[0]);
}

/**
 * Keyword search. Gamma has no documented full-text search param, so this is an
 * honest MVP: pull a page of high-volume active events and filter client-side by
 * title / question substring. Good enough to demo; swap for a real index later.
 */
export async function searchEvents(query: string, limit: number): Promise<MarketEvent[]> {
  const pool = await getTrendingEvents(200);
  const q = query.toLowerCase();
  const matches = pool.filter((event) => {
    if (event.title.toLowerCase().includes(q)) return true;
    return event.markets.some((m) => m.question.toLowerCase().includes(q));
  });
  return matches.slice(0, limit);
}
