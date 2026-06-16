//! V2.2.3 (Session 33) — integration coverage for matching, DOI direct
//! lookup, and cross-source merge.
//!
//! Uses mockito (the project's HTTP-mock convention) to drive the real
//! request-building + parsing + merge pipeline without the network. The
//! `search_papers` Tauri command itself needs a full app handle, so we test
//! its building blocks: the per-source `by_doi_at` / `search_at` functions,
//! `merge::merge`, `matching`, and the pure `should_fallback` rule.

use app_lib::search::{
    crossref, matching, merge, openalex, pubmed, semantic_scholar, should_fallback,
};
use mockito::Matcher;

const DAVISON_DOI: &str = "10.1111/j.2517-6161.1990.tb01796.x";

// --------------------------------------------------------------------------
// DOI detection on real-world inputs
// --------------------------------------------------------------------------

#[test]
fn detects_doi_in_various_inputs() {
    assert_eq!(
        matching::extract_doi(DAVISON_DOI).as_deref(),
        Some(DAVISON_DOI)
    );
    assert_eq!(
        matching::extract_doi(&format!("https://doi.org/{DAVISON_DOI}")).as_deref(),
        Some(DAVISON_DOI)
    );
    assert_eq!(
        matching::extract_doi(&format!("Davison & Smith (1990). doi:{DAVISON_DOI}.")).as_deref(),
        Some(DAVISON_DOI)
    );
    assert!(matching::extract_doi("models for exceedances over high thresholds").is_none());
}

// --------------------------------------------------------------------------
// Per-source DOI endpoints (Session 33 additions)
// --------------------------------------------------------------------------

#[tokio::test]
async fn openalex_by_doi_parses_single_work() {
    let mut server = mockito::Server::new_async().await;
    let mock = server
        .mock("GET", Matcher::Regex(r"/works/doi:.+".to_string()))
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(
            r#"{"id":"https://openalex.org/W123",
                "doi":"https://doi.org/10.1111/j.2517-6161.1990.tb01796.x",
                "title":"Models for Exceedances over High Thresholds",
                "publication_year":1990,
                "authorships":[
                    {"author":{"display_name":"A. C. Davison"}},
                    {"author":{"display_name":"R. L. Smith"}}
                ],
                "abstract_inverted_index":null,
                "primary_location":null}"#,
        )
        .create_async()
        .await;

    let base = format!("{}/works", server.url());
    let p = openalex::by_doi_at(&base, DAVISON_DOI)
        .await
        .expect("openalex by_doi")
        .expect("found");
    assert_eq!(p.title, "Models for Exceedances over High Thresholds");
    assert_eq!(p.authors.len(), 2);
    assert_eq!(p.doi.as_deref(), Some(DAVISON_DOI));
    mock.assert_async().await;
}

#[tokio::test]
async fn semantic_scholar_by_doi_parses_single_paper() {
    let mut server = mockito::Server::new_async().await;
    let mock = server
        .mock("GET", Matcher::Regex(r"/graph/v1/paper/DOI:.+".to_string()))
        .match_query(Matcher::Any)
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(
            r#"{"paperId":"abc",
                "externalIds":{"DOI":"10.1111/j.2517-6161.1990.tb01796.x"},
                "title":"Models for Exceedances over High Thresholds",
                "authors":[{"name":"A. C. Davison"}],
                "year":1990,
                "url":"https://www.semanticscholar.org/paper/abc"}"#,
        )
        .create_async()
        .await;

    let base = format!("{}/graph/v1/paper", server.url());
    let p = semantic_scholar::by_doi_at(&base, DAVISON_DOI)
        .await
        .expect("ss by_doi")
        .expect("found");
    assert_eq!(p.title, "Models for Exceedances over High Thresholds");
    assert_eq!(p.doi.as_deref(), Some(DAVISON_DOI));
    mock.assert_async().await;
}

// --------------------------------------------------------------------------
// DOI direct lookup → merge: metadata completed across sources
// --------------------------------------------------------------------------

