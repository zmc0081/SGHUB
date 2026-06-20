<div align="center">

# SG Hub

**AI-Powered Academic Literature Management Desktop App**

Open Source · Local-First · Privacy-Respecting

English · [简体中文](./README.md)

`Tauri 2` · `React 18` · `TypeScript` · `Rust` · `SQLite(FTS5)` · MIT License

</div>

---

## Overview

SG Hub is an open-source (MIT) desktop client for researchers that brings discovering, managing, and reading literature into one local-first, privacy-respecting workspace. It offers multi-source aggregated search, keyword subscriptions with scheduled notifications, a literature database, AI-powered paper analysis, free-form chat, and BYOK multi-model configuration.

## Features

- **Multi-source search** — 8 sources in parallel (arXiv / PubMed / Semantic Scholar / OpenAlex / Crossref / CORE / DBLP / DOAJ), with DOI lookup, fuzzy title matching, and cross-source dedup & merge
- **Subscriptions & notifications** — keyword subscriptions + scheduled local push (system tray)
- **Literature database** — nested folders + tags + smart folders + local PDF upload & management
- **Built-in PDF reader** — open PDFs in-app with paging / zoom / outline / search
- **Full-text translation** — LLM-powered, academic-grade translation preserving structure and layout
- **AI paper analysis** — structured deep-reading via multiple Skills, streaming output
- **Free-form chat** — switch models, attach files, use Skills and paper references
- **Model config (BYOK)** — Claude / GPT / DeepSeek / local Ollama; API keys stored in OS keychain
- **AI Store** — connect to the standalone SG AI Store for ready-to-use model quotas

## Retrieval Layer Architecture

SG Hub's retrieval layer is a layered pipeline: multi-source ingestion → dedup & merge → citation enrichment → semantic search → application output.

<div align="center">

![SG Hub Retrieval Layer Architecture](./sghub_retrieval_layer_architecture.png)

</div>

| Layer | Capability | Status |
|---|---|---|
| ① Multi-source ingestion | parallel adapters · field normalization · rate-limit & retry (8 sources + planned Unpaywall) | Done |
| ② Dedup & merge | exact DOI match · fuzzy title/author · version clustering · best-field merge | Done |
| ③ Citation enrichment | citation graph · citation counts · bidirectional links · related-paper recommendation | Planned |
| ④ Semantic search | embeddings · vector store · hybrid (BM25 + vector) · reranking | Planned |

## Tech Stack

| Layer | Technology |
|------|------|
| Framework | Tauri 2 (Rust backend + WebView frontend) |
| Frontend | React 18 + TypeScript 5 + Vite + TailwindCSS 3 + Zustand + TanStack Router |
| i18n | react-i18next (zh-CN / zh-TW / en-US / ja-JP / fr-FR) |
| Backend | Rust + tokio + rusqlite (SQLite + FTS5) + reqwest + keyring |
| PDF | pdf.js (render) + pdf-extract / lopdf (text extraction) |

## Installation

Download the installer for your platform from [Releases](https://github.com/zmc0081/SGHUB/releases):
- Windows: `SG.Hub_x.x.x_x64-setup.exe`
- macOS: `SG.Hub_x.x.x_x64.dmg`

> On Windows, if SmartScreen appears, click "More info → Run anyway".
> Supports Windows 10 21H2+ and macOS 12+.

## Build from Source

```bash
# Prerequisites: Node.js >= 18, Rust, platform build deps
git clone https://github.com/zmc0081/SGHUB.git
cd SGHUB
npm install
npm run tauri dev      # dev mode
npm run tauri build    # build installers
```

## Privacy

- Data is stored locally by default; papers / PDFs / chat history are not uploaded
- In BYOK mode, requests go directly to the model provider, not through any SG Hub server
- In AI Store mode, requests go through the sgaistore.com gateway, which records only usage metadata, not content
- API keys are stored in the OS keychain (Credential Manager / Keychain)

## License

[MIT](./LICENSE) © Star Technology

---

<div align="center">

Copyright © Star Technology. All Rights Reserved.

</div>
