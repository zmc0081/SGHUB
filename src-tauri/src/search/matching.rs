//! Search matching helpers (V2.2.3 / Session 33).
//!
//! Two jobs:
//!   1. Recognise a DOI in user input (raw, `doi:`-prefixed, a URL, or buried
//!      in a pasted citation) so we can route to exact-DOI lookups.
//!   2. Normalise titles for cross-source "is this the same paper?" matching,
//!      so case / punctuation differences (e.g. "Models for Exceedances over
//!      High Thresholds" vs "models for exceedances over high thresholds.")
//!      don't cause misses.
//!
//! No regex crate is in the dependency set, so the DOI matcher is hand-rolled
//! against the spec pattern `^10\.\d{4,9}/[-._;()/:a-zA-Z0-9]+$`.

use std::collections::HashSet;

/// Jaccard similarity at/above which two normalized titles are the same work.
pub const TITLE_SIM_THRESHOLD: f64 = 0.82;

/// Common English stop words dropped from titles before matching/keyword
/// extraction. Lower-case; matched against already-lower-cased tokens.
const STOPWORDS: &[&str] = &[
    "a", "an", "the", "of", "for", "and", "or", "on", "in", "to", "with", "is", "are", "be", "by",
    "from", "as", "at", "via", "into", "over", "under", "between",
];

fn is_doi_suffix_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || matches!(c, '-' | '.' | '_' | ';' | '(' | ')' | '/' | ':')
}

/// True when `s` is *exactly* a DOI per `^10\.\d{4,9}/[allowed]+$`.
fn is_doi(s: &str) -> bool {
    let Some(rest) = s.strip_prefix("10.") else {
        return false;
    };
    let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
    if !(4..=9).contains(&digits.len()) {
        return false;
    }
    let after = &rest[digits.len()..];
    let Some(suffix) = after.strip_prefix('/') else {
        return false;
    };
    !suffix.is_empty() && suffix.chars().all(is_doi_suffix_char)
}

/// Trailing characters commonly glued onto a DOI by citation punctuation.
fn trim_citation_trailing(s: &str) -> &str {
    s.trim_end_matches(['.', ',', ';', ']', '>'])
}

/// Pull a DOI out of arbitrary user input:
/// - a bare DOI, optionally `doi:`-prefixed or as a doi.org URL, or
/// - the first DOI-looking token inside a pasted citation string.
///
/// Returns the canonical `10.xxxx/...` form (no prefix).
pub fn extract_doi(input: &str) -> Option<String> {
    let mut s = input.trim();
    for p in [
        "doi:",
        "DOI:",
        "doi.org/",
        "https://doi.org/",
        "http://doi.org/",
        "https://dx.doi.org/",
    ] {
        if let Some(stripped) = s.strip_prefix(p) {
            s = stripped.trim();
        }
    }
    if is_doi(s) {
        return Some(s.to_string());
    }
    // Scan for a DOI embedded in a longer string (pasted citation).
    for (i, _) in s.match_indices("10.") {
        let token: String = s[i..].chars().take_while(|c| !c.is_whitespace()).collect();
        let token = trim_citation_trailing(&token);
        if is_doi(token) {
            return Some(token.to_string());
        }
    }
    None
}

/// Normalize a title for cross-source equality: lower-case, drop punctuation,
/// remove stop words, collapse whitespace.
pub fn normalize_title(title: &str) -> String {
    let lowered = title.to_lowercase();
    let cleaned: String = lowered
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { ' ' })
        .collect();
    cleaned
        .split_whitespace()
        .filter(|w| !STOPWORDS.contains(w))
        .collect::<Vec<_>>()
        .join(" ")
}

/// Jaccard similarity (0.0..=1.0) over the normalized token sets of two titles.
pub fn title_similarity(a: &str, b: &str) -> f64 {
    let na = normalize_title(a);
    let nb = normalize_title(b);
    if na.is_empty() || nb.is_empty() {
        return 0.0;
    }
    if na == nb {
        return 1.0;
    }
    let sa: HashSet<&str> = na.split_whitespace().collect();
    let sb: HashSet<&str> = nb.split_whitespace().collect();
    let inter = sa.intersection(&sb).count();
    let union = sa.union(&sb).count();
    if union == 0 {
        0.0
    } else {
        inter as f64 / union as f64
    }
}

/// Whether two titles refer to the same work (similarity ≥ threshold).
pub fn same_title(a: &str, b: &str) -> bool {
    title_similarity(a, b) >= TITLE_SIM_THRESHOLD
}

/// Significant words of a title (stop words removed), space-joined. Used to
/// build a looser query for sources that match long exact phrases poorly.
pub fn extract_keywords(title: &str) -> String {
    normalize_title(title)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_bare_doi() {
        assert_eq!(
            extract_doi("10.1111/j.2517-6161.1990.tb01796.x").as_deref(),
            Some("10.1111/j.2517-6161.1990.tb01796.x")
        );
        assert_eq!(
            extract_doi("10.1080/03461238.2012.00033").as_deref(),
            Some("10.1080/03461238.2012.00033")
        );
    }

    #[test]
    fn strips_prefixes_and_urls() {
        assert_eq!(
            extract_doi("doi:10.1000/xyz123").as_deref(),
            Some("10.1000/xyz123")
        );
        assert_eq!(
            extract_doi("https://doi.org/10.1000/xyz123").as_deref(),
            Some("10.1000/xyz123")
        );
        assert_eq!(
            extract_doi("  DOI: 10.1000/xyz123  ").as_deref(),
            Some("10.1000/xyz123")
        );
    }

    #[test]
    fn extracts_doi_from_citation() {
        let cite = "Davison, A. C., & Smith, R. L. (1990). Models for Exceedances over High \
                    Thresholds. JRSS-B. https://doi.org/10.1111/j.2517-6161.1990.tb01796.x.";
        assert_eq!(
            extract_doi(cite).as_deref(),
            Some("10.1111/j.2517-6161.1990.tb01796.x")
        );
    }

    #[test]
    fn rejects_non_dois() {
        assert!(extract_doi("extreme value threshold").is_none());
        assert!(extract_doi("10.12").is_none()); // too few registrant digits / no slash
        assert!(extract_doi("10.1234").is_none()); // no slash + suffix
        assert!(extract_doi("11.1234/x").is_none()); // must start with 10.
    }

    #[test]
    fn normalize_drops_case_punct_and_stopwords() {
        assert_eq!(
            normalize_title("Models for Exceedances over High Thresholds"),
            "models exceedances high thresholds"
        );
        assert_eq!(
            normalize_title("models   for exceedances OVER high thresholds."),
            "models exceedances high thresholds"
        );
    }

    #[test]
    fn similarity_matches_punctuation_variants() {
        assert!(same_title(
            "Models for Exceedances over High Thresholds",
            "models for exceedances over high thresholds."
        ));
        assert!(same_title(
            "A Review of Extreme Value Threshold Estimation and Uncertainty Quantification",
            "A review of extreme-value threshold estimation & uncertainty quantification"
        ));
    }

    #[test]
    fn similarity_rejects_different_papers() {
        assert!(!same_title(
            "Attention Is All You Need",
            "Models for Exceedances over High Thresholds"
        ));
    }

    #[test]
    fn keywords_strip_stopwords() {
        assert_eq!(
            extract_keywords("A Review of Extreme Value Threshold Estimation"),
            "review extreme value threshold estimation"
        );
    }
}
