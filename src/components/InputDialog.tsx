import { FormEvent, useEffect, useId, useState } from "react";
import { Loader2 } from "lucide-react";
import { BaseModal } from "./BaseModal";
import { Icon } from "./Icon";

export interface InputDialogProps {
  open: boolean;
  onConfirm: (value: string) => void | Promise<void>;
  onCancel: () => void;
  title: string;
  description?: string;
  initialValue?: string;
  placeholder?: string;
  label?: string;
  validate?: (value: string) => string | null;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function InputDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  initialValue = "",
  placeholder,
  label,
  validate,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
}: InputDialogProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setSubmitError(null);
    }
  }, [open, initialValue]);

  const validationError = validate ? validate(value) : null;
  const hasError = Boolean(validationError) || Boolean(submitError);
  const disabled = busy || Boolean(validationError);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (validationError) return;
    setSubmitError(null);
    try {
      setBusy(true);
      await Promise.resolve(onConfirm(value));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const errorText = submitError ?? validationError;

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
            className="px-btn-x py-btn-y rounded-pill border border-border-default text-fg-1 bg-card hover:bg-navy-faint disabled:opacity-50 transition-colors duration-fast ease-khx font-medium text-caption"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            form={inputId}
            disabled={disabled}
            className="px-btn-x py-btn-y rounded-pill shadow-btn font-medium text-caption text-fg-inverse bg-navy hover:bg-navy-hover transition-colors duration-fast ease-khx disabled:opacity-50 flex items-center gap-2"
          >
            {busy && <Icon icon={Loader2} size="sm" className="animate-spin" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <form id={inputId} onSubmit={handleSubmit}>
        {description && (
          <p className="text-body text-fg-1 mb-4">{description}</p>
        )}
        {label && (
          <label
            htmlFor={`${inputId}-input`}
            className="block text-caption font-medium text-fg-1 mb-2"
          >
            {label}
          </label>
        )}
        <input
          id={`${inputId}-input`}
          type="text"
          value={value}
          autoFocus
          placeholder={placeholder}
          aria-invalid={hasError}
          aria-describedby={errorText ? errorId : undefined}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          disabled={busy}
          className={`w-full px-input-x py-input-y rounded-pill border bg-card text-fg-1 placeholder:text-fg-3 transition-colors duration-fast ease-khx focus:outline-none focus:shadow-focus disabled:opacity-50 disabled:cursor-not-allowed ${
            hasError
              ? "border-danger-fg focus:shadow-focus-danger"
              : "border-border-default focus:border-border-focus"
          }`}
          style={{ fontSize: "13px" }}
        />
        {errorText && (
          <p id={errorId} className="text-meta text-danger-fg mt-2">
            {errorText}
          </p>
        )}
      </form>
    </BaseModal>
  );
}
