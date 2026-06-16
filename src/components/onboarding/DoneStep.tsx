// V2.2.4 — onboarding Step 3 (done). Messaging branches on whether a
// default model actually got configured (checked live, so it's correct
// regardless of which path/skips the user took).
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Settings2, Sparkles } from "lucide-react";
import { api } from "../../lib/tauri";
import { Icon } from "../Icon";
import { useT } from "../../hooks/useT";
import { BTN_PRIMARY, BTN_SECONDARY } from "./styles";

export function DoneStep({ onEnter }: { onEnter: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const [hasModel, setHasModel] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .getModelConfigs()
      .then((models) => setHasModel(models.some((m) => m.is_default)))
      .catch(() => setHasModel(false));
  }, []);

  function goConfigureModel() {
    onEnter();
    void navigate({ to: "/models" });
  }

  return (
    <div className="flex flex-col items-center text-center px-2 py-6">
      <div className="w-16 h-16 rounded-icon bg-success-bg flex items-center justify-center">
        <Icon
          icon={hasModel === false ? Sparkles : CheckCircle2}
          size="lg"
          className="text-success-fg"
        />
      </div>
      <h1 className="mt-5 text-h2 font-semibold text-fg-1">
        {t("onboarding.done_title")}
      </h1>
      <p className="mt-2 text-body text-fg-2 max-w-sm">
        {hasModel === false
          ? t("onboarding.done_no_model")
          : t("onboarding.done_ready")}
      </p>

      <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
        <button type="button" onClick={onEnter} className={BTN_PRIMARY}>
          {t("onboarding.done_enter")}
        </button>
        {hasModel === false && (
          <button
            type="button"
            onClick={goConfigureModel}
            className={BTN_SECONDARY}
          >
            <Icon icon={Settings2} size="sm" />
            <span>{t("onboarding.done_configure_now")}</span>
          </button>
        )}
      </div>
    </div>
  );
}
