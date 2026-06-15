use std::time::{Duration, Instant};

use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::Emitter;

use crate::AppState;

pub(crate) mod arxiv;
// V2.2.3 (Session 33) — `pub` so integration tests can drive these directly.
pub mod openalex;
pub mod pubmed;
pub mod semantic_scholar;
// V2.2.3 (Session 32) — new sources. `pub` so the integration test
// (`tests/search_new_sources.rs`) can drive each `search_at` against mockito.
pub mod core_api;
pub mod crossref;
pub mod dblp;
pub mod doaj;
// V2.2.3 (Session 33) — DOI/title matching + cross-source merge.
pub mod matching;
pub mod merge;

const SOURCE_TIMEOUT: Duration = Duration::from_secs(10);

/// Below this many merged results a *single general source* search auto-expands
/// to Crossref + CORE to widen recall (Part 4 fallback).
const FALLBACK_THRESHOLD: usize = 3;

/// Whether a search should auto-expand to the high-recall sources. Fires only
/// for a single *general* source (arXiv / Semantic Scholar / OpenAlex) with too
/// few results: "all" already includes Crossref + CORE, and specialist single
/// sources (PubMed / DBLP / DOAJ / Crossref / CORE) are an explicit choice.
pub fn should_fallback(source: &str, result_count: usize) -> bool {
    matches!(source, "arxiv" | "semantic_scholar" | "openalex") && result_count < FALLBACK_THRESHOLD
}

/// Keychain username under which the CORE API key is stored (service "sghub").
/// When absent, the CORE source is skipped — we never send an unauthenticated
/// request. Set it from the frontend via `set_core_api_key`.
pub(crate) const CORE_API_KEY_REF: &str = "core_api_key";

/// Default contact e-mail for Crossref's "polite pool". A real per-user
/// override can be wired through `AppConfig.crossref_mailto` once config
/// persistence lands; until then this project contact keeps us in the
/// polite pool for better rate limits.
const CROSSREF_MAILTO: &str = "contact@sghub.app";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Paper {
    pub id: String,
    pub title: String,
    pub authors: Vec<String>,
    #[serde(rename = "abstract")]
    pub abstract_: Option<String>,
    pub doi: Option<String>,
    pub source: String,
    pub source_id: Option<String>,
    pub source_url: Option<String>,
    pub published_at: Option<String>,
    pub pdf_path: Option<String>,
    pub read_status: String,
    pub created_at: String,
    pub updated_at: String,
    /// V2.2.3 — every source this (possibly merged) paper was found in, in
    /// priority order. A freshly-parsed single-source paper carries just its
    /// own source; cross-source merge unions them. `#[serde(default)]` so rows
    /// read back from the DB (which has no such column) deserialize cleanly.
    #[serde(default)]
    pub sources: Vec<String>,
    /// V2.2.3 — best direct full-text / PDF link (CORE `downloadUrl`, an arXiv
    /// PDF, a DOAJ fulltext link…), distinct from `source_url` (landing page).
    #[serde(default)]
    pub fulltext_url: Option<String>,
}

