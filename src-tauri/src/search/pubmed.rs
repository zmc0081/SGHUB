use serde::Deserialize;

use crate::search::Paper;

const ESEARCH: &str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const EFETCH: &str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
const USER_AGENT: &str = "SGHUB/0.1 (+https://github.com/zmc0081/SGHUB)";
const TOOL: &str = "sghub";

#[derive(Debug, Deserialize)]
struct EsearchResponse {
    esearchresult: EsearchResult,
}

#[derive(Debug, Deserialize)]
struct EsearchResult {
    idlist: Vec<String>,
}

pub async fn search(
    query: &str,
    limit: u32,
) -> Result<Vec<Paper>, Box<dyn std::error::Error + Send + Sync>> {
    let client = reqwest::Client::builder().user_agent(USER_AGENT).build()?;

    // Step 1: esearch — query → list of PMIDs
    let esearch_url = reqwest::Url::parse_with_params(
        ESEARCH,
        &[
            ("db", "pubmed"),
            ("term", query),
            ("retmax", &limit.to_string()),
            ("retmode", "json"),
            ("tool", TOOL),
        ],
    )?;
    let esearch: EsearchResponse = client
        .get(esearch_url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    if esearch.esearchresult.idlist.is_empty() {
        return Ok(Vec::new());
    }

    // Step 2: efetch — PMIDs → full XML records
    let ids = esearch.esearchresult.idlist.join(",");
    let efetch_url = reqwest::Url::parse_with_params(
        EFETCH,
        &[
            ("db", "pubmed"),
            ("id", &ids),
            ("retmode", "xml"),
            ("tool", TOOL),
        ],
    )?;
    let xml = client
        .get(efetch_url)
        .send()
        .await?
        .error_for_status()?
        .text()
        .await?;

    Ok(parse_efetch(&xml)?)
}

fn parse_efetch(xml: &str) -> Result<Vec<Paper>, roxmltree::Error> {
    let doc = roxmltree::Document::parse(xml)?;
    let papers = doc
        .descendants()
        .filter(|n| n.is_element() && n.tag_name().name() == "PubmedArticle")
        .filter_map(parse_article)
        .collect();
    Ok(papers)
}

fn parse_article(article: roxmltree::Node) -> Option<Paper> {
    // PMID
    let pmid = descendant_text(article, "PMID")?;

    // Title
    let title = descendant_text(article, "ArticleTitle")?;

    // Abstract — may have multiple AbstractText elements (structured abstracts)
    let abstract_parts: Vec<String> = article
        .descendants()
        .filter(|n| n.is_element() && n.tag_name().name() == "AbstractText")
        .filter_map(|n| {
            let label = n.attribute("Label").map(|l| format!("{}: ", l));
            let text = n.text()?.trim();
            if text.is_empty() {
                None
            } else {
                Some(format!("{}{}", label.unwrap_or_default(), text))
            }
        })
        .collect();
    let abstract_ = if abstract_parts.is_empty() {
        None
    } else {
        Some(abstract_parts.join(" "))
    };

    // Authors — combine ForeName + LastName
    let authors: Vec<String> = article
        .descendants()
        .filter(|n| n.is_element() && n.tag_name().name() == "Author")
        .filter_map(author_full_name)
        .collect();

    // DOI from <ArticleId IdType="doi">
    let doi = article
        .descendants()
        .filter(|n| n.is_element() && n.tag_name().name() == "ArticleId")
        .find(|n| n.attribute("IdType") == Some("doi"))
        .and_then(|n| n.text())
        .map(|s| s.trim().to_string());

    // Published date — prefer ArticleDate, fall back to PubDate (Year/Month/Day)
    let published_at = article_date(article).or_else(|| pub_date(article));

    Some(Paper {
        id: format!("p-pubmed-{}", pmid),
        title,
        authors,
        abstract_,
        doi,
        source: "pubmed".to_string(),
        source_id: Some(pmid.clone()),
        source_url: Some(format!("https://pubmed.ncbi.nlm.nih.gov/{}/", pmid)),
        published_at,
        pdf_path: None,
        read_status: "unread".to_string(),
        created_at: String::new(),
        updated_at: String::new(),
    })
}

fn descendant_text(node: roxmltree::Node, name: &str) -> Option<String> {
    node.descendants()
        .find(|n| n.is_element() && n.tag_name().name() == name)
        .and_then(|n| n.text())
        .map(|s| s.trim().to_string())
}

fn author_full_name(author: roxmltree::Node) -> Option<String> {
    let last = author
        .children()
        .find(|n| n.is_element() && n.tag_name().name() == "LastName")
        .and_then(|n| n.text())
        .map(|s| s.trim().to_string());
    let fore = author
        .children()
        .find(|n| n.is_element() && n.tag_name().name() == "ForeName")
        .and_then(|n| n.text())
        .map(|s| s.trim().to_string());
    let collective = author
        .children()
        .find(|n| n.is_element() && n.tag_name().name() == "CollectiveName")
        .and_then(|n| n.text())
        .map(|s| s.trim().to_string());
    match (fore, last, collective) {
        (Some(f), Some(l), _) => Some(format!("{} {}", f, l)),
        (None, Some(l), _) => Some(l),
        (_, _, Some(c)) => Some(c),
        _ => None,
    }
}

fn article_date(article: roxmltree::Node) -> Option<String> {
    let ad = article
        .descendants()
        .find(|n| n.is_element() && n.tag_name().name() == "ArticleDate")?;
    let year = child_text(ad, "Year")?;
    let month = child_text(ad, "Month").unwrap_or_else(|| "01".into());
    let day = child_text(ad, "Day").unwrap_or_else(|| "01".into());
    Some(format!(
        "{}-{:0>2}-{:0>2}T00:00:00Z",
        year,
        normalize_month(&month),
        day
    ))
}

fn pub_date(article: roxmltree::Node) -> Option<String> {
    let pd = article
        .descendants()
        .find(|n| n.is_element() && n.tag_name().name() == "PubDate")?;
    let year = child_text(pd, "Year")?;
    let month = child_text(pd, "Month").map(|m| normalize_month(&m));
    let day = child_text(pd, "Day");
    match (month, day) {
        (Some(m), Some(d)) => Some(format!("{}-{:0>2}-{:0>2}T00:00:00Z", year, m, d)),
        (Some(m), None) => Some(format!("{}-{:0>2}-01T00:00:00Z", year, m)),
        _ => Some(format!("{}-01-01T00:00:00Z", year)),
    }
}

fn child_text(node: roxmltree::Node, name: &str) -> Option<String> {
    node.children()
        .find(|n| n.is_element() && n.tag_name().name() == name)
        .and_then(|n| n.text())
        .map(|s| s.trim().to_string())
}

/// PubMed PubDate.Month is sometimes "Sep" instead of "09".
fn normalize_month(m: &str) -> String {
    match m {
        "Jan" => "01", "Feb" => "02", "Mar" => "03", "Apr" => "04",
        "May" => "05", "Jun" => "06", "Jul" => "07", "Aug" => "08",
        "Sep" => "09", "Oct" => "10", "Nov" => "11", "Dec" => "12",
        other => other,
    }
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    const ESEARCH_SAMPLE: &str = r#"{
      "header": {"type": "esearch", "version": "0.3"},
      "esearchresult": {
        "count": "2", "retmax": "2", "retstart": "0",
        "idlist": ["36100450", "37301754"]
      }
    }"#;

    const EFETCH_SAMPLE: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<PubmedArticleSet>
  <PubmedArticle>
    <MedlineCitation>
      <PMID Version="1">36100450</PMID>
      <Article>
        <Journal>
          <JournalIssue>
            <PubDate>
              <Year>2022</Year>
              <Month>Sep</Month>
              <Day>13</Day>
            </PubDate>
          </JournalIssue>
        </Journal>
        <ArticleTitle>Highly accurate protein structure prediction with AlphaFold.</ArticleTitle>
        <Abstract>
          <AbstractText Label="BACKGROUND">Proteins are essential...</AbstractText>
          <AbstractText Label="METHODS">We developed a deep learning method.</AbstractText>
        </Abstract>
        <AuthorList>
          <Author>
            <LastName>Jumper</LastName>
            <ForeName>John</ForeName>
          </Author>
          <Author>
            <LastName>Hassabis</LastName>
            <ForeName>Demis</ForeName>
          </Author>
        </AuthorList>
      </Article>
    </MedlineCitation>
    <PubmedData>
      <ArticleIdList>
        <ArticleId IdType="pubmed">36100450</ArticleId>
        <ArticleId IdType="doi">10.1038/s41586-021-03819-2</ArticleId>
      </ArticleIdList>
    </PubmedData>
  </PubmedArticle>
  <PubmedArticle>
    <MedlineCitation>
      <PMID Version="1">37301754</PMID>
      <Article>
        <ArticleDate DateType="Electronic">
          <Year>2023</Year>
          <Month>06</Month>
          <Day>08</Day>
        </ArticleDate>
        <ArticleTitle>Second example.</ArticleTitle>
        <AuthorList>
          <Author>
            <CollectiveName>Some Consortium</CollectiveName>
          </Author>
        </AuthorList>
      </Article>
    </MedlineCitation>
    <PubmedData>
      <ArticleIdList>
        <ArticleId IdType="pubmed">37301754</ArticleId>
      </ArticleIdList>
    </PubmedData>
  </PubmedArticle>
</PubmedArticleSet>"#;

    #[test]
    fn parses_esearch_json() {
        let r: EsearchResponse = serde_json::from_str(ESEARCH_SAMPLE).expect("json");
        assert_eq!(r.esearchresult.idlist.len(), 2);
        assert_eq!(r.esearchresult.idlist[0], "36100450");
    }

    #[test]
    fn parses_efetch_xml_full() {
        let papers = parse_efetch(EFETCH_SAMPLE).expect("xml");
        assert_eq!(papers.len(), 2);

        let p = &papers[0];
        assert_eq!(p.id, "p-pubmed-36100450");
        assert_eq!(p.title, "Highly accurate protein structure prediction with AlphaFold.");
        assert_eq!(p.authors, vec!["John Jumper", "Demis Hassabis"]);
        assert_eq!(p.source, "pubmed");
        assert_eq!(p.source_id.as_deref(), Some("36100450"));
        assert_eq!(
            p.source_url.as_deref(),
            Some("https://pubmed.ncbi.nlm.nih.gov/36100450/")
        );
        assert_eq!(p.doi.as_deref(), Some("10.1038/s41586-021-03819-2"));
        assert_eq!(p.published_at.as_deref(), Some("2022-09-13T00:00:00Z"));
        // structured abstract joins parts with labels
        let abs = p.abstract_.as_deref().unwrap();
        assert!(abs.contains("BACKGROUND:"));
        assert!(abs.contains("METHODS:"));
    }

    #[test]
    fn handles_collective_author_and_article_date() {
        let papers = parse_efetch(EFETCH_SAMPLE).expect("xml");
        let p = &papers[1];
        assert_eq!(p.authors, vec!["Some Consortium"]);
        assert_eq!(p.published_at.as_deref(), Some("2023-06-08T00:00:00Z"));
        assert!(p.doi.is_none());
        assert!(p.abstract_.is_none());
    }

    #[test]
    fn normalize_month_works() {
        assert_eq!(normalize_month("Sep"), "09");
        assert_eq!(normalize_month("01"), "01");
        assert_eq!(normalize_month("Mar"), "03");
    }
}
