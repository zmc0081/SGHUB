use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Paper {
    pub id: String,
    pub title: String,
    pub authors: Vec<String>,
    #[serde(rename = "abstract")]
    pub abstract_: Option<String>,
    pub doi: Option<String>,
    pub source: String,
    pub source_id: Option<String>,
    pub source_url: Option<String>,
    pub published_at: Option<String>,
    pub pdf_path: Option<String>,
    pub read_status: String,
    pub created_at: String,
    pub updated_at: String,
}

pub fn mock_papers() -> Vec<Paper> {
    vec![
        Paper {
            id: "p-arxiv-1706.03762".into(),
            title: "Attention Is All You Need".into(),
            authors: vec![
                "Ashish Vaswani".into(),
                "Noam Shazeer".into(),
                "Niki Parmar".into(),
                "Jakob Uszkoreit".into(),
                "Llion Jones".into(),
                "Aidan N. Gomez".into(),
                "Łukasz Kaiser".into(),
                "Illia Polosukhin".into(),
            ],
            abstract_: Some(
                "The dominant sequence transduction models are based on complex recurrent or \
                 convolutional neural networks. We propose a new simple network architecture, \
                 the Transformer, based solely on attention mechanisms, dispensing with \
                 recurrence and convolutions entirely."
                    .into(),
            ),
            doi: Some("10.48550/arXiv.1706.03762".into()),
            source: "arxiv".into(),
            source_id: Some("1706.03762".into()),
            source_url: Some("https://arxiv.org/abs/1706.03762".into()),
            published_at: Some("2017-06-12T17:57:00Z".into()),
            pdf_path: None,
            read_status: "read".into(),
            created_at: "2026-04-28T10:00:00Z".into(),
            updated_at: "2026-04-28T10:00:00Z".into(),
        },
        Paper {
            id: "p-arxiv-1810.04805".into(),
            title: "BERT: Pre-training of Deep Bidirectional Transformers for Language \
                    Understanding"
                .into(),
            authors: vec![
                "Jacob Devlin".into(),
                "Ming-Wei Chang".into(),
                "Kenton Lee".into(),
                "Kristina Toutanova".into(),
            ],
            abstract_: Some(
                "We introduce a new language representation model called BERT, which stands for \
                 Bidirectional Encoder Representations from Transformers. Unlike recent language \
                 representation models, BERT is designed to pre-train deep bidirectional \
                 representations from unlabeled text."
                    .into(),
            ),
            doi: Some("10.48550/arXiv.1810.04805".into()),
            source: "arxiv".into(),
            source_id: Some("1810.04805".into()),
            source_url: Some("https://arxiv.org/abs/1810.04805".into()),
            published_at: Some("2018-10-11T00:50:00Z".into()),
            pdf_path: None,
            read_status: "reading".into(),
            created_at: "2026-04-28T10:05:00Z".into(),
            updated_at: "2026-04-29T14:20:00Z".into(),
        },
        Paper {
            id: "p-arxiv-2005.14165".into(),
            title: "Language Models are Few-Shot Learners".into(),
            authors: vec![
                "Tom B. Brown".into(),
                "Benjamin Mann".into(),
                "Nick Ryder".into(),
                "Melanie Subbiah".into(),
                "Jared Kaplan".into(),
                "et al.".into(),
            ],
            abstract_: Some(
                "Recent work has demonstrated substantial gains on many NLP tasks and benchmarks \
                 by pre-training on a large corpus of text followed by fine-tuning on a specific \
                 task. We show that scaling up language models greatly improves task-agnostic, \
                 few-shot performance."
                    .into(),
            ),
            doi: Some("10.48550/arXiv.2005.14165".into()),
            source: "arxiv".into(),
            source_id: Some("2005.14165".into()),
            source_url: Some("https://arxiv.org/abs/2005.14165".into()),
            published_at: Some("2020-05-28T17:29:00Z".into()),
            pdf_path: None,
            read_status: "unread".into(),
            created_at: "2026-04-29T09:12:00Z".into(),
            updated_at: "2026-04-29T09:12:00Z".into(),
        },
        Paper {
            id: "p-arxiv-2305.18290".into(),
            title: "Direct Preference Optimization: Your Language Model is Secretly a Reward \
                    Model"
                .into(),
            authors: vec![
                "Rafael Rafailov".into(),
                "Archit Sharma".into(),
                "Eric Mitchell".into(),
                "Stefano Ermon".into(),
                "Christopher D. Manning".into(),
                "Chelsea Finn".into(),
            ],
            abstract_: Some(
                "While large-scale unsupervised language models learn broad world knowledge, \
                 precise control of their behavior is difficult. We introduce a new \
                 parameterization of the reward model in RLHF that enables extraction of the \
                 corresponding optimal policy in closed form."
                    .into(),
            ),
            doi: Some("10.48550/arXiv.2305.18290".into()),
            source: "arxiv".into(),
            source_id: Some("2305.18290".into()),
            source_url: Some("https://arxiv.org/abs/2305.18290".into()),
            published_at: Some("2023-05-29T17:57:00Z".into()),
            pdf_path: None,
            read_status: "parsed".into(),
            created_at: "2026-04-29T11:30:00Z".into(),
            updated_at: "2026-04-30T08:15:00Z".into(),
        },
        Paper {
            id: "p-pubmed-37301754".into(),
            title: "AlphaFold and the future of structural biology".into(),
            authors: vec!["John Jumper".into(), "Demis Hassabis".into()],
            abstract_: Some(
                "AlphaFold has reshaped structural biology by predicting protein structures from \
                 sequence with near-experimental accuracy. We discuss applications and \
                 limitations across drug discovery and basic research."
                    .into(),
            ),
            doi: Some("10.1038/s41586-023-06291-2".into()),
            source: "pubmed".into(),
            source_id: Some("37301754".into()),
            source_url: Some("https://pubmed.ncbi.nlm.nih.gov/37301754/".into()),
            published_at: Some("2023-06-08T00:00:00Z".into()),
            pdf_path: None,
            read_status: "unread".into(),
            created_at: "2026-04-29T16:00:00Z".into(),
            updated_at: "2026-04-29T16:00:00Z".into(),
        },
        Paper {
            id: "p-arxiv-2302.13971".into(),
            title: "LLaMA: Open and Efficient Foundation Language Models".into(),
            authors: vec![
                "Hugo Touvron".into(),
                "Thibaut Lavril".into(),
                "Gautier Izacard".into(),
                "Xavier Martinet".into(),
                "et al.".into(),
            ],
            abstract_: Some(
                "We introduce LLaMA, a collection of foundation language models ranging from 7B \
                 to 65B parameters. We train our models on trillions of tokens, and show that it \
                 is possible to train state-of-the-art models using publicly available datasets \
                 exclusively."
                    .into(),
            ),
            doi: Some("10.48550/arXiv.2302.13971".into()),
            source: "arxiv".into(),
            source_id: Some("2302.13971".into()),
            source_url: Some("https://arxiv.org/abs/2302.13971".into()),
            published_at: Some("2023-02-27T18:25:00Z".into()),
            pdf_path: None,
            read_status: "unread".into(),
            created_at: "2026-04-30T07:45:00Z".into(),
            updated_at: "2026-04-30T07:45:00Z".into(),
        },
    ]
}

#[tauri::command]
pub async fn search_papers(
    query: String,
    source: String,
    limit: u32,
) -> Result<Vec<Paper>, String> {
    let q = query.trim().to_lowercase();
    let papers: Vec<Paper> = mock_papers()
        .into_iter()
        .filter(|p| source == "all" || source.is_empty() || p.source == source)
        .filter(|p| {
            if q.is_empty() {
                return true;
            }
            p.title.to_lowercase().contains(&q)
                || p.authors.iter().any(|a| a.to_lowercase().contains(&q))
                || p.abstract_
                    .as_deref()
                    .map(|a| a.to_lowercase().contains(&q))
                    .unwrap_or(false)
        })
        .take(limit as usize)
        .collect();
    Ok(papers)
}
