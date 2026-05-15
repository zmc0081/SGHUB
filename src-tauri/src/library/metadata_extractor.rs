//! PDF metadata extraction for `upload_local_paper`.
//!
//! Three-step priority chain:
//!  1. `lopdf` parses the PDF's `Info` dictionary (/Title /Author /Subject).
//!     This is the cheapest path and works for ~70% of well-produced PDFs.
//!  2. Fallback to first-page text via `pdf_extract` + heuristics:
//!       - title    → biggest contiguous run in the top third
//!       - authors  → comma/`and`-separated names just below the title
//!       - abstract → text after the literal "Abstract" keyword
//!  3. Last resort: file stem as title, empty authors/abstract.
//!
//! `confidence` is a rough 0..=1 score the UI uses to decide whether to
//! pop the user-review modal. The thresholds:
//!   - ≥ 0.8  → trust silently
//!   - 0.5..  → import but flag for review
//!   - < 0.5  → import + force-show review form
//!
//! Tests below cover the heuristics with synthetic strings (since
//! generating real PDF fixtures inside a unit test is out of scope).

use std::path::Path;

use lopdf::Document;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartialMetadata {
    pub title: String,
    pub authors: Vec<String>,
    /// Stored separately so the frontend can render "extracted from PDF
    /// /Subject" vs "scraped from first page" if needed.
    #[serde(rename = "abstract")]
    pub abstract_: Option<String>,
    pub doi: Option<String>,
    /// 0..=1; lower means UI should force user review.
    pub confidence: f32,
    /// "pdf_info" | "first_page" | "filename"
    pub source: String,
}

impl PartialMetadata {
    pub fn needs_review(&self) -> bool {
        self.confidence < 0.5
    }
}

// ============================================================
// Public entry
// ============================================================

pub fn extract_pdf_metadata(file_path: &Path) -> Result<PartialMetadata, String> {
    // Step 1: lopdf /Info dictionary
    if let Some(meta) = try_pdf_info(file_path) {
        return Ok(meta);
    }
    // Step 2: first-page text heuristics
    if let Some(meta) = try_first_page(file_path) {
        return Ok(meta);
    }
    // Step 3: filename fallback
    Ok(filename_fallback(file_path))
}

// ============================================================
// Step 1 — PDF /Info dictionary
// ============================================================

fn try_pdf_info(file_path: &Path) -> Option<PartialMetadata> {
    let doc = Document::load(file_path).ok()?;
    let info = doc.trailer.get(b"Info").ok()?;
    let info_id = info.as_reference().ok()?;
    let info_obj = doc.get_object(info_id).ok()?;
    let info_dict = info_obj.as_dict().ok()?;

    let read_string = |key: &[u8]| -> Option<String> {
        info_dict
            .get(key)
            .ok()
            .and_then(|v| v.as_str().ok())
            .and_then(decode_pdf_string)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
    };

    let title = read_string(b"Title")?;
    let author_raw = read_string(b"Author").unwrap_or_default();
    let abstract_ = read_string(b"Subject");

    let authors = split_authors(&author_raw);

    // Confidence rule: title present is the baseline (0.6); a non-trivial
    // author list bumps to 0.85; an additional Subject (abstract) bumps to 0.9.
    let mut confidence = 0.6_f32;
    if !authors.is_empty() {
        confidence += 0.25;
    }
    if abstract_.is_some() {
        confidence += 0.05;
    }

    Some(PartialMetadata {
        title,
        authors,
        abstract_,
        doi: None,
        confidence: confidence.min(1.0),
        source: "pdf_info".into(),
    })
}

/// PDF strings can be UTF-16 BE (BOM 0xFE 0xFF) or Latin-1; decode best-effort.
fn decode_pdf_string(bytes: &[u8]) -> Option<String> {
    if bytes.len() >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF {
        // UTF-16 BE
        let u16s: Vec<u16> = bytes[2..]
            .chunks_exact(2)
            .map(|c| u16::from_be_bytes([c[0], c[1]]))
            .collect();
        String::from_utf16(&u16s).ok()
    } else {
        // Latin-1 / PDFDocEncoding (good-enough approximation for ASCII-heavy text)
        Some(bytes.iter().map(|&b| b as char).collect())
    }
}

// ============================================================
// Step 2 — First-page text heuristics
// ============================================================

