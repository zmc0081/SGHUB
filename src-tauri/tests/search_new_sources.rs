//! V2.2.3 (Session 32) — integration coverage for the four new search
//! sources: Crossref, CORE, DBLP, DOAJ.
//!
//! Each source's `search_at` (and Crossref's `by_doi_at`) is pointed at a
//! mockito server so we exercise the real HTTP request-building + parsing
//! path end-to-end without touching the network. (The project already uses
//! `mockito` for the AI-client integration tests; we follow that convention
//! rather than introduce `wiremock`.)
//!
//! DBLP's single-object-vs-array author quirk gets dedicated coverage.
//!
//! The `#[ignore]`d tests at the bottom hit the real APIs and are the
//! acceptance cases from `SESSION_TASKS.md` (the two EVT papers). Run with:
//!   cargo test --test search_new_sources -- --ignored

use app_lib::search::{core_api, crossref, dblp, doaj};
use mockito::Matcher;

// --------------------------------------------------------------------------
// Crossref
// --------------------------------------------------------------------------

#[tokio::test]
async fn crossref_search_parses_journal_paper() {
    let mut server = mockito::Server::new_async().await;
    let body = r#"{"status":"ok","message":{"items":[
        {
          "DOI":"10.1080/03461238.2012.00033",
          "title":["A Review of Extreme Value Threshold Estimation and Uncertainty Quantification"],
          "author":[{"given":"Carl","family":"Scarrott"},{"given":"Anna","family":"MacDonald"}],
          "container-title":["REVSTAT-Statistical Journal"],
          "published":{"date-parts":[[2012,3]]},
          "abstract":"<jats:p>The threshold approach.</jats:p>",
          "resource":{"primary":{"URL":"https://www.ine.pt/revstat/article/10-1"}}
        }
    ]}}"#;
    let mock = server
        .mock("GET", "/works")
        .match_query(Matcher::Any)
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(body)
        .create_async()
        .await;

    let base = format!("{}/works", server.url());
    let papers = crossref::search_at(
        &base,
        "extreme value threshold",
        10,
        Some("contact@sghub.app"),
    )
    .await
    .expect("crossref search");
    assert_eq!(papers.len(), 1);
    assert_eq!(papers[0].source, "crossref");
    assert_eq!(
        papers[0].doi.as_deref(),
        Some("10.1080/03461238.2012.00033")
    );
    assert_eq!(papers[0].authors, vec!["Carl Scarrott", "Anna MacDonald"]);
    assert_eq!(
        papers[0].abstract_.as_deref(),
        Some("The threshold approach.")
    );
    mock.assert_async().await;
}

#[tokio::test]
async fn crossref_by_doi_keeps_literal_slash_in_path() {
    let mut server = mockito::Server::new_async().await;
    // The DOI slash must reach the server unencoded: /works/10.1.../...
    let mock = server
        .mock("GET", "/works/10.1111/j.2517-6161.1990.tb01796.x")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(
            r#"{"status":"ok","message":{
                "DOI":"10.1111/j.2517-6161.1990.tb01796.x",
                "title":["Models for Exceedances over High Thresholds"],
                "author":[{"given":"A. C.","family":"Davison"},{"given":"R. L.","family":"Smith"}],
                "issued":{"date-parts":[[1990]]}}}"#,
        )
        .create_async()
        .await;

    let base = format!("{}/works", server.url());
    let p = crossref::by_doi_at(&base, "10.1111/j.2517-6161.1990.tb01796.x", None)
        .await
        .expect("crossref by_doi")
        .expect("found");
    assert_eq!(p.title, "Models for Exceedances over High Thresholds");
    assert_eq!(p.published_at.as_deref(), Some("1990-01-01T00:00:00Z"));
    mock.assert_async().await;
}

#[tokio::test]
async fn crossref_by_doi_404_returns_none() {
    let mut server = mockito::Server::new_async().await;
    let _m = server
        .mock("GET", "/works/10.0/nonexistent")
        .with_status(404)
        .with_body("Resource not found.")
        .create_async()
        .await;

    let base = format!("{}/works", server.url());
    let r = crossref::by_doi_at(&base, "10.0/nonexistent", None)
        .await
        .expect("by_doi ok");
    assert!(r.is_none(), "404 maps to Ok(None)");
}

// --------------------------------------------------------------------------
// CORE
// --------------------------------------------------------------------------

#[tokio::test]
async fn core_search_parses_and_keeps_download_url() {
    let mut server = mockito::Server::new_async().await;
    let mock = server
        .mock("POST", "/search/works")
        .match_header("authorization", "Bearer test-core-key")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(
            r#"{"totalHits":1,"results":[
                {"id":12345678,
                 "title":"A Review of Extreme Value Threshold Estimation",
                 "authors":[{"name":"Scarrott, Carl"}],
                 "abstract":"The threshold approach.",
                 "doi":"10.1080/03461238.2012.00033",
                 "yearPublished":2012,
                 "downloadUrl":"https://core.ac.uk/download/12345678.pdf"}
            ]}"#,
        )
        .create_async()
        .await;

    let papers = core_api::search_at(&server.url(), "extreme value", 10, "test-core-key")
        .await
        .expect("core search");
    assert_eq!(papers.len(), 1);
    assert_eq!(papers[0].source, "core");
    assert_eq!(
        papers[0].source_url.as_deref(),
        Some("https://core.ac.uk/download/12345678.pdf"),
        "CORE's full-text downloadUrl is preserved"
    );
    mock.assert_async().await;
}

