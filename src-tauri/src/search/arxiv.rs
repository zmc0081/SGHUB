use crate::search::Paper;

const ARXIV_API: &str = "http://export.arxiv.org/api/query";
const ATOM_NS: &str = "http://www.w3.org/2005/Atom";
const ARXIV_NS: &str = "http://arxiv.org/schemas/atom";

pub async fn search(
    query: &str,
    limit: u32,
) -> Result<Vec<Paper>, Box<dyn std::error::Error + Send + Sync>> {
    let url = reqwest::Url::parse_with_params(
        ARXIV_API,
        &[
            ("search_query", format!("all:{}", query)),
            ("max_results", limit.to_string()),
        ],
    )?;
    let body = reqwest::get(url)
        .await?
        .error_for_status()?
        .text()
        .await?;
    Ok(parse_atom(&body)?)
}

fn parse_atom(xml: &str) -> Result<Vec<Paper>, roxmltree::Error> {
    let doc = roxmltree::Document::parse(xml)?;
    let papers = doc
        .descendants()
        .filter(|n| {
            n.is_element()
                && n.tag_name().name() == "entry"
                && n.tag_name().namespace() == Some(ATOM_NS)
        })
        .filter_map(parse_entry)
        .collect();
    Ok(papers)
}

fn parse_entry(entry: roxmltree::Node) -> Option<Paper> {
    let atom_child_text = |name: &str| -> Option<String> {
        entry
            .children()
            .find(|n| {
                n.is_element()
                    && n.tag_name().name() == name
                    && n.tag_name().namespace() == Some(ATOM_NS)
            })
            .and_then(|n| n.text())
            .map(squish)
    };

    let id_url = atom_child_text("id")?;
    let arxiv_id = id_url
        .rsplit('/')
        .next()?
        .split('v')
        .next()?
        .to_string();

    let title = atom_child_text("title")?;
    let abstract_ = atom_child_text("summary");
    let published_at = atom_child_text("published");

    let authors: Vec<String> = entry
        .children()
        .filter(|n| {
            n.is_element()
                && n.tag_name().name() == "author"
                && n.tag_name().namespace() == Some(ATOM_NS)
        })
        .filter_map(|a| {
            a.children()
                .find(|n| {
                    n.is_element()
                        && n.tag_name().name() == "name"
                        && n.tag_name().namespace() == Some(ATOM_NS)
                })
                .and_then(|n| n.text())
                .map(|s| s.trim().to_string())
        })
        .collect();

    let source_url = entry
        .children()
        .filter(|n| {
            n.is_element()
                && n.tag_name().name() == "link"
                && n.tag_name().namespace() == Some(ATOM_NS)
        })
        .find(|n| {
            n.attribute("rel") == Some("alternate") && n.attribute("type") == Some("text/html")
        })
        .and_then(|n| n.attribute("href"))
        .map(String::from);

    let doi = entry
        .children()
        .find(|n| {
            n.is_element()
                && n.tag_name().name() == "doi"
                && n.tag_name().namespace() == Some(ARXIV_NS)
        })
        .and_then(|n| n.text())
        .map(|s| s.trim().to_string());

    Some(Paper {
        id: format!("p-arxiv-{}", arxiv_id),
        title,
        authors,
        abstract_,
        doi,
        source: "arxiv".to_string(),
        source_id: Some(arxiv_id),
        source_url,
        published_at,
        pdf_path: None,
        read_status: "unread".to_string(),
        created_at: String::new(),
        updated_at: String::new(),
    })
}

/// Collapse all whitespace runs into single spaces, trim ends.
/// arXiv titles/summaries are often line-wrapped with random indentation.
fn squish(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
  <entry>
    <id>http://arxiv.org/abs/1706.03762v5</id>
    <published>2017-06-12T17:57:00Z</published>
    <updated>2017-12-06T18:31:25Z</updated>
    <title>
      Attention Is All You Need
    </title>
    <summary>
      The dominant sequence transduction models are based on complex
      recurrent or convolutional neural networks. We propose a new simple
      network architecture, the Transformer.
    </summary>
    <author><name>Ashish Vaswani</name></author>
    <author><name>Noam Shazeer</name></author>
    <link rel="alternate" type="text/html" href="http://arxiv.org/abs/1706.03762v5"/>
    <link title="pdf" rel="related" type="application/pdf" href="http://arxiv.org/pdf/1706.03762v5"/>
    <arxiv:doi>10.48550/arXiv.1706.03762</arxiv:doi>
    <category term="cs.CL"/>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2302.13971v1</id>
    <published>2023-02-27T18:25:00Z</published>
    <title>LLaMA: Open and Efficient Foundation Language Models</title>
    <summary>We introduce LLaMA.</summary>
    <author><name>Hugo Touvron</name></author>
    <link rel="alternate" type="text/html" href="http://arxiv.org/abs/2302.13971v1"/>
  </entry>
</feed>"#;

    #[test]
    fn parses_two_entries() {
        let papers = parse_atom(SAMPLE).expect("parse");
        assert_eq!(papers.len(), 2);
    }

    #[test]
    fn extracts_full_first_entry() {
        let papers = parse_atom(SAMPLE).expect("parse");
        let p = &papers[0];
        assert_eq!(p.id, "p-arxiv-1706.03762");
        assert_eq!(p.title, "Attention Is All You Need");
        assert_eq!(p.authors, vec!["Ashish Vaswani", "Noam Shazeer"]);
        assert_eq!(p.source, "arxiv");
        assert_eq!(p.source_id.as_deref(), Some("1706.03762"));
        assert_eq!(
            p.source_url.as_deref(),
            Some("http://arxiv.org/abs/1706.03762v5")
        );
        assert_eq!(p.doi.as_deref(), Some("10.48550/arXiv.1706.03762"));
        assert_eq!(p.published_at.as_deref(), Some("2017-06-12T17:57:00Z"));
        assert!(p.abstract_.as_deref().unwrap().starts_with("The dominant"));
        // squish collapsed the multi-line summary
        assert!(!p.abstract_.as_deref().unwrap().contains('\n'));
    }

    #[test]
    fn missing_doi_is_none() {
        let papers = parse_atom(SAMPLE).expect("parse");
        assert!(papers[1].doi.is_none());
    }

    #[test]
    fn squish_collapses_whitespace() {
        assert_eq!(squish("  a   b\n  c "), "a b c");
    }
}
