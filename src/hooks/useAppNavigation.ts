/**
 * Cross-module navigation helper.
 *
 * Centralizes everything that moves the user (or a paper) between pages:
 * - openParseWithPaper  → /parse?paper_id=...&skill=...
 * - openExternal        → opener::open in Rust (OS browser)
 * - downloadPaperPdf    → streaming download with `download:progress` events
 *
 * Components subscribe to the returned `api` shape; the underlying calls
 * are deliberately not memoized (TanStack `navigate` is stable, the Tauri
 * `api.*` functions are module-level singletons).
 */

import { useNavigate } from "@tanstack/react-router";
import { api } from "../lib/tauri";

export interface OpenParseOptions {
  /** Preselect a Skill in the Parse page (otherwise default is kept). */
  skill?: string;
}

export function useAppNavigation() {
  const navigate = useNavigate();
  return {
    openParseWithPaper: (paperId: string, opts?: OpenParseOptions) =>
      navigate({
        to: "/parse",
        search: {
          paper_id: paperId,
          ...(opts?.skill ? { skill: opts.skill } : {}),
        },
      }),

    /**
     * Resolve the best external URL for a paper then open it in the OS
     * default browser. Returns the resolved URL (`null` when nothing is
     * usable — caller should show "无可用原文链接" toast).
     */
    openPaperExternal: async (paperId: string): Promise<string | null> => {
      const url = await api.resolvePaperUrl(paperId);
      if (url) await api.openExternalUrl(url);
      return url;
    },

    openExternal: (url: string) => api.openExternalUrl(url),

    downloadPaperPdf: (paperId: string) => api.downloadPaperPdf(paperId),

    cancelDownload: (paperId: string) => api.cancelDownload(paperId),

    openLocalPdf: (path: string) => api.openLocalPdf(path),
  };
}
