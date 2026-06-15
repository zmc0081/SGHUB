//! DBLP source (V2.2.3 / Session 32).
//!
//! DBLP is the computer-science bibliography — no auth, very high metadata
//! quality for CS venues.
//!
//! The one sharp edge (called out in the task): DBLP's JSON serializes a
//! single value as an object and multiple values as an array. This affects
//! `hits.hit`, `authors.author`, and `ee`. We model all three with a
//! `OneOrMany` untagged enum so both shapes parse.

use serde::Deserialize;

use crate::search::Paper;

const DBLP_API: &str = "https://dblp.org/search/publ/api";
const USER_AGENT: &str = "SGHUB/0.1 (+https://github.com/zmc0081/SGHUB)";

/// DBLP returns a bare object for a single element, an array for many.
///
/// `Many` MUST come first: serde's untagged matcher tries variants in order,
/// and a struct can be (mis)deserialized from a sequence — so with `One`
/// first an array would be greedily consumed as a single (empty) element.
#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum OneOrMany<T> {
    Many(Vec<T>),
    One(Box<T>),
}

impl<T> OneOrMany<T> {
    fn into_vec(self) -> Vec<T> {
        match self {
            OneOrMany::One(v) => vec![*v],
            OneOrMany::Many(v) => v,
        }
    }
}

#[derive(Debug, Deserialize)]
struct DblpResponse {
    result: DblpResult,
}

#[derive(Debug, Deserialize)]
struct DblpResult {
    hits: DblpHits,
}

#[derive(Debug, Deserialize)]
struct DblpHits {
    hit: Option<OneOrMany<DblpHit>>,
}

#[derive(Debug, Deserialize)]
struct DblpHit {
    info: DblpInfo,
}