pub fn mock_papers() -> Vec<Paper> {
    vec![
        Paper {
            id: "p-arxiv-1706.03762".into(),
            title: "Attention Is All You Need".into(),
            authors: vec![
                "Ashish Vaswani".into(),
                "Noam Shazeer".into(),
                "Niki Parmar".into(),
                "Jakob Uszkoreit".into(),
                "Llion Jones".into(),
                "Aidan N. Gomez".into(),
                "Łukasz Kaiser".into(),
                "Illia Polosukhin".into(),
            ],
            abstract_: Some(
                "The dominant sequence transduction models are based on complex recurrent or \
                 convolutional neural networks. We propose a new simple network architecture, \
                 the Transformer, based solely on attention mechanisms, dispensing with \
                 recurrence and convolutions entirely."
                    .into(),
            ),
            doi: Some("10.48550/arXiv.1706.03762".into()),
            source: "arxiv".into(),
            source_id: Some("1706.03762".into()),
            source_url: Some("https://arxiv.org/abs/1706.03762".into()),
            published_at: Some("2017-06-12T17:57:00Z".into()),
            pdf_path: None,
            sources: Vec::new(),
            fulltext_url: None,
            read_status: "read".into(),
            created_at: "2026-04-28T10:00:00Z".into(),
            updated_at: "2026-04-28T10:00:00Z".into(),
        },
        Paper {
            id: "p-arxiv-1810.04805".into(),
            title: "BERT: Pre-training of Deep Bidirectional Transformers for Language \
                    Understanding"
                .into(),
            authors: vec![
                "Jacob Devlin".into(),
                "Ming-Wei Chang".into(),
                "Kenton Lee".into(),
                "Kristina Toutanova".into(),
            ],
            abstract_: Some(
                "We introduce a new language representation model called BERT, which stands for \
                 Bidirectional Encoder Representations from Transformers. Unlike recent language \
                 representation models, BERT is designed to pre-train deep bidirectional \
                 representations from unlabeled text."
                    .into(),
            ),
            doi: Some("10.48550/arXiv.1810.04805".into()),
            source: "arxiv".into(),
            source_id: Some("1810.04805".into()),
            source_url: Some("https://arxiv.org/abs/1810.04805".into()),
            published_at: Some("2018-10-11T00:50:00Z".into()),
            pdf_path: None,
            sources: Vec::new(),
            fulltext_url: None,
            read_status: "reading".into(),
            created_at: "2026-04-28T10:05:00Z".into(),
            updated_at: "2026-04-29T14:20:00Z".into(),
        },
        Paper {
            id: "p-arxiv-2005.14165".into(),
            title: "Language Models are Few-Shot Learners".into(),
            authors: vec![
                "Tom B. Brown".into(),
                "Benjamin Mann".into(),
                "Nick Ryder".into(),
                "Melanie Subbiah".into(),
                "Jared Kaplan".into(),
                "et al.".into(),
            ],
            abstract_: Some(
                "Recent work has demonstrated substantial gains on many NLP tasks and benchmarks \
                 by pre-training on a large corpus of text followed by fine-tuning on a specific \
                 task. We show that scaling up language models greatly improves task-agnostic, \
                 few-shot performance."
                    .into(),
            ),
            doi: Some("10.48550/arXiv.2005.14165".into()),
            source: "arxiv".into(),
            source_id: Some("2005.14165".into()),
            source_url: Some("https://arxiv.org/abs/2005.14165".into()),
            published_at: Some("2020-05-28T17:29:00Z".into()),
            pdf_path: None,
            sources: Vec::new(),
            fulltext_url: None,
            read_status: "unread".into(),
            created_at: "2026-04-29T09:12:00Z".into(),
            updated_at: "2026-04-29T09:12:00Z".into(),
        },
        Paper {
            id: "p-arxiv-2305.18290".into(),
            title: "Direct Preference Optimization: Your Language Model is Secretly a Reward \
                    Model"
                .into(),
            authors: vec![
                "Rafael Rafailov".into(),
                "Archit Sharma".into(),
                "Eric Mitchell".into(),
                "Stefano Ermon".into(),
                "Christopher D. Manning".into(),
                "Chelsea Finn".into(),
            ],
            abstract_: Some(
                "While large-scale unsupervised language models learn broad world knowledge, \
                 precise control of their behavior is difficult. We introduce a new \
                 parameterization of the reward model in RLHF that enables extraction of the \
                 corresponding optimal policy in closed form."
                    .into(),
            ),
            doi: Some("10.48550/arXiv.2305.18290".into()),
            source: "arxiv".into(),
            source_id: Some("2305.18290".into()),
            source_url: Some("https://arxiv.org/abs/2305.18290".into()),
            published_at: Some("2023-05-29T17:57:00Z".into()),
            pdf_path: None,
            sources: Vec::new(),
            fulltext_url: None,
            read_status: "parsed".into(),
            created_at: "2026-04-29T11:30:00Z".into(),
            updated_at: "2026-04-30T08:15:00Z".into(),
        },
        Paper {
            id: "p-pubmed-37301754".into(),
            title: "AlphaFold and the future of structural biology".into(),
            authors: vec!["John Jumper".into(), "Demis Hassabis".into()],
            abstract_: Some(
                "AlphaFold has reshaped structural biology by predicting protein structures from \
                 sequence with near-experimental accuracy. We discuss applications and \
                 limitations across drug discovery and basic research."
                    .into(),
            ),
            doi: Some("10.1038/s41586-023-06291-2".into()),
            source: "pubmed".into(),
            source_id: Some("37301754".into()),
            source_url: Some("https://pubmed.ncbi.nlm.nih.gov/37301754/".into()),
            published_at: Some("2023-06-08T00:00:00Z".into()),
            pdf_path: None,
            sources: Vec::new(),
            fulltext_url: None,
            read_status: "unread".into(),
            created_at: "2026-04-29T16:00:00Z".into(),
            updated_at: "2026-04-29T16:00:00Z".into(),
        },
        Paper {
            id: "p-arxiv-2302.13971".into(),
            title: "LLaMA: Open and Efficient Foundation Language Models".into(),
            authors: vec![
                "Hugo Touvron".into(),
                "Thibaut Lavril".into(),
                "Gautier Izacard".into(),
                "Xavier Martinet".into(),
                "et al.".into(),
            ],
            abstract_: Some(
                "We introduce LLaMA, a collection of foundation language models ranging from 7B \
                 to 65B parameters. We train our models on trillions of tokens, and show that it \
                 is possible to train state-of-the-art models using publicly available datasets \
                 exclusively."
                    .into(),
            ),
            doi: Some("10.48550/arXiv.2302.13971".into()),
            source: "arxiv".into(),
            source_id: Some("2302.13971".into()),
            source_url: Some("https://arxiv.org/abs/2302.13971".into()),
            published_at: Some("2023-02-27T18:25:00Z".into()),
            pdf_path: None,
            sources: Vec::new(),
            fulltext_url: None,
            read_status: "unread".into(),
            created_at: "2026-04-30T07:45:00Z".into(),
            updated_at: "2026-04-30T07:45:00Z".into(),
        },
    ]
}

