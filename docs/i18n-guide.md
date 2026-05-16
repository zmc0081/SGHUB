# SGHUB i18n Contributor Guide

SGHUB currently ships two locales — **简体中文 (zh-CN)** and **English
(en-US)**. The infrastructure is generic enough to support more once we
have committed maintainers; this guide covers both the day-to-day flow
(adding/changing keys) and the larger work of reintroducing a third
language.

## Architecture in one paragraph

All UI text lives as nested JSON in `locales/*.json`. The frontend uses
[i18next](https://www.i18next.com/) + [react-i18next](https://react.i18next.com/);
components call `t("namespace.key")` and the value is looked up in the
active language file. If a key is missing in a non-default language,
i18next falls back to `en-US` automatically.

The active language is decided at app startup:

1. User pick from settings (saved in `~/.sghub/config.toml`)
2. OS locale (`get_system_locale` Tauri command — `zh*` → zh-CN, else
   en-US)
3. Hard fallback `en-US`

## Adding or changing a key

1. Open both `locales/zh-CN.json` and `locales/en-US.json`.
2. Add the new key under the appropriate namespace (e.g. `chat`,
   `search`, `common`).
3. Reference it from the component:

   ```tsx
   const t = useT();
   <button>{t("common.save")}</button>
   ```

4. Mark the file as internationalized by adding a comment at the top:

   ```tsx
   // i18n: 本组件文案已国际化 (V2.1.0)
   ```

5. Run `npm run build` to make sure the JSON parses.

### Interpolation

Values can contain `{{name}}`-style placeholders:

```json
"subscription_new_count": "订阅「{{name}}」有 {{count}} 篇新文献"
```

Call:

```ts
t("notifications.subscription_new_count", { name: "Transformer", count: 3 })
```

Keep the placeholder tokens identical across languages.

### Plurals

For languages with plural rules different from English (e.g. Arabic,
Russian), i18next supports the suffix syntax (`_zero`, `_one`,
`_other`). SGHUB doesn't ship any pluralized keys yet; please open an
issue first if you need one so we can pick a consistent shape.

## Reintroducing a language we dropped

zh-TW, ja-JP and fr-FR were dropped from `SUPPORTED_LANGUAGES` in
V2.1.0-rc2 because we couldn't keep up. The full sequence to bring one
back:

1. Open an issue confirming you'll commit to maintaining it (a steady
   trickle of translation PRs as new keys land — typically 5–10 per
   release).
2. Create `locales/<code>.json`. Easiest start: copy `en-US.json` to
   keep the key shape identical.
3. Add the language to `SUPPORTED_LANGUAGES` in
   `src/i18n/index.ts` and import the JSON in the same file.
4. (Optional) Update `resolve_locale` in
   `src-tauri/src/config/mod.rs` so the OS locale falls through to your
   new code when appropriate, and update the matching test.
5. Open a PR — title like `i18n(ja-JP): re-introduce 日本語 with initial
   translation pass`.

## Adding a brand-new language (e.g. de-DE)

Same as above, but:

- Pick a [BCP 47](https://en.wikipedia.org/wiki/IETF_language_tag)
  code in the `xx-YY` form.
- Bundle size: each locale is ~5 KB gzipped — fine for a handful of
  languages. If we ever hit ~10, we'll switch to lazy-loaded chunks.
- Style notes per language:
  - Keep emoji (📎 ⭐ 🧠 …) in the same position as the source string
  - No HTML in the JSON values — raise it in the PR if you need it
  - Leave "SGHUB" in Latin script in every language

Thanks for helping make SGHUB usable for researchers worldwide. 🌍
