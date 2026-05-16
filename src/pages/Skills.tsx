// i18n: 本组件文案已国际化 (V2.1.0)
import { useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useNavigate } from "@tanstack/react-router";
import {
  api,
  type SkillSummary,
  type SkillUploadResult,
} from "../lib/tauri";
import { useT } from "../hooks/useT";

// ============================================================
// Toast (light, in-component — avoids adding a UI dep)
// ============================================================

type ToastKind = "success" | "error";
type Toast = { id: number; kind: ToastKind; lines: string[] };

let toastSeq = 0;

function ToastList({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="fixed top-12 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-3 py-2 rounded shadow-lg border text-sm ${
            t.kind === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-900"
              : "bg-red-50 border-red-300 text-red-900"
          }`}
        >
          <div className="flex items-start gap-2">
            <span className="shrink-0">
              {t.kind === "success" ? "✓" : "✕"}
            </span>
            <div className="flex-1 min-w-0">
              {t.lines.map((l, i) => (
                <div key={i} className="break-words">
                  {t.lines.length > 1 ? (
                    <span className="text-app-fg/50 mr-1.5">{i + 1}.</span>
                  ) : null}
                  {l}
                </div>
              ))}
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              className="shrink-0 text-app-fg/40 hover:text-app-fg"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Skill card
// ============================================================

function SkillRow({
  skill,
  onDelete,
  onEdit,
  onCopy,
}: {
  skill: SkillSummary;
  onDelete?: () => void;
  onEdit?: () => void;
  onCopy?: () => void;
}) {
  const t = useT();
  return (
    <div className="bg-white border border-black/10 rounded p-3 flex items-start gap-3">
      <div className="text-2xl shrink-0 leading-none mt-0.5">
        {skill.icon || "🤖"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-semibold text-primary truncate">
            {skill.display_name}
          </div>
          <code className="text-[10px] text-app-fg/40">{skill.name}</code>
          {skill.version && (
            <span className="text-[10px] text-app-fg/40">v{skill.version}</span>
          )}
          {skill.author && (
            <span className="text-[10px] text-app-fg/50">@ {skill.author}</span>
          )}
        </div>
        {skill.description && (
          <p className="mt-0.5 text-xs text-app-fg/70 line-clamp-2">
            {skill.description}
          </p>
        )}
        {skill.recommended_models.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {skill.recommended_models.map((m) => (
              <span
                key={m}
                className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary"
              >
                {m}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0 flex flex-col gap-1">
        {onEdit && (
          <button
            onClick={onEdit}
            className="px-2 py-1 text-[11px] rounded border border-black/10 hover:border-primary hover:text-primary"
          >
            {t("skills.edit")}
          </button>
        )}
        {onCopy && (
          <button
            onClick={onCopy}
            className="px-2 py-1 text-[11px] rounded border border-black/10 hover:border-primary hover:text-primary whitespace-nowrap"
          >
            {t("skills.duplicate")}
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="px-2 py-1 text-[11px] rounded border border-black/10 text-red-600 hover:border-red-600 hover:bg-red-50"
          >
            {t("skills.delete")}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main page
// ============================================================

export default function Skills() {
  const t = useT();
  const navigate = useNavigate();
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    api.getSkills().then(setSkills).catch((e) => pushToast("error", [String(e)]));
  };

  // Initial load + listen for "skills:updated" so other windows / batch
  // uploads refresh the list automatically. Self-contained so we don't
  // depend on the outer `refresh` closure.
  useEffect(() => {
    const reload = () => {
      api.getSkills().then(setSkills).catch((e) => console.warn(e));
    };
    reload();
    let unlisten: UnlistenFn | undefined;
    listen("skills:updated", () => reload()).then((u) => {
      unlisten = u;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  const pushToast = (kind: ToastKind, lines: string[]) => {
    const id = ++toastSeq;
    setToasts((prev) => [...prev, { id, kind, lines }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleFileSelected = async (file: File) => {
    const lower = file.name.toLowerCase();

    // Always read as bytes — many .skill files are binary zip archives
    // (Anthropic Skills convention) so we sniff the magic.
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const isZipMagic =
      bytes.length >= 4 &&
      bytes[0] === 0x50 && // P
      bytes[1] === 0x4b && // K
      bytes[2] === 0x03 &&
      bytes[3] === 0x04;

    const isYamlLike =
      lower.endsWith(".yaml") ||
      lower.endsWith(".yml") ||
      lower.endsWith(".skill");
    const isZipLike = lower.endsWith(".zip") || isZipMagic;

    if (isZipLike) {
      // ZIP path — covers .zip AND binary .skill (Anthropic packaged format)
      try {
        const results: SkillUploadResult[] = await api.uploadSkillZip(
          Array.from(bytes),
        );
        const ok = results.filter((r) => r.success).length;
        const fails = results.filter((r) => !r.success);
        if (results.length === 0) {
          pushToast("error", [
            t("skills.zip_no_skill", { name: file.name }),
          ]);
        } else if (fails.length === 0) {
          pushToast("success", [
            t("skills.zip_ok_count", { name: file.name, ok }),
          ]);
        } else {
          const lines = [
            t("skills.zip_mixed", {
              name: file.name,
              ok,
              fail: fails.length,
            }),
            ...fails.flatMap((f) =>
              f.errors.map((e) => `  ${f.filename}: ${e}`),
            ),
          ];
          pushToast(ok > 0 ? "success" : "error", lines);
        }
      } catch (e) {
        pushToast("error", [
          t("skills.zip_parse_failed", {
            name: file.name,
            detail: String(e),
          }),
        ]);
      }
    } else if (isYamlLike) {
      // Text path — decode UTF-8 and dispatch
      const text = new TextDecoder("utf-8").decode(bytes);
      try {
        const spec = await api.uploadSkillFile(text, file.name);
        pushToast("success", [
          t("skills.uploaded_toast", { name: spec.display_name }),
        ]);
      } catch (e) {
        const errors = Array.isArray(e) ? (e as string[]) : [String(e)];
        pushToast("error", errors);
      }
    } else {
      pushToast("error", [
        t("skills.unsupported_format", { name: file.name }),
      ]);
    }
    // Reset input so the same file can be picked again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onUploadClick = () => fileInputRef.current?.click();

  const handleDelete = async (skill: SkillSummary) => {
    if (
      !confirm(
        t("skills.confirm_delete_custom", { name: skill.display_name }),
      )
    )
      return;
    try {
      await api.deleteCustomSkill(skill.name);
      pushToast("success", [
        t("skills.deleted_toast", { name: skill.display_name }),
      ]);
      refresh();
    } catch (e) {
      pushToast("error", [
        t("skills.delete_failed_toast", { detail: String(e) }),
      ]);
    }
  };

  const builtin = skills.filter((s) => s.is_builtin);
  const custom = skills.filter((s) => !s.is_builtin);

  return (
    <div className="p-8 max-w-5xl">
      <ToastList toasts={toasts} onDismiss={dismissToast} />

      <div className="text-xs text-app-fg/50 mb-2">
        <span>{t("skills.breadcrumb_settings")}</span>
        <span className="mx-1">/</span>
        <span className="text-app-fg/80">{t("skills.title")}</span>
      </div>

      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary mb-1">
            {t("skills.title")}
          </h1>
          <p className="text-sm text-app-fg/60">{t("skills.subtitle")}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => navigate({ to: "/skills/new" })}
            className="px-3 py-1.5 text-sm rounded border border-primary text-primary hover:bg-primary/5"
          >
            {t("skills.new")}
          </button>
          <button
            onClick={onUploadClick}
            className="px-3 py-1.5 text-sm rounded bg-primary text-white hover:bg-primary/90"
          >
            {t("skills.upload")}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml,.skill,.zip"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelected(f);
            }}
          />
        </div>
      </div>

      {/* Custom Skills */}
      <section className="mb-8">
        <div className="text-xs uppercase tracking-wider text-app-fg/50 mb-2 flex items-center gap-2">
          <span>{t("skills.custom_section")}</span>
          <span className="text-app-fg/40">({custom.length})</span>
        </div>
        {custom.length === 0 ? (
          <div className="bg-white border border-dashed border-black/15 rounded p-6 text-center text-sm text-app-fg/50">
            {t("skills.no_custom_yet")}
          </div>
        ) : (
          <div className="grid gap-2">
            {custom.map((s) => (
              <SkillRow
                key={s.name}
                skill={s}
                onEdit={() => navigate({ to: "/skills/$name/edit", params: { name: s.name } })}
                onDelete={() => handleDelete(s)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Builtin Skills */}
      <section>
        <div className="text-xs uppercase tracking-wider text-app-fg/50 mb-2 flex items-center gap-2">
          <span>{t("skills.builtin_section")}</span>
          <span className="text-app-fg/40">({builtin.length})</span>
        </div>
        <div className="grid gap-2 opacity-90">
          {builtin.map((s) => (
            <div key={s.name} className="bg-black/5 rounded">
              <SkillRow
                skill={s}
                onCopy={() =>
                  navigate({ to: "/skills/$name/copy", params: { name: s.name } })
                }
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
