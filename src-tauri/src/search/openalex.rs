use std::collections::HashMap;

use serde::Deserialize;

use crate::search::Paper;

const OA_API: &str = "https://api.openalex.org/works";
const USER_AGENT: &str = "SGHUB/0.1 (+https://github.com/zmc0081/SGHUB)";

#[derive(Debug, Deserialize)]
struct OaResponse {
    results: Vec<OaWork>,
}

#[derive(Debug, Deserialize)]
struct OaWork {
    id: Option<String>,
    doi: Option<String>,
    title: Option<String>,
    publication_date: Option<String>,
    publication_year: Option<i32>,
    abstract_inverted_index: Option<HashMap<String, Vec<u32>>>,
    authorships: Option<Vec<OaAuthorship>>,
    primary_location: Option<OaPrimaryLocation>,
}

#[derive(Debug, Deserialize)]
struct OaAuthorship {
    author: Option<OaAuthor>,
}

#[derive(Debug, Deserialize)]
struct OaAuthor {
    display_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OaPrimaryLocation {
    landing_page_url: Option<String>,
}

pub async fn search(
    query: &str,
    limit: u32,
) -> Result<Vec<Paper>, Box<dyn std::error::Error + Send + Sync>> {
    let url = reqwest::Url::parse_with_params(
        OA_API,
        &[
            ("search", query.to_string()),
            ("per_page", limit.to_string()),
        ],
    )?;
    let client = reqwest::Client::builder().user_agent(USER_AGENT).build()?;
    let resp: OaResponse = client
        .get(url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    Ok(resp.results.into_iter().filter_map(map_to_paper).collect())
}

/// Rebuild abstract from OpenAlex's inverted index.
/// Input: { word: [positions...] }  →  Output: "word1 word2 word3 ..."
fn rebuild_abstract(inv: &HashMap<String, Vec<u32>>) -> Option<String> {
    let max_pos = inv.values().flatten().max().copied()?;
    let mut words = vec![String::new(); (max_pos + 1) as usize];
    for (word, positions) in inv {
        for &pos in positions {
            if let Some(slot) = words.get_mut(pos as usize) {
                slot.clone_from(word);
            }
        }
    }
    let joined = words.join(" ");
    let trimmed = joined.split_whitespace().collect::<Vec<_>>().join(" ");
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

fn strip_url_prefix(url: &str, prefix: &str) -> String {
    url.strip_prefix(prefix).unwrap_or(url).to_string()
}

fn map_to_paper(w: OaWork) -> Option<Paper> {
    let title = w.title?;
    let doi = w.doi.as_deref().map(|d| strip_url_prefix(d, "https://doi.org/"));
    let oa_id = w.id.as_deref().map(|i| strip_url_prefix(i, "https://openalex.org/"));

    let id = match (&oa_id, &doi) {
        (Some(i), _) => format!("p-openalex-{}", i),
        (_, Some(d)) => format!("p-doi-{}", d),
        _ => return None,
    };

    Some(Paper {
        id,
        title,
        authors: w
            .authorships
            .unwrap_or_default()
            .into_iter()
            .filter_map(|a| a.author.and_then(|x| x.display_name))
            .collect(),
        abstract_: w.abstract_inverted_index.as_ref().and_then(rebuild_abstract),
        doi,
        source: "openalex".to_string(),
        source_id: oa_id,
        source_url: w.primary_location.and_then(|l| l.landing_page_url),
        published_at: w
            .publication_date
            .as_deref()
            .filter(|d| !d.is_empty())
            .map(|d| format!("{}T00:00:00Z", d))
            .or_else(|| w.publication_year.map(|y| format!("{}-01-01T00:00:00Z", y))),
        pdf_path: None,
        read_status: "unread".to_string(),
        created_at: String::new(),
        updated_at: String::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"{
      "meta": {"count": 1},
      "results": [{
        "id": "https://openalex.org/W2741809807",
        "doi": "https://doi.org/10.7717/peerj.4375",
        "title": "The state of OA: a large-scale analysis of the prevalence and impact of Open Access articles",
        "publication_date": "2018-02-13",
        "publication_year": 2018,
        "abstract_inverted_index": {
          "Despite": [0],
          "growing": [1],
          "interest": [2],
          "in": [3, 6],
          "Open": [4],
          "Access": [5],
          "publishing": [7]
        },
        "authorships": [
          {"author": {"display_name": "Heather Piwowar"}},
          {"author": {"display_name": "Jason Priem"}}
        ],
        "primary_location": {
          "landing_page_url": "https://peerj.com/articles/4375"
        }
      }]
    }"#;

    #[test]
    fn parses_response_and_strips_url_prefixes() {
        let r: OaResponse = serde_json::from_str(SAMPLE).expect("json");
        let papers: Vec<Paper> = r.results.into_iter().filter_map(map_to_paper).collect();
        assert_eq!(papers.len(), 1);
        let p = &papers[0];
        assert_eq!(p.id, "p-openalex-W2741809807");
        assert_eq!(p.source_id.as_deref(), Some("W2741809807"));
        assert_eq!(p.doi.as_deref(), Some("10.7717/peerj.4375"));
        assert_eq!(p.source, "openalex");
        assert_eq!(p.authors.len(), 2);
        assert_eq!(p.published_at.as_deref(), Some("2018-02-13T00:00:00Z"));
    }

    #[test]
    fn rebuilds_abstract_from_inverted_index() {
        let r: OaResponse = serde_json::from_str(SAMPLE).expect("json");
        let p = r.results.into_iter().filter_map(map_to_paper).next().unwrap();
        assert_eq!(
            p.abstract_.as_deref(),
            Some("Despite growing interest in Open Access in publishing")
        );
    }

    #[test]
    fn rebuild_handles_repeated_words() {
        let mut inv: HashMap<String, Vec<u32>> = HashMap::new();
        inv.insert("hello".into(), vec![0, 3]);
        inv.insert("world".into(), vec![1, 2]);
        assert_eq!(
            rebuild_abstract(&inv).as_deref(),
            Some("hello world world hello")
        );
    }

    #[test]
    fn rebuild_empty_returns_none() {
        let empty: HashMap<String, Vec<u32>> = HashMap::new();
        assert!(rebuild_abstract(&empty).is_none());
    }

    #[test]
    fn falls_back_to_year_when_no_date() {
        let json = r#"{
          "meta": {"count": 1},
          "results": [{
            "id": "https://openalex.org/W123",
            "doi": null,
            "title": "T",
            "publication_year": 2020,
            "publication_date": null,
            "abstract_inverted_index": null,
            "authorships": [],
            "primary_location": null
          }]
        }"#;
        let r: OaResponse = serde_json::from_str(json).expect("json");
        let p = r.results.into_iter().filter_map(map_to_paper).next().unwrap();
        assert_eq!(p.published_at.as_deref(), Some("2020-01-01T00:00:00Z"));
        assert!(p.doi.is_none());
        assert!(p.abstract_.is_none());
    }
}
