// V2.2.6 — Settings "文献数据源管理" card.
//
// The single global editor for which of the 8 literature sources are queried.
// Persists to the backend (set_enabled_sources); Literature Search and the
// Today's Feed scheduler both read the same toggle, so all three stay
// consistent. Empty enabled list = all enabled.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Database, Loader2 } from "lucide-react";
import { api } from "../lib/tauri";
import {
  ALL_SOURCES,
  ALL_SOURCE_VALUES,
  isSourceEnabled,
  resolveEnabledSources,
} from "../lib/sources";
import { useToast } from "../hooks/useToast";
import { Icon } from "./Icon";

const GROUPS = ["sources.group_general", "sources.group_oa", "sources.group_cs"];

export function SourcesCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const [enabled, setEnabled] = useState<string[] | null>(null);

  useEffect(() => {
    api
      .getEnabledSources()
      .then(setEnabled)
      .catch(() => setEnabled([]));
  }, []);

  const toggle = async (value: string) => {
    if (enabled === null) return;
    const current = resolveEnabledSources(enabled);
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    if (next.length === 0) {
      toast.info(t("sources.at_least_one"));
      return;
    }
    // Normalise to canonical order so the persisted file is stable.
    const ordered = ALL_SOURCE_VALUES.filter((v) => next.includes(v));
    setEnabled(ordered);
    try {
      await api.setEnabledSources(ordered);
    } catch (e) {
      toast.danger(String(e));
    }
  };

  return (
    <div className="bg-card rounded-card shadow-card p-6">
      <div className="flex items-center gap-2 mb-1">
        <Icon icon={Database} size="sm" className="text-fg-2" />
        <h2 className="text-h3 font-semibold text-fg-1">{t("sources.title")}</h2>
      </div>
      <p className="text-meta text-fg-2 mb-4">{t("sources.subtitle")}</p>

      {enabled === null ? (
        <div className="flex items-center gap-2 text-meta text-fg-3 py-2">
          <Icon icon={Loader2} size="sm" className="animate-spin" />
          <span>{t("sources.loading")}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {GROUPS.map((gk) => {
            const items = ALL_SOURCES.filter((s) => s.groupKey === gk);
            if (items.length === 0) return null;
            return (
              <div key={gk}>
                <div className="text-meta text-fg-3 mb-2">{t(gk)}</div>
                <div className="flex flex-wrap gap-2">
                  {items.map((s) => {
                    const on = isSourceEnabled(enabled, s.value);
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => toggle(s.value)}
                        aria-pressed={on}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill border text-meta transition-colors duration-fast ease-khx ${
                          on
                            ? "border-indigo-muted bg-indigo-soft text-indigo font-medium"
                            : "border-border-default text-fg-2 hover:text-fg-1 hover:bg-navy-faint"
                        }`}
                      >
                        {on && <Icon icon={Check} size="xs" />}
                        <span>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
