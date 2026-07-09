// V2.2.9 (Session 47, R8) — per-provider model-id preset lists for the
// add/edit model form. ONE place to maintain: refresh these when vendors
// ship new models (note the last-verified date per provider). The form
// always offers a "自定义…" entry on top of these, so an outdated list
// never blocks using a brand-new model. Saved configs are free text —
// refreshing this file never affects existing rows.

export const MODEL_ID_PRESETS: Record<string, string[]> = {
  // Last verified: 2026-07-09
  anthropic: [
    "claude-opus-4-8",
    "claude-sonnet-5",
    "claude-haiku-4-5-20251001",
  ],
  // Last verified: 2026-07-09
  openai: ["gpt-5", "gpt-5-mini", "gpt-4o"],
  // Last verified: 2026-07-09 — current Gemini line-up per Google Vertex
  // (3.5 Flash is the newest; 2.5 Pro remains in service).
  vertex: ["gemini-3.5-flash", "gemini-3.5-pro", "gemini-2.5-pro"],
  // Last verified: 2026-07-09 — popular local models (suggestions only;
  // whatever `ollama list` shows is equally valid via 自定义).
  ollama: ["llama3.3", "qwen3:8b", "deepseek-r1:8b"],
  // "openai" provider is also used by DeepSeek / SG AI Store / LM Studio
  // custom endpoints — those ids vary per gateway, so the generic openai
  // list above plus 自定义 covers them. DeepSeek's own ids for convenience:
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
};

/** Preset ids for a provider ("" for unknown → custom-only). DeepSeek shares
 *  the `openai` provider kind, so we surface its ids too when the endpoint
 *  points at deepseek.com. */
export function presetsFor(provider: string, endpoint?: string): string[] {
  if (provider === "openai" && endpoint?.includes("deepseek.com")) {
    return MODEL_ID_PRESETS.deepseek;
  }
  return MODEL_ID_PRESETS[provider] ?? [];
}
