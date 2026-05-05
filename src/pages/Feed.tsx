import { useEffect, useMemo, useState } from "react";
import {
  api,
  type Subscription,
  type SubscriptionInput,
  type SubscriptionResult,
} from "../lib/tauri";

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
  { value: "daily", label: "每天" },
  { value: "weekly", label: "每周" },
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
      setErr("请输入关键词");
      return;
    }
    if (form.sources.length === 0) {
      setErr("至少选择一个数据源");
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
        {isEdit ? "编辑订阅" : "新建订阅"}
      </div>

      <label className="block">
        <div className="text-xs text-app-fg/60 mb-1">关键词表达式</div>
        <input
          value={form.keyword_expr}
          onChange={(e) =>
            setForm((f) => ({ ...f, keyword_expr: e.target.value }))
          }
          placeholder='如: "LLM alignment" OR "RLHF"'
          className="w-full px-2.5 py-1.5 text-sm border border-black/10 rounded font-mono focus:outline-none focus:border-primary"
        />
      </label>

      <div>
        <div className="text-xs text-app-fg/60 mb-1.5">数据源</div>
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
          <div className="text-xs text-app-fg/60 mb-1">频率</div>
          <select
            value={form.frequency}
            onChange={(e) =>
              setForm((f) => ({ ...f, frequency: e.target.value }))
            }
            className="w-full px-2.5 py-1.5 text-sm border border-black/10 rounded bg-white"
          >
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <div className="text-xs text-app-fg/60 mb-1">每次最多</div>
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
          取消
        </button>
        <button
          onClick={submit}
          disabled={saving}
          className="px-3 py-1 text-xs rounded bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "保存中…" : isEdit ? "保存修改" : "创建"}
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
        {sub.sources.join(" · ")} · {sub.frequency} · 上次{" "}
        {sub.last_run_at
          ? new Date(sub.last_run_at).toLocaleDateString()
          : "从未"}
      </div>
      <div className="mt-1.5 ml-3.5 opacity-0 group-hover:opacity-100 flex gap-2 text-[10px]">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="text-app-fg/60 hover:text-primary"
        >
          {sub.is_active ? "暂停" : "启用"}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="text-app-fg/60 hover:text-primary"
        >
          编辑
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-app-fg/60 hover:text-red-600"
        >
          删除
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
  onCollect,
  onMarkRead,
}: {
  result: SubscriptionResult;
  onCollect: () => void;
  onMarkRead: () => void;
}) {
  const { paper } = result;
  const sourceCls =
    SOURCE_BADGE[paper.source] ?? "bg-app-fg/20 text-app-fg";
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
          <a
            href={paper.source_url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-primary hover:underline leading-snug truncate"
          >
            {paper.title}
          </a>
        </div>
        <span className="shrink-0 text-[10px] text-app-fg/40">
          {new Date(result.found_at).toLocaleString()}
        </span>
      </div>
      <div className="mt-1 text-xs text-app-fg/70">
        {paper.authors.slice(0, 4).join(", ")}
        {paper.authors.length > 4 && ` 等`}
        {paper.published_at && ` · ${paper.published_at.slice(0, 10)}`}
      </div>
      {paper.abstract && (
        <p className="mt-1.5 text-xs text-app-fg/70 line-clamp-2">
          {paper.abstract}
        </p>
      )}
      <div className="mt-2 flex items-center gap-1.5 text-[11px]">
        <button
          onClick={onCollect}
          className="px-2 py-0.5 rounded border border-black/10 hover:border-primary/30 hover:bg-primary/5"
        >
          ⭐ 收藏
        </button>
        <button
          onClick={() => alert("AI 精读 — 跳转 /parse 待接入")}
          className="px-2 py-0.5 rounded border border-black/10 hover:border-primary/30 hover:bg-primary/5"
        >
          🧠 AI 精读
        </button>
        {!result.is_read && (
          <button
            onClick={onMarkRead}
            className="px-2 py-0.5 rounded border border-black/10 text-app-fg/60 hover:border-primary/30"
          >
            标已读
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

  const collect = async (paperId: string) => {
    try {
      const folders = await api.getFolders();
      if (folders.length === 0) {
        alert("还没有文件夹 — 请先到「⭐ 收藏夹」新建");
        return;
      }
      const list = folders.map((f, i) => `${i + 1}. ${f.name}`).join("\n");
      const choice = prompt(`添加到哪个文件夹?\n\n${list}`, "1");
      if (!choice) return;
      const idx = parseInt(choice, 10) - 1;
      if (Number.isNaN(idx) || idx < 0 || idx >= folders.length) return;
      await api.addToFolder(folders[idx].id, paperId);
      alert(`✓ 已加入「${folders[idx].name}」`);
    } catch (e) {
      alert(`收藏失败: ${e}`);
    }
  };

  const markRead = async (subId: string, paperId: string) => {
    try {
      await api.markSubscriptionPaperRead(subId, paperId);
      refresh();
    } catch (e) {
      alert(`操作失败: ${e}`);
    }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      await api.runSubscriptionsNow();
      refresh();
    } catch (e) {
      alert(`运行失败: ${e}`);
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
    if (!confirm(`删除订阅「${sub.keyword_expr}」?所有推送结果一并清除。`))
      return;
    try {
      await api.deleteSubscription(sub.id);
      if (selectedSub === sub.id) setSelectedSub(null);
      refresh();
    } catch (e) {
      alert(`删除失败: ${e}`);
    }
  };

  const handleToggle = async (sub: Subscription) => {
    try {
      await api.toggleSubscriptionActive(sub.id);
      refresh();
    } catch (e) {
      alert(`操作失败: ${e}`);
    }
  };

  return (
    <div className="flex h-full">
      {/* SIDEBAR */}
      <aside className="w-72 border-r border-black/10 bg-white/40 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-black/5">
          <div className="text-[10px] uppercase tracking-wider text-app-fg/50 mb-2 flex items-center justify-between">
            <span>订阅</span>
            <button
              onClick={() => {
                setShowAddForm(true);
                setEditingSub(null);
              }}
              className="text-[10px] text-primary hover:underline"
            >
              + 新建
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
            📰 全部推送
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {subs.length === 0 && (
            <div className="text-[11px] text-app-fg/40 text-center py-4">
              还没有订阅
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
          <h1 className="text-xl font-semibold text-primary">今日推送</h1>
          <span className="text-xs text-app-fg/50">{results.length} 篇</span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={runNow}
              disabled={running}
              className="px-3 py-1.5 text-xs rounded border border-primary text-primary hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
            >
              {running ? "运行中…" : "🔄 立即刷新"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">
              错误: {error}
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
                  还没有订阅 — 点左侧
                  <span className="text-primary mx-1">+ 新建</span>
                  开始
                </>
              ) : (
                <>
                  暂无推送结果 — 点右上
                  <span className="text-primary mx-1">立即刷新</span>
                  立即跑一次活跃订阅
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
                    <span className="text-app-fg/40">· {group.items.length} 篇</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {group.items.map((r) => (
                      <ResultCard
                        key={`${r.subscription_id}-${r.paper.id}`}
                        result={r}
                        onCollect={() => collect(r.paper.id)}
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
                  onCollect={() => collect(r.paper.id)}
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
