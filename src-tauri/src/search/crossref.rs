//! Crossref source (V2.2.3 / Session 32).
//!
//! Crossref covers virtually every formally-published work that has a DOI,
//! so it's the key source for filling the "regional / specialist journal"
//! blind spot of the original four sources (e.g. REVSTAT, JRSS-B).
//!
//! - Free, no auth. Supplying a contact e-mail (`mailto`) opts us into the
//!   "polite pool" for better rate limits — we read it from config and fall
//!   back to a project contact.
//! - `search_at` takes the base URL so the integration tests can point it at
//!   a mockito server (same testability pattern as `ai_client`).
//! - `crossref_by_doi` is the exact-DOI channel that Session 33's "DOI direct
//!   lookup" will build on.

use serde::Deserialize;

use crate::search::Paper;

const CROSSREF_API: &str = "https://api.crossref.org/works";
const USER_AGENT: &str = "SGHUB/0.1 (+https://github.com/zmc0081/SGHUB)";

#[derive(Debug, Deserialize)]
struct CrListResponse {
    message: CrList,
}

#[derive(Debug, Deserialize)]
struct CrList {
    #[serde(default)]
    items: Vec<CrItem>,
}

#[derive(Debug, Deserialize)]
struct CrItemResponse {
    message: CrItem,
}

#[derive(Debug, Deserialize)]
struct CrItem {
    #[serde(rename = "DOI")]
    doi: Option<String>,
    title: Option<Vec<String>>,
    #[serde(default)]
    author: Vec<CrAuthor>,
    published: Option<CrDate>,
    issued: Option<CrDate>,
    #[serde(rename = "abstract")]
    abstract_: Option<String>,
    #[serde(rename = "URL")]
    url: Option<String>,
    resource: Option<CrResource>,
}

#[derive(Debug, Deserialize)]
struct CrAuthor {
    given: Option<String>,
    family: Option<String>,
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CrDate {
    // Crossref emits `"date-parts": [[null]]` for some records, so the inner
    // value must be Option — otherwise a single such item fails the whole
    // response decode and the source returns nothing.
    #[serde(rename = "date-parts", default)]
    date_parts: Vec<Vec<Option<i32>>>,
}

#[derive(Debug, Deserialize)]
struct CrResource {
    primary: Option<CrPrimary>,
}

#[derive(Debug, Deserialize)]
struct CrPrimary {
    #[serde(rename = "URL")]
    url: Option<String>,
}

/// Search Crossref against the production endpoint.
pub async fn search(
    query: &str,
    limit: u32,
    mailto: Option<&str>,
) -> Result<Vec<Paper>, Box<dyn std::error::Error + Send + Sync>> {
    search_at(CROSSREF_API, query, limit, mailto).await
}

/// Exact-DOI lookup against the production endpoint.
pub async fn by_doi(
    doi: &str,
    mailto: Option<&str>,
) -> Result<Option<Paper>, Box<dyn std::error::Error + Send + Sync>> {
    by_doi_at(CROSSREF_API, doi, mailto).await
}

/// Testable search: `base` is the `works` collection URL.
pub async fn search_at(
    base: &str,
    query: &str,
    limit: u32,
    mailto: Option<&str>,
) -> Result<Vec<Paper>, Box<dyn std::error::Error + Send + Sync>> {
    let mut params: Vec<(&str, String)> =
        vec![("query", query.to_string()), ("rows", limit.to_string())];
    if let Some(m) = mailto.filter(|m| !m.trim().is_empty()) {
        params.push(("mailto", m.to_string()));
    }
    let url = reqwest::Url::parse_with_params(base, &params)?;
    let client = reqwest::Client::builder().user_agent(USER_AGENT).build()?;
    let resp: CrListResponse = client
        .get(url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    Ok(resp
        .message
        .items
        .into_iter()
        .filter_map(map_to_paper)
        .collect())
}

/// Testable exact-DOI lookup: `base` is the `works` collection URL; the DOI
/// is appended as a path segment (`{base}/{doi}`).
pub async fn by_doi_at(
    base: &str,
    doi: &str,
    mailto: Option<&str>,
) -> Result<Option<Paper>, Box<dyn std::error::Error + Send + Sync>> {
    // A DOI contains literal slashes (`10.1080/03461238...`) that Crossref
    // expects unencoded in the path, so we `join` a trailing-slashed base
    // rather than push a single percent-encoded segment.
    let base_slash = if base.ends_with('/') {
        base.to_string()
    } else {
        format!("{}/", base)
    };
    let mut url = reqwest::Url::parse(&base_slash)?.join(doi)?;
    if let Some(m) = mailto.filter(|m| !m.trim().is_empty()) {
        url.query_pairs_mut().append_pair("mailto", m);
    }
    let client = reqwest::Client::builder().user_agent(USER_AGENT).build()?;
    let resp = client.get(url).send().await?;
    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }
    let parsed: CrItemResponse = resp.error_for_status()?.json().await?;
    Ok(map_to_paper(parsed.message))
}

/// Strip JATS / XML tags from a Crossref abstract and collapse whitespace.
fn strip_jats(s: &str) -> Option<String> {
    let mut out = String::with_capacity(s.len());
    let mut in_tag = false;
    for c in s.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(c),
            _ => {}
        }
    }
    let collapsed = out.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.is_empty() {
        None
    } else {
        Some(collapsed)
    }
}

