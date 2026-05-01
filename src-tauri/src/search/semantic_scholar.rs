use serde::Deserialize;

use crate::search::Paper;

const SS_API: &str = "https://api.semanticscholar.org/graph/v1/paper/search";
const FIELDS: &str = "title,authors,abstract,externalIds,url,year,publicationDate";
const USER_AGENT: &str = "SGHUB/0.1 (+https://github.com/zmc0081/SGHUB)";
const RETRY_DELAY: std::time::Duration = std::time::Duration::from_secs(2);

#[derive(Debug, Deserialize)]
struct SsResponse {
    data: Vec<SsPaper>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SsPaper {
    paper_id: Option<String>,
    title: Option<String>,
    #[serde(rename = "abstract")]
    abstract_: Option<String>,
    authors: Option<Vec<SsAuthor>>,
    external_ids: Option<SsExternalIds>,
    url: Option<String>,
    year: Option<i32>,
    publication_date: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SsAuthor {
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SsExternalIds {
    #[serde(rename = "DOI")]
    doi: Option<String>,
}

pub async fn search(
    query: &str,
    limit: u32,
) -> Result<Vec<Paper>, Box<dyn std::error::Error + Send + Sync>> {
    let url = reqwest::Url::parse_with_params(
        SS_API,
        &[
            ("query", query.to_string()),
            ("limit", limit.to_string()),
            ("fields", FIELDS.to_string()),
        ],
    )?;
    let client = reqwest::Client::builder().user_agent(USER_AGENT).build()?;

    // Single retry on 429 — SS free tier rate-limits aggressively per IP.
    let mut resp = client.get(url.clone()).send().await?;
    if resp.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
        log::info!("semantic_scholar 429, retrying after {:?}", RETRY_DELAY);
        tokio::time::sleep(RETRY_DELAY).await;
        resp = client.get(url).send().await?;
    }

    let data: SsResponse = resp.error_for_status()?.json().await?;
    Ok(data.data.into_iter().filter_map(map_to_paper).collect())
}

fn map_to_paper(ss: SsPaper) -> Option<Paper> {
    let title = ss.title?;
    let doi = ss.external_ids.as_ref().and_then(|e| e.doi.clone());
    let id = match (&ss.paper_id, &doi) {
        (Some(p), _) => format!("p-ss-{}", p),
        (_, Some(d)) => format!("p-doi-{}", d),
        _ => return None,
    };

    Some(Paper {
        id,
        title,
        authors: ss
            .authors
            .unwrap_or_default()
            .into_iter()
            .filter_map(|a| a.name)
            .collect(),
        abstract_: ss.abstract_,
        doi,
        source: "semantic_scholar".to_string(),
        source_id: ss.paper_id,
        source_url: ss.url,
        published_at: ss
            .publication_date
            .as_deref()
            .filter(|d| !d.is_empty())
            .map(|d| format!("{}T00:00:00Z", d))
            .or_else(|| ss.year.map(|y| format!("{}-01-01T00:00:00Z", y))),
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
      "total": 2,
      "offset": 0,
      "data": [
        {
          "paperId": "204e3073870fae3d05bcbc2f6a8e263d9b72e776",
          "externalIds": {"DOI": "10.48550/arXiv.1706.03762", "ArXiv": "1706.03762", "MAG": "2963403868"},
          "url": "https://www.semanticscholar.org/paper/204e3073",
          "title": "Attention is All you Need",
          "abstract": "The dominant sequence transduction models...",
          "authors": [
            {"authorId": "1", "name": "Ashish Vaswani"},
            {"authorId": "2", "name": "Noam Shazeer"}
          ],
          "year": 2017,
          "publicationDate": "2017-06-12"
        },
        {
          "paperId": "abc123",
          "externalIds": {},
          "url": "https://www.semanticscholar.org/paper/abc123",
          "title": "Some paper without DOI",
          "abstract": null,
          "authors": [],
          "year": 2024,
          "publicationDate": null
        }
      ]
    }"#;

    #[test]
    fn parses_response_and_maps() {
        let resp: SsResponse = serde_json::from_str(SAMPLE).expect("json");
        let papers: Vec<Paper> = resp.data.into_iter().filter_map(map_to_paper).collect();
        assert_eq!(papers.len(), 2);
    }

    #[test]
    fn first_paper_has_doi_authors_and_full_date() {
        let resp: SsResponse = serde_json::from_str(SAMPLE).expect("json");
        let papers: Vec<Paper> = resp.data.into_iter().filter_map(map_to_paper).collect();
        let p = &papers[0];
        assert_eq!(p.title, "Attention is All you Need");
        assert_eq!(p.authors.len(), 2);
        assert_eq!(p.source, "semantic_scholar");
        assert_eq!(p.doi.as_deref(), Some("10.48550/arXiv.1706.03762"));
        // publicationDate (2017-06-12) wins over year (2017)
        assert_eq!(p.published_at.as_deref(), Some("2017-06-12T00:00:00Z"));
        assert_eq!(p.id, "p-ss-204e3073870fae3d05bcbc2f6a8e263d9b72e776");
    }

    #[test]
    fn second_paper_handles_missing_doi_empty_authors_and_null_date() {
        let resp: SsResponse = serde_json::from_str(SAMPLE).expect("json");
        let papers: Vec<Paper> = resp.data.into_iter().filter_map(map_to_paper).collect();
        let p = &papers[1];
        assert!(p.doi.is_none());
        assert!(p.authors.is_empty());
        assert!(p.abstract_.is_none());
        // publicationDate is null → fall back to year (2024-01-01)
        assert_eq!(p.published_at.as_deref(), Some("2024-01-01T00:00:00Z"));
    }

    #[test]
    fn missing_both_date_and_year_yields_none() {
        let json = r#"{
          "total": 1, "offset": 0,
          "data": [{
            "paperId": "x", "title": "T", "authors": [],
            "externalIds": {}, "url": null
          }]
        }"#;
        let resp: SsResponse = serde_json::from_str(json).expect("json");
        let papers: Vec<Paper> = resp.data.into_iter().filter_map(map_to_paper).collect();
        assert!(papers[0].published_at.is_none());
    }
}