#[tokio::test]
async fn doi_lookup_merges_and_completes_authors() {
    // Crossref returns only the first author; OpenAlex has both.
    let mut cr_srv = mockito::Server::new_async().await;
    cr_srv
        .mock("GET", Matcher::Regex(r"/works/10\..+".to_string()))
        .with_status(200)
        .with_body(
            r#"{"status":"ok","message":{
                "DOI":"10.1111/j.2517-6161.1990.tb01796.x",
                "title":["Models for Exceedances over High Thresholds"],
                "author":[{"given":"A. C.","family":"Davison"}],
                "issued":{"date-parts":[[1990]]}}}"#,
        )
        .create_async()
        .await;
    let mut oa_srv = mockito::Server::new_async().await;
    oa_srv
        .mock("GET", Matcher::Regex(r"/works/doi:.+".to_string()))
        .with_status(200)
        .with_body(
            r#"{"id":"https://openalex.org/W1",
                "doi":"https://doi.org/10.1111/j.2517-6161.1990.tb01796.x",
                "title":"Models for Exceedances over High Thresholds",
                "publication_year":1990,
                "authorships":[
                    {"author":{"display_name":"A. C. Davison"}},
                    {"author":{"display_name":"R. L. Smith"}}
                ],
                "abstract_inverted_index":null,"primary_location":null}"#,
        )
        .create_async()
        .await;

    let cr = crossref::by_doi_at(&format!("{}/works", cr_srv.url()), DAVISON_DOI, None)
        .await
        .unwrap()
        .unwrap();
    let oa = openalex::by_doi_at(&format!("{}/works", oa_srv.url()), DAVISON_DOI)
        .await
        .unwrap()
        .unwrap();

    // Crossref first (best journal metadata) → primary.
    let merged = merge::merge(vec![cr, oa]);
    assert_eq!(merged.len(), 1, "same DOI collapses to one");
    assert_eq!(merged[0].source, "crossref");
    assert_eq!(
        merged[0].authors.len(),
        2,
        "missing second author completed from OpenAlex"
    );
    assert_eq!(merged[0].sources, vec!["crossref", "openalex"]);
}

// --------------------------------------------------------------------------
// Title fuzzy matching: case/punctuation variants across sources merge
// --------------------------------------------------------------------------

#[tokio::test]
async fn title_variants_across_sources_merge_into_one() {
    // Two sources, no DOI, titles differ only by case/punctuation.
    let mut cr_srv = mockito::Server::new_async().await;
    cr_srv
        .mock("GET", "/works")
        .match_query(Matcher::Any)
        .with_status(200)
        .with_body(
            r#"{"status":"ok","message":{"items":[{
                "DOI":"10.9999/x",
                "title":["Models for Exceedances over High Thresholds"],
                "author":[{"given":"A.","family":"Davison"}],
                "issued":{"date-parts":[[1990]]}}]}}"#,
        )
        .create_async()
        .await;

    // Crossref result + a hand-built variant standing in for another source.
    let cr = crossref::search_at(&format!("{}/works", cr_srv.url()), "exceedances", 5, None)
        .await
        .unwrap();
    assert_eq!(cr.len(), 1);

    // Same work, different source, no DOI, punctuation/case differences.
    let mut variant = cr[0].clone();
    variant.doi = None;
    variant.source = "semantic_scholar".into();
    variant.sources = vec!["semantic_scholar".into()];
    variant.title = "models for exceedances over high thresholds.".into();
    variant.authors = vec!["A. Davison".into(), "R. Smith".into()];

    // Title-only match still requires same year; both are 1990.
    let merged = merge::merge(vec![cr[0].clone(), variant]);
    assert_eq!(merged.len(), 1, "case/punct title variants merge");
    assert!(matching::same_title(
        "Models for Exceedances over High Thresholds",
        "models for exceedances over high thresholds."
    ));
}

// --------------------------------------------------------------------------
// Fallback rule
// --------------------------------------------------------------------------

// --------------------------------------------------------------------------
// Real-network source-health checks (Session 33 fixes). Run with `-- --ignored`.
// --------------------------------------------------------------------------

#[tokio::test]
#[ignore = "hits real NCBI E-utilities"]
async fn acceptance_pubmed_parses_real_dtd_response() {
    // Regression for "XML with DTD detected": NCBI efetch responses begin with
    // a DOCTYPE/DTD declaration that previously killed the whole source.
    let papers = pubmed::search("CRISPR gene editing", 5)
        .await
        .expect("pubmed live search must not error on the DTD doctype");
    assert!(!papers.is_empty(), "expected PubMed hits for a common term");
    assert!(papers.iter().all(|p| p.source == "pubmed"));
}

#[tokio::test]
#[ignore = "hits real OpenAlex API"]
async fn acceptance_openalex_polite_pool_returns_results() {
    // `select` + `mailto` put us in the polite pool with a small payload.
    // (We don't assert latency — OpenAlex response time is variable on their
    // side; the in-app per-source timeout handles the occasional slow spike.)
    let papers = openalex::search("attention is all you need", 10)
        .await
        .expect("openalex live search");
    assert!(!papers.is_empty(), "expected OpenAlex hits");
    assert!(papers.iter().all(|p| p.source == "openalex"));
    assert!(
        papers.iter().any(|p| !p.authors.is_empty()),
        "select must still return authorships"
    );
}

#[test]
fn fallback_rule() {
    // Sparse single general source → expand.
    assert!(should_fallback("arxiv", 0));
    assert!(should_fallback("semantic_scholar", 2));
    assert!(should_fallback("openalex", 1));
    // Enough results → no expand.
    assert!(!should_fallback("arxiv", 3));
    assert!(!should_fallback("arxiv", 10));
    // "all" already includes the high-recall sources.
    assert!(!should_fallback("all", 0));
    // Specialist single sources are an explicit choice.
    assert!(!should_fallback("dblp", 0));
    assert!(!should_fallback("pubmed", 0));
    assert!(!should_fallback("crossref", 0));
}
