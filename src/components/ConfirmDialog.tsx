import { useState } from "react";
import { Loader2 } from "lucide-react";
import { BaseModal } from "./BaseModal";
import { Icon } from "./Icon";

export type ConfirmVariant = "default" | "danger";

export interface ConfirmDialogProps {
  open: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  title: string;
  description?: string;
  variant?: ConfirmVariant;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  variant = "default",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    try {
      setBusy(true);
      await Promise.resolve(onConfirm());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const confirmClass =
    variant === "danger"
      ? "bg-danger-fg text-fg-inverse hover:opacity-90"
      : "bg-navy text-fg-inverse hover:bg-navy-hover";

  return (
    <BaseModal
      open={open}
      onClose={() => !busy && onCancel()}
      size="sm"
      closeOnEscape={!busy}
      closeOnBackdrop={!busy}
      title={title}
      showClose={false}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            autoFocus={variant === "danger"}
            className="px-btn-x py-btn-y rounded-pill border border-border-default text-fg-1 bg-card hover:bg-navy-faint disabled:opacity-50 transition-colors duration-fast ease-khx font-medium text-caption"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            autoFocus={variant !== "danger"}
            className={`px-btn-x py-btn-y rounded-pill shadow-btn font-medium text-caption transition-colors duration-fast ease-khx disabled:opacity-50 flex items-center gap-2 ${confirmClass}`}
          >
            {busy && <Icon icon={Loader2} size="sm" className="animate-spin" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      {description && <p className="text-body text-fg-1">{description}</p>}
      {error && (
        <div className="mt-3 text-meta text-danger-fg bg-danger-bg border border-danger-border rounded-card-sm px-3 py-2">
          {error}
        </div>
      )}
    </BaseModal>
  );
}
