// i18n: 本组件文案已国际化 (V2.1.0)
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  api,
  type Subscription,
  type SubscriptionInput,
  type SubscriptionResult,
} from "../lib/tauri";
import { PaperActions } from "../components/PaperActions";
import { Icon } from "../components/Icon";
import { Skeleton } from "../components/Skeleton";
import { confirmAsync } from "../components/DialogProvider";
import { useToast } from "../hooks/useToast";
import { useT } from "../hooks/useT";

const SOURCE_BADGE: Record<string, string> = {
  arxiv: "bg-src-arxiv text-src-arxiv-fg",
  semantic_scholar: "bg-src-ss text-src-ss-fg",
  pubmed: "bg-src-pubmed text-src-pubmed-fg",
  openalex: "bg-src-openalex text-src-openalex-fg",
  local: "bg-src-local text-src-local-fg",
};

const ALL_SOURCES = [
  { value: "arxiv", label: "arXiv" },
  { value: "semantic_scholar", label: "Semantic Scholar" },
  { value: "pubmed", label: "PubMed" },
  { value: "openalex", label: "OpenAlex" },
];

const FREQUENCIES = [
  { value: "daily", labelKey: "feed.form_freq_daily" },
  { value: "weekly", labelKey: "feed.form_freq_weekly" },
];

const EMPTY_INPUT: SubscriptionInput = {
  keyword_expr: "",
  sources: ["arxiv"],
  frequency: "daily",
  max_results: 20,
};

