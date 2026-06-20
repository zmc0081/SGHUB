// V2.2.6 — SG AI Store product listing, embedded in the 模型配置 (Models)
// page below the "前往 SG AI Store 购买" button. The standalone /store home
// was removed; this reuses the same sgAiStoreApi sync (pull + SSE) and the
// product-card design so users can browse / be guided to purchase without
// leaving model configuration. Each card still deep-links to the per-product
// detail page (/store/product/:id).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
  WifiOff,
} from "lucide-react";
import {
  pickLocalized,
  type SgStoreProduct,
  type SyncStatus,
  sgAiStoreApi,
} from "../lib/sgAiStoreApi";
import { Icon } from "./Icon";
import { Skeleton } from "./Skeleton";

const PROVIDER_LABEL: Record<string, { zh: string; en: string }> = {
  anthropic: { zh: "Anthropic — Claude", en: "Anthropic — Claude" },
  openai: { zh: "OpenAI", en: "OpenAI" },
  deepseek: { zh: "DeepSeek", en: "DeepSeek" },
  multi: { zh: "全模型套餐", en: "Multi-Model Bundles" },
};

const PROVIDER_ORDER = ["anthropic", "openai", "deepseek", "multi"];

function formatLastSynced(iso: string | null, lang: string): string {
  if (!iso) return lang.startsWith("zh") ? "从未同步" : "Never synced";
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return lang.startsWith("zh") ? `${sec} 秒前` : `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return lang.startsWith("zh") ? `${min} 分钟前` : `${min}m ago`;
  const hr = Math.floor(min / 60);
  return lang.startsWith("zh") ? `${hr} 小时前` : `${hr}h ago`;
}

function formatQuotaTokens(tokens: number): string {
  if (tokens >= 1_000_000_000) {
    return `${(tokens / 1_000_000_000).toFixed(1)}B tokens`;
  }
  if (tokens >= 1_000_000) {
    return `${Math.round(tokens / 1_000_000)}M tokens`;
  }
  return `${tokens.toLocaleString()} tokens`;
}

function ProductCard({
  product,
  lang,
}: {
  product: SgStoreProduct;
  lang: string;
}) {
  const { t } = useTranslation();
  const name = pickLocalized(product.name, lang);
  const description = pickLocalized(product.description, lang);
  const features = product.features[lang] ?? product.features["en-US"] ?? [];
  const periodLabel =
    product.billing_period === "yearly"
      ? t("store.period_yearly")
      : t("store.period_monthly");

  return (
    <article className="bg-card rounded-card shadow-card p-5 flex flex-col gap-3 hover:shadow-card-hover hover:-translate-y-0.5 transition-[box-shadow,transform] duration-fast ease-khx">
      <header className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-icon bg-indigo-soft text-indigo flex items-center justify-center flex-shrink-0">
          <Icon icon={Sparkles} size="lg" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-h3 font-semibold text-fg-1 leading-tight">
              {name}
            </h3>
            {product.popular && (
              <span className="rounded-pill px-2 py-0.5 text-meta font-medium bg-badge-update-bg text-badge-update-fg">
                {t("store.badge_popular")}
              </span>
            )}
          </div>
          <p className="text-meta text-fg-3 mt-0.5 font-mono">
            {product.model_id}
          </p>
        </div>
      </header>
      <p className="text-caption text-fg-2 leading-relaxed line-clamp-3">
        {description}
      </p>
      <ul className="text-meta text-fg-2 space-y-1 mt-1">
        {features.slice(0, 3).map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Icon
              icon={CheckCircle2}
              size="xs"
              className="text-success-fg mt-0.5 flex-shrink-0"
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 pt-3 border-t border-border-subtle flex items-end justify-between gap-3">
        <div>
          <div className="text-h2 font-bold text-fg-1 tabular-nums">
            ¥{product.price_cny}
            <span className="text-caption text-fg-3 font-normal ml-1">
              / {periodLabel}
            </span>
          </div>
          <div className="text-meta text-fg-3 tabular-nums">
            {formatQuotaTokens(product.token_quota)}
          </div>
        </div>
        <Link
          to="/store/product/$productId"
          params={{ productId: product.id }}
          className="inline-flex items-center gap-1.5 px-btn-x-sm py-btn-y-sm rounded-pill border border-border-default bg-card text-fg-1 text-meta font-medium hover:border-navy hover:text-navy transition-colors duration-fast ease-khx"
        >
          {t("store.view_details")}
        </Link>
      </div>
    </article>
  );
}

function SyncIndicator({
  status,
  syncing,
  onSync,
  lang,
}: {
  status: SyncStatus | null;
  syncing: boolean;
  onSync: () => void;
  lang: string;
}) {
  const { t } = useTranslation();

  const statusIcon =
    !status || status.state === "synced"
      ? CheckCircle2
      : status.state === "syncing" || syncing
        ? Loader2
        : status.state === "offline"
          ? WifiOff
          : AlertTriangle;

  const statusColor =
    !status || status.state === "synced"
      ? "text-success-fg"
      : status.state === "offline"
        ? "text-fg-3"
        : status.state === "stale"
          ? "text-warning-fg-strong"
          : "text-fg-2";

  const statusLabel = (() => {
    if (syncing || status?.state === "syncing") return t("store.status_syncing");
    if (!status || status.state === "synced") return t("store.status_synced");
    if (status.state === "offline") return t("store.status_offline");
    return t("store.status_stale");
  })();

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 text-meta">
        <Icon
          icon={statusIcon}
          size="xs"
          className={`${statusColor} ${
            status?.state === "syncing" || syncing ? "animate-spin" : ""
          }`}
        />
        <span className={statusColor}>{statusLabel}</span>
        {status?.last_synced_at && (
          <span className="text-fg-3">
            · {formatLastSynced(status.last_synced_at, lang)}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onSync}
        disabled={syncing}
        className="inline-flex items-center gap-1.5 px-btn-x-sm py-btn-y-sm rounded-pill border border-border-default bg-card text-fg-1 text-meta font-medium hover:border-navy hover:text-navy disabled:opacity-50 transition-colors duration-fast ease-khx"
      >
        <Icon icon={RefreshCw} size="xs" className={syncing ? "animate-spin" : ""} />
        <span>{t("store.sync_now")}</span>
      </button>
    </div>
  );
}

/** Embedded SG AI Store product browser for the Models page (V2.2.6). */
export function AiStoreProducts() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const [products, setProducts] = useState<SgStoreProduct[] | null>(null);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, s] = await Promise.all([
          sgAiStoreApi.getProducts(),
          sgAiStoreApi.getSyncStatus(),
        ]);
        if (!cancelled) {
          setProducts(list);
          setStatus(s);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const r = await sgAiStoreApi.syncNow();
      setProducts(r.products);
      setStatus(r.status);
    } catch (e) {
      setError(String(e));
    } finally {
      setSyncing(false);
    }
  }, []);

  const popular = useMemo(
    () => products?.filter((p) => p.popular) ?? [],
    [products],
  );

  const byProvider = useMemo(() => {
    const grouped = new Map<string, SgStoreProduct[]>();
    products?.forEach((p) => {
      const arr = grouped.get(p.model_provider) ?? [];
      arr.push(p);
      grouped.set(p.model_provider, arr);
    });
    return grouped;
  }, [products]);

  return (
    <section className="mt-2">
      <header className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div className="min-w-0">
          <h2 className="text-h3 font-semibold text-fg-1 flex items-center gap-2">
            <Icon icon={Sparkles} size="base" className="text-indigo" />
            <span>{t("models.store_section_title")}</span>
          </h2>
          <p className="text-meta text-fg-2 mt-1">
            {t("models.store_section_subtitle")}
          </p>
        </div>
        <SyncIndicator
          status={status}
          syncing={syncing}
          onSync={handleSync}
          lang={lang}
        />
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-card-sm bg-danger-bg border border-danger-border text-danger-fg px-4 py-3 mb-4 flex items-start gap-2 text-caption"
        >
          <Icon icon={AlertTriangle} size="sm" className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="rect" height={240} />
          ))}
        </div>
      )}

      {!loading && popular.length > 0 && (
        <div className="mb-6">
          <h3 className="text-meta uppercase tracking-wide-brand text-fg-3 mb-3">
            {t("store.section_popular")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {popular.map((p) => (
              <ProductCard key={p.id} product={p} lang={lang} />
            ))}
          </div>
        </div>
      )}

      {!loading &&
        PROVIDER_ORDER.map((provider) => {
          const list = byProvider.get(provider);
          if (!list || list.length === 0) return null;
          const label =
            PROVIDER_LABEL[provider]?.[lang.startsWith("zh") ? "zh" : "en"] ??
            provider;
          return (
            <div key={provider} className="mb-6">
              <h3 className="text-meta uppercase tracking-wide-brand text-fg-3 mb-3">
                {label}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {list.map((p) => (
                  <ProductCard key={p.id} product={p} lang={lang} />
                ))}
              </div>
            </div>
          );
        })}

      {!loading && !error && (products?.length ?? 0) === 0 && (
        <div className="text-caption text-fg-3 text-center py-8">
          {t("models.store_section_empty")}
        </div>
      )}
    </section>
  );
}