#[derive(Debug, Deserialize)]
struct DblpInfo {
    title: Option<String>,
    authors: Option<DblpAuthors>,
    year: Option<String>,
    doi: Option<String>,
    ee: Option<OneOrMany<String>>,
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DblpAuthors {
    author: Option<OneOrMany<DblpAuthor>>,
}

#[derive(Debug, Deserialize)]
struct DblpAuthor {
    text: Option<String>,
}

/// Search DBLP against the production endpoint.
pub async fn search(
    query: &str,
    limit: u32,
) -> Result<Vec<Paper>, Box<dyn std::error::Error + Send + Sync>> {
    search_at(DBLP_API, query, limit).await
}

/// Testable search: `base` is the publ-search API URL.
pub async fn search_at(
    base: &str,
    query: &str,
    limit: u32,
) -> Result<Vec<Paper>, Box<dyn std::error::Error + Send + Sync>> {
    let url = reqwest::Url::parse_with_params(
        base,
        &[
            ("q", query.to_string()),
            ("format", "json".to_string()),
            ("h", limit.to_string()),
        ],
    )?;
    let client = reqwest::Client::builder().user_agent(USER_AGENT).build()?;
    let body = client
        .get(url)
        .send()
        .await?
        .error_for_status()?
        .text()
        .await?;
    Ok(parse(&body)?)
}

fn parse(json: &str) -> Result<Vec<Paper>, serde_json::Error> {
    let resp: DblpResponse = serde_json::from_str(json)?;
    let hits = match resp.result.hits.hit {
        Some(h) => h.into_vec(),
        None => return Ok(Vec::new()),
    };
    Ok(hits
        .into_iter()
        .filter_map(|h| map_to_paper(h.info))
        .collect())
}

fn map_to_paper(info: DblpInfo) -> Option<Paper> {
    let title = info
        .title
        .map(|s| s.split_whitespace().collect::<Vec<_>>().join(" "))
        .filter(|s| !s.is_empty())?;

    let authors = info
        .authors
        .and_then(|a| a.author)
        .map(OneOrMany::into_vec)
        .unwrap_or_default()
        .into_iter()
        .filter_map(|a| a.text)
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    let doi = info.doi.filter(|d| !d.trim().is_empty());
    // `ee` (electronic edition) is the most useful link; fall back to the
    // DBLP record URL.
    let ee_first = info
        .ee
        .map(OneOrMany::into_vec)
        .and_then(|v| v.into_iter().next());
    let source_url = ee_first.or(info.url.clone());

    let id = match (&doi, &info.url) {
        (Some(d), _) => format!("p-doi-{}", d),
        (_, Some(u)) => format!("p-dblp-{}", u),
        _ => return None,
    };

    Some(Paper {
        id,
        title,
        authors,
        abstract_: None, // DBLP returns metadata only, no abstract
        source: "dblp".to_string(),
        source_id: info.url,
        source_url,
        published_at: info.year.and_then(|y| {
            let y = y.trim();
            if y.is_empty() {
                None
            } else {
                Some(format!("{}-01-01T00:00:00Z", y))
            }
        }),
        doi,
        pdf_path: None,
        read_status: "unread".to_string(),
        created_at: String::new(),
        updated_at: String::new(),
        sources: vec!["dblp".to_string()],
        fulltext_url: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Multiple authors → `author` is an array; multiple hits → `hit` is an array.
    const MANY: &str = r#"{
      "result": {
        "hits": {
          "@total": "1",
          "hit": [
            {
              "info": {
                "title": "Attention Is All You Need",
                "authors": {
                  "author": [
                    {"@pid": "1", "text": "Ashish Vaswani"},
                    {"@pid": "2", "text": "Noam Shazeer"}
                  ]
                },
                "venue": "NeurIPS",
                "year": "2017",
                "doi": "10.48550/arXiv.1706.03762",
                "ee": ["https://arxiv.org/abs/1706.03762"],
                "url": "https://dblp.org/rec/conf/nips/VaswaniSPUJGKP17"
              }
            }
          ]
        }
      }
    }"#;

    // Single author → `author` is an object (not array); single hit → `hit` is an object.
    const SINGLE: &str = r#"{
      "result": {
        "hits": {
          "@total": "1",
          "hit": {
            "info": {
              "title": "A Single Author Paper",
              "authors": {"author": {"@pid": "9", "text": "Solo Researcher"}},
              "year": "2021",
              "ee": "https://example.org/paper.pdf",
              "url": "https://dblp.org/rec/x/Solo21"
            }
          }
        }
      }
    }"#;

    const EMPTY: &str = r#"{"result":{"hits":{"@total":"0"}}}"#;

    #[test]
    fn parses_array_authors_and_array_hits() {
        let papers = parse(MANY).expect("parse");
        assert_eq!(papers.len(), 1);
        let p = &papers[0];
        assert_eq!(p.title, "Attention Is All You Need");
        assert_eq!(p.authors, vec!["Ashish Vaswani", "Noam Shazeer"]);
        assert_eq!(p.source, "dblp");
        assert_eq!(p.doi.as_deref(), Some("10.48550/arXiv.1706.03762"));
        assert_eq!(
            p.source_url.as_deref(),
            Some("https://arxiv.org/abs/1706.03762")
        );
        assert_eq!(p.published_at.as_deref(), Some("2017-01-01T00:00:00Z"));
    }

    #[test]
    fn parses_single_author_object_and_single_hit_object() {
        let papers = parse(SINGLE).expect("parse");
        assert_eq!(papers.len(), 1, "single hit object must parse");
        let p = &papers[0];
        assert_eq!(
            p.authors,
            vec!["Solo Researcher"],
            "single author object must parse"
        );
        // ee as a bare string (not array)
        assert_eq!(
            p.source_url.as_deref(),
            Some("https://example.org/paper.pdf")
        );
        // no DOI → id falls back to the DBLP url
        assert_eq!(p.id, "p-dblp-https://dblp.org/rec/x/Solo21");
    }

    #[test]
    fn empty_hits_yield_no_papers() {
        assert!(parse(EMPTY).expect("parse").is_empty());
    }
}