fn try_first_page(file_path: &Path) -> Option<PartialMetadata> {
    let text = pdf_extract::extract_text(file_path).ok()?;
    if text.trim().is_empty() {
        return None;
    }

    // Take roughly the first page worth — pdf-extract doesn't expose
    // page boundaries, but the first ~3000 chars usually covers it.
    let first_page = &text[..text.len().min(3000)];
    let lines: Vec<&str> = first_page
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect();
    if lines.is_empty() {
        return None;
    }

    let (title, title_idx) = extract_title(&lines)?;
    let authors = extract_authors(&lines, title_idx);
    let abstract_ = extract_abstract(first_page);
    let doi = extract_doi(first_page);

    // Confidence: heuristic + non-trivial inputs raise it.
    let mut confidence = 0.3_f32;
    if title.split_whitespace().count() >= 3 {
        confidence += 0.1;
    }
    if !authors.is_empty() {
        confidence += 0.1;
    }
    if abstract_.is_some() {
        confidence += 0.05;
    }
    if doi.is_some() {
        confidence += 0.05;
    }

    Some(PartialMetadata {
        title,
        authors,
        abstract_,
        doi,
        confidence: confidence.min(1.0),
        source: "first_page".into(),
    })
}

/// Pick the longest line in the top third that looks like a title:
///   - 3+ words
///   - not all uppercase (would be a venue header)
///   - not starting with a digit or section marker
fn extract_title(lines: &[&str]) -> Option<(String, usize)> {
    let cutoff = (lines.len() / 3).max(3).min(lines.len());
    let mut best: Option<(usize, usize, &str)> = None; // (len, idx, line)
    for (i, line) in lines.iter().take(cutoff).enumerate() {
        let words = line.split_whitespace().count();
        let starts_bad = line
            .chars()
            .next()
            .is_some_and(|c| c.is_ascii_digit() || c == '#' || c == '§');
        let all_caps_short = line.len() < 40
            && line.chars().filter(|c| c.is_alphabetic()).all(|c| c.is_uppercase());
        if words < 3 || starts_bad || all_caps_short {
            continue;
        }
        if best.map(|b| b.0 < line.len()).unwrap_or(true) {
            best = Some((line.len(), i, line));
        }
    }
    best.map(|(_, i, l)| (l.to_string(), i))
}

/// Read the 2–3 lines after the title; join them and split on `,` / ` and `.
fn extract_authors(lines: &[&str], title_idx: usize) -> Vec<String> {
    let start = title_idx + 1;
    let end = (start + 3).min(lines.len());
    if start >= end {
        return Vec::new();
    }
    let block: String = lines[start..end].join(" ");
    split_authors(&block)
}

fn split_authors(raw: &str) -> Vec<String> {
    // Strip affiliation marks like superscripts and footnotes.
    let cleaned: String = raw
        .chars()
        .filter(|&c| !matches!(c, '*' | '†' | '‡' | '§' | '¶' | '|') && !c.is_ascii_digit())
        .collect();
    let separators: &[_] = &[',', ';'];
    let mut out: Vec<String> = cleaned
        .split(separators)
        .flat_map(|chunk| chunk.split(" and "))
        .map(|s| s.trim().trim_end_matches('.').to_string())
        .filter(|s| {
            // Author-ish: 2..5 words, no email, no @
            let words = s.split_whitespace().count();
            (2..=5).contains(&words)
                && !s.contains('@')
                && !s.to_lowercase().contains("abstract")
        })
        .collect();
    out.dedup();
    out
}

fn extract_abstract(text: &str) -> Option<String> {
    let lower = text.to_lowercase();
    let key = lower.find("abstract")?;
    let after = &text[key..];
    // Skip the "Abstract" word + optional punctuation.
    let rest = after
        .trim_start_matches(|c: char| c.is_alphabetic())
        .trim_start_matches([':', '.', '—', '-', ' ', '\t', '\n']);
    let para_end = rest.find("\n\n").unwrap_or(rest.len().min(1500));
    let cand = rest[..para_end].trim();
    // 12-word floor — rejects "Abstract: TODO" style placeholders but
    // keeps short conference abstracts (50–100 chars) intact.
    if cand.split_whitespace().count() < 12 {
        return None;
    }
    Some(cand.to_string())
}