// --------------------------------------------------------------------------
// DBLP — the single-object vs array author quirk
// --------------------------------------------------------------------------

#[tokio::test]
async fn dblp_search_array_authors() {
    let mut server = mockito::Server::new_async().await;
    let mock = server
        .mock("GET", "/search/publ/api")
        .match_query(Matcher::Any)
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(
            r#"{"result":{"hits":{"@total":"1","hit":[
                {"info":{
                    "title":"Attention Is All You Need",
                    "authors":{"author":[
                        {"@pid":"1","text":"Ashish Vaswani"},
                        {"@pid":"2","text":"Noam Shazeer"}
                    ]},
                    "year":"2017",
                    "doi":"10.48550/arXiv.1706.03762",
                    "ee":["https://arxiv.org/abs/1706.03762"],
                    "url":"https://dblp.org/rec/conf/nips/VaswaniSPUJGKP17"
                }}
            ]}}}"#,
        )
        .create_async()
        .await;

    let base = format!("{}/search/publ/api", server.url());
    let papers = dblp::search_at(&base, "attention", 10).await.expect("dblp");
    assert_eq!(papers.len(), 1);
    assert_eq!(papers[0].authors, vec!["Ashish Vaswani", "Noam Shazeer"]);
    mock.assert_async().await;
}

#[tokio::test]
async fn dblp_search_single_author_object_and_single_hit() {
    let mut server = mockito::Server::new_async().await;
    // Single author → object (not array); single hit → object (not array).
    let mock = server
        .mock("GET", "/search/publ/api")
        .match_query(Matcher::Any)
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(
            r#"{"result":{"hits":{"@total":"1","hit":
                {"info":{
                    "title":"A Single Author Paper",
                    "authors":{"author":{"@pid":"9","text":"Solo Researcher"}},
                    "year":"2021",
                    "ee":"https://example.org/paper.pdf",
                    "url":"https://dblp.org/rec/x/Solo21"
                }}
            }}}"#,
        )
        .create_async()
        .await;

    let base = format!("{}/search/publ/api", server.url());
    let papers = dblp::search_at(&base, "single", 10).await.expect("dblp");
    assert_eq!(papers.len(), 1, "single hit object parses");
    assert_eq!(
        papers[0].authors,
        vec!["Solo Researcher"],
        "single author object parses"
    );
    assert_eq!(
        papers[0].source_url.as_deref(),
        Some("https://example.org/paper.pdf")
    );
    mock.assert_async().await;
}

// --------------------------------------------------------------------------
// DOAJ — query lives in the URL path
// --------------------------------------------------------------------------

#[tokio::test]
async fn doaj_search_parses_open_access_article() {
    let mut server = mockito::Server::new_async().await;
    let mock = server
        .mock(
            "GET",
            Matcher::Regex(r"/api/v2/search/articles/.+".to_string()),
        )
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(
            r#"{"total":1,"results":[
                {"id":"abc123doaj","bibjson":{
                    "title":"An Open Access Statistics Article",
                    "author":[{"name":"Jane Doe"}],
                    "abstract":"Open access abstract.",
                    "year":"2015",
                    "identifier":[{"type":"doi","id":"10.1234/oa.2015.1"}],
                    "link":[{"type":"fulltext","url":"https://journal.example.org/article/1/pdf"}]
                }}
            ]}"#,
        )
        .create_async()
        .await;

    let base = format!("{}/api/v2/search/articles", server.url());
    let papers = doaj::search_at(&base, "extreme value", 10)
        .await
        .expect("doaj");
    assert_eq!(papers.len(), 1);
    assert_eq!(papers[0].source, "doaj");
    assert_eq!(papers[0].doi.as_deref(), Some("10.1234/oa.2015.1"));
    assert_eq!(
        papers[0].source_url.as_deref(),
        Some("https://journal.example.org/article/1/pdf")
    );
    mock.assert_async().await;
}

// --------------------------------------------------------------------------
// Acceptance cases — real network, run manually with `-- --ignored`.
// --------------------------------------------------------------------------

#[tokio::test]
#[ignore = "hits real Crossref API"]
async fn acceptance_crossref_finds_scarrott_evt_review() {
    let papers = crossref::search(
        "Review of Extreme Value Threshold Estimation Scarrott",
        10,
        Some("contact@sghub.app"),
    )
    .await
    .expect("crossref live");
    assert!(
        papers
            .iter()
            .any(|p| p.title.to_lowercase().contains("extreme value threshold")),
        "expected the Scarrott & MacDonald EVT review in Crossref results"
    );
}

#[tokio::test]
#[ignore = "hits real Crossref API"]
async fn acceptance_crossref_by_doi_davison_smith() {
    let p = crossref::by_doi(
        "10.1111/j.2517-6161.1990.tb01796.x",
        Some("contact@sghub.app"),
    )
    .await
    .expect("crossref live")
    .expect("found by DOI");
    assert!(p.title.to_lowercase().contains("exceedances"));
}
