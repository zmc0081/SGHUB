# SG Hub

[简体中文](README.zh-CN.md) | **English**

> **AI-powered academic literature manager for researchers.** Multi-source aggregated search / keyword subscriptions / AI structured deep-reading / Skill orchestration / BYOK multi-model / AI Store ready-to-use.
>
> Open source, local-first, BYOK + optional prepaid models.
>
> Project codename: `SGHUB` (the GitHub repo name, package name, bundle id, and other technical identifiers are kept); the display name is unified as **SG Hub**.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-v2.2.2-1F2E4D)](src-tauri/tauri.conf.json)
![Tauri 2](https://img.shields.io/badge/Tauri-2-24C8DB)
![React 18](https://img.shields.io/badge/React-18-61DAFB)
![Rust](https://img.shields.io/badge/Rust-1.80+-DE6233)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey)

---

## UI & Design

The interface follows the **V2.2 SGHUB Capsule** design spec (tokens / component specs / icon-map / interaction flows):

- Design spec (authoritative source): [`docs/ui-design/`](docs/ui-design/)
- Full screen-by-screen screenshot checklist: [`docs/ui-screenshots-checklist.md`](docs/ui-screenshots-checklist.md)
- Empty-state illustrations: [`docs/ui-design/4-assets/illustrations/`](docs/ui-design/4-assets/illustrations/)
- V2.1 historical UI baseline (SUPERSEDED): [`docs/ui-design-requirements.md`](docs/ui-design-requirements.md)

> Store-quality UI screenshots ship with each Release; run `cargo tauri dev` to preview every screen locally.

---

## ✨ Features (V2.2.2)

### Literature workflow
- **Multi-source aggregated search** — concurrent queries across arXiv / PubMed / Semantic Scholar / OpenAlex, unified result format, virtual scrolling kicks in automatically above 100 entries.
- **Keyword subscriptions + local push** — cron-driven subscriptions with no backend dependency, sidebar unread badge, bulk "mark read", one-click "new rule".
- **Literature database** (formerly "Favorites") — nested folders / tag cloud / reading status (unread / reading / read / parsed) / drag-to-file / FTS5 full-text search.
- **Local PDF upload & centralized management (NEW in V2.2.2)** — an "Upload PDF" button in the library toolbar plus full-page file drag-and-drop; metadata is auto-extracted via `lopdf` + `pdf-extract`, and failed / low-confidence files get a "Needs review" badge with one-click completion; local and online papers are managed together (folders / tags / status / FTS / source filter + batch move · tag · delete); local-PDF storage usage is shown in the left rail with orphan-file cleanup; edge cases are handled (duplicate detection, non-PDF rejection, corrupt-file degradation, >100 MB rejection).

### AI parsing & chat
- **Structured deep-reading (Parse)** — multiple Skill templates, streaming output, cards auto-split by `output_dimensions`, session-level history that can be restored.
- **General chat (Chat)** — multi-session, pin/rename, file attachments, optional Skill attachment, Markdown + syntax highlighting, Claude-style attachment chips, a "Thinking…" three-dot animation before streaming starts.
- **AI-generated Skills** — natural-language description → auto-generated valid YAML; supports multi-round refine, auto-retry validation, a 3-tab Config/YAML/Test preview, and localStorage drafts.
- **Skill management** — built-in + custom lists, upload `.yaml/.yml/.skill/.zip`, Monaco editor + live preview + test run + copy-and-edit a built-in.

### Models & cost
- **BYOK multi-model** — Claude / GPT / DeepSeek / local Ollama / any OpenAI-compatible endpoint / **SG AI Store prepaid plans**.
- **Keys in the Keychain** — Windows Credential Manager / macOS Keychain, **never** written to disk.
- **Cost tracking + charts** — input/output tokens recorded per model with automatic USD calculation; the Models page has 4 stat cards + a smooth AreaChart + 7d/30d/custom range switching + adaptive X-axis ticks.
- **AI parsing diagnostic logs** — every `chat_stream` entry records provider / endpoint / model_id / model_name, and failures carry the model name to ease cross-provider debugging.
- **History backfill** — a "Rebuild stats" button recomputes recent usage from `chat_messages` / `ai_parse_results`.

### AI Store
- **Browse prepaid model plans** — an "AI Store" sidebar entry, 6 SKUs (Claude Opus / Sonnet / GPT-5 / DeepSeek / Multi-Bundle) + a featured section + provider grouping.
- **Product detail + purchase redirect** — two-column layout, a sticky purchase panel, "Buy now" opens sgaistore.com in the OS browser.
- **Backend cache + auto-sync** — SQLite cache (V005) + 5-minute cycle + SSE push (reserved) + offline fallback.
- **SG AI Store onboarding** — a Models-page onboarding banner (paste-key one-click add) + SG AI Store chip + 4-tier balance badge (green/orange/red/grey) + 24h usage + refresh/detail/top-up buttons.
- **Pre-flight balance interception** — when balance < ¥1 or < 1000 tokens, Chat / Parse pops an InsufficientBalanceDialog (top up / switch model / cancel).

### Application infrastructure
- **Collapsible sidebar** — smooth 220px ↔ 60px animation + localStorage persistence + auto-collapse when the first window is < 900px + tooltips.
- **Auto-update** — daily-N / weekly (7-weekday bitmask) + 15-min-step time dropdown, with three behaviors: notify / silent download / mark only, and cron is rescheduled live.
- **Configurable data directory** — a 3-step migration wizard: pick directory → pick mode (migrate / fresh / adopt existing) → summary confirmation; SHA-256 verification + rollback on failure + auto-restart.
- **Privacy policy viewer** — a bilingual (zh/en) markdown policy built into Settings (covering local storage / API keys / BYOK / SG AI Store / Keychain / third-party data flows / user rights / contact).
- **Multilingual** — Simplified Chinese / English, follows the system, switches at runtime without restart.
- **Fully local** — SQLite + FTS5 local index; aside from the AI / search APIs and the SG AI Store gateway you actively call, no data is sent to any third party.

---

## 🚀 Installation

### Download a prebuilt release (recommended)

Go to [Releases](https://github.com/zmc0081/SGHUB/releases/latest):

- **Windows 10/11** — `SG.Hub_2.2.4_x64-setup.exe` (NSIS installer)
- **macOS 12+** — `SG.Hub_2.2.4_universal.dmg` (universal: Intel & Apple Silicon)

> **First-launch security prompts (until release signing is enabled):**
> - **Windows** — if SmartScreen shows "Windows protected your PC", click **More info → Run anyway**.
> - **macOS** — if it says "cannot verify developer", **right-click → Open → Open** (or run `xattr -dr com.apple.quarantine "/Applications/SG Hub.app"`).
>
> Maintainers: see [`docs/code-signing.md`](docs/code-signing.md) to enable code signing + notarization (removes these prompts).

### Build from source

See [Build from source](#-build-from-source) below.

---

## 🤖 Model configuration (BYOK + SG AI Store)

SG Hub bundles no AI service — bring your own key. Entry point: **Model Config → Add Model**.

| Provider | Default endpoint | Get a key | Notes |
|---|---|---|---|
| **Anthropic** | `https://api.anthropic.com` | <https://console.anthropic.com/> | Claude 3.5 / 4 / Opus / Sonnet |
| **OpenAI** | `https://api.openai.com/v1` | <https://platform.openai.com/api-keys> | GPT-4o / o1 / gpt-5 |
| **DeepSeek** | `https://api.deepseek.com/v1` | <https://platform.deepseek.com/> | deepseek-chat / reasoner |
| **Ollama (local)** | `http://localhost:11434` | no key needed | run `ollama pull llama3:8b` first |
| **SG AI Store** | `https://sgaistore.com/v1` | <https://sgaistore.com/> | prepaid, ready to use, built-in balance badge + interception |
| **Custom (OpenAI-compatible)** | any endpoint | — | LM Studio / Azure OpenAI / self-hosted gateway |

### Pricing (cost estimation)
Each model card can hold an "input price" and "output price" (USD / 1M tokens), used by the Models-page stat cards and the cost column of the chart. After selecting a "preset" in the add form, prices are auto-filled by model-id prefix (claude-opus / gpt-5 / deepseek, etc.).

> Keys are **stored only in the system Keychain** — never written to toml, never logged, never uploaded to any third party.

---

## 🛒 AI Store (optional prepaid service)

Fully independent of BYOK — you can mix both modes.

### Who it's for
- People who don't want to apply for Anthropic / OpenAI accounts.
- People who want unified billing (one subscription, multiple switchable models).
- Occasional heavy users for whom monthly prepay beats pay-per-call.

### Flow
1. Click "AI Store" in the sidebar to browse 6 plans (Claude Opus monthly/yearly / Sonnet / GPT-5 / DeepSeek / all-model bundle).
2. Open a product detail → "Buy now" → the browser opens `sgaistore.com/buy/{id}` to complete payment.
3. Back in SG Hub → an onboarding banner appears atop "Model Config" → paste the API key from sgaistore.com + pick the purchased plan → one-click add.
4. The model card shows a balance badge (green/orange/red/grey) + expiry + 24h usage automatically.
5. When balance runs low, Chat / Parse pops a "Top up" dialog.

### Data flow
- Requests are proxied through the `sgaistore.com` gateway to the underlying model provider.
- The gateway **only records usage metadata** (token counts / call time / user id) and **does not store** request bodies (paper content, prompts) or response bodies.
- Fully optional — when unused, there is no data flow at all between SG Hub and sgaistore.com.

Full data-flow details + user rights are in the in-app **Settings → Privacy Policy** (bilingual zh/en).

---

## 🧠 Skill system

A Skill is a reusable "literature → structured output" template: define `name / description / prompt_template / output_dimensions / recommended_models / ...` in YAML, and attach it on demand in Parse and Chat.

### Built-in Skill
- `general_read.yaml` — a general deep-reading template (title / key questions / method / results / novelty / limitations).

### User Skill sources (3 ways)
1. **AI-generated** — `Skill Management → + New → Create with AI`: one natural-language sentence + multi-round refine, with automatic YAML validation + retry.
2. **Hand-written** — `+ New → Create manually`: a Monaco YAML editor + live preview + test run.
3. **Upload / copy** — upload `.yaml/.yml/.skill/.zip`, or copy a built-in Skill and edit it.

### Skill YAML fields (excerpt)
```yaml
name: my_method_finder       # unique id (kebab/snake case)
display_name: Method Finder
description: Extract experimental methods, datasets, and comparison metrics
icon: 🔬                      # user input field, emoji exempt
version: 1.0.0
author: you@example.com
recommended_models: [claude-3-5-sonnet, gpt-4o]
output_dimensions:
  - key: dataset
    label: Dataset
  - key: baseline
    label: Baseline
  - key: metric
    label: Metric
prompt_template: |
  Read the following paper and output strictly as JSON {dataset, baseline, metric}:
  Title: {{title}}
  Abstract: {{abstract}}
  Body: {{full_text}}
```

See [`skills/general_read.yaml`](skills/general_read.yaml) and the SkillEditor "rendered prompt" preview for the full template variables and fields.

---

## 🔄 Auto-update

Entry point: **Settings → Auto-update**.

- **Master switch** + **frequency** (daily-N / weekly 7-weekday multi-select) + **time** (96 options at 15-min steps).
- **Behavior on finding an update**: notify / silent download / mark only (icon badge).
- A status grid shows: current version / last check / next scheduled check / pending version.
- Cron reschedules automatically on config change, no restart needed.

> `tauri-plugin-updater` is only enabled in release builds; dev builds skip it to avoid crashing when signing keys are absent.

---

## 💾 Data directory

### Default location
- **Windows**: `%APPDATA%\com.sghub.app\` (= `C:\Users\<you>\AppData\Roaming\com.sghub.app\`)
- **macOS**: `~/Library/Application Support/com.sghub.app/`

```
com.sghub.app/
├── config.toml         # main config
├── models.toml         # model config (key references, no plaintext)
├── data/
│   ├── sghub.db        # SQLite main database (V001-V006 migrations)
│   ├── pdfs/           # downloaded/uploaded PDFs (local uploads under pdfs/uploaded/)
│   ├── cache/          # search cache
│   └── chat_attachments/  # Chat uploaded attachments
├── skills/             # user-defined Skill YAML
└── logs/               # app logs (rolling, 7 days)
```

### Custom path

`Settings → Data storage location → Change path` triggers a 3-step wizard:

1. **Pick a directory** — instant validation (empty / existing SG Hub data / forbidden paths like the system root).
2. **Pick a mode** —
   - migrate existing data there
   - start fresh at the new path (old data kept)
   - directly adopt existing SG Hub data at the target path
3. **Summary confirmation** — shows old→new + mode, warns "do not close during migration".

Migration process:
- Each file is verified by SHA-256 (db/yaml/toml) or byte length (PDF).
- Any failed step rolls everything back; old data is never lost.
- On completion you can choose "keep / delete the old directory" and the app auto-restarts.
- The custom path is written to `%APPDATA%\sghub-bootstrap\bootstrap.toml` (separate from the data itself, to avoid the "data moved but path not found" bootstrap loop).

---

## 🔧 Build from source

### Prerequisites

| Dependency | Version | Windows install |
|---|---|---|
| Node.js | ≥ 18 | `winget install OpenJS.NodeJS.LTS` |
| Rust | **≥ 1.80** (uses `std::sync::LazyLock`) | `winget install Rustlang.Rustup` then `rustup default stable` |
| MSVC Build Tools | 2022 | `winget install Microsoft.VisualStudio.2022.BuildTools` (check "Desktop development with C++") |
| Tauri CLI | 2.x | `cargo install tauri-cli --version "^2.0"` |

macOS needs Xcode Command Line Tools (`xcode-select --install`).
Linux needs `libwebkit2gtk-4.1-dev` and friends (see [CONTRIBUTING.md](CONTRIBUTING.md)).

### Build steps

```bash
git clone https://github.com/zmc0081/SGHUB.git
cd SGHUB

# 1. Install frontend deps
npm install

# 2. Dev mode (hot reload, updater skipped)
cargo tauri dev

# 3. Production build
cargo tauri build
# Output: src-tauri/target/release/bundle/{nsis,dmg,...}
```

### Repository layout (overview)

```
SG_Hub/
├── src/                           # React frontend
│   ├── pages/                     # routed pages
│   │   ├── Search / Feed / Library / Parse / Chat
│   │   ├── Models / Skills / SkillGenerator / Settings
│   │   └── store/                 # StoreHome / ProductDetail / mockData
│   ├── components/                # UI components
│   │   ├── Sidebar / Titlebar / PaperPicker / PaperActions
│   │   ├── FavoriteButton / PaperMetadataEditor / SkillEditor
│   │   ├── BrandLogo / DataDirCard / UpdaterCard
│   │   ├── PrivacyPolicyDialog
│   │   ├── InsufficientBalanceDialog
│   │   └── chat/*
│   ├── stores/                    # Zustand: chatStore / libraryStore / skillGeneratorStore
│   ├── lib/
│   │   ├── tauri.ts               # centralized invoke() wrappers
│   │   ├── sgAiStoreApi.ts        # AI Store frontend contract
│   │   └── version.ts             # APP_VERSION single source (reads package.json)
│   ├── assets/privacy/            # zh-CN.md + en-US.md (bundled)
│   ├── i18n/                      # i18next config
│   └── styles/                    # Tailwind + CSS variables (themes)
├── src-tauri/
│   ├── src/
│   │   ├── ai_client/             # OpenAI-compatible / Anthropic / Ollama impls + usage stats
│   │   ├── ai_store/              # products / sync_strategy / sse_listener / billing / commands
│   │   ├── chat/                  # sessions / messages / attachments
│   │   ├── config/                # bootstrap.toml + paths + migration
│   │   ├── db/                    # SQLite + r2d2 + refinery
│   │   ├── library/               # folders / tags / reading status / local PDF upload
│   │   ├── notify/                # system tray notifications
│   │   ├── pdf_extract/           # lopdf + pdf-extract + catch_unwind
│   │   ├── scheduler/             # tokio-cron-scheduler (subscriptions + updater)
│   │   ├── search/                # multi-source concurrent search
│   │   ├── skill_engine/          # Skill loading / rendering / generator
│   │   ├── subscription/          # keyword subscriptions
│   │   └── updater/               # auto-update + time scheduling
│   ├── icons/                     # desktop icons (source: app-icon.svg)
│   ├── migrations/                # V001 → V006 SQL migrations
│   └── tests/                     # integration tests (parse_with_all_providers, etc.)
├── skills/                        # built-in Skill (general_read.yaml)
├── locales/                       # zh-CN.json / en-US.json
└── docs/
    ├── ui-design/                 # V2.2 SGHUB Capsule design spec (authoritative)
    ├── ui-design-requirements.md  # V2.1 historical UI baseline (SUPERSEDED)
    ├── ui-screenshots-checklist.md
    ├── i18n-guide.md
    ├── skill-authoring-guide.md
    └── SESSION_TASKS.md           # historical session task list
```

---

## 🔒 Privacy & security

- API keys are stored in the system Keychain via [keyring-rs](https://github.com/hwchen/keyring-rs) — never written to a plaintext file, never logged, never uploaded to any third party.
- Aside from AI / search API calls you actively trigger, the app sends no data to any third party.
- SG AI Store (optional) requests are proxied through the `sgaistore.com` gateway, which only records usage metadata (token counts / time) and does not store request or response bodies.
- The SQLite database is stored locally and can be backed up or exported at any time.
- PDF text extraction runs under `tokio::spawn_blocking` + `catch_unwind`, so a corrupt / abnormal PDF cannot take down the main process.
- The in-app **Settings → Privacy Policy** provides the full bilingual terms (10 sections) covering every third-party data flow.

---

## 🌐 Internationalization (i18n)

SG Hub follows the system language by default; you can also switch manually in "Settings → Language" without restarting.

| Code  | Language     | Status                              |
| ----- | ------------ | ----------------------------------- |
| zh-CN | 简体中文     | ✅ Complete (default)               |
| en-US | English      | ✅ Complete                         |

OS locales like `zh-TW` / `zh-HK` resolve to zh-CN; other languages resolve to en-US.
See [`docs/i18n-guide.md`](docs/i18n-guide.md) for adding a new language.

---

## 📚 Documentation

| Doc | Purpose |
|---|---|
| [`docs/ui-design/`](docs/ui-design/) | **V2.2 SGHUB Capsule design spec** (tokens / component specs / icon-map / interaction flows) |
| [`docs/ui-design-requirements.md`](docs/ui-design-requirements.md) | V2.1 historical UI baseline (SUPERSEDED; only a V2.1→V2.2 reference) |
| [`docs/ui-screenshots-checklist.md`](docs/ui-screenshots-checklist.md) | full screen-by-screen screenshot task list |
| [`docs/i18n-guide.md`](docs/i18n-guide.md) | guide to adding / maintaining languages |
| [`docs/skill-authoring-guide.md`](docs/skill-authoring-guide.md) | Skill YAML authoring spec |
| [`docs/data-management.md`](docs/data-management.md) | data directory / migration / backup strategy |
| [`docs/release-checklist.md`](docs/release-checklist.md) | pre-release checklist (version sync / icons / signing / install robustness) |
| [`docs/code-signing.md`](docs/code-signing.md) | Windows + macOS code signing & notarization setup |
| [`docs/SESSION_TASKS.md`](docs/SESSION_TASKS.md) | per-version session task list (M2.1.0 / M2.2.1 history + roadmap) |
| [CONTRIBUTING.md](CONTRIBUTING.md) | dev environment / code style / PR flow |
| [CLAUDE.md](CLAUDE.md) | Claude Code project context (architecture / constraints / style) |

---

## 🤝 Contributing

Issues / PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for environment setup, code style, and the PR flow.

Before opening a PR, make sure:
- `cargo fmt` + `cargo clippy --all-targets -- -D warnings` pass (MSRV 1.80).
- `cargo test` passes.
- `npm run build` + `npx eslint src/` pass.
- The 6 PR-blocking greps are all 0 (see [CLAUDE.md](CLAUDE.md) §UI design spec): no V2.1 stale tokens / no `transition-all` / no `window.confirm/prompt/alert` / no emoji (Skill icon excepted) / no hardcoded colors (`src/styles/index.css` excepted).
- Commit messages follow Conventional Commits (`feat:` / `fix:` / `docs:` / `chore:` …).

---

## License

[MIT](LICENSE) © 2026 SG Hub Contributors
