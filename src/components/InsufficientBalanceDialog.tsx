// V2.2.1 Session 29 — SG AI Store recharge prompt.
//
// Backend signals via AiError::InsufficientBalance, which serializes to
// a string starting with "SG AI Store 余额不足". The Chat / Parse error
// handlers detect that prefix and open this dialog. Three actions:
//   - 前往充值 → open sgaistore.com/topup?key=… in the OS browser
//   - 换个模型 → just close (caller is expected to focus the model picker)
//   - 取消 → close, do nothing
//
// We never put the actual API key in the URL — the user goes to the
// dashboard logged in there, sgaistore.com already knows who they are.

import { useTranslation } from "react-i18next";
import { ExternalLink, RefreshCw, X as XIcon } from "lucide-react";
import { BaseModal } from "./BaseModal";
import { Icon } from "./Icon";
import { api } from "../lib/tauri";

const TOPUP_URL = "https://sgaistore.com/topup";

/**
 * Recognize the backend's InsufficientBalance error so call sites can
 * route to this dialog instead of showing a generic toast. The prefix
 * is pinned by Rust's `#[error("SG AI Store 余额不足: ...")]`.
 */
export function isInsufficientBalanceError(err: unknown): boolean {
  if (err == null) return false;
  const s = typeof err === "string" ? err : String(err);
  return s.includes("SG AI Store 余额不足");
}

export interface InsufficientBalanceDialogProps {
  open: boolean;
  onClose: () => void;
  /** Optional name of the model that triggered the block, for context. */
  modelName?: string | null;
  /** Fired when the user picks "换个模型" — caller decides what that means
   *  (e.g. focus the model picker, or open Models). */
  onSwitchModel?: () => void;
}

export function InsufficientBalanceDialog({
  open,
  onClose,
  modelName,
  onSwitchModel,
}: InsufficientBalanceDialogProps) {
  const { t } = useTranslation();

  async function handleTopUp() {
    try {
      await api.openExternalUrl(TOPUP_URL);
    } catch (e) {
      // The OS-browser open is best-effort; if it failed the user can
      // still copy the URL from the dialog footer text.
      console.warn("topup open failed", e);
    }
    onClose();
  }

  function handleSwitch() {
    onClose();
    onSwitchModel?.();
  }

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      size="md"
      title={t("balance_dialog.title")}
      description={
        modelName
          ? t("balance_dialog.subtitle_with_model", { model: modelName })
          : t("balance_dialog.subtitle")
      }
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill border border-border-default bg-card text-fg-2 text-caption font-medium hover:border-navy hover:text-navy transition-colors duration-fast ease-khx"
          >
            <Icon icon={XIcon} size="sm" />
            <span>{t("balance_dialog.cancel")}</span>
          </button>
          <button
            type="button"
            onClick={handleSwitch}
            className="inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill border border-border-default bg-card text-fg-1 text-caption font-medium hover:border-navy hover:text-navy transition-colors duration-fast ease-khx"
          >
            <Icon icon={RefreshCw} size="sm" />
            <span>{t("balance_dialog.switch_model")}</span>
          </button>
          <button
            type="button"
            onClick={handleTopUp}
            className="inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill bg-navy text-fg-inverse text-caption font-medium shadow-btn hover:bg-navy-hover hover:shadow-btn-hover hover:-translate-y-px transition-[background,box-shadow,transform] duration-fast ease-khx"
          >
            <Icon icon={ExternalLink} size="sm" />
            <span>{t("balance_dialog.top_up")}</span>
          </button>
        </>
      }
    >
      <p className="text-caption text-fg-1 leading-relaxed">
        {t("balance_dialog.body")}
      </p>
      <p className="text-meta text-fg-3 mt-3 font-mono break-all">
        {TOPUP_URL}
      </p>
    </BaseModal>
  );
}
