// V2.2.4 — onboarding Step 0 (welcome). Brand mark + one-liner, then the
// "start vs skip-all" fork. No progress dots here — the wizard proper
// starts at Step 1.
import { ArrowRight } from "lucide-react";
import { LogoMark } from "../BrandLogo";
import { Icon } from "../Icon";
import { useT } from "../../hooks/useT";
import { BTN_GHOST, BTN_PRIMARY } from "./styles";

export function WelcomeStep({
  onStart,
  onSkipAll,
}: {
  onStart: () => void;
  onSkipAll: () => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col items-center text-center px-2 py-6">
      <div className="w-16 h-16 rounded-icon bg-navy-faint flex items-center justify-center">
        <LogoMark size={40} className="text-navy" />
      </div>
      <h1 className="mt-5 text-h2 font-semibold text-fg-1">
        {t("onboarding.welcome_title")}
      </h1>
      <p className="mt-2 text-body text-fg-2 max-w-sm">
        {t("onboarding.welcome_subtitle")}
      </p>
      <p className="mt-2 text-meta text-fg-3 max-w-sm">
        {t("onboarding.welcome_hint")}
      </p>
      <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
        <button type="button" onClick={onStart} className={BTN_PRIMARY}>
          <span>{t("onboarding.welcome_start")}</span>
          <Icon icon={ArrowRight} size="sm" />
        </button>
        <button type="button" onClick={onSkipAll} className={BTN_GHOST}>
          {t("onboarding.welcome_skip_all")}
        </button>
      </div>
    </div>
  );
}
