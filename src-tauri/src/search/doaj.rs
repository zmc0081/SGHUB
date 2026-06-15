//! DOAJ source (V2.2.3 / Session 32).
//!
//! Directory of Open Access Journals — no auth. The query is part of the URL
//! path (`/search/articles/{query}`), so it's pushed as a percent-encoded
//! path segment.

use serde::Deserialize;

use crate::search::Paper;

const DOAJ_API: &str = "https://doaj.org/api/v2/search/articles";
const USER_AGENT: &str = "SGHUB/0.1 (+https://github.com/zmc0081/SGHUB)";

#[derive(Debug, Deserialize)]
struct DoajResponse {
    #[serde(default)]
    results: Vec<DoajResult>,
}

#[derive(Debug, Deserialize)]
struct DoajResult {
    id: Option<String>,
    bibjson: Option<DoajBibjson>,
}

#[derive(Debug, Deserialize)]
struct DoajBibjson {
    title: Option<String>,
    #[serde(default)]
    author: Vec<DoajAuthor>,
    #[serde(rename = "abstract")]
    abstract_: Option<String>,
    year: Option<String>,
    #[serde(default)]
    identifier: Vec<DoajIdentifier>,
    #[serde(default)]
    link: Vec<DoajLink>,
}

#[derive(Debug, Deserialize)]
struct DoajAuthor {
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DoajIdentifier {
    #[serde(rename = "type")]
    id_type: Option<String>,
    id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DoajLink {
    #[serde(rename = "type")]
    link_type: Option<String>,
    url: Option<String>,
}

/// Search DOAJ against the production endpoint.
pub async fn search(
    query: &str,
    limit: u32,
) -> Result<Vec<Paper>, Box<dyn std::error::Error + Send + Sync>> {
    search_at(DOAJ_API, query, limit).await
}

/// Testable search: `base` is the `search/articles` collection URL; the query
/// is appended as a path segment.
pub async fn search_at(
    base: &str,
    query: &str,
    limit: u32,
) -> Result<Vec<Paper>, Box<dyn std::error::Error + Send + Sync>> {
    let mut url = reqwest::Url::parse(base)?;
    url.path_segments_mut()
        .map_err(|_| "doaj base URL cannot be a base")?
        .push(query);
    url.query_pairs_mut()
        .append_pair("pageSize", &limit.to_string());
    let client = reqwest::Client::builder().user_agent(USER_AGENT).build()?;
    let resp: DoajResponse = client
        .get(url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    Ok(resp.results.into_iter().filter_map(map_to_paper).collect())
}

fn map_to_paper(r: DoajResult) -> Option<Paper> {
    let bib = r.bibjson?;
    let title = bib
        .title
        .map(|s| s.split_whitespace().collect::<Vec<_>>().join(" "))
        .filter(|s| !s.is_empty())?;

    let doi = bib
        .identifier
        .iter()
        .find(|i| i.id_type.as_deref() == Some("doi"))
        .and_then(|i| i.id.clone())
        .filter(|d| !d.trim().is_empty());

    let source_url = bib
        .link
        .iter()
        .find(|l| l.link_type.as_deref() == Some("fulltext"))
        .and_then(|l| l.url.clone())
        .or_else(|| bib.link.iter().find_map(|l| l.url.clone()));

    // Only a link explicitly typed "fulltext" counts as a full-text link.
    let fulltext_url = bib
        .link
        .iter()
        .find(|l| l.link_type.as_deref() == Some("fulltext"))
        .and_then(|l| l.url.clone());

    let id = match (&doi, &r.id) {
        (Some(d), _) => format!("p-doi-{}", d),
        (_, Some(i)) => format!("p-doaj-{}", i),
        _ => return None,
    };

    Some(Paper {
        id,
        title,
        authors: bib
            .author
            .into_iter()
            .filter_map(|a| a.name.map(|n| n.trim().to_string()))
            .filter(|n| !n.is_empty())
            .collect(),
        abstract_: bib
            .abstract_
            .map(|s| s.split_whitespace().collect::<Vec<_>>().join(" "))
            .filter(|s| !s.is_empty()),
        source: "doaj".to_string(),
        source_id: r.id,
        source_url,
        published_at: bib.year.and_then(|y| {
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
        sources: vec!["doaj".to_string()],
        fulltext_url,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"{
      "total": 2,
      "results": [
        {
          "id": "abc123doaj",
          "bibjson": {
            "title": "An Open Access Statistics Article",
            "author": [{"name": "Jane Doe"}, {"name": "John Roe"}],
            "abstract": "Open   access   abstract.",
            "year": "2015",
            "identifier": [
              {"type": "doi", "id": "10.1234/oa.2015.1"},
              {"type": "eissn", "id": "1234-5678"}
            ],
            "link": [
              {"type": "fulltext", "url": "https://journal.example.org/article/1/pdf"}
            ],
            "journal": {"title": "Journal of Open Stats"}
          }
        },
        {
          "id": "noDoiArticle",
          "bibjson": {
            "title": "No DOI here",
            "author": [],
            "year": "2018",
            "identifier": [{"type": "eissn", "id": "9999-0000"}],
            "link": [{"type": "homepage", "url": "https://journal.example.org/home"}]
          }
        }
      ]
    }"#;

    #[test]
    fn parses_two_results() {
        let r: DoajResponse = serde_json::from_str(SAMPLE).expect("json");
        let papers: Vec<Paper> = r.results.into_iter().filter_map(map_to_paper).collect();
        assert_eq!(papers.len(), 2);
    }

    #[test]
    fn first_result_extracts_doi_and_fulltext_link() {
        let r: DoajResponse = serde_json::from_str(SAMPLE).expect("json");
        let p = r
            .results
            .into_iter()
            .filter_map(map_to_paper)
            .next()
            .unwrap();
        assert_eq!(p.source, "doaj");
        assert_eq!(p.doi.as_deref(), Some("10.1234/oa.2015.1"));
        assert_eq!(p.id, "p-doi-10.1234/oa.2015.1");
        assert_eq!(p.authors, vec!["Jane Doe", "John Roe"]);
        assert_eq!(
            p.source_url.as_deref(),
            Some("https://journal.example.org/article/1/pdf")
        );
        assert_eq!(p.abstract_.as_deref(), Some("Open access abstract."));
        assert_eq!(p.published_at.as_deref(), Some("2015-01-01T00:00:00Z"));
    }

    #[test]
    fn second_result_falls_back_to_doaj_id_and_any_link() {
        let r: DoajResponse = serde_json::from_str(SAMPLE).expect("json");
        let papers: Vec<Paper> = r.results.into_iter().filter_map(map_to_paper).collect();
        let p = &papers[1];
        assert!(p.doi.is_none());
        assert_eq!(p.id, "p-doaj-noDoiArticle");
        // no fulltext link → first available link used
        assert_eq!(
            p.source_url.as_deref(),
            Some("https://journal.example.org/home")
        );
    }
}
