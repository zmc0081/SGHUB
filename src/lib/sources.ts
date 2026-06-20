// V2.2.6 — single source of truth for the 8 literature sources.
//
// Both Literature Search and Today's Feed (and the Settings "文献数据源管理"
// card) import this so the source list can never drift between modules again.
// Which sources are *enabled* is a global, backend-persisted toggle
// (get_enabled_sources / set_enabled_sources); an EMPTY enabled list means
// "all enabled" (matches the backend convention).

export interface SourceDef {
  value: string;
  /** Brand name — not localized (matches the source-badge labels). */
  label: string;
  /** i18n key under `sources.group_*` for the Settings grouping header. */
  groupKey: string;
}

export const ALL_SOURCES: SourceDef[] = [
  { value: "arxiv", label: "arXiv", groupKey: "sources.group_general" },
  { value: "semantic_scholar", label: "Semantic Scholar", groupKey: "sources.group_general" },
  { value: "pubmed", label: "PubMed", groupKey: "sources.group_general" },
  { value: "openalex", label: "OpenAlex", groupKey: "sources.group_general" },
  { value: "crossref", label: "Crossref", groupKey: "sources.group_general" },
  { value: "core", label: "CORE", groupKey: "sources.group_oa" },
  { value: "doaj", label: "DOAJ", groupKey: "sources.group_oa" },
  { value: "dblp", label: "DBLP", groupKey: "sources.group_cs" },
];

export const ALL_SOURCE_VALUES: string[] = ALL_SOURCES.map((s) => s.value);

/** Empty enabled list = all enabled (backend convention). */
export function isSourceEnabled(enabled: string[], value: string): boolean {
  return enabled.length === 0 || enabled.includes(value);
}

/** Resolve a stored enabled list to the concrete set of enabled source ids
 *  (expands the "empty = all" convention). */
export function resolveEnabledSources(enabled: string[]): string[] {
  return enabled.length === 0 ? [...ALL_SOURCE_VALUES] : enabled;
}
