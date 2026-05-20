/**
 * PaperMetadataEditor — modal for confirming / correcting PDF-extracted
 * metadata. Opens automatically when `upload_local_paper` returns
 * `needs_user_review: true` (confidence < 0.5), or manually from Library
 * via the "重新提取元数据" action.
 *
 * The form is the source of truth while open; "保存" calls
 * `update_paper_metadata`. "跳过" closes without writing — the originally
 * extracted (low-confidence) row stays as-is and can be fixed later.
 */

// i18n: 本组件文案已国际化 (V2.1.0)
import { useEffect, useState } from "react";
import { AlertTriangle, FileText, Loader2, X } from "lucide-react";
import { api, type PartialMetadata } from "../lib/tauri";
import { useT } from "../hooks/useT";
import { BaseModal } from "./BaseModal";
import { Icon } from "./Icon";

interface Props {
  paperId: string;
  initial: PartialMetadata;
  /** Absolute / relative path the user can click to open the original PDF
   *  for cross-referencing while editing. */
  pdfPath?: string | null;
  onClose: () => void;
  onSaved?: () => void;
}

const SOURCE_KEY: Record<string, string> = {
  pdf_info: "paper_metadata_editor.source_pdf_info",
  first_page: "paper_metadata_editor.source_first_page",
  filename: "paper_metadata_editor.source_filename",
};

