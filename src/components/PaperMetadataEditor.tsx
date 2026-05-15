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

import { useEffect, useState } from "react";
import { api, type PartialMetadata } from "../lib/tauri";

interface Props {
  paperId: string;
  initial: PartialMetadata;
  /** Absolute / relative path the user can click to open the original PDF
   *  for cross-referencing while editing. */
  pdfPath?: string | null;
  onClose: () => void;
  onSaved?: () => void;
}

const SOURCE_LABEL: Record<string, string> = {
  pdf_info: "PDF /Info 字典",
  first_page: "首页文本启发式",
  filename: "文件名兜底",
};

export function PaperMetadataEditor({
  paperId,
  initial,
  pdfPath,
  onClose,
  onSaved,
}: Props) {
  const [title, setTitle] = useState(initial.title);
  const [authors, setAuthors] = useState<string[]>(initial.authors);
  const [abstract, setAbstract] = useState(initial.abstract ?? "");
  const [doi, setDoi] = useState(initial.doi ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Re-seed when the initial metadata changes (e.g. user clicks
  // "re-extract" then the modal stays open with the same paperId).
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

  const save = async () => {
    if (!title.trim()) {
      setErr("标题不能为空");
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
  const confColor =
    initial.confidence >= 0.8
      ? "text-emerald-600"
      : initial.confidence >= 0.5
        ? "text-amber-600"
        : "text-red-600";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-md shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-black/10">
          <div>
            <div className="text-sm font-semibold text-primary">补全文献元数据</div>
            <div className="text-[11px] text-app-fg/60 mt-1 flex items-center gap-3">
              <span>
                提取来源:
                <strong className="ml-1">
                  {SOURCE_LABEL[initial.source] ?? initial.source}
                </strong>
              </span>
              <span className={confColor}>
                置信度 <strong>{confidencePct}%</strong>
              </span>
              {pdfPath && (
                <button
                  onClick={() => void api.openLocalPdf(pdfPath)}
                  className="text-primary hover:underline"
                >
                  📄 对照原文
                </button>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-app-fg/50 hover:text-app-fg px-1"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <label className="block">
            <div className="text-xs text-app-fg/70 mb-1">标题 *</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm border border-black/10 rounded focus:outline-none focus:border-primary"
            />
          </label>

          <div>
            <div className="text-xs text-app-fg/70 mb-1 flex items-center justify-between">
              <span>作者列表</span>
              <button
                onClick={addAuthor}
                className="text-[11px] text-primary hover:underline"
              >
                + 添加
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {authors.length === 0 && (
                <div className="text-[11px] text-app-fg/40 italic">
                  暂无 — 点击「+ 添加」录入
                </div>
              )}
              {authors.map((a, i) => (
                <div key={i} className="flex gap-1">
                  <input
                    value={a}
                    onChange={(e) => updateAuthor(i, e.target.value)}
                    placeholder="First Last"
                    className="flex-1 px-2 py-1 text-xs border border-black/10 rounded focus:outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => removeAuthor(i)}
                    className="px-2 text-xs text-red-600 hover:bg-red-50 rounded"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <label className="block">
            <div className="text-xs text-app-fg/70 mb-1">摘要</div>
            <textarea
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              rows={5}
              className="w-full px-2.5 py-1.5 text-sm border border-black/10 rounded focus:outline-none focus:border-primary resize-none"
            />
          </label>

          <label className="block">
            <div className="text-xs text-app-fg/70 mb-1">DOI(可选)</div>
            <input
              value={doi}
              onChange={(e) => setDoi(e.target.value)}
              placeholder="10.1234/example"
              className="w-full px-2.5 py-1.5 text-sm border border-black/10 rounded font-mono focus:outline-none focus:border-primary"
            />
          </label>

          {err && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-1.5 rounded">
              {err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-3 border-t border-black/10 bg-gray-50">
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs rounded border border-black/10 text-app-fg/70 hover:bg-black/5"
          >
            跳过(保留原提取)
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-3 py-1 text-xs rounded bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
