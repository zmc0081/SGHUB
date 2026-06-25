// V2.2.7 — model picker for the chat composer (and "regenerate with another
// model"). Lists configured models grouped by provider; SG AI Store models
// show a balance badge. Empty state links to 模型配置.
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronDown, Cpu, ExternalLink, Store } from "lucide-react";
import { api, type ModelConfig } from "../../lib/tauri";
import { useT } from "../../hooks/useT";
import { Icon } from "../Icon";

const PROVIDER_ORDER = ["anthropic", "openai", "ollama", "custom"];

function groupLabel(provider: string, customLabel: string): string {
  switch (provider) {
    case "anthropic":
      return "Claude";
    case "openai":
      return "OpenAI";
    case "ollama":
      return "Ollama";
    default:
      return customLabel;
  }
}

interface Props {
  value: string | null;
  onChange: (id: string) => void;
  /** sm = inline (message actions); md = composer toolbar. */
  size?: "sm" | "md";
  /** Which way the menu opens. Composer sits at the bottom → "up". */
  placement?: "up" | "down";
  /** Button label when no model is selected (e.g. "regenerate with…"). */
  placeholder?: string;
}

export function ModelPicker({
  value,
  onChange,
  size = "md",
  placement = "up",
  placeholder,
}: Props) {
  const t = useT();
  const navigate = useNavigate();
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [balances, setBalances] = useState<Record<string, number | null>>({});
  const [open, setOpen] = useState(false);
  const [balancesLoaded, setBalancesLoaded] = useState(false);

  useEffect(() => {
    api.getModelConfigs().then(setModels).catch(() => {});
  }, []);

  // Fetch SG AI Store balances only the first time the menu opens — avoids
  // hitting the balance API once per message-row picker in a long chat.
  useEffect(() => {
    if (!open || balancesLoaded) return;
    setBalancesLoaded(true);
    models
      .filter((m) => m.is_sg_ai_store)
      .forEach((m) => {
        api
          .aiStoreGetBalance(m.id)
          .then((s) => setBalances((b) => ({ ...b, [m.id]: s.balance_cny })))
          .catch(() => {});
      });
  }, [open, balancesLoaded, models]);

  const current = models.find((m) => m.id === value) ?? null;

  const sgStore = models.filter((m) => m.is_sg_ai_store);
  const byProvider = new Map<string, ModelConfig[]>();
  models
    .filter((m) => !m.is_sg_ai_store)
    .forEach((m) => {
      const arr = byProvider.get(m.provider) ?? [];
      arr.push(m);
      byProvider.set(m.provider, arr);
    });

  const select = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const btnSize = size === "sm" ? "h-7 px-2.5" : "h-8 px-3";

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t("chat.switch_model")}
        className={`inline-flex items-center gap-1.5 ${btnSize} rounded-pill border border-border-default bg-card text-meta text-fg-1 hover:border-indigo hover:text-indigo transition-colors duration-fast ease-khx max-w-[190px]`}
      >
        <Icon
          icon={current?.is_sg_ai_store ? Store : Cpu}
          size="xs"
          className="shrink-0"
        />
        <span className="truncate">
          {current ? current.name : (placeholder ?? t("chat.no_models"))}
        </span>
        <Icon icon={ChevronDown} size="xs" className="shrink-0" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-dropdown"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            className={`absolute left-0 z-dropdown min-w-[240px] max-h-[360px] overflow-y-auto rounded-card-sm border border-border-default bg-card shadow-nav py-1.5 ${
              placement === "up" ? "bottom-full mb-1" : "top-full mt-1"
            }`}
          >
            {models.length === 0 ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate({ to: "/models" });
                }}
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-meta text-indigo hover:bg-navy-faint transition-colors duration-fast ease-khx"
              >
                <Icon icon={ExternalLink} size="xs" />
                <span>{t("chat.model_go_configure")}</span>
              </button>
            ) : (
              <>
                {PROVIDER_ORDER.filter((p) => byProvider.has(p)).map((p) => (
                  <ModelGroup
                    key={p}
                    label={groupLabel(p, t("chat.model_group_custom"))}
                    models={byProvider.get(p)!}
                    value={value}
                    balances={balances}
                    onSelect={select}
                  />
                ))}
                {sgStore.length > 0 && (
                  <ModelGroup
                    label="SG AI Store"
                    models={sgStore}
                    value={value}
                    balances={balances}
                    onSelect={select}
                    isStore
                  />
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ModelGroup({
  label,
  models,
  value,
  balances,
  onSelect,
  isStore,
}: {
  label: string;
  models: ModelConfig[];
  value: string | null;
  balances: Record<string, number | null>;
  onSelect: (id: string) => void;
  isStore?: boolean;
}) {
  return (
    <div className="mb-1 last:mb-0">
      <div className="px-3 py-1 text-micro uppercase tracking-wide-brand text-fg-3">
        {label}
      </div>
      {models.map((m) => {
        const active = m.id === value;
        const bal = balances[m.id];
        return (
          <button
            key={m.id}
            type="button"
            role="menuitemradio"
            aria-checked={active}
            onClick={() => onSelect(m.id)}
            className={`flex items-center gap-2 w-full text-left px-3 py-1.5 text-meta hover:bg-navy-faint transition-colors duration-fast ease-khx ${
              active ? "text-indigo font-medium" : "text-fg-1"
            }`}
          >
            {active ? (
              <Icon icon={Check} size="xs" className="text-indigo shrink-0" />
            ) : (
              <span className="w-3.5 shrink-0" aria-hidden />
            )}
            <span className="flex-1 truncate">{m.name}</span>
            {isStore && bal != null && (
              <span className="shrink-0 rounded-pill px-1.5 py-0.5 text-micro tabular-nums bg-badge-default-bg text-badge-default-fg">
                ¥{bal.toFixed(2)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