fn extract_doi(text: &str) -> Option<String> {
    // Common DOI pattern: 10.<registrant>/<suffix>
    let bytes = text.as_bytes();
    let mut i = 0;
    while i + 4 < bytes.len() {
        if &bytes[i..i + 3] == b"10." {
            let mut j = i + 3;
            while j < bytes.len() && bytes[j].is_ascii_digit() {
                j += 1;
            }
            if j < bytes.len() && bytes[j] == b'/' && j - i >= 5 {
                let mut k = j + 1;
                while k < bytes.len()
                    && !bytes[k].is_ascii_whitespace()
                    && !matches!(bytes[k], b',' | b';' | b')' | b']')
                {
                    k += 1;
                }
                if let Ok(s) = std::str::from_utf8(&bytes[i..k]) {
                    return Some(s.trim_end_matches('.').to_string());
                }
            }
        }
        i += 1;
    }
    None
}

// ============================================================
// Step 3 — Filename fallback
// ============================================================

fn filename_fallback(file_path: &Path) -> PartialMetadata {
    let stem = file_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("untitled")
        .replace(['_', '-'], " ");
    PartialMetadata {
        title: stem,
        authors: Vec::new(),
        abstract_: None,
        doi: None,
        confidence: 0.2,
        source: "filename".into(),
    }
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_authors_handles_commas_and_and() {
        let v = split_authors("Alice Smith, Bob Jones and Carol Doe");
        assert_eq!(v, vec!["Alice Smith", "Bob Jones", "Carol Doe"]);
    }

    #[test]
    fn split_authors_strips_affiliation_marks() {
        let v = split_authors("Alice Smith*, Bob Jones†1");
        assert_eq!(v, vec!["Alice Smith", "Bob Jones"]);
    }

    #[test]
    fn split_authors_filters_out_emails_and_too_short() {
        let v = split_authors("foo, Alice Smith, alice@bar.com");
        assert_eq!(v, vec!["Alice Smith"]);
    }

    #[test]
    fn extract_doi_finds_common_pattern() {
        let t = "Cite this: doi:10.1145/3340531.3411904  Conference 2024";
        assert_eq!(
            extract_doi(t).as_deref(),
            Some("10.1145/3340531.3411904")
        );
    }

    #[test]
    fn extract_doi_skips_trailing_period() {
        let t = "DOI 10.1234/abc.def.";
        assert_eq!(extract_doi(t).as_deref(), Some("10.1234/abc.def"));
    }

    #[test]
    fn extract_abstract_after_keyword() {
        let body = "Header\n\nAbstract: This paper presents a novel framework for \
                    aligning large language models via supervised reinforcement, \
                    showing material gains over baselines.\n\nIntroduction text…";
        let abs = extract_abstract(body).unwrap();
        assert!(abs.starts_with("This paper presents"));
        // Threshold is 12 words; this abstract has 19.
        assert!(abs.split_whitespace().count() >= 12);
    }

    #[test]
    fn extract_abstract_rejects_too_short() {
        let body = "Abstract: Too short.";
        assert!(extract_abstract(body).is_none());
    }

    #[test]
    fn extract_title_picks_longest_top_third_line() {
        let lines = vec![
            "Proceedings of XYZ Workshop",
            "On the Convergence of Stochastic Optimization Methods",
            "Author Name",
            "Affiliation",
            "Abstract",
            "We study the convergence behavior of …",
        ];
        let (t, idx) = extract_title(&lines).unwrap();
        assert_eq!(t, "On the Convergence of Stochastic Optimization Methods");
        assert_eq!(idx, 1);
    }

    #[test]
    fn decode_pdf_string_utf16be_with_bom() {
        let bytes: Vec<u8> = vec![0xFE, 0xFF, 0x00, 0x48, 0x00, 0x69]; // "Hi"
        assert_eq!(decode_pdf_string(&bytes).as_deref(), Some("Hi"));
    }

    #[test]
    fn filename_fallback_replaces_separators() {
        let p = std::path::PathBuf::from("/tmp/my_great-paper.pdf");
        let m = filename_fallback(&p);
        assert_eq!(m.title, "my great paper");
        assert_eq!(m.confidence, 0.2);
        assert!(m.needs_review());
    }

    #[test]
    fn confidence_threshold_marks_low_for_review() {
        let m = PartialMetadata {
            title: "x".into(),
            authors: vec![],
            abstract_: None,
            doi: None,
            confidence: 0.49,
            source: "first_page".into(),
        };
        assert!(m.needs_review());
        let m2 = PartialMetadata { confidence: 0.5, ..m };
        assert!(!m2.needs_review());
    }
}
