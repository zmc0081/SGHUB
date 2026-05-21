// V2.2.1 Session 28 — AI Store product detail page.
//
// Layout (≥ md): two-column.
//   Left flex-1   header (icon + name + provider + tags) +
//                 long description + features + FAQ
//   Right 320px   sticky buy panel:
//                 price + quota + "立即购买" button +
//                 link back to /store + terms link

import { useEffect, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Shield,
  Sparkles,
} from "lucide-react";
import {
  pickLocalized,
  pickLocalizedArray,
  type SgStoreProduct,
  sgAiStoreApi,
} from "../../lib/sgAiStoreApi";
import { api } from "../../lib/tauri";
import { Icon } from "../../components/Icon";
import { Skeleton } from "../../components/Skeleton";
import { confirmAsync } from "../../components/DialogProvider";
import { useToast } from "../../hooks/useToast";

interface ProductDetailProps {
  productId: string;
}

function PeriodAndPrice({ product, lang }: { product: SgStoreProduct; lang: string }) {
  const { t } = useTranslation();
  const periodLabel =
    product.billing_period === "yearly"
      ? t("store.period_yearly")
      : t("store.period_monthly");
  const tokensReadable = (() => {
    if (product.token_quota >= 1_000_000_000) {
      return `${(product.token_quota / 1_000_000_000).toFixed(1)}B`;
    }
    if (product.token_quota >= 1_000_000) {
      return `${Math.round(product.token_quota / 1_000_000)}M`;
    }
    return product.token_quota.toLocaleString();
  })();
  return (
    <div>
      <div className="text-display-sm font-bold text-fg-1 tabular-nums leading-none">
        ¥{product.price_cny}
      </div>
      <div className="text-caption text-fg-3 mt-2">
        ≈ ${product.price_usd} USD · {periodLabel}
      </div>
      <div className="text-meta text-fg-2 mt-3 tabular-nums">
        {tokensReadable} tokens / {periodLabel}
      </div>
      {lang.startsWith("zh") ? null : null}
    </div>
  );
}