fn date_to_iso(d: &Option<CrDate>) -> Option<String> {
    let parts = d.as_ref()?.date_parts.first()?;
    let year = parts.first().copied().flatten()?;
    let month = parts.get(1).copied().flatten().unwrap_or(1).max(1);
    let day = parts.get(2).copied().flatten().unwrap_or(1).max(1);
    Some(format!("{:04}-{:02}-{:02}T00:00:00Z", year, month, day))
}

fn map_to_paper(item: CrItem) -> Option<Paper> {
    // Crossref entries are keyed by DOI — no DOI means nothing useful to dedupe on.
    let doi = item.doi?;
    let title = item
        .title
        .and_then(|t| t.into_iter().find(|s| !s.trim().is_empty()))
        .map(|s| s.split_whitespace().collect::<Vec<_>>().join(" "))?;

    let authors = item
        .author
        .into_iter()
        .filter_map(|a| match (a.given, a.family, a.name) {
            (Some(g), Some(f), _) => Some(format!("{} {}", g.trim(), f.trim())),
            (None, Some(f), _) => Some(f.trim().to_string()),
            (_, None, Some(n)) => Some(n.trim().to_string()),
            _ => None,
        })
        .collect();

    let source_url = item
        .resource
        .and_then(|r| r.primary)
        .and_then(|p| p.url)
        .or(item.url);

    Some(Paper {
        id: format!("p-doi-{}", doi),
        title,
        authors,
        abstract_: item.abstract_.as_deref().and_then(strip_jats),
        source: "crossref".to_string(),
        source_id: Some(doi.clone()),
        source_url,
        published_at: date_to_iso(&item.published).or_else(|| date_to_iso(&item.issued)),
        doi: Some(doi),
        pdf_path: None,
        read_status: "unread".to_string(),
        created_at: String::new(),
        updated_at: String::new(),
        sources: vec!["crossref".to_string()],
        fulltext_url: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"{
      "status": "ok",
      "message": {
        "items": [
          {
            "DOI": "10.1080/03461238.2012.00033",
            "title": ["A Review of Extreme Value Threshold Estimation and Uncertainty Quantification"],
            "author": [
              {"given": "Carl", "family": "Scarrott"},
              {"given": "Anna", "family": "MacDonald"}
            ],
            "container-title": ["REVSTAT-Statistical Journal"],
            "published": {"date-parts": [[2012, 3]]},
            "abstract": "<jats:p>The threshold approach to <jats:italic>extreme value</jats:italic> analysis.</jats:p>",
            "URL": "https://doi.org/10.1080/03461238.2012.00033",
            "resource": {"primary": {"URL": "https://www.ine.pt/revstat/article/10-1"}}
          },
          {
            "DOI": "10.1111/j.2517-6161.1990.tb01796.x",
            "title": ["Models for Exceedances over High Thresholds"],
            "author": [
              {"given": "A. C.", "family": "Davison"},
              {"given": "R. L.", "family": "Smith"}
            ],
            "issued": {"date-parts": [[1990]]}
          },
          {
            "title": ["No DOI entry should be dropped"],
            "author": []
          }
        ]
      }
    }"#;

    #[test]
    fn parses_items_and_drops_doi_less() {
        let r: CrListResponse = serde_json::from_str(SAMPLE).expect("json");
        let papers: Vec<Paper> = r
            .message
            .items
            .into_iter()
            .filter_map(map_to_paper)
            .collect();
        assert_eq!(papers.len(), 2, "the DOI-less item is dropped");
    }

    #[test]
    fn first_item_full_mapping() {
        let r: CrListResponse = serde_json::from_str(SAMPLE).expect("json");
        let p = &r
            .message
            .items
            .into_iter()
            .filter_map(map_to_paper)
            .next()
            .unwrap();
        assert_eq!(
            p.title,
            "A Review of Extreme Value Threshold Estimation and Uncertainty Quantification"
        );
        assert_eq!(p.source, "crossref");
        assert_eq!(p.doi.as_deref(), Some("10.1080/03461238.2012.00033"));
        assert_eq!(p.id, "p-doi-10.1080/03461238.2012.00033");
        assert_eq!(p.authors, vec!["Carl Scarrott", "Anna MacDonald"]);
        // date-parts [2012,3] → padded month, default day 1
        assert_eq!(p.published_at.as_deref(), Some("2012-03-01T00:00:00Z"));
        // resource.primary.URL wins over the doi.org URL
        assert_eq!(
            p.source_url.as_deref(),
            Some("https://www.ine.pt/revstat/article/10-1")
        );
        // JATS tags stripped, whitespace collapsed
        assert_eq!(
            p.abstract_.as_deref(),
            Some("The threshold approach to extreme value analysis.")
        );
    }

    #[test]
    fn second_item_year_only_and_doi_url_fallback() {
        let r: CrListResponse = serde_json::from_str(SAMPLE).expect("json");
        let papers: Vec<Paper> = r
            .message
            .items
            .into_iter()
            .filter_map(map_to_paper)
            .collect();
        let p = &papers[1];
        // issued used when published absent; year-only → 01-01
        assert_eq!(p.published_at.as_deref(), Some("1990-01-01T00:00:00Z"));
        assert!(p.abstract_.is_none());
        assert!(p.source_url.is_none());
    }

    #[test]
    fn by_doi_response_shape_parses() {
        let single = r#"{"status":"ok","message":{
            "DOI":"10.1/x","title":["T"],"author":[{"given":"A","family":"B"}],
            "issued":{"date-parts":[[2020,6,15]]}}}"#;
        let r: CrItemResponse = serde_json::from_str(single).expect("json");
        let p = map_to_paper(r.message).unwrap();
        assert_eq!(p.doi.as_deref(), Some("10.1/x"));
        assert_eq!(p.published_at.as_deref(), Some("2020-06-15T00:00:00Z"));
    }

    #[test]
    fn tolerates_null_date_parts() {
        // Crossref returns `"issued": {"date-parts": [[null]]}` for some
        // records (figures, supplements, theses). It must NOT break the whole
        // response decode — otherwise the source silently returns nothing.
        let json = r#"{"status":"ok","message":{"items":[
            {"DOI":"10.1/x","title":["Null dated record"],"issued":{"date-parts":[[null]]}},
            {"DOI":"10.1/y","title":["Year only"],"issued":{"date-parts":[[1990]]}}
        ]}}"#;
        let r: CrListResponse =
            serde_json::from_str(json).expect("must decode despite null date-parts");
        let papers: Vec<Paper> = r
            .message
            .items
            .into_iter()
            .filter_map(map_to_paper)
            .collect();
        assert_eq!(papers.len(), 2);
        assert!(
            papers[0].published_at.is_none(),
            "null date → no published_at"
        );
        assert_eq!(
            papers[1].published_at.as_deref(),
            Some("1990-01-01T00:00:00Z")
        );
    }

    #[test]
    fn strip_jats_removes_tags() {
        assert_eq!(
            strip_jats("<jats:p>Hello <b>world</b></jats:p>").as_deref(),
            Some("Hello world")
        );
        assert!(strip_jats("   <p></p>  ").is_none());
    }
}
