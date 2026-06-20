// V2.2.6 — persistent search state.
//
// The 文献检索 page previously held its query / filters / results in
// component-local `useState`, so navigating to another menu unmounted the
// page and wiped everything. Lifting that state here lets it survive route
// changes: leaving and returning to /search restores the last query, source,
// filters, result list and scroll position. `loading` stays component-local
// (a transient spinner should never be "restored").
import { create } from "zustand";
import type { Paper } from "../lib/tauri";

interface SearchState {
  query: string;
  source: string;
  timeRange: string;
  sortBy: string;
  papers: Paper[];
  error: string | null;
  duration: number | null;
  /** True once a search has actually run — lets the page tell "no results"
   *  apart from "never searched" for the empty-state copy. */
  hasSearched: boolean;
  /** Last scroll offset of the results viewport, restored on return. */
  scrollTop: number;

  setQuery: (q: string) => void;
  setSource: (s: string) => void;
  setTimeRange: (t: string) => void;
  setSortBy: (s: string) => void;
  setResults: (papers: Paper[], duration: number) => void;
  setError: (e: string | null) => void;
  setScrollTop: (n: number) => void;
  /** Patch a single result's `pdf_path` after it has been downloaded, so the
   *  card still shows "打开 PDF" (not "下载 PDF") after leaving and returning
   *  to the search page. */
  setPaperPdfPath: (paperId: string, pdfPath: string) => void;
  reset: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: "",
  source: "all",
  timeRange: "all",
  sortBy: "relevance",
  papers: [],
  error: null,
  duration: null,
  hasSearched: false,
  scrollTop: 0,

  setQuery: (query) => set({ query }),
  setSource: (source) => set({ source }),
  setTimeRange: (timeRange) => set({ timeRange }),
  setSortBy: (sortBy) => set({ sortBy }),
  setResults: (papers, duration) =>
    set({ papers, duration, error: null, hasSearched: true }),
  setError: (error) => set({ error }),
  setScrollTop: (scrollTop) => set({ scrollTop }),
  setPaperPdfPath: (paperId, pdfPath) =>
    set((s) => ({
      papers: s.papers.map((p) =>
        p.id === paperId ? { ...p, pdf_path: pdfPath } : p,
      ),
    })),
  reset: () =>
    set({
      query: "",
      papers: [],
      error: null,
      duration: null,
      hasSearched: false,
      scrollTop: 0,
    }),
}));