export default function ProductDetail({ productId }: ProductDetailProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const toast = useToast();

  const [product, setProduct] = useState<SgStoreProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    sgAiStoreApi
      .getProduct(productId)
      .then((p) => {
        if (!cancelled) setProduct(p);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  async function handleBuy() {
    if (!product) return;
    const ok = await confirmAsync({
      title: t("store.confirm_buy_title"),
      description: t("store.confirm_buy_desc", {
        product: pickLocalized(product.name, lang),
        price: product.price_cny,
      }),
      confirmLabel: t("store.confirm_buy_yes"),
      cancelLabel: t("common.cancel"),
    });
    if (!ok) return;
    setBuying(true);
    try {
      await api.openExternalUrl(product.purchase_url);
      toast.info(
        t("store.toast_browser_opened"),
        t("store.toast_browser_opened_desc"),
      );
    } catch (e) {
      toast.danger(t("store.toast_browser_failed"), String(e));
    } finally {
      setBuying(false);
    }
  }

  if (loading) {
    return (
      <main role="main" className="p-8 max-w-5xl mx-auto">
        <div className="flex flex-col gap-4">
          <Skeleton variant="rect" height={48} />
          <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6">
            <Skeleton variant="rect" height={400} />
            <Skeleton variant="rect" height={300} />
          </div>
        </div>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main role="main" className="p-8 max-w-3xl mx-auto">
        <Link
          to="/store"
          className="inline-flex items-center gap-1.5 text-meta text-indigo hover:text-indigo-hover mb-4"
        >
          <Icon icon={ArrowLeft} size="xs" />
          {t("store.back_to_store")}
        </Link>
        <div
          role="alert"
          className="rounded-card-sm bg-danger-bg border border-danger-border text-danger-fg px-4 py-3 flex items-start gap-2 text-caption"
        >
          <Icon icon={AlertTriangle} size="sm" className="flex-shrink-0 mt-0.5" />
          <span>{error ?? t("store.product_not_found")}</span>
        </div>
      </main>
    );
  }

  const name = pickLocalized(product.name, lang);
  const description = pickLocalized(product.description, lang);
  const features = pickLocalizedArray(product.features, lang);

  return (
    <main role="main" className="p-8 max-w-5xl mx-auto">
      <Link
        to="/store"
        className="inline-flex items-center gap-1.5 text-meta text-indigo hover:text-indigo-hover mb-4"
      >
        <Icon icon={ArrowLeft} size="xs" />
        {t("store.back_to_store")}
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Left — content */}
        <article className="bg-card rounded-card shadow-card p-6">
          <header className="flex items-start gap-4 pb-5 border-b border-border-subtle">
            <div className="w-16 h-16 rounded-icon bg-indigo-soft text-indigo flex items-center justify-center flex-shrink-0">
              <Icon icon={Sparkles} size="xl" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-h2 font-semibold text-fg-1 leading-tight">
                  {name}
                </h1>
                {product.popular && (
                  <span className="rounded-pill px-2 py-0.5 text-meta font-medium bg-badge-update-bg text-badge-update-fg">
                    {t("store.badge_popular")}
                  </span>
                )}
              </div>
              <p className="text-meta text-fg-3 font-mono">
                {product.model_id} · {product.model_provider}
              </p>
              {product.tags.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {product.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-pill px-2 py-0.5 text-meta bg-navy-faint text-fg-2"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </header>

          <section className="pt-5">
            <h2 className="text-h3 font-semibold text-fg-1 mb-2">
              {t("store.section_overview")}
            </h2>
            <p className="text-caption text-fg-1 leading-relaxed">
              {description}
            </p>
          </section>

          <section className="pt-5">
            <h2 className="text-h3 font-semibold text-fg-1 mb-3">
              {t("store.section_features")}
            </h2>
            <ul className="space-y-2">
              {features.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-caption text-fg-1"
                >
                  <Icon
                    icon={CheckCircle2}
                    size="sm"
                    className="text-success-fg mt-0.5 flex-shrink-0"
                  />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="pt-5">
            <h2 className="text-h3 font-semibold text-fg-1 mb-3">
              {t("store.section_faq")}
            </h2>
            <dl className="text-caption space-y-3">
              <div>
                <dt className="font-medium text-fg-1">
                  {t("store.faq_q_byok")}
                </dt>
                <dd className="text-fg-2 mt-1 leading-relaxed">
                  {t("store.faq_a_byok")}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-fg-1">
                  {t("store.faq_q_quota")}
                </dt>
                <dd className="text-fg-2 mt-1 leading-relaxed">
                  {t("store.faq_a_quota")}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-fg-1">
                  {t("store.faq_q_refund")}
                </dt>
                <dd className="text-fg-2 mt-1 leading-relaxed">
                  {t("store.faq_a_refund")}
                </dd>
              </div>
            </dl>
          </section>
        </article>

        {/* Right — sticky buy panel */}
        <aside className="md:sticky md:top-4 bg-card rounded-card shadow-card p-6 flex flex-col gap-4">
          <PeriodAndPrice product={product} lang={lang} />

          <button
            type="button"
            onClick={handleBuy}
            disabled={buying}
            className="inline-flex items-center justify-center gap-2 px-btn-x py-btn-y rounded-pill bg-navy text-fg-inverse text-caption font-medium shadow-btn hover:bg-navy-hover hover:shadow-btn-hover hover:-translate-y-px disabled:opacity-50 disabled:hover:translate-y-0 transition-[background,box-shadow,transform] duration-fast ease-khx"
          >
            <Icon
              icon={buying ? Loader2 : ExternalLink}
              size="sm"
              className={buying ? "animate-spin" : ""}
            />
            <span>{t("store.buy_now")}</span>
          </button>

          <div className="pt-3 border-t border-border-subtle">
            <h3 className="text-meta font-semibold text-fg-2 uppercase tracking-wide-brand mb-2">
              {t("store.quota_summary")}
            </h3>
            <ul className="text-meta text-fg-1 space-y-1.5 tabular-nums">
              <li className="flex items-center justify-between gap-2">
                <span className="text-fg-2">{t("store.quota_period")}</span>
                <span>
                  {product.billing_period === "yearly"
                    ? t("store.period_yearly")
                    : t("store.period_monthly")}
                </span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-fg-2">{t("store.quota_tokens")}</span>
                <span>{product.token_quota.toLocaleString()}</span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-fg-2">{t("store.quota_model")}</span>
                <span className="font-mono text-meta">{product.model_id}</span>
              </li>
            </ul>
          </div>

          <div className="pt-3 border-t border-border-subtle text-meta text-fg-3 leading-relaxed flex items-start gap-2">
            <Icon icon={Shield} size="xs" className="mt-0.5 flex-shrink-0" />
            <p>
              {t("store.terms_disclosure")}{" "}
              <button
                type="button"
                onClick={() => router.navigate({ to: "/settings" })}
                className="text-indigo hover:text-indigo-hover underline"
              >
                {t("store.terms_link")}
              </button>
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
