//! CORE source (V2.2.3 / Session 32).
//!
//! Filename is `core_api` to avoid colliding with Rust's `core`.
//!
//! CORE aggregates open-access full text from institutional & preprint
//! repositories worldwide — its value is the `downloadUrl` (direct full-text
//! PDF), which fills the "repository full text" blind spot.
//!
//! Requires a free API key (Bearer auth). The key lives in the OS keychain;
//! `search_papers` reads it best-effort and skips CORE entirely when absent,
//! so we never send an unauthenticated request.

use serde::{Deserialize, Serialize};

use crate::search::Paper;

const CORE_API: &str = "https://api.core.ac.uk/v3";
const USER_AGENT: &str = "SGHUB/0.1 (+https://github.com/zmc0081/SGHUB)";

#[derive(Debug, Serialize)]
struct CoreQuery<'a> {
    q: &'a str,
    limit: u32,
}

#[derive(Debug, Deserialize)]
struct CoreResponse {
    #[serde(default)]
    results: Vec<CoreWork>,
}

#[derive(Debug, Deserialize)]
struct CoreWork {
    id: Option<serde_json::Value>,
    title: Option<String>,
    #[serde(default)]
    authors: Vec<CoreAuthor>,
    #[serde(rename = "abstract")]
    abstract_: Option<String>,
    doi: Option<String>,
    #[serde(rename = "yearPublished")]
    year_published: Option<i32>,
    #[serde(rename = "downloadUrl")]
    download_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CoreAuthor {
    name: Option<String>,
}

/// Search CORE against the production endpoint.
pub async fn search(
    query: &str,
    limit: u32,
    api_key: &str,
) -> Result<Vec<Paper>, Box<dyn std::error::Error + Send + Sync>> {
    search_at(CORE_API, query, limit, api_key).await
}

/// Testable search: `base` is the v3 API root (`{base}/search/works`).
pub async fn search_at(
    base: &str,
    query: &str,
    limit: u32,
    api_key: &str,
) -> Result<Vec<Paper>, Box<dyn std::error::Error + Send + Sync>> {
    let url = format!("{}/search/works", base.trim_end_matches('/'));
    let client = reqwest::Client::builder().user_agent(USER_AGENT).build()?;
    let resp: CoreResponse = client
        .post(url)
        .bearer_auth(api_key)
        .json(&CoreQuery { q: query, limit })
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    Ok(resp.results.into_iter().filter_map(map_to_paper).collect())
}

fn id_to_string(v: &serde_json::Value) -> Option<String> {
    match v {
        serde_json::Value::String(s) => Some(s.clone()),
        serde_json::Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

fn map_to_paper(w: CoreWork) -> Option<Paper> {
    let title = w
        .title
        .map(|s| s.split_whitespace().collect::<Vec<_>>().join(" "))
        .filter(|s| !s.is_empty())?;
    let doi = w.doi.filter(|d| !d.trim().is_empty());
    let core_id = w.id.as_ref().and_then(id_to_string);

    let id = match (&doi, &core_id) {
        (Some(d), _) => format!("p-doi-{}", d),
        (_, Some(i)) => format!("p-core-{}", i),
        _ => return None,
    };

    Some(Paper {
        id,
        title,
        authors: w
            .authors
            .into_iter()
            .filter_map(|a| a.name.map(|n| n.trim().to_string()))
            .filter(|n| !n.is_empty())
            .collect(),
        abstract_: w
            .abstract_
            .map(|s| s.split_whitespace().collect::<Vec<_>>().join(" "))
            .filter(|s| !s.is_empty()),
        // CORE's headline feature is the direct full-text PDF link.
        source_url: w.download_url.clone(),
        source: "core".to_string(),
        source_id: core_id,
        published_at: w.year_published.map(|y| format!("{}-01-01T00:00:00Z", y)),
        doi,
        pdf_path: None,
        read_status: "unread".to_string(),
        created_at: String::new(),
        updated_at: String::new(),
        sources: vec!["core".to_string()],
        fulltext_url: w.download_url,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"{
      "totalHits": 2,
      "results": [
        {
          "id": 12345678,
          "title": "A Review of Extreme Value Threshold Estimation",
          "authors": [{"name": "Scarrott, Carl"}, {"name": "MacDonald, Anna"}],
          "abstract": "The   threshold   approach.",
          "doi": "10.1080/03461238.2012.00033",
          "yearPublished": 2012,
          "downloadUrl": "https://core.ac.uk/download/12345678.pdf"
        },
        {
          "id": 999,
          "title": "No DOI but has CORE id",
          "authors": [],
          "abstract": null,
          "doi": null,
          "yearPublished": 2019,
          "downloadUrl": null
        }
      ]
    }"#;

    #[test]
    fn parses_two_results() {
        let r: CoreResponse = serde_json::from_str(SAMPLE).expect("json");
        let papers: Vec<Paper> = r.results.into_iter().filter_map(map_to_paper).collect();
        assert_eq!(papers.len(), 2);
    }

    #[test]
    fn first_result_keeps_download_url_as_source_url() {
        let r: CoreResponse = serde_json::from_str(SAMPLE).expect("json");
        let p = r
            .results
            .into_iter()
            .filter_map(map_to_paper)
            .next()
            .unwrap();
        assert_eq!(p.source, "core");
        assert_eq!(p.doi.as_deref(), Some("10.1080/03461238.2012.00033"));
        assert_eq!(p.id, "p-doi-10.1080/03461238.2012.00033");
        assert_eq!(p.authors, vec!["Scarrott, Carl", "MacDonald, Anna"]);
        assert_eq!(
            p.source_url.as_deref(),
            Some("https://core.ac.uk/download/12345678.pdf")
        );
        // whitespace collapsed in abstract
        assert_eq!(p.abstract_.as_deref(), Some("The threshold approach."));
        assert_eq!(p.published_at.as_deref(), Some("2012-01-01T00:00:00Z"));
    }

    #[test]
    fn second_result_uses_core_id_when_no_doi() {
        let r: CoreResponse = serde_json::from_str(SAMPLE).expect("json");
        let papers: Vec<Paper> = r.results.into_iter().filter_map(map_to_paper).collect();
        let p = &papers[1];
        assert!(p.doi.is_none());
        assert_eq!(p.id, "p-core-999");
        assert_eq!(p.source_id.as_deref(), Some("999"));
        assert!(p.abstract_.is_none());
    }

    #[test]
    fn string_id_also_supported() {
        let json = r#"{"results":[{"id":"abc","title":"T","authors":[],"yearPublished":2020}]}"#;
        let r: CoreResponse = serde_json::from_str(json).expect("json");
        let p = r
            .results
            .into_iter()
            .filter_map(map_to_paper)
            .next()
            .unwrap();
        assert_eq!(p.id, "p-core-abc");
    }
}
