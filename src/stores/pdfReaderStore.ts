// V2.2.6 — in-app PDF reader visibility + source.
//
// Any card (Search / Library / Feed) opens the reader by calling
// `openReader({ path, title, paperId })`. The overlay (mounted once in
// App) reads this store. `autoTranslate` is set when the entry was the
// 翻译 button so the translation panel opens immediately.
import { create } from "zustand";

export interface PdfSource {
  /** A `papers.pdf_path` value — absolute for downloaded PDFs, relative to
   *  the data dir for uploaded ones. The backend resolves both. */
  path: string;
  title: string;
  /** Paper id if this PDF belongs to a known paper (enables translation
   *  by paper_id); null for ad-hoc files. */
  paperId: string | null;
}

interface PdfReaderState {
  open: boolean;
  source: PdfSource | null;
  autoTranslate: boolean;
  openReader: (source: PdfSource, opts?: { translate?: boolean }) => void;
  close: () => void;
}

export const usePdfReaderStore = create<PdfReaderState>((set) => ({
  open: false,
  source: null,
  autoTranslate: false,
  openReader: (source, opts) =>
    set({ open: true, source, autoTranslate: !!opts?.translate }),
  close: () => set({ open: false, source: null, autoTranslate: false }),
}));
