// V2.2.1 Session 28 — SG AI Store API contract.
//
// SG AI Store (sgaistore.com) is a SEPARATE prepaid-model gateway
// product. SG Hub only consumes its public listing API + the optional
// per-user balance/usage view (Session 29). Nothing in this file
// implies SG Hub talks to sgaistore.com unless the user explicitly
// engages the Store flow.
//
// During development the entire frontend reads from `mockData.ts`
// directly — the Tauri-backed path is wired but only fires when
// `USE_MOCK_DATA` is flipped off (or the env override is set).

import { MOCK_PRODUCTS } from "../pages/store/mockData";

// ── shape contract (mirrored on the Rust side as serde structs) ────

/** Per-locale string map, e.g. `{ "zh-CN": "Claude Opus 月度包", ... }` */
export type LocalizedString = Record<string, string>;
/** Per-locale string-array map for feature bullets. */
export type LocalizedStringArray = Record<string, string[]>;

export interface SgStoreProduct {
  id: string;
  name: LocalizedString;
  description: LocalizedString;
  icon_url: string;
  model_provider: string; // "anthropic" | "openai" | "deepseek" | "ollama" | "multi"
  model_id: string;
  billing_period: "monthly" | "yearly";
  price_cny: number;
  price_usd: number;
  token_quota: number; // monthly/yearly token allowance
  features: LocalizedStringArray;
  tags: string[]; // ["popular", "best-value", ...]
  popular: boolean;
  purchase_url: string;
}

export interface SgStoreBalance {
  balance_cny: number;
  remaining_tokens: number;
  subscription: {
    product_name: string;
    expires_at: string; // ISO 8601
    auto_renew: boolean;
  } | null;
  usage_24h: {
    tokens_in: number;
    tokens_out: number;
    call_count: number;
  };
}

export type SyncState = "synced" | "syncing" | "offline" | "stale";

export interface SyncStatus {
  state: SyncState;
  last_synced_at: string | null; // ISO 8601
  next_sync_at: string | null; // ISO 8601, null when offline
  product_count: number;
  message: string | null; // human-readable when state ∈ {offline, stale}
}

// ── runtime configuration ──────────────────────────────────────────

/**
 * Master flip. While SG AI Store the product is still pre-launch, the
 * Store UI runs entirely off in-process mock data — no HTTP, no SSE,
 * no Tauri commands fired.
 *
 * Set to `false` when the real sgaistore.com endpoint is reachable.
 */
export const USE_MOCK_DATA = true;

/** Base URL of the SG AI Store catalog API. */
export const SG_AI_STORE_BASE_URL = "https://sgaistore.com";

// ── API surface (resolves through mock or Tauri) ───────────────────

let mockSyncedAt: Date | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function fiveMinutesFromNow(): string {
  return new Date(Date.now() + 5 * 60 * 1000).toISOString();
}

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const sgAiStoreApi = {
  /**
   * Return the current product catalog. Frontend mock mode just
   * resolves the bundled array after a tiny artificial delay so the
   * UI loading state is exercised. Real mode would invoke Tauri's
   * `ai_store_get_products`.
   */
  async getProducts(): Promise<SgStoreProduct[]> {
    if (USE_MOCK_DATA) {
      await delay(150);
      mockSyncedAt = mockSyncedAt ?? new Date();
      return MOCK_PRODUCTS;
    }
    // Real path (wired but not exercised in mock mode):
    const { api } = await import("./tauri");
    return api.aiStoreGetProducts();
  },

  /**
   * Trigger an immediate refresh. Mock mode flips `last_synced_at`
   * and returns the same data; real mode would issue an HTTP GET
   * with `If-None-Match: <etag>` and parse the updated catalog.
   */
  async syncNow(): Promise<{ products: SgStoreProduct[]; status: SyncStatus }> {
    if (USE_MOCK_DATA) {
      await delay(400);
      mockSyncedAt = new Date();
      return {
        products: MOCK_PRODUCTS,
        status: {
          state: "synced",
          last_synced_at: mockSyncedAt.toISOString(),
          next_sync_at: fiveMinutesFromNow(),
          product_count: MOCK_PRODUCTS.length,
          message: null,
        },
      };
    }
    const { api } = await import("./tauri");
    return api.aiStoreSyncNow();
  },

  /** Current sync status snapshot (cheap, no network in either mode). */
  async getSyncStatus(): Promise<SyncStatus> {
    if (USE_MOCK_DATA) {
      return {
        state: "synced",
        last_synced_at: mockSyncedAt?.toISOString() ?? nowIso(),
        next_sync_at: fiveMinutesFromNow(),
        product_count: MOCK_PRODUCTS.length,
        message: null,
      };
    }
    const { api } = await import("./tauri");
    return api.aiStoreGetSyncStatus();
  },

  /**
   * Look up a single product by id. Always traverses the cached
   * catalog client-side — there's no single-product endpoint.
   */
  async getProduct(id: string): Promise<SgStoreProduct | null> {
    const all = await this.getProducts();
    return all.find((p) => p.id === id) ?? null;
  },
};

// ── i18n helpers — pick the right localized field for the user ─────

/**
 * Read a `LocalizedString` against the active app language with
 * graceful fallback: exact match → en-US → first entry.
 */
export function pickLocalized(
  field: LocalizedString | undefined,
  lang: string,
): string {
  if (!field) return "";
  if (field[lang]) return field[lang];
  if (field["en-US"]) return field["en-US"];
  const first = Object.values(field)[0];
  return first ?? "";
}

export function pickLocalizedArray(
  field: LocalizedStringArray | undefined,
  lang: string,
): string[] {
  if (!field) return [];
  if (field[lang]) return field[lang];
  if (field["en-US"]) return field["en-US"];
  const first = Object.values(field)[0];
  return first ?? [];
}
