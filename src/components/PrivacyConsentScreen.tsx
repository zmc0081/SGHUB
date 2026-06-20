// V2.2.6 — mandatory first-run privacy-policy consent (R7).
//
// Shown full-screen BEFORE the onboarding wizard and the app proper whenever
// the user hasn't accepted the current policy version (fresh install or a
// policy/version bump). The "I have read and agree" button only enables once
// the user scrolls to the bottom of the policy; "Exit" closes the app.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogOut, ShieldCheck } from "lucide-react";
import { api } from "../lib/tauri";
import { useToast } from "../hooks/useToast";
import { Icon } from "./Icon";
import { PrivacyPolicyBody, type PrivacyLang } from "./PrivacyPolicyBody";

export function PrivacyConsentScreen({ onAgree }: { onAgree: () => void }) {
  const { i18n, t } = useTranslation();
  const toast = useToast();
  const initial: PrivacyLang = i18n.language === "zh-CN" ? "zh-CN" : "en-US";
  const [lang, setLang] = useState<PrivacyLang>(initial);
  const [readToBottom, setReadToBottom] = useState(false);
  const [agreeing, setAgreeing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // On language switch, reset the read gate + scroll back to the top. If the
  // (new) content is shorter than the viewport, it's already "fully read".
  useEffect(() => {
    const el = scrollRef.current;
    setReadToBottom(false);
    if (el) {
      el.scrollTop = 0;
      if (el.scrollHeight <= el.clientHeight + 8) setReadToBottom(true);
    }
  }, [lang]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
      setReadToBottom(true);
    }
  };

  const agree = async () => {
    setAgreeing(true);
    try {
      await api.setPrivacyAgreed();
      onAgree();
    } catch (e) {
      // Persisting failed (rare). Don't trap the user behind the gate — let
      // them in for this session; it simply re-prompts next launch.
      console.warn("setPrivacyAgreed failed", e);
      toast.danger(t("privacy_consent.save_failed"));
      onAgree();
    } finally {
      setAgreeing(false);
    }
  };

  const exit = () => {
    void getCurrentWindow().close().catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-overlay-modal-backdrop">
      <div className="relative bg-card rounded-card shadow-modal w-full max-w-2xl max-h-[92vh] flex flex-col p-6 sm:p-8">
        <div className="flex items-start gap-3 mb-4 flex-shrink-0">
          <div className="w-11 h-11 rounded-icon bg-indigo-soft text-indigo flex items-center justify-center flex-shrink-0">
            <Icon icon={ShieldCheck} size="lg" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-h2 font-semibold text-fg-1">
              {t("privacy_consent.title")}
            </h1>
            <p className="text-meta text-fg-2 mt-1">
              {t("privacy_consent.subtitle")}
            </p>
          </div>
        </div>

        {/* Language toggle — independent of app language. */}
        <div className="flex items-center gap-2 mb-3 flex-shrink-0">
          <span className="text-meta text-fg-2">
            {t("settings.privacy_language_label")}
          </span>
          {(["zh-CN", "en-US"] as const).map((code) => {
            const active = lang === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                aria-pressed={active}
                className={`px-3 py-1 rounded-pill text-meta font-medium transition-colors duration-fast ease-khx ${
                  active
                    ? "bg-navy text-fg-inverse"
                    : "bg-navy-faint text-fg-2 hover:bg-navy-soft hover:text-fg-1"
                }`}
              >
                {code === "zh-CN" ? "中文" : "English"}
              </button>
            );
          })}
        </div>

        {/* Scrollable policy body. */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex-1 min-h-0 overflow-y-auto rounded-card-sm border border-border-default bg-page p-4 sm:p-5"
        >
          <PrivacyPolicyBody lang={lang} />
        </div>

        {!readToBottom && (
          <p className="text-meta text-fg-3 mt-3 flex-shrink-0">
            {t("privacy_consent.scroll_hint")}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 mt-4 flex-shrink-0">
          <button
            type="button"
            onClick={exit}
            className="inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill border border-border-default text-caption text-fg-2 hover:text-danger-fg hover:border-danger-border transition-colors duration-fast ease-khx font-medium"
          >
            <Icon icon={LogOut} size="sm" />
            <span>{t("privacy_consent.exit")}</span>
          </button>
          <button
            type="button"
            onClick={agree}
            disabled={!readToBottom || agreeing}
            className="inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill bg-navy text-fg-inverse text-caption font-medium shadow-btn hover:bg-navy-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-fast ease-khx"
          >
            <Icon icon={ShieldCheck} size="sm" />
            <span>{t("privacy_consent.agree")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
