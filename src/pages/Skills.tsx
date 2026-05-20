// i18n: 本组件文案已国际化 (V2.1.0)
import { useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  Copy,
  Lock,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import {
  api,
  type SkillSummary,
  type SkillUploadResult,
} from "../lib/tauri";
import { useT } from "../hooks/useT";
import { useToast } from "../hooks/useToast";
import { confirmAsync } from "../components/DialogProvider";
import { Icon } from "../components/Icon";

function SkillRow({
  skill,
  onDelete,
  onEdit,
  onCopy,
  builtin,
}: {
  skill: SkillSummary;
  onDelete?: () => void;
  onEdit?: () => void;
  onCopy?: () => void;
  builtin?: boolean;
}) {
  const t = useT();
  return (
    <div className="bg-card rounded-card shadow-card p-5 flex items-start gap-4 transition-shadow duration-base ease-khx hover:shadow-card-hover">
      <div className="shrink-0 w-11 h-11 rounded-icon bg-indigo-soft text-indigo flex items-center justify-center text-h3 leading-none">
        {/* User-data icon (allowed to be emoji per design-style-spec §A.7) */}
        {skill.icon || (
          <Icon icon={Sparkles} size="base" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-h3 font-semibold text-fg-1 truncate">
            {skill.display_name}
          </div>
          <code className="text-meta font-mono text-fg-3">{skill.name}</code>
          {skill.version && (
            <span className="text-meta text-fg-3 tabular-nums">
              v{skill.version}
            </span>
          )}
          {skill.author && (
            <span className="text-meta text-fg-3">@ {skill.author}</span>
          )}
          {builtin && (
            <span className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-micro font-medium bg-badge-default-bg text-badge-default-fg">
              <Icon icon={Lock} size={10} />
              <span>{t("skills.builtin_badge")}</span>
            </span>
          )}
        </div>
        {skill.description && (
          <p className="mt-1 text-caption text-fg-2 line-clamp-2 leading-relaxed">
            {skill.description}
          </p>
        )}
        {skill.recommended_models.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {skill.recommended_models.map((m) => (
              <span
                key={m}
                className="text-micro px-2 py-0.5 rounded-pill bg-indigo-soft text-indigo"
              >
                {m}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0 flex flex-col gap-1.5">
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-pill border border-border-default text-meta text-fg-1 hover:border-indigo hover:text-indigo transition-colors duration-fast ease-khx"
          >
            <Icon icon={Pencil} size="xs" />
            <span>{t("skills.edit")}</span>
          </button>
        )}
        {onCopy && (
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-pill border border-border-default text-meta text-fg-1 hover:border-indigo hover:text-indigo whitespace-nowrap transition-colors duration-fast ease-khx"
          >
            <Icon icon={Copy} size="xs" />
            <span>{t("skills.duplicate")}</span>
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-pill border border-border-default text-meta text-danger-fg hover:bg-danger-bg hover:border-danger-border transition-colors duration-fast ease-khx"
          >
            <Icon icon={Trash2} size="xs" />
            <span>{t("skills.delete")}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function Skills() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newMenuOpen, setNewMenuOpen] = useState(false);

  const refresh = () => {
    api
      .getSkills()
      .then(setSkills)
      .catch((e) => toast.danger(String(e)));
  };

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

  const handleFileSelected = async (file: File) => {
    const lower = file.name.toLowerCase();

    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const isZipMagic =
      bytes.length >= 4 &&
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      bytes[2] === 0x03 &&
      bytes[3] === 0x04;

    const isYamlLike =
      lower.endsWith(".yaml") ||
      lower.endsWith(".yml") ||
      lower.endsWith(".skill");
    const isZipLike = lower.endsWith(".zip") || isZipMagic;

    if (isZipLike) {
      try {
        const results: SkillUploadResult[] = await api.uploadSkillZip(
          Array.from(bytes),
        );
        const ok = results.filter((r) => r.success).length;
        const fails = results.filter((r) => !r.success);
        if (results.length === 0) {
          toast.danger(t("skills.zip_no_skill", { name: file.name }));
        } else if (fails.length === 0) {
          toast.success(t("skills.zip_ok_count", { name: file.name, ok }));
        } else {
          const description = fails
            .flatMap((f) => f.errors.map((e) => `${f.filename}: ${e}`))
            .join("\n");
          toast.show({
            variant: ok > 0 ? "success" : "danger",
            title: t("skills.zip_mixed", {
              name: file.name,
              ok,
              fail: fails.length,
            }),
            description,
            duration: 6000,
          });
        }
      } catch (e) {
        toast.danger(
          t("skills.zip_parse_failed", {
            name: file.name,
            detail: String(e),
          }),
        );
      }
    } else if (isYamlLike) {
      const text = new TextDecoder("utf-8").decode(bytes);
      try {
        const spec = await api.uploadSkillFile(text, file.name);
        toast.success(
          t("skills.uploaded_toast", { name: spec.display_name }),
        );
      } catch (e) {
        const errors = Array.isArray(e) ? (e as string[]) : [String(e)];
        toast.danger(t("skills.upload_failed_title"), errors.join("\n"));
      }
    } else {
      toast.danger(t("skills.unsupported_format", { name: file.name }));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onUploadClick = () => fileInputRef.current?.click();

  const handleDelete = async (skill: SkillSummary) => {
    const ok = await confirmAsync({
      title: t("skills.confirm_delete_title"),
      description: t("skills.confirm_delete_custom", {
        name: skill.display_name,
      }),
      variant: "danger",
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!ok) return;
    try {
      await api.deleteCustomSkill(skill.name);
      toast.success(t("skills.deleted_toast", { name: skill.display_name }));
      refresh();
    } catch (e) {
      toast.danger(t("skills.delete_failed_toast", { detail: String(e) }));
    }
  };

  const builtin = skills.filter((s) => s.is_builtin);
  const custom = skills.filter((s) => !s.is_builtin);

  return (
    <main role="main" className="p-8 max-w-5xl mx-auto">
      <div className="text-meta text-fg-3 mb-2">
        <span>{t("skills.breadcrumb_settings")}</span>
        <span className="mx-1">/</span>
        <span className="text-fg-2">{t("skills.title")}</span>
      </div>

      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-h2 font-semibold text-fg-1">
            {t("skills.title")}
          </h1>
          <p className="text-meta text-fg-2 mt-1">{t("skills.subtitle")}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => setNewMenuOpen((v) => !v)}
              onBlur={() => setTimeout(() => setNewMenuOpen(false), 150)}
              className="inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill border border-border-default text-caption text-fg-1 hover:border-indigo hover:text-indigo transition-colors duration-fast ease-khx"
            >
              <Icon icon={Plus} size="sm" />
              <span>{t("skills.new")}</span>
              <Icon icon={ChevronDown} size={12} className="text-fg-3" />
            </button>
            {newMenuOpen && (
              <div className="absolute right-0 mt-1 w-72 bg-card rounded-card-sm shadow-nav z-popover overflow-hidden">
                <button
                  type="button"
                  onMouseDown={() => navigate({ to: "/skills/generate" })}
                  className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-caption text-fg-1 hover:bg-indigo-soft transition-colors duration-fast ease-khx"
                >
                  <Icon icon={Sparkles} size="sm" className="text-indigo" />
                  <span>{t("skill_gen.menu_ai")}</span>
                </button>
                <button
                  type="button"
                  onMouseDown={() => navigate({ to: "/skills/new" })}
                  className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-caption text-fg-1 hover:bg-indigo-soft border-t border-border-subtle transition-colors duration-fast ease-khx"
                >
                  <Icon icon={Pencil} size="sm" className="text-indigo" />
                  <span>{t("skill_gen.menu_manual")}</span>
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onUploadClick}
            className="inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill bg-navy text-fg-inverse text-caption font-medium shadow-btn hover:bg-navy-hover hover:shadow-btn-hover hover:-translate-y-px transition-[background,box-shadow,transform] duration-fast ease-khx"
          >
            <Icon icon={Upload} size="sm" />
            <span>{t("skills.upload")}</span>
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

      <section className="mb-8">
        <div className="text-meta uppercase tracking-wide-brand text-fg-3 mb-3 flex items-center gap-2">
          <span>{t("skills.custom_section")}</span>
          <span className="text-fg-3 tabular-nums">({custom.length})</span>
        </div>
        {custom.length === 0 ? (
          <div className="bg-card border border-dashed border-border-default rounded-card p-8 text-center text-caption text-fg-3">
            {t("skills.no_custom_yet")}
          </div>
        ) : (
          <div className="grid gap-3">
            {custom.map((s) => (
              <SkillRow
                key={s.name}
                skill={s}
                onEdit={() =>
                  navigate({
                    to: "/skills/$name/edit",
                    params: { name: s.name },
                  })
                }
                onDelete={() => handleDelete(s)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="text-meta uppercase tracking-wide-brand text-fg-3 mb-3 flex items-center gap-2">
          <span>{t("skills.builtin_section")}</span>
          <span className="text-fg-3 tabular-nums">({builtin.length})</span>
        </div>
        <div className="grid gap-3">
          {builtin.map((s) => (
            <div key={s.name} className="bg-soft rounded-card">
              <SkillRow
                skill={s}
                builtin
                onCopy={() =>
                  navigate({
                    to: "/skills/$name/copy",
                    params: { name: s.name },
                  })
                }
              />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
