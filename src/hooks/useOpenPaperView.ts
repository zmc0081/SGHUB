// V2.2.10 (Session 48, R2) — shared "open this paper in the built-in reader"
// logic for TITLE clicks across Search / Feed / Library. Availability matches
// the 查看 button (R1): local PDF opens directly; an OA paper downloads first
// (the card's PaperActions shows the progress via the global
// `download:progress` event); otherwise a toast explains there's nothing to
// read. Kept as a hook so every card gets identical behaviour.
import { useRef } from "react";
import { type Paper } from "../lib/tauri";
import { isLikelyOA } from "../components/PaperActions";
import { usePdfReaderStore } from "../stores/pdfReaderStore";
import { useAppNavigation } from "./useAppNavigation";
import { useT } from "./useT";
import { useToast } from "./useToast";

/** Same gate as the 查看 button: readable now, or fetchable (OA). */
export function canViewPaper(paper: Paper): boolean {
  return !!paper.pdf_path || isLikelyOA(paper);
}

export function useOpenPaperView() {
  const t = useT();
  const toast = useToast();
  const nav = useAppNavigation();
  // Guard against double-clicks racing a download per paper.
  const busyRef = useRef<Set<string>>(new Set());

  const openPaper = async (paper: Paper) => {
    if (busyRef.current.has(paper.id)) return;
    let path = paper.pdf_path;
    if (!path) {
      if (!isLikelyOA(paper)) {
        toast.info(t("paper_actions.view_no_pdf"));
        return;
      }
      busyRef.current.add(paper.id);
      try {
        // Progress shows on the card's PaperActions (same download event).
        path = await nav.downloadPaperPdf(paper.id);
      } catch (e) {
        toast.danger(String(e));
        return;
      } finally {
        busyRef.current.delete(paper.id);
      }
    }
    usePdfReaderStore.getState().openReader({
      path,
      title: paper.title,
      paperId: paper.id,
    });
  };

  return { openPaper, canViewPaper };
}