/// Insert papers into the SQLite `papers` table.
/// `INSERT OR IGNORE` on the PK (id) — repeat searches don't duplicate rows.
/// FTS5 stays in sync via the schema's `papers_ai` trigger.
pub(crate) fn persist(pool: &crate::db::DbPool, papers: &[Paper]) -> rusqlite::Result<usize> {
    let mut conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let tx = conn.transaction()?;
    let mut inserted = 0usize;
    {
        let mut stmt = tx.prepare(
            "INSERT OR IGNORE INTO papers \
             (id, title, authors, abstract, doi, source, source_id, source_url, published_at, read_status) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        )?;
        for p in papers {
            let authors_json = serde_json::to_string(&p.authors).unwrap_or_else(|_| "[]".into());
            inserted += stmt.execute(params![
                p.id,
                p.title,
                authors_json,
                p.abstract_,
                p.doi,
                p.source,
                p.source_id,
                p.source_url,
                p.published_at,
                p.read_status,
            ])?;
        }
    }
    tx.commit()?;
    Ok(inserted)
}

/// Read the CORE API key off the keychain, best-effort (empty when absent).
async fn read_core_key() -> String {
    tokio::task::spawn_blocking(|| {
        crate::keychain::get_api_key(CORE_API_KEY_REF)
            .ok()
            .flatten()
    })
    .await
    .ok()
    .flatten()
    .unwrap_or_default()
}

/// Persist the merged results without blocking the async runtime.
async fn persist_results(pool: crate::db::DbPool, papers: Vec<Paper>) {
    match tokio::task::spawn_blocking(move || persist(&pool, &papers)).await {
        Ok(Ok(n)) => log::info!("persisted {} new papers", n),
        Ok(Err(e)) => log::warn!("persist failed: {}", e),
        Err(e) => log::warn!("persist join error: {}", e),
    }
}

/// Query every source that supports exact-DOI lookup concurrently. Crossref is
/// first (best journal metadata), so it becomes the merge primary.
async fn doi_direct_lookup(doi: &str, core_key: &str) -> Vec<Paper> {
    use tokio::time::timeout;

    let (cr, oa, ss) = tokio::join!(
        timeout(SOURCE_TIMEOUT, crossref::by_doi(doi, Some(CROSSREF_MAILTO))),
        timeout(SOURCE_TIMEOUT, openalex::by_doi(doi)),
        timeout(SOURCE_TIMEOUT, semantic_scholar::by_doi(doi)),
    );

    let mut out = Vec::new();
    for (name, r) in [("crossref", cr), ("openalex", oa), ("semantic_scholar", ss)] {
        match r {
            Ok(Ok(Some(p))) => out.push(p),
            Ok(Ok(None)) => {}
            Ok(Err(e)) => log::warn!("{} by_doi failed: {}", name, e),
            Err(_) => log::warn!("{} by_doi timed out", name),
        }
    }

    // CORE has no by-DOI endpoint; a DOI-string search usually surfaces it.
    if !core_key.trim().is_empty() {
        match timeout(SOURCE_TIMEOUT, core_api::search(doi, 3, core_key)).await {
            Ok(Ok(v)) => {
                if let Some(p) = v.into_iter().find(|p| p.doi.as_deref() == Some(doi)) {
                    out.push(p);
                }
            }
            Ok(Err(e)) => log::warn!("core by_doi search failed: {}", e),
            Err(_) => log::warn!("core by_doi timed out"),
        }
    }
    out
}

async fn run_source<F, Fut>(name: &'static str, enabled: bool, fetcher: F) -> Vec<Paper>
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = Result<Vec<Paper>, Box<dyn std::error::Error + Send + Sync>>>,
{
    if !enabled {
        return Vec::new();
    }
    match tokio::time::timeout(SOURCE_TIMEOUT, fetcher()).await {
        Ok(Ok(p)) => p,
        Ok(Err(e)) => {
            log::warn!("{} search failed: {}", name, e);
            Vec::new()
        }
        Err(_) => {
            log::warn!("{} search timed out after {:?}", name, SOURCE_TIMEOUT);
            Vec::new()
        }
    }
}

#[tauri::command]
pub async fn search_papers(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    query: String,
    source: String,
    limit: u32,
) -> Result<Vec<Paper>, String> {
    let q = query.trim();
    if q.is_empty() {
        return Ok(Vec::new());
    }
    let q = q.to_string();
    let started = Instant::now();
    let core_key = read_core_key().await;
    let have_core_key = !core_key.trim().is_empty();

    // ── Part 1: DOI direct lookup ────────────────────────────────────────
    // If the input is (or contains) a DOI, hit each source's exact endpoint
    // and merge into one high-quality record.
    if let Some(doi) = matching::extract_doi(&q) {
        let merged = merge::merge(doi_direct_lookup(&doi, &core_key).await);
        persist_results(state.db_pool.clone(), merged.clone()).await;
        log::info!(
            "DOI direct `{}` → {} result(s) ({:?})",
            doi,
            merged.len(),
            started.elapsed()
        );
        return Ok(merged);
    }

    // ── Normal multi-source search ───────────────────────────────────────
    let want_arxiv = matches!(source.as_str(), "all" | "" | "arxiv");
    let want_ss = matches!(source.as_str(), "all" | "" | "semantic_scholar");
    let want_pubmed = matches!(source.as_str(), "all" | "" | "pubmed");
    let want_openalex = matches!(source.as_str(), "all" | "" | "openalex");
    let want_crossref = matches!(source.as_str(), "all" | "" | "crossref");
    let want_core = matches!(source.as_str(), "all" | "" | "core");
    let want_dblp = matches!(source.as_str(), "all" | "" | "dblp");
    let want_doaj = matches!(source.as_str(), "all" | "" | "doaj");
    if want_core && !have_core_key {
        log::info!("core source requested but no API key configured — skipping");
    }

    let (a, s, p, o, cr, co, db, dj) = tokio::join!(
        run_source("arxiv", want_arxiv, || arxiv::search(&q, limit)),
        run_source("semantic_scholar", want_ss, || semantic_scholar::search(
            &q, limit
        )),
        run_source("pubmed", want_pubmed, || pubmed::search(&q, limit)),
        run_source("openalex", want_openalex, || openalex::search(&q, limit)),
        run_source("crossref", want_crossref, || crossref::search(
            &q,
            limit,
            Some(CROSSREF_MAILTO)
        )),
        run_source("core", want_core && have_core_key, || core_api::search(
            &q, limit, &core_key
        )),
        run_source("dblp", want_dblp, || dblp::search(&q, limit)),
        run_source("doaj", want_doaj, || doaj::search(&q, limit)),
    );

    // Source extension order = merge priority (Crossref before CORE/DBLP/DOAJ).
    let mut combined = Vec::new();
    for chunk in [a, s, p, o, cr, co, db, dj] {
        combined.extend(chunk);
    }
    let mut merged = merge::merge(combined);

    // ── Part 4: fallback ─────────────────────────────────────────────────
    // A single *general* source that returns too little auto-expands to the
    // high-recall sources (Crossref + CORE).
    if should_fallback(&source, merged.len()) {
        // Part 2.3 — a long phrase matches poorly on some sources; widen recall
        // by querying the high-recall sources with just the core keywords. A
        // quoted phrase is left verbatim so exact-match sources keep precision.
        let is_quoted = q.starts_with('"') && q.ends_with('"') && q.len() > 1;
        let expand_q = if !is_quoted && q.split_whitespace().count() > 8 {
            let kw = matching::extract_keywords(&q);
            if kw.is_empty() {
                q.clone()
            } else {
                kw
            }
        } else {
            q.clone()
        };
        log::info!(
            "sparse results ({}) for source={} — expanding to crossref+core with `{}`",
            merged.len(),
            source,
            expand_q
        );
        let (cr, co) = tokio::join!(
            run_source("crossref", true, || crossref::search(
                &expand_q,
                limit,
                Some(CROSSREF_MAILTO)
            )),
            run_source("core", have_core_key, || core_api::search(
                &expand_q, limit, &core_key
            )),
        );
        if !cr.is_empty() || !co.is_empty() {
            let mut all = merged;
            all.extend(cr);
            all.extend(co);
            merged = merge::merge(all);
            if let Err(e) = app.emit("search:fallback", ()) {
                log::warn!("search:fallback emit failed: {}", e);
            }
        }
    }

    // Surface near-exact title matches to the top: when the user pasted/typed a
    // full title, the correct hit may come from a later-merged source (e.g.
    // Crossref) and would otherwise sit below less-relevant results from
    // earlier sources. Only for title-like queries (≥3 significant words) so
    // short keyword searches keep each source's own relevance order. Stable
    // sort → ties keep source/merge order.
    if matching::normalize_title(&q).split_whitespace().count() >= 3 {
        merged.sort_by_cached_key(|p| {
            if matching::title_similarity(&q, &p.title) >= 0.6 {
                0u8
            } else {
                1u8
            }
        });
    }

    persist_results(state.db_pool.clone(), merged.clone()).await;
    log::info!(
        "search `{}` source={} returned {} (took {:?})",
        q,
        source,
        merged.len(),
        started.elapsed()
    );
    Ok(merged)
}

/// Store (or, when `key` is empty, clear) the CORE API key in the OS keychain.
/// The key is never written to config files or logs.
#[tauri::command]
pub async fn set_core_api_key(key: String) -> Result<(), String> {
    let key = key.trim().to_string();
    tokio::task::spawn_blocking(move || {
        if key.is_empty() {
            crate::keychain::delete_api_key(CORE_API_KEY_REF)
        } else {
            crate::keychain::set_api_key(CORE_API_KEY_REF, &key)
        }
    })
    .await
    .map_err(|e| format!("keychain task join: {}", e))?
    .map_err(|e| e.to_string())
}

/// Whether a non-empty CORE API key is currently stored. The key value itself
/// is never returned to the frontend.
#[tauri::command]
pub async fn is_core_api_key_set() -> Result<bool, String> {
    let stored = tokio::task::spawn_blocking(|| crate::keychain::get_api_key(CORE_API_KEY_REF))
        .await
        .map_err(|e| format!("keychain task join: {}", e))?
        .map_err(|e| e.to_string())?;
    Ok(stored.map(|k| !k.trim().is_empty()).unwrap_or(false))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_at;
    use tempfile::TempDir;

    fn paper(id: &str, title: &str, doi: Option<&str>, source: &str) -> Paper {
        Paper {
            id: id.into(),
            title: title.into(),
            authors: vec!["X".into()],
            abstract_: Some("abs".into()),
            doi: doi.map(String::from),
            source: source.into(),
            source_id: None,
            source_url: None,
            published_at: None,
            pdf_path: None,
            sources: Vec::new(),
            fulltext_url: None,
            read_status: "unread".into(),
            created_at: String::new(),
            updated_at: String::new(),
        }
    }

    #[test]
    fn persist_writes_to_papers_and_indexes_fts() {
        let tmp = TempDir::new().unwrap();
        let pool = init_at(tmp.path()).unwrap();

        let papers = vec![Paper {
            id: "p-arxiv-1706.03762".into(),
            title: "Attention Is All You Need".into(),
            authors: vec!["Ashish Vaswani".into(), "Noam Shazeer".into()],
            abstract_: Some("We propose the Transformer.".into()),
            doi: Some("10.48550/arXiv.1706.03762".into()),
            source: "arxiv".into(),
            source_id: Some("1706.03762".into()),
            source_url: Some("https://arxiv.org/abs/1706.03762".into()),
            published_at: Some("2017-06-12T17:57:00Z".into()),
            pdf_path: None,
            sources: Vec::new(),
            fulltext_url: None,
            read_status: "unread".into(),
            created_at: String::new(),
            updated_at: String::new(),
        }];

        let inserted = persist(&pool, &papers).expect("persist");
        assert_eq!(inserted, 1);

        let conn = pool.get().unwrap();

        let row_count: i64 = conn
            .query_row("SELECT count(*) FROM papers", [], |r| r.get(0))
            .unwrap();
        assert_eq!(row_count, 1);

        // FTS5 hit
        let fts_count: i64 = conn
            .query_row(
                "SELECT count(*) FROM papers_fts WHERE papers_fts MATCH 'Transformer'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(fts_count, 1);

        // created_at should be populated by SQLite default even though we passed empty
        let created: String = conn
            .query_row("SELECT created_at FROM papers", [], |r| r.get(0))
            .unwrap();
        assert!(
            !created.is_empty() && created.contains('T'),
            "expected ISO 8601 timestamp, got {:?}",
            created
        );
    }

    #[test]
    fn persist_is_idempotent_on_same_id() {
        let tmp = TempDir::new().unwrap();
        let pool = init_at(tmp.path()).unwrap();

        let papers = vec![paper("p-x-1", "Title X", Some("10.x/1"), "arxiv")];
        assert_eq!(persist(&pool, &papers).unwrap(), 1);
        assert_eq!(persist(&pool, &papers).unwrap(), 0, "INSERT OR IGNORE");

        let conn = pool.get().unwrap();
        let count: i64 = conn
            .query_row("SELECT count(*) FROM papers", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }
}
