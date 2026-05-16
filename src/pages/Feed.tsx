// i18n: 本组件文案已国际化 (V2.1.0)
import { useEffect, useMemo, useState } from "react";
import {
  api,
  type Subscription,
  type SubscriptionInput,
  type SubscriptionResult,
} from "../lib/tauri";
import { PaperActions } from "../components/PaperActions";
import { useT } from "../hooks/useT";

// ============================================================
// Constants
// ============================================================

const SOURCE_BADGE: Record<string, string> = {
  arxiv: "bg-[#B31B1B] text-white",
  semantic_scholar: "bg-[#1857B6] text-white",
  pubmed: "bg-[#00897B] text-white",
  openalex: "bg-[#7B3FBF] text-white",
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

// ============================================================
// Subscription form (modal-style)
// ============================================================

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
    <div className="bg-white border border-primary/30 rounded p-4 space-y-3">
      <div className="font-semibold text-primary">
        {isEdit ? t("feed.form_edit_title") : t("feed.form_create_title")}
      </div>

      <label className="block">
        <div className="text-xs text-app-fg/60 mb-1">
          {t("feed.form_keyword_label")}
        </div>
        <input
          value={form.keyword_expr}
          onChange={(e) =>
            setForm((f) => ({ ...f, keyword_expr: e.target.value }))
          }
          placeholder={t("feed.form_keyword_placeholder")}
          className="w-full px-2.5 py-1.5 text-sm border border-black/10 rounded font-mono focus:outline-none focus:border-primary"
        />
      </label>

      <div>
        <div className="text-xs text-app-fg/60 mb-1.5">
          {t("feed.form_sources_label")}
        </div>
        <div className="flex flex-wrap gap-2">
          {ALL_SOURCES.map((s) => {
            const checked = form.sources.includes(s.value);
            return (
              <button
                key={s.value}
                onClick={() => toggleSource(s.value)}
                className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                  checked
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-black/10 text-app-fg/60 hover:border-primary/40"
                }`}
              >
                {checked ? "✓ " : ""}
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <div className="text-xs text-app-fg/60 mb-1">
            {t("feed.form_freq_label")}
          </div>
          <select
            value={form.frequency}
            onChange={(e) =>
              setForm((f) => ({ ...f, frequency: e.target.value }))
            }
            className="w-full px-2.5 py-1.5 text-sm border border-black/10 rounded bg-white"
          >
            {FREQUENCIES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <div className="text-xs text-app-fg/60 mb-1">
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
            className="w-full px-2.5 py-1.5 text-sm border border-black/10 rounded"
          />
        </label>
      </div>

      {err && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-1.5 rounded">
          {err}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-3 py-1 text-xs rounded border border-black/10 text-app-fg/70 hover:bg-black/5"
        >
          {t("common.cancel")}
        </button>
        <button
          onClick={submit}
          disabled={saving}
          className="px-3 py-1 text-xs rounded bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
        >
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

// ============================================================
// Subscription sidebar item
// ============================================================

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
      className={`group p-2 rounded cursor-pointer transition-colors ${
        selected
          ? "bg-primary/10 ring-1 ring-primary/30"
          : "hover:bg-black/5"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`shrink-0 w-1.5 h-1.5 rounded-full ${
            sub.is_active ? "bg-emerald-500" : "bg-gray-300"
          }`}
        />
        <span
          className={`flex-1 text-sm truncate font-mono ${
            sub.is_active ? "text-app-fg" : "text-app-fg/50"
          }`}
        >
          {sub.keyword_expr}
        </span>
        {unreadCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-[#1A1F2E] font-semibold leading-none">
            {unreadCount}
          </span>
        )}
      </div>
      <div className="mt-1 text-[10px] text-app-fg/50 ml-3.5">
        {sub.sources.join(" · ")} · {sub.frequency} · {t("feed.last_run_prefix")}{" "}
        {sub.last_run_at
          ? new Date(sub.last_run_at).toLocaleDateString()
          : t("feed.last_run_never")}
      </div>
      <div className="mt-1.5 ml-3.5 opacity-0 group-hover:opacity-100 flex gap-2 text-[10px]">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="text-app-fg/60 hover:text-primary"
        >
          {sub.is_active ? t("feed.toggle_pause") : t("feed.toggle_enable")}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="text-app-fg/60 hover:text-primary"
        >
          {t("feed.edit_button")}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-app-fg/60 hover:text-red-600"
        >
          {t("feed.delete_button")}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Result card (one paper from a subscription run)
// ============================================================

function ResultCard({
  result,
  onMarkRead,
}: {
  result: SubscriptionResult;
  onMarkRead: () => void;
}) {
  const t = useT();
  const { paper } = result;
  const sourceCls = SOURCE_BADGE[paper.source] ?? "bg-app-fg/20 text-app-fg";
  return (
    <article
      className={`bg-white border rounded p-3 transition-colors ${
        result.is_read ? "border-black/5 opacity-70" : "border-black/10"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {!result.is_read && (
            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-accent" />
          )}
          <span
            className={`shrink-0 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold ${sourceCls}`}
          >
            {paper.source}
          </span>
          <span className="text-sm font-semibold text-primary leading-snug truncate">
            {paper.title}
          </span>
        </div>
        <span className="shrink-0 text-[10px] text-app-fg/40">
          {new Date(result.found_at).toLocaleString()}
        </span>
      </div>
      <div className="mt-1 text-xs text-app-fg/70">
        {paper.authors.slice(0, 4).join(", ")}
        {paper.authors.length > 4 && t("feed.et_al")}
        {paper.published_at && ` · ${paper.published_at.slice(0, 10)}`}
      </div>
      {paper.abstract && (
        <p className="mt-1.5 text-xs text-app-fg/70 line-clamp-2">
          {paper.abstract}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <PaperActions paper={paper} />
        {!result.is_read && (
          <button
            onClick={onMarkRead}
            className="px-2 py-1 rounded border border-black/10 text-app-fg/60 hover:border-primary/30 text-xs"
          >
            {t("feed.mark_read_button")}
          </button>
        )}
      </div>
    </article>
  );
}

// ============================================================
// Main page
// ============================================================

export default function Feed() {
  const t = useT();
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

  // Group results by subscription_id when in "all" view
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

  // Per-subscription unread count for sidebar badges
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
      alert(t("feed.error_action_failed", { detail: String(e) }));
    }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      await api.runSubscriptionsNow();
      refresh();
    } catch (e) {
      alert(t("feed.error_run_failed", { detail: String(e) }));
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
    if (!confirm(t("feed.confirm_delete", { keyword: sub.keyword_expr })))
      return;
    try {
      await api.deleteSubscription(sub.id);
      if (selectedSub === sub.id) setSelectedSub(null);
      refresh();
    } catch (e) {
      alert(t("feed.error_delete_failed", { detail: String(e) }));
    }
  };

  const handleToggle = async (sub: Subscription) => {
    try {
      await api.toggleSubscriptionActive(sub.id);
      refresh();
    } catch (e) {
      alert(t("feed.error_action_failed", { detail: String(e) }));
    }
  };

  return (
    <div className="flex h-full">
      {/* SIDEBAR */}
      <aside className="w-72 border-r border-black/10 bg-white/40 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-black/5">
          <div className="text-[10px] uppercase tracking-wider text-app-fg/50 mb-2 flex items-center justify-between">
            <span>{t("feed.subscriptions_header")}</span>
            <button
              onClick={() => {
                setShowAddForm(true);
                setEditingSub(null);
              }}
              className="text-[10px] text-primary hover:underline"
            >
              {t("feed.new_button")}
            </button>
          </div>
          <button
            onClick={() => setSelectedSub(null)}
            className={`w-full text-left text-sm px-2 py-1.5 rounded ${
              selectedSub === null
                ? "bg-primary/10 text-primary font-medium"
                : "text-app-fg/70 hover:bg-black/5"
            }`}
          >
            {t("feed.all_pushes")}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {subs.length === 0 && (
            <div className="text-[11px] text-app-fg/40 text-center py-4">
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

      {/* MAIN */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-black/10 p-4 bg-white/30 flex items-baseline gap-3">
          <h1 className="text-xl font-semibold text-primary">
            {t("feed.title")}
          </h1>
          <span className="text-xs text-app-fg/50">
            {t("feed.count_papers", { count: results.length })}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={runNow}
              disabled={running}
              className="px-3 py-1.5 text-xs rounded border border-primary text-primary hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
            >
              {running ? t("feed.running") : t("feed.refresh_now")}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">
              {t("search.error_prefix", { detail: error })}
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

          {!showAddForm && !editingSub && results.length === 0 && (
            <div className="text-sm text-app-fg/50 text-center py-12">
              {subs.length === 0 ? (
                <>
                  {t("feed.no_results_subs_empty_prefix")}
                  <span className="text-primary mx-1">{t("feed.new_link")}</span>
                  {t("feed.no_results_subs_empty_suffix")}
                </>
              ) : (
                <>
                  {t("feed.no_results_run_now_prefix")}
                  <span className="text-primary mx-1">
                    {t("feed.refresh_now_link")}
                  </span>
                  {t("feed.no_results_run_now_suffix")}
                </>
              )}
            </div>
          )}

          {/* Grouped view (only when no specific sub selected, multiple groups) */}
          {selectedSub === null && grouped.size > 1 && (
            <>
              {Array.from(grouped.entries()).map(([subId, group]) => (
                <section key={subId}>
                  <div className="text-xs font-semibold text-app-fg/70 mb-2 flex items-center gap-2">
                    <span className="font-mono text-primary">{group.keyword}</span>
                    <span className="text-app-fg/40">
                      {t("feed.papers_count_short", { count: group.items.length })}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
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

          {/* Flat view (single subscription selected, or only one group) */}
          {(selectedSub !== null || grouped.size <= 1) && results.length > 0 && (
            <div className="flex flex-col gap-2">
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
