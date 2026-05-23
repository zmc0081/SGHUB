# SG Hub Privacy Policy

**Version**: V2.2.1 · **Last updated**: 2026-05-21

SG Hub is an open-source (MIT) desktop literature manager that runs entirely on your computer. This document describes how SG Hub handles your data.

> **In one line**: SG Hub **does not operate any backend server**. All your papers, Skills, chat history, PDFs and API keys live only on your machine. Details below.

---

## 1. Local data storage

Everything is stored in your OS application-data directory:

- **Windows**: `%APPDATA%\com.sghub.app\`
- **macOS**: `~/Library/Application Support/com.sghub.app/`

Contents:

- `data/sghub.db` — SQLite database (paper metadata, chat history, parse results, subscriptions)
- `data/pdfs/` — PDFs you downloaded or uploaded
- `data/cache/` — search-result cache
- `data/chat_attachments/` — files attached in Chat
- `skills/` — your custom Skill templates
- `logs/` — application logs (rolling, auto-deleted after 7 days)

You can move all of the above to any path under **Settings → Data location** (works with OneDrive / iCloud Drive sync).

---

## 2. API key security

Provider API keys are stored in your OS keychain:

- **Windows**: Windows Credential Manager
- **macOS**: Keychain

Backed by the `keyring-rs` open-source library. Your key is **never**:

- Written to any plain-text config file (no key in `config.toml` / `models.toml`)
- Written to logs
- Sent to any SG Hub-controlled server (we don't have one)

Each key is bound to its model-config UUID. Deleting a model clears the corresponding keychain entry at the same time.

---

## 3. AI model calls (BYOK mode)

When you configure Anthropic / OpenAI / DeepSeek / Ollama / any OpenAI-compatible service with your own API key:

- Requests go **directly** (HTTPS) from your computer to the `endpoint` you configured
- **Nothing passes through any SG Hub server**
- The request body contains: the paper title / abstract / full PDF text you selected, your Skill-rendered prompt, and model parameters
- Responses stream back to your computer and render token-by-token

The full destination URL is visible in **Settings → Models** under each model card's `endpoint` field.

---

## 4. SG AI Store (optional, upcoming)

If at some point you choose to use SG AI Store (`https://sgaistore.com`) prepaid models:

- Requests are proxied through the SG AI Store gateway to the underlying provider
- The gateway **records usage metadata only**: token counts, call timestamps, user identifier (for billing reconciliation)
- The gateway **does not retain** request bodies (paper content, prompts) or response bodies
- You can disable this path entirely under **Settings → Privacy → Block SG AI Store models in Chat / AI Parse**

SG AI Store is a **separate product** with its own terms of service. It is fully optional. If you don't use it, no data flows between SG Hub and sgaistore.com.

---

## 5. Literature search

Search hits the following **open scholarly APIs** directly (no API key required, no personal information sent):

| Source | Host | Purpose |
|---|---|---|
| arXiv | `export.arxiv.org` | arXiv preprints |
| Semantic Scholar | `api.semanticscholar.org` | Cross-discipline papers + citation graph |
| PubMed | `eutils.ncbi.nlm.nih.gov` | Medical literature (NCBI E-utilities) |
| OpenAlex | `api.openalex.org` | Open scholarly graph |

Requests contain only your search keywords. Results are cached locally; subsequent browsing makes no further network calls.

---

## 6. Auto-update

When **Settings → Auto-update** is enabled, SG Hub queries `https://github.com/zmc0081/SGHUB/releases` for release metadata on the schedule you set.

- The request contains only the current version string
- No personal information, paper data, or usage statistics are sent
- You can disable this entirely under **Settings → Auto-update**

---

## 7. Logs

Application logs are written to the local `logs/` directory and auto-deleted after 7 days. They contain:

- Module name + timestamp + log level
- Call-chain context (provider / endpoint / model_id — **never the API key, never the paper text**)
- Error stack traces

Logs **are not uploaded anywhere**. If you want to share logs for debugging, please open the `logs/` directory manually and review contents first.

---

## 8. Third-party data flow overview

| Destination | Trigger | Data sent |
|---|---|---|
| → Model provider (Anthropic / OpenAI / DeepSeek / Ollama, etc.) | AI Parse / Chat / Skill test | Selected paper + prompt + model parameters |
| → arXiv / Semantic Scholar / PubMed / OpenAlex | Literature search / subscription | Search keywords |
| → GitHub Releases | Auto-update | Current version number |
| → sgaistore.com (optional) | Using an SG AI Store model | Same as model provider + usage metadata |

Outside these four explicit destinations, SG Hub **does not send data to any other server**.

---

## 9. Your rights

You own your data fully:

- **Export**: Library papers export to BibTeX with one click; chat history can be read directly from the SQLite file
- **Delete**: Deleting a paper / Skill / chat / model wipes the associated keychain entry and files immediately
- **Migrate**: **Settings → Data location** moves the entire data directory anywhere you choose
- **Offline**: Outside the trigger points above, SG Hub works fully offline

---

## 10. Updates & contact

- This policy evolves with each release. **Material changes** will be called out in the changelog.
- Project: `https://github.com/zmc0081/SGHUB`
- Feedback: GitHub Issues
- Policy version: **V2.2.1** · last updated **2026-05-21**

---

> This is the community-edition default policy. If you deploy SG Hub in an enterprise or regulated environment, please have your legal/compliance team review this document.
