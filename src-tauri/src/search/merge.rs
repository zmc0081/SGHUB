//! Cross-source merge & metadata completion (V2.2.3 / Session 33).
//!
//! With 8 sources running concurrently, the same work commonly surfaces from
//! 4–5 of them, each with partial metadata (Semantic Scholar might list one
//! author, Crossref the full set; CORE alone has a full-text link). This
//! module collapses those into one enriched `Paper`:
//!
//!   - grouping key: exact DOI, else normalized title + year;
//!   - the first occurrence is the "primary" (source extension order decides
//!     which source represents the merged paper);
//!   - gaps are filled from whichever member has the value, preferring the
//!     most complete author list, the longest abstract, and CORE's full-text
//!     link;
//!   - `sources` records every source the work was found in.

use std::collections::HashMap;

use crate::search::matching;
use crate::search::Paper;

/// First 4 chars of an ISO date when they're a year, else "".
fn year_of(published_at: &Option<String>) -> String {
    published_at
        .as_deref()
        .filter(|s| s.len() >= 4 && s.as_bytes()[..4].iter().all(u8::is_ascii_digit))
        .map(|s| s[..4].to_string())
        .unwrap_or_default()
}

/// Merge papers that refer to the same work into one enriched record,
/// preserving the first-seen order of groups.
pub fn merge(papers: Vec<Paper>) -> Vec<Paper> {
    let mut groups: Vec<Vec<Paper>> = Vec::new();
    let mut doi_index: HashMap<String, usize> = HashMap::new();
    let mut title_index: HashMap<String, usize> = HashMap::new();

    for p in papers {
        let doi_key = p
            .doi
            .as_deref()
            .map(|d| d.trim().to_lowercase())
            .filter(|d| !d.is_empty());
        let nt = matching::normalize_title(&p.title);
        let title_key = if nt.is_empty() {
            None
        } else {
            Some(format!("{}|{}", nt, year_of(&p.published_at)))
        };

        let idx = doi_key
            .as_ref()
            .and_then(|d| doi_index.get(d).copied())
            .or_else(|| title_key.as_ref().and_then(|t| title_index.get(t).copied()));

        let i = match idx {
            Some(i) => {
                groups[i].push(p);
                i
            }
            None => {
                let i = groups.len();
                groups.push(vec![p]);
                i
            }
        };
        // Register both keys so a later member matching by either lands here.
        if let Some(d) = doi_key {
            doi_index.entry(d).or_insert(i);
        }
        if let Some(t) = title_key {
            title_index.entry(t).or_insert(i);
        }
    }

    groups.into_iter().map(merge_group).collect()
}

fn merge_group(group: Vec<Paper>) -> Paper {
    // Primary = first seen (keeps source priority order).
    let mut out = group[0].clone();

    // Most complete author list wins.
    if let Some(best) = group.iter().map(|p| &p.authors).max_by_key(|a| a.len()) {
        if best.len() > out.authors.len() {
            out.authors = best.clone();
        }
    }
    // Longest abstract wins.
    if let Some(best) = group
        .iter()
        .filter_map(|p| p.abstract_.as_ref())
        .max_by_key(|s| s.len())
    {
        if best.len() > out.abstract_.as_deref().map_or(0, str::len) {
            out.abstract_ = Some(best.clone());
        }
    }
    // Fill scalar gaps from any member.
    if out.doi.is_none() {
        out.doi = group.iter().find_map(|p| p.doi.clone());
    }
    if out.published_at.is_none() {
        out.published_at = group.iter().find_map(|p| p.published_at.clone());
    }
    if out.source_url.is_none() {
        out.source_url = group.iter().find_map(|p| p.source_url.clone());
    }
    // Full-text link: prefer CORE's, then any member's.
    out.fulltext_url = group
        .iter()
        .find(|p| p.source == "core")
        .and_then(|p| p.fulltext_url.clone())
        .or_else(|| group.iter().find_map(|p| p.fulltext_url.clone()));

    // Union of sources, first-seen order.
    let mut sources: Vec<String> = Vec::new();
    for p in &group {
        let list: &[String] = if p.sources.is_empty() {
            std::slice::from_ref(&p.source)
        } else {
            &p.sources
        };
        for s in list {
            if !sources.contains(s) {
                sources.push(s.clone());
            }
        }
    }
    out.sources = sources;
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn p(source: &str, title: &str, doi: Option<&str>, authors: &[&str]) -> Paper {
        Paper {
            id: format!("p-{}-{}", source, title),
            title: title.into(),
            doi: doi.map(String::from),
            source: source.into(),
            authors: authors.iter().map(|s| s.to_string()).collect(),
            sources: vec![source.into()],
            published_at: Some("2015-01-01T00:00:00Z".into()),
            ..Default::default()
        }
    }

    #[test]
    fn merges_same_doi_and_completes_authors() {
        // Semantic Scholar is primary (first) but missing the second author;
        // Crossref fills it in.
        let ss = p("semantic_scholar", "Some Work", Some("10.1/x"), &["Alice"]);
        let cr = p("crossref", "Some Work", Some("10.1/x"), &["Alice", "Bob"]);
        let out = merge(vec![ss, cr]);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].source, "semantic_scholar", "first seen is primary");
        assert_eq!(out[0].authors, vec!["Alice", "Bob"], "authors completed");
        assert_eq!(out[0].sources, vec!["semantic_scholar", "crossref"]);
    }

    #[test]
    fn merges_by_normalized_title_and_year_when_no_doi() {
        let a = p("arxiv", "Deep Learning", None, &["A"]);
        let b = p("openalex", "deep learning.", None, &["A", "B"]);
        let out = merge(vec![a, b]);
        assert_eq!(out.len(), 1, "case/punct title variants merge");
        assert_eq!(out[0].authors, vec!["A", "B"]);
        assert_eq!(out[0].sources, vec!["arxiv", "openalex"]);
    }

    #[test]
    fn prefers_core_fulltext_link() {
        let mut arx = p("arxiv", "W", Some("10.1/x"), &["A"]);
        arx.fulltext_url = Some("https://arxiv.org/pdf/x".into());
        let mut core = p("core", "W", Some("10.1/x"), &["A"]);
        core.fulltext_url = Some("https://core.ac.uk/download/x.pdf".into());
        let out = merge(vec![arx, core]);
        assert_eq!(out.len(), 1);
        assert_eq!(
            out[0].fulltext_url.as_deref(),
            Some("https://core.ac.uk/download/x.pdf"),
            "CORE full-text wins"
        );
    }

    #[test]
    fn keeps_distinct_papers_separate() {
        let a = p("arxiv", "Attention Is All You Need", Some("10.1/a"), &["A"]);
        let b = p("arxiv", "Models for Exceedances", Some("10.1/b"), &["B"]);
        assert_eq!(merge(vec![a, b]).len(), 2);
    }

    #[test]
    fn longest_abstract_wins() {
        let mut short = p("arxiv", "W", Some("10.1/x"), &["A"]);
        short.abstract_ = Some("short".into());
        let mut long = p("crossref", "W", Some("10.1/x"), &["A"]);
        long.abstract_ = Some("a considerably longer and more complete abstract".into());
        let out = merge(vec![short, long]);
        assert_eq!(
            out[0].abstract_.as_deref(),
            Some("a considerably longer and more complete abstract")
        );
    }
}
