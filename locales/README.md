# SGHUB Locales

App-wide translation source files. The runtime loads these JSON files at
startup; the active language is decided in this order:

1. User pick saved in `~/.sghub/config.toml` (`language` field)
2. **OS locale** (via `get_system_locale` — see `src-tauri/src/config/mod.rs`)
3. Fallback: `en-US`

## Supported languages

| Code  | Name         | Status                  |
| ----- | ------------ | ----------------------- |
| zh-CN | 简体中文     | ✅ Complete (default)   |
| en-US | English      | ✅ Complete             |

Only these two are bundled into the app right now (V2.1.0-rc2). The
infrastructure supports more — see [`../docs/i18n-guide.md`](../docs/i18n-guide.md)
for how to re-introduce zh-TW / ja-JP / fr-FR / a new language once
there's a maintainer for it.

## Adding a new key

1. Add the key to `en-US.json` AND `zh-CN.json` with proper translations.
   The two together are the source of truth.
2. Reference it from the UI as `t("namespace.key")` (or with interpolation:
   `t("notifications.subscription_new_count", { name, count })`).

If the key is missing from one language, i18next falls back to `en-US`
automatically — but please avoid that: ship every key in both files.

## Plural / variable syntax

We use i18next default interpolation:

```json
"subscription_new_count": "订阅「{{name}}」有 {{count}} 篇新文献"
```

Call:

```ts
t("notifications.subscription_new_count", { name: "Transformer", count: 3 })
```