function SubscriptionForm({
  initial,
  isEdit,
  onSave,
  onCancel,
}: {
  initial: SubscriptionInput;
  isEdit: boolean;
  onSave: (input: SubscriptionInput) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useT();
  const [form, setForm] = useState<SubscriptionInput>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggleSource = (src: string) => {
    setForm((f) => ({
      ...f,
      sources: f.sources.includes(src)
        ? f.sources.filter((s) => s !== src)
        : [...f.sources, src],
    }));
  };

  const submit = async () => {
    if (!form.keyword_expr.trim()) {
      setErr(t("feed.form_validation_keyword_required"));
      return;
    }
    if (form.sources.length === 0) {
      setErr(t("feed.form_validation_source_required"));
      return;
    }
    setErr(null);
    setSaving(true);
    try {
      await onSave({ ...form, keyword_expr: form.keyword_expr.trim() });
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card rounded-card shadow-card p-6 space-y-4">
      <div className="text-h3 font-semibold text-fg-1">
        {isEdit ? t("feed.form_edit_title") : t("feed.form_create_title")}
      </div>

      <label className="block">
        <div className="text-caption font-medium text-fg-1 mb-2">
          {t("feed.form_keyword_label")}
        </div>
        <input
          value={form.keyword_expr}
          onChange={(e) =>
            setForm((f) => ({ ...f, keyword_expr: e.target.value }))
          }
          placeholder={t("feed.form_keyword_placeholder")}
          className="w-full px-input-x py-input-y rounded-pill border border-border-default bg-card text-fg-1 placeholder:text-fg-3 font-mono focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
          style={{ fontSize: "13px" }}
        />
      </label>

      <div>
        <div className="text-caption font-medium text-fg-1 mb-2">
          {t("feed.form_sources_label")}
        </div>
        <div className="flex flex-wrap gap-2">
          {ALL_SOURCES.map((s) => {
            const checked = form.sources.includes(s.value);
            return (
              <button
                key={s.value}
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggleSource(s.value)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-pill border text-meta transition-colors duration-fast ease-khx ${
                  checked
                    ? "bg-indigo-soft border-indigo-muted text-indigo font-medium"
                    : "bg-card border-border-default text-fg-2 hover:border-indigo-muted hover:text-fg-1"
                }`}
              >
                {checked && <Icon icon={Check} size={12} />}
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <div className="text-caption font-medium text-fg-1 mb-2">
            {t("feed.form_freq_label")}
          </div>
          <select
            value={form.frequency}
            onChange={(e) =>
              setForm((f) => ({ ...f, frequency: e.target.value }))
            }
            className="w-full px-input-x py-input-y rounded-pill border border-border-default bg-card text-fg-1 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
            style={{ fontSize: "13px" }}
          >
            {FREQUENCIES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <div className="text-caption font-medium text-fg-1 mb-2">
            {t("feed.form_max_label")}
          </div>
          <input
            type="number"
            value={form.max_results}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                max_results: Math.max(1, Number(e.target.value) || 1),
              }))
            }
            min="1"
            max="200"
            className="w-full px-input-x py-input-y rounded-pill border border-border-default bg-card text-fg-1 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
            style={{ fontSize: "13px" }}
          />
        </label>
      </div>

      {err && (
        <div
          role="alert"
          className="rounded-card-sm bg-danger-bg border border-danger-border text-danger-fg px-4 py-3 flex items-start gap-2 text-caption"
        >
          <Icon icon={AlertTriangle} size="sm" className="flex-shrink-0 mt-0.5" />
          <span>{err}</span>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center px-btn-x py-btn-y rounded-pill border border-border-default text-caption text-fg-1 hover:bg-navy-faint transition-colors duration-fast ease-khx font-medium"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill shadow-btn bg-navy text-fg-inverse hover:bg-navy-hover disabled:opacity-50 transition-colors duration-fast ease-khx font-medium text-caption"
        >
          {saving && <Icon icon={Loader2} size="sm" className="animate-spin" />}
          {saving
            ? t("common.saving")
            : isEdit
              ? t("feed.save_changes")
              : t("feed.create")}
        </button>
      </div>
    </div>
  );
}

function SubscriptionItem({
  sub,
  selected,
  unreadCount,
  onSelect,
  onToggle,
  onEdit,
  onDelete,
}: {
  sub: Subscription;
  selected: boolean;
  unreadCount: number;
  onSelect: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      className={`group p-3 rounded-card-sm cursor-pointer transition-colors duration-fast ease-khx ${
        selected
          ? "bg-navy-soft ring-1 ring-indigo-muted"
          : "hover:bg-navy-faint"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`shrink-0 w-1.5 h-1.5 rounded-full ${
            sub.is_active ? "bg-success-fg" : "bg-border-strong"
          }`}
        />
        <span
          className={`flex-1 text-caption truncate font-mono ${
            sub.is_active ? "text-fg-1" : "text-fg-3"
          }`}
        >
          {sub.keyword_expr}
        </span>
        {unreadCount > 0 && (
          <span
            aria-label={`${unreadCount} unread`}
            className="rounded-pill px-2 py-0.5 text-micro font-medium bg-badge-improve-bg text-badge-improve-fg tabular-nums"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </div>
      <div className="mt-1 text-meta text-fg-3 ml-3.5">
        {sub.sources.join(" · ")} · {sub.frequency} · {t("feed.last_run_prefix")}{" "}
        {sub.last_run_at
          ? new Date(sub.last_run_at).toLocaleDateString()
          : t("feed.last_run_never")}
      </div>
      <div className="mt-2 ml-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-fast ease-khx flex gap-3 text-meta">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="inline-flex items-center gap-1 text-fg-2 hover:text-indigo transition-colors duration-fast ease-khx"
        >
          <Icon icon={sub.is_active ? Pause : Play} size="xs" />
          <span>
            {sub.is_active ? t("feed.toggle_pause") : t("feed.toggle_enable")}
          </span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="inline-flex items-center gap-1 text-fg-2 hover:text-indigo transition-colors duration-fast ease-khx"
        >
          <Icon icon={Pencil} size="xs" />
          <span>{t("feed.edit_button")}</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="inline-flex items-center gap-1 text-fg-2 hover:text-danger-fg transition-colors duration-fast ease-khx"
        >
          <Icon icon={Trash2} size="xs" />
          <span>{t("feed.delete_button")}</span>
        </button>
      </div>
    </div>
  );
}

function ResultCard({
  result,
  onMarkRead,
}: {
  result: SubscriptionResult;
  onMarkRead: () => void;
}) {
  const t = useT();
  const { paper } = result;
  const sourceCls =
    SOURCE_BADGE[paper.source] ?? "bg-badge-default-bg text-badge-default-fg";
  return (
    <article
      className={`rounded-card bg-card shadow-card p-5 transition-shadow duration-base ease-khx ${
        result.is_read ? "opacity-70" : "hover:shadow-card-hover"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {!result.is_read && (
            <span
              aria-label="Unread"
              className="shrink-0 w-2 h-2 rounded-full bg-indigo"
            />
          )}
          <span
            className={`shrink-0 text-micro uppercase tracking-wide-brand px-2 py-0.5 rounded-pill font-semibold ${sourceCls}`}
          >
            {paper.source}
          </span>
        </div>
        <span className="shrink-0 text-meta text-fg-3 tabular-nums">
          {new Date(result.found_at).toLocaleString()}
        </span>
      </div>
      <h3 className="text-h3 font-semibold text-fg-1 leading-snug">
        {paper.title}
      </h3>
      <p className="text-meta text-fg-2 mt-1">
        {paper.authors.slice(0, 4).join(", ")}
        {paper.authors.length > 4 && t("feed.et_al")}
        {paper.published_at && ` · ${paper.published_at.slice(0, 10)}`}
      </p>
      {paper.abstract && (
        <p className="mt-2 text-caption text-fg-2 line-clamp-2 leading-relaxed">
          {paper.abstract}
        </p>
      )}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <PaperActions paper={paper} />
        {!result.is_read && (
          <button
            type="button"
            onClick={onMarkRead}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-pill border border-border-default text-meta text-fg-2 hover:text-indigo hover:bg-indigo-soft hover:border-indigo-muted transition-colors duration-fast ease-khx"
          >
            <Icon icon={Check} size="xs" />
            <span>{t("feed.mark_read_button")}</span>
          </button>
        )}
      </div>
    </article>
  );
}

export default function Feed() {
  const t = useT();
  const toast = useToast();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [results, setResults] = useState<SubscriptionResult[]>([]);
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    api.getSubscriptions().then(setSubs).catch((e) => setError(String(e)));
    api
      .getSubscriptionResults(selectedSub)
      .then(setResults)
      .catch((e) => setError(String(e)));
  };

  useEffect(refresh, [selectedSub]);

  const grouped = useMemo(() => {
    const groups = new Map<
      string,
      { keyword: string; items: SubscriptionResult[] }
    >();
    for (const r of results) {
      const g = groups.get(r.subscription_id);
      if (g) {
        g.items.push(r);
      } else {
        groups.set(r.subscription_id, {
          keyword: r.subscription_keyword,
          items: [r],
        });
      }
    }
    return groups;
  }, [results]);

  const unreadBySub = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of results) {
      if (!r.is_read) {
        m.set(r.subscription_id, (m.get(r.subscription_id) ?? 0) + 1);
      }
    }
    return m;
  }, [results]);

  const markRead = async (subId: string, paperId: string) => {
    try {
      await api.markSubscriptionPaperRead(subId, paperId);
      refresh();
    } catch (e) {
      toast.danger(t("feed.error_action_failed", { detail: String(e) }));
    }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      await api.runSubscriptionsNow();
      refresh();
    } catch (e) {
      toast.danger(t("feed.error_run_failed", { detail: String(e) }));
    } finally {
      setRunning(false);
    }
  };

  const handleSave = async (input: SubscriptionInput) => {
    if (editingSub) {
      await api.updateSubscription(editingSub.id, input);
      setEditingSub(null);
    } else {
      await api.createSubscription(input);
      setShowAddForm(false);
    }
    refresh();
  };

  const handleDelete = async (sub: Subscription) => {
    const ok = await confirmAsync({
      title: t("feed.confirm_delete_title"),
      description: t("feed.confirm_delete", { keyword: sub.keyword_expr }),
      variant: "danger",
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!ok) return;
    try {
      await api.deleteSubscription(sub.id);
      if (selectedSub === sub.id) setSelectedSub(null);
      refresh();
    } catch (e) {
      toast.danger(t("feed.error_delete_failed", { detail: String(e) }));
    }
  };

  const handleToggle = async (sub: Subscription) => {
    try {
      await api.toggleSubscriptionActive(sub.id);
      refresh();
    } catch (e) {
      toast.danger(t("feed.error_action_failed", { detail: String(e) }));
    }
  };

  return (
    <div className="flex h-full bg-page text-fg-1">
      <aside
        aria-label="Subscriptions"
        className="w-side-panel border-r border-border-default bg-soft flex flex-col overflow-hidden"
      >
        <div className="p-4 border-b border-border-subtle">
          <div className="text-meta uppercase tracking-wide-brand text-fg-3 mb-3 flex items-center justify-between">
            <span>{t("feed.subscriptions_header")}</span>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(true);
                setEditingSub(null);
              }}
              className="inline-flex items-center gap-1 text-indigo hover:text-indigo-hover transition-colors duration-fast ease-khx normal-case tracking-normal"
            >
              <Icon icon={Plus} size="xs" />
              <span>{t("feed.new_button")}</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSelectedSub(null)}
            className={`w-full text-left text-caption px-3 py-2 rounded-pill transition-colors duration-fast ease-khx ${
              selectedSub === null
                ? "bg-navy-soft text-indigo font-medium"
                : "text-fg-2 hover:bg-navy-faint hover:text-fg-1"
            }`}
          >
            {t("feed.all_pushes")}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {subs.length === 0 && (
            <div className="text-meta text-fg-3 text-center py-6">
              {t("feed.no_subscriptions")}
            </div>
          )}
          {subs.map((s) => (
            <SubscriptionItem
              key={s.id}
              sub={s}
              selected={selectedSub === s.id}
              unreadCount={unreadBySub.get(s.id) ?? 0}
              onSelect={() => setSelectedSub(s.id)}
              onToggle={() => handleToggle(s)}
              onEdit={() => {
                setEditingSub(s);
                setShowAddForm(false);
              }}
              onDelete={() => handleDelete(s)}
            />
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-page">
        <div className="border-b border-border-default px-8 py-4 bg-card flex items-baseline gap-3">
          <h1 className="text-h2 font-semibold text-fg-1">{t("feed.title")}</h1>
          <span className="text-meta text-fg-3">
            {t("feed.count_papers", { count: results.length })}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={runNow}
              disabled={running}
              className="inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill border border-border-default text-caption text-fg-1 hover:border-indigo hover:text-indigo disabled:opacity-50 transition-colors duration-fast ease-khx"
            >
              {running ? (
                <Icon icon={Loader2} size="sm" className="animate-spin" />
              ) : (
                <Icon icon={RefreshCw} size="sm" />
              )}
              <span>{running ? t("feed.running") : t("feed.refresh_now")}</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-5 max-w-5xl">
          {error && (
            <div
              role="alert"
              className="rounded-card-sm bg-danger-bg border border-danger-border text-danger-fg px-4 py-3 flex items-start gap-2 text-caption"
            >
              <Icon
                icon={AlertTriangle}
                size="sm"
                className="flex-shrink-0 mt-0.5"
              />
              <span>{t("search.error_prefix", { detail: error })}</span>
            </div>
          )}

          {(showAddForm || editingSub) && (
            <SubscriptionForm
              initial={
                editingSub
                  ? {
                      keyword_expr: editingSub.keyword_expr,
                      sources: editingSub.sources,
                      frequency: editingSub.frequency,
                      max_results: editingSub.max_results,
                    }
                  : EMPTY_INPUT
              }
              isEdit={!!editingSub}
              onSave={handleSave}
              onCancel={() => {
                setShowAddForm(false);
                setEditingSub(null);
              }}
            />
          )}

          {!showAddForm && !editingSub && running && results.length === 0 && (
            <div className="flex flex-col gap-3">
              <Skeleton variant="paper-card" />
              <Skeleton variant="paper-card" />
            </div>
          )}

          {!showAddForm && !editingSub && !running && results.length === 0 && (
            <div className="text-caption text-fg-3 text-center py-12">
              {subs.length === 0 ? (
                <>
                  {t("feed.no_results_subs_empty_prefix")}
                  <span className="text-indigo mx-1">
                    {t("feed.new_link")}
                  </span>
                  {t("feed.no_results_subs_empty_suffix")}
                </>
              ) : (
                <>
                  {t("feed.no_results_run_now_prefix")}
                  <span className="text-indigo mx-1">
                    {t("feed.refresh_now_link")}
                  </span>
                  {t("feed.no_results_run_now_suffix")}
                </>
              )}
            </div>
          )}

          {selectedSub === null && grouped.size > 1 && (
            <>
              {Array.from(grouped.entries()).map(([subId, group]) => (
                <section key={subId}>
                  <div className="text-caption font-semibold text-fg-1 mb-3 flex items-center gap-2">
                    <span className="font-mono text-indigo">
                      {group.keyword}
                    </span>
                    <span className="text-meta text-fg-3">
                      {t("feed.papers_count_short", {
                        count: group.items.length,
                      })}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {group.items.map((r) => (
                      <ResultCard
                        key={`${r.subscription_id}-${r.paper.id}`}
                        result={r}
                        onMarkRead={() => markRead(r.subscription_id, r.paper.id)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </>
          )}

          {(selectedSub !== null || grouped.size <= 1) && results.length > 0 && (
            <div className="flex flex-col gap-3">
              {results.map((r) => (
                <ResultCard
                  key={`${r.subscription_id}-${r.paper.id}`}
                  result={r}
                  onMarkRead={() => markRead(r.subscription_id, r.paper.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
