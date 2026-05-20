import {
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  useEffect,
  useId,
  useRef,
} from "react";
import { X } from "lucide-react";
import { Icon } from "./Icon";

export type ModalSize = "sm" | "md" | "lg" | "xl";

export interface BaseModalProps {
  open: boolean;
  onClose: () => void;
  size?: ModalSize;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  title?: string;
  description?: string;
  showClose?: boolean;
  footer?: ReactNode;
  children: ReactNode;
  /** Optional aria-label when there's no visual title */
  ariaLabel?: string;
}

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function BaseModal({
  open,
  onClose,
  size = "md",
  closeOnEscape = true,
  closeOnBackdrop = true,
  title,
  description,
  showClose = true,
  footer,
  children,
  ariaLabel,
}: BaseModalProps) {
  const reactId = useId();
  const titleId = `modal-title-${reactId}`;
  const descId = `modal-desc-${reactId}`;
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Body scroll lock + focus management.
  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Initial focus: first focusable element inside.
    queueMicrotask(() => {
      const root = dialogRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      const target = focusable[0] ?? root;
      target.focus();
    });

    return () => {
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape" && closeOnEscape) {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === "Tab") {
      const root = dialogRef.current;
      if (!root) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute("data-focus-trap-skip"));
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function handleBackdropClick(e: MouseEvent<HTMLDivElement>) {
    if (!closeOnBackdrop) return;
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-overlay-modal-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? ariaLabel : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`relative bg-card rounded-card shadow-modal flex flex-col w-full max-h-[90vh] ${SIZE_CLASS[size]}`}
      >
        {(title || description || showClose) && (
          <div className="px-6 py-4 border-b border-border-default flex-shrink-0 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              {title && (
                <h2
                  id={titleId}
                  className="text-h3 font-semibold text-fg-1 truncate"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="text-meta text-fg-2 mt-1">
                  {description}
                </p>
              )}
            </div>
            {showClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="flex-shrink-0 w-8 h-8 rounded-pill flex items-center justify-center text-fg-2 hover:text-fg-1 hover:bg-navy-faint transition-colors duration-fast ease-khx"
              >
                <Icon icon={X} size="sm" />
              </button>
            )}
          </div>
        )}

        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-border-default flex-shrink-0 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
