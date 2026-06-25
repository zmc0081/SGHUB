# SG Hub Privacy Policy

**Version**: v2.2.7 · **Effective**: 2026-06-25

SG Hub is an open-source (MIT) desktop literature manager that runs entirely on your computer. This document describes how SG Hub handles your data.

> **Short promise**: SG Hub **operates no backend server**. All your papers, Skills, chat history, PDFs and API keys live only on your computer. The details follow.

---

## 1. Local data storage

All data lives in the OS application-data directory:

- **Windows**: `%APPDATA%\com.sghub.app\`
- **macOS**: `~/Library/Application Support/com.sghub.app/`

Including:

- `data/sghub.db` — SQLite database (paper metadata, chat history, parse results, subscriptions)
- `data/pdfs/` — PDFs you download or upload
- `data/cache/` — search-result cache
- `data/chat_attachments/` — chat upload attachments
- `skills/` — custom Skill templates
- `logs/` — application logs (auto-deleted after 7 days)

You can change the data directory under **Settings → Data location** and migrate everything to any path you choose (OneDrive / iCloud Drive sync supported).

---

## 2. API key security

Model-provider API keys are stored entirely in the OS credential store:

- **Windows**: Windows Credential Manager
- **macOS**: Keychain

Backed by the open-source `keyring-rs` library. Keys are **never**:

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
- Chat attachments are included by type: text / PDF are extracted to text and added to the context; images are sent as multimodal (base64) to vision-capable models
- Responses stream back to your computer and render token-by-token

The full destination URL is visible in **Settings → Models** under each model card's `endpoint` field.

---

## 4. PDF reading & full-text translation

From v2.2.6 SG Hub includes a built-in PDF reader and full-text translation:

- **Built-in PDF reading**: PDFs are rendered in-app with pdf.js (paging / zoom / outline / in-page search / text selection), **entirely locally — no file is uploaded**.
- **Full-text translation**: translation sends the **text content** of a PDF / paper to the **model you configured** (directly to your provider in BYOK mode; via the gateway if you use an SG AI Store model) to produce academic-quality output.
  - Text is sent in document-structure chunks; the request body contains the source text plus a translation prompt and model parameters
  - Translated chunks stream back and are rendered / reassembled locally, **never through any SG Hub server**
  - Whether to translate, and with which model, is entirely your choice; nothing is sent unless you trigger translation

> Like AI Parse / Chat, translation hands the selected document's text to your configured model provider. Please assess before using it on sensitive or unpublished content.

---

## 5. SG AI Store (optional, upcoming)

If at some point you choose to use SG AI Store (`https://sgaistore.com`) prepaid models:

- Requests are proxied through the SG AI Store gateway to the underlying provider
- The gateway **records usage metadata only**: token counts, call timestamps, user identifier (for billing reconciliation)
- The gateway **does not retain** request bodies (paper content, prompts, text to translate) or response bodies
- If you don't configure an SG AI Store key, no data flows between SG Hub and sgaistore.com

SG AI Store is a **separate product** with its own terms of service. It is fully optional.

---

## 6. Literature search

Search hits the following **open scholarly APIs** directly (no personal information sent):

| Source | Host | Purpose |
|---|---|---|
| arXiv | `export.arxiv.org` | arXiv preprints |
| Semantic Scholar | `api.semanticscholar.org` | Cross-discipline papers + citation graph |
| PubMed | `eutils.ncbi.nlm.nih.gov` | Medical literature (NCBI E-utilities) |
| OpenAlex | `api.openalex.org` | Open scholarly graph |
| Crossref | `api.crossref.org` | Published journal articles (DOI) |
| CORE | `api.core.ac.uk` | Repository / open-access full text |
| DBLP | `dblp.org` | Computer-science literature |
| DOAJ | `doaj.org` | Open-access journals |

Requests contain only your search keywords (Crossref may optionally carry the contact e-mail you set in Settings to join its polite pool). Results are cached locally; subsequent browsing makes no further network calls.

---

## 7. Auto-update

SG Hub queries `https://github.com/zmc0081/SGHUB/releases` for release metadata once on each launch:

- The request contains only the current version string
- No personal information, paper data, or usage statistics are sent
- When an update is found a notification appears and the decision to update is yours

---

## 8. Logs

Application logs are written to the local `logs/` directory and auto-deleted after 7 days. They contain:

- Module name + timestamp + log level
- Call-chain context (provider / endpoint / model_id — **never the API key, never the paper text**)
- Error stack traces

Logs **are not uploaded anywhere**. If you want to share logs for debugging, please open the `logs/` directory manually and review contents first.

---

## 9. Third-party data flow overview

| Destination | Trigger | Data sent |
|---|---|---|
| → Model provider (Anthropic / OpenAI / DeepSeek / Ollama, etc.) | AI Parse / Chat / Skill test / Full-text translation | Selected paper / PDF text + prompt + model parameters |
| → arXiv / Semantic Scholar / PubMed / OpenAlex / Crossref / CORE / DBLP / DOAJ | Literature search / subscription | Search keywords |
| → GitHub Releases | Auto-update | Current version number |
| → sgaistore.com (optional) | Using an SG AI Store model | Same as model provider + usage metadata |

Outside these explicit destinations, SG Hub **does not send data to any other server**.

---

## 10. Your rights

You own your data fully:

- **Export**: Library papers export to BibTeX with one click; chat history can be read directly from the SQLite file; translations can be copied / exported
- **Delete**: Deleting a paper / Skill / chat / model wipes the associated keychain entry and files immediately
- **Migrate**: **Settings → Data location** moves the entire data directory anywhere you choose
- **Offline**: Outside the trigger points above, SG Hub works fully offline

---

## 11. Updates & contact

- This policy evolves with each release. **Material changes** are called out in the changelog and require you to read and accept it again.
- This policy's version and effective date appear at the **top of this document** and always match the app version.
- Project: `https://github.com/zmc0081/SGHUB`
- Feedback: GitHub Issues

---

> This is the community-edition default policy. If you deploy SG Hub in an enterprise or regulated environment, please have your legal/compliance team review this document.