const CONFIDENCE_CELLS = 5;

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  const filled = Math.round(pct * CONFIDENCE_CELLS);
  const colorClass =
    pct >= 0.8
      ? "bg-success-fg"
      : pct >= 0.6
        ? "bg-warning-fg"
        : "bg-danger-fg";
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="inline-flex items-center gap-0.5"
    >
      {Array.from({ length: CONFIDENCE_CELLS }).map((_, i) => (
        <span
          key={i}
          className={`w-3 h-1.5 rounded-pill ${
            i < filled ? colorClass : "bg-border-strong"
          }`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export function PaperMetadataEditor({
  paperId,
  initial,
  pdfPath,
  onClose,
  onSaved,
}: Props) {
  const t = useT();
  const [title, setTitle] = useState(initial.title);
  const [authors, setAuthors] = useState<string[]>(initial.authors);
  const [abstract, setAbstract] = useState(initial.abstract ?? "");
  const [doi, setDoi] = useState(initial.doi ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setTitle(initial.title);
    setAuthors(initial.authors);
    setAbstract(initial.abstract ?? "");
    setDoi(initial.doi ?? "");
  }, [initial]);

  const updateAuthor = (idx: number, value: string) => {
    setAuthors((a) => a.map((v, i) => (i === idx ? value : v)));
  };
  const addAuthor = () => setAuthors((a) => [...a, ""]);
  const removeAuthor = (idx: number) =>
    setAuthors((a) => a.filter((_, i) => i !== idx));

  const titleMissing = !title.trim();

  const save = async () => {
    if (titleMissing) {
      setErr(t("paper_metadata_editor.validation_title_required"));
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const cleanAuthors = authors.map((s) => s.trim()).filter(Boolean);
      await api.updatePaperMetadata(
        paperId,
        title.trim(),
        cleanAuthors,
        abstract.trim() || null,
        doi.trim() || null,
      );
      onSaved?.();
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  };

  const confidencePct = Math.round(initial.confidence * 100);

  return (
    <BaseModal
      open
      onClose={() => !saving && onClose()}
      size="lg"
      closeOnEscape={!saving}
      closeOnBackdrop={!saving}
      title={t("paper_metadata_editor.title")}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill border border-border-default text-fg-1 bg-card hover:bg-navy-faint disabled:opacity-50 transition-colors duration-fast ease-khx font-medium text-caption"
          >
            {t("paper_metadata_editor.skip")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill shadow-btn bg-navy text-fg-inverse hover:bg-navy-hover disabled:opacity-50 transition-colors duration-fast ease-khx font-medium text-caption"
          >
            {saving && <Icon icon={Loader2} size="sm" className="animate-spin" />}
            {saving
              ? t("paper_metadata_editor.saving")
              : t("paper_metadata_editor.save")}
          </button>
        </>
      }
    >
      <div className="text-meta text-fg-2 mb-4 flex items-center gap-4 flex-wrap">
        <span>
          {t("paper_metadata_editor.extraction_source")}
          <strong className="ml-1 text-fg-1">
            {SOURCE_KEY[initial.source]
              ? t(SOURCE_KEY[initial.source])
              : initial.source}
          </strong>
        </span>
        <span className="inline-flex items-center gap-2">
          <span>{t("paper_metadata_editor.confidence_label")}</span>
          <ConfidenceBar value={initial.confidence} />
          <span className="tabular-nums">{confidencePct}%</span>
        </span>
        {pdfPath && (
          <button
            type="button"
            onClick={() => void api.openLocalPdf(pdfPath)}
            className="inline-flex items-center gap-1 text-indigo hover:text-indigo-hover transition-colors duration-fast ease-khx"
          >
            <Icon icon={FileText} size="xs" />
            <span>{t("paper_metadata_editor.view_original")}</span>
          </button>
        )}
      </div>

      <div className="space-y-4">
        <label className="block">
          <div className="text-caption font-medium text-fg-1 mb-2">
            {t("paper_metadata_editor.title_field")}
            <span aria-hidden className="text-danger-fg ml-1">
              *
            </span>
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-required="true"
            aria-invalid={titleMissing && err !== null}
            disabled={saving}
            className={`w-full px-input-x py-input-y rounded-pill border bg-card text-fg-1 placeholder:text-fg-3 transition-colors duration-fast ease-khx focus:outline-none ${
              titleMissing && err
                ? "border-danger-fg shadow-focus-danger"
                : "border-border-default focus:border-border-focus focus:shadow-focus"
            }`}
            style={{ fontSize: "13px" }}
          />
        </label>

        <div>
          <div className="text-caption font-medium text-fg-1 mb-2 flex items-center justify-between">
            <span>{t("paper_metadata_editor.authors_field")}</span>
          </div>
          <div className="flex flex-col gap-2">
            {authors.length === 0 && (
              <div className="text-meta text-fg-3 italic text-center py-2">
                {t("paper_metadata_editor.authors_empty")}
              </div>
            )}
            {authors.map((a, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={a}
                  onChange={(e) => updateAuthor(i, e.target.value)}
                  placeholder={t(
                    "paper_metadata_editor.first_last_placeholder",
                  )}
                  disabled={saving}
                  className="flex-1 px-input-x py-input-y rounded-pill border border-border-default bg-card text-fg-1 placeholder:text-fg-3 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
                  style={{ fontSize: "13px" }}
                />
                <button
                  type="button"
                  onClick={() => removeAuthor(i)}
                  aria-label={`Remove author ${i + 1}`}
                  className="w-9 h-9 rounded-pill flex items-center justify-center text-fg-2 hover:text-danger-fg hover:bg-danger-bg transition-colors duration-fast ease-khx"
                >
                  <Icon icon={X} size="sm" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addAuthor}
              className="w-full px-input-x py-input-y rounded-pill border border-dashed border-border-default text-caption text-fg-2 hover:text-indigo hover:border-indigo-muted transition-colors duration-fast ease-khx"
            >
              + {t("paper_metadata_editor.add_author")}
            </button>
          </div>
        </div>

        <label className="block">
          <div className="text-caption font-medium text-fg-1 mb-2">
            {t("paper_metadata_editor.abstract_field")}
          </div>
          <textarea
            value={abstract}
            onChange={(e) => setAbstract(e.target.value)}
            rows={5}
            disabled={saving}
            className="w-full px-textarea-x py-textarea-y rounded-card-sm border border-border-default bg-card text-fg-1 placeholder:text-fg-3 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx resize-y"
            style={{ fontSize: "13px", minHeight: "120px" }}
          />
        </label>

        <label className="block">
          <div className="text-caption font-medium text-fg-1 mb-2">
            {t("paper_metadata_editor.doi_field")}
          </div>
          <input
            value={doi}
            onChange={(e) => setDoi(e.target.value)}
            placeholder={t("paper_metadata_editor.doi_placeholder")}
            disabled={saving}
            className="w-full px-input-x py-input-y rounded-pill border border-border-default bg-card text-fg-1 placeholder:text-fg-3 font-mono focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
            style={{ fontSize: "13px" }}
          />
        </label>

        {err && (
          <div
            role="alert"
            className="text-caption text-danger-fg bg-danger-bg border border-danger-border rounded-card-sm px-4 py-3 flex items-start gap-2"
          >
            <Icon icon={AlertTriangle} size="sm" className="flex-shrink-0 mt-0.5" />
            <span>{err}</span>
          </div>
        )}
      </div>
    </BaseModal>
  );
}
