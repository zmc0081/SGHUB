/**
 * Skills.draft.tsx — V2.2 SGHUB Capsule
 *
 * Static structural draft for /skills (Skill 管理 / Skills).
 *
 * Layout: single column, p-8 max-w-5xl
 *   - Header: breadcrumb (设置 / Skill 管理) + H1 + subtitle
 *     + right-aligned: [+ 新建 ▾] dropdown + [⬆ 上传 Skill] primary
 *   - Custom section: heading + count + cards (or dashed empty card)
 *   - Built-in section: heading + count + cards (on bg-soft, read-only)
 *
 * "+ 新建 ▾" dropdown:
 *   ✨ 用 AI 创建 → /skills/generate
 *   📝 手动创建 → /skills/new
 *   Both emojis replaced with Lucide (Sparkles / FilePenLine).
 *
 * Upload: hidden <input type="file" accept=".yaml,.yml,.skill,.zip">
 * Toast: global via useToast() (Step 2 §B.1).
 * Delete confirm: confirmAsync() (Step 2 §B.3).
 */

import {
  Plus,
  Upload,
  Sparkles,
  FilePenLine,
  ChevronDown,
  Pencil,
  Trash2,
  Copy,
  Brain,
  X,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Search,
} from 'lucide-react';
// import { useTranslation } from 'react-i18next';
// import { useSkillsStore } from '@/stores/skillsStore';
// import { useToast } from '@/components/ToastProvider';
// import { confirmAsync } from '@/lib/dialog';

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────

interface Skill {
  name: string;            // unique key, e.g. "paper-deep-read"
  displayName: string;
  description: string;
  icon: string;            // free-form: emoji OR Lucide name (per Step 2 §A.7)
  category: 'parsing' | 'summarization' | 'extraction' | 'custom';
  version: string;
  author: string;
  recommendedModels: string[];
  isBuiltIn: boolean;
}

// ───────────────────────────────────────────────────────────────────────────────
// Mock data
// ───────────────────────────────────────────────────────────────────────────────

const MOCK_CUSTOM_SKILLS: Skill[] = [
  {
    name: 'paper-deep-read',
    displayName: '论文深度精读',
    description: '从论文中提取核心贡献、方法、实验结果、局限性,适合科研人员快速建立对论文的全面认识。',
    icon: 'Brain',
    category: 'parsing',
    version: '1.2.0',
    author: 'You',
    recommendedModels: ['claude-opus-4-7', 'gpt-4o'],
    isBuiltIn: false,
  },
  {
    name: 'methodology-extractor',
    displayName: '研究方法提取',
    description: '聚焦论文的方法学部分,输出实验设计、数据集、评估指标、消融分析。',
    icon: 'Sparkles',
    category: 'extraction',
    version: '0.4.1',
    author: 'You',
    recommendedModels: ['claude-opus-4-7'],
    isBuiltIn: false,
  },
];

const MOCK_BUILTIN_SKILLS: Skill[] = [
  {
    name: 'quick-summary',
    displayName: '快速摘要',
    description: '一段式总结论文核心要点,不分章节。适合快速浏览。',
    icon: 'FileText',
    category: 'summarization',
    version: '2.2.0',
    author: 'SGHUB',
    recommendedModels: ['claude-haiku-4-5', 'gpt-4o-mini'],
    isBuiltIn: true,
  },
  {
    name: 'critical-review',
    displayName: '批判性评审',
    description: '从审稿人视角分析论文的贡献声明、方法严谨性、实验充分性、写作清晰度,产出 review 风格的反馈。',
    icon: 'Search',
    category: 'parsing',
    version: '2.2.0',
    author: 'SGHUB',
    recommendedModels: ['claude-opus-4-7'],
    isBuiltIn: true,
  },
  {
    name: 'figure-caption-explainer',
    displayName: '图表解读',
    description: '逐张解释论文中的图表,说明它在论证逻辑中扮演的角色。',
    icon: 'Brain',
    category: 'extraction',
    version: '2.2.0',
    author: 'SGHUB',
    recommendedModels: ['claude-opus-4-7', 'gpt-4o'],
    isBuiltIn: true,
  },
];

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Renders a skill's icon. Skill icon field is free-form text per Step 2 §A.7:
 * users can use a Lucide name (recommended for clarity) or emoji (preserved
 * as user data freedom). In draft we render a single Lucide Brain as a safe
 * placeholder — real implementation looks up the icon string by name.
 */
function SkillIcon() {
  // TODO: dynamic lookup from Lucide icon name. Real implementation:
  //   const IconComponent = LucideIcons[skill.icon as keyof typeof LucideIcons] ?? Brain;
  return (
    <div className="
      w-11 h-11 rounded-icon flex-shrink-0
      bg-indigo-soft text-indigo
      flex items-center justify-center
    ">
      <Brain size={22} strokeWidth={1.5} aria-hidden />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Header with dropdown + upload button
// ───────────────────────────────────────────────────────────────────────────────

function NewSkillDropdown() {
  return (
    <div
      role="menu"
      aria-label="Create new skill"
      className="
        absolute top-full right-0 mt-2
        w-60 rounded-card-sm bg-card shadow-nav
        border border-border-default
        py-2 z-popover
      "
    >
      <a
        href="/skills/generate"
        role="menuitem"
        className="
          flex items-center gap-3 px-4 py-2.5
          text-caption text-fg-1
          hover:bg-navy-faint
          transition-colors duration-fast ease-khx
          focus-visible:outline-none focus-visible:bg-navy-faint
        "
      >
        <Sparkles size={16} strokeWidth={1.5} aria-hidden className="text-indigo flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium">用 AI 创建</p>
          <p className="text-meta text-fg-3 mt-0.5">对话式生成,适合从零开始</p>
        </div>
      </a>
      <div className="border-t border-border-default my-1" />
      <a
        href="/skills/new"
        role="menuitem"
        className="
          flex items-center gap-3 px-4 py-2.5
          text-caption text-fg-1
          hover:bg-navy-faint
          transition-colors duration-fast ease-khx
          focus-visible:outline-none focus-visible:bg-navy-faint
        "
      >
        <FilePenLine size={16} strokeWidth={1.5} aria-hidden className="text-fg-2 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium">手动创建</p>
          <p className="text-meta text-fg-3 mt-0.5">直接编辑 YAML,适合有经验的用户</p>
        </div>
      </a>
    </div>
  );
}

function PageHeader({
  isNewMenuOpen,
}: {
  isNewMenuOpen?: boolean;
}) {
  return (
    <header className="flex items-start justify-between gap-6 mb-8">
      <div>
        <p className="text-meta text-fg-3 mb-1">
          <a
            href="/settings"
            className="hover:text-fg-2 transition-colors duration-fast ease-khx focus-visible:outline-none focus-visible:underline"
          >
            设置
          </a>
          <span className="mx-1.5">/</span>
          <span>Skill 管理</span>
        </p>
        <h1 className="text-h2 font-semibold text-fg-1">Skill 管理</h1>
        <p className="text-meta text-fg-2 mt-1 max-w-xl leading-relaxed">
          Skill 是一段提示词模板,告诉 AI 用什么角度解读文献。内置 3 个,你也可以自己创建或上传。
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* + 新建 dropdown */}
        <div className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={isNewMenuOpen}
            className={`
              inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill border
              text-caption font-medium text-fg-1 border-border-default bg-card
              hover:border-navy-muted hover:bg-navy-faint
              transition-colors duration-fast ease-khx
              focus-visible:outline-none focus-visible:shadow-focus
              ${isNewMenuOpen ? 'bg-navy-faint border-navy-muted' : ''}
            `}
          >
            <Plus size={14} strokeWidth={1.5} aria-hidden />
            <span>新建</span>
            <ChevronDown size={12} strokeWidth={1.5} aria-hidden />
          </button>
          {isNewMenuOpen && <NewSkillDropdown />}
        </div>

        {/* Upload — hidden input + visible button */}
        <label className="
          inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill cursor-pointer
          bg-navy text-text-inverse text-caption font-medium
          shadow-btn hover:bg-navy-hover hover:shadow-btn-hover hover:-translate-y-px
          active:bg-navy-active active:translate-y-0
          transition-[background,box-shadow,transform] duration-fast ease-khx
          focus-within:shadow-[var(--shadow-btn),var(--shadow-focus)]
        ">
          <Upload size={14} strokeWidth={1.5} aria-hidden />
          <span>上传 Skill</span>
          <input
            type="file"
            accept=".yaml,.yml,.skill,.zip"
            multiple
            className="sr-only"
            aria-label="Upload skill file"
          />
        </label>
      </div>
    </header>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Skill row card
// ───────────────────────────────────────────────────────────────────────────────

function SkillRow({ skill }: { skill: Skill }) {
  return (
    <article
      aria-label={`Skill: ${skill.displayName}`}
      className="
        rounded-card bg-card shadow-card p-5
        transition-shadow duration-base ease-khx hover:shadow-card-hover
      "
    >
      <div className="flex items-start gap-4">
        <SkillIcon />

        {/* Main column */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-h3 font-semibold text-fg-1">{skill.displayName}</h3>
            <span className="
              inline-flex items-center px-2 py-0.5 rounded-pill
              bg-badge-default-bg text-badge-default-fg
              text-micro font-mono
            ">
              {skill.name}
            </span>
            <span className="
              inline-flex items-center px-2 py-0.5 rounded-pill
              bg-badge-default-bg text-badge-default-fg
              text-micro font-medium
            ">
              v{skill.version}
            </span>
            <span className="text-meta text-fg-3">· {skill.author}</span>
          </div>

          <p className="text-caption text-fg-2 mt-2 line-clamp-2 leading-relaxed">
            {skill.description}
          </p>

          {/* Recommended models */}
          {skill.recommendedModels.length > 0 && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-meta text-fg-3">推荐:</span>
              {skill.recommendedModels.map((m) => (
                <span
                  key={m}
                  className="
                    inline-flex items-center px-2 py-0.5 rounded-pill
                    bg-soft text-fg-2
                    text-micro font-mono border border-border-default
                  "
                >
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right action column — varies by isBuiltIn */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {skill.isBuiltIn ? (
            // Built-in: only "复制并编辑"
            <button
              type="button"
              className="
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill border
                text-meta font-medium text-fg-1 border-border-default bg-card
                hover:border-navy-muted hover:bg-navy-faint
                transition-colors duration-fast ease-khx
                focus-visible:outline-none focus-visible:shadow-focus
              "
            >
              <Copy size={12} strokeWidth={1.5} aria-hidden />
              <span>复制并编辑</span>
            </button>
          ) : (
            // Custom: edit / copy / delete
            <>
              <button
                type="button"
                aria-label="Edit"
                className="
                  p-2 rounded-pill text-fg-2
                  hover:text-indigo hover:bg-indigo-soft
                  transition-colors duration-fast ease-khx
                  focus-visible:outline-none focus-visible:shadow-focus
                "
                title="编辑"
              >
                <Pencil size={14} strokeWidth={1.5} aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Copy and edit"
                className="
                  p-2 rounded-pill text-fg-2
                  hover:text-indigo hover:bg-indigo-soft
                  transition-colors duration-fast ease-khx
                  focus-visible:outline-none focus-visible:shadow-focus
                "
                title="复制并编辑"
              >
                <Copy size={14} strokeWidth={1.5} aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Delete"
                className="
                  p-2 rounded-pill text-fg-2
                  hover:text-danger-fg hover:bg-danger-bg
                  transition-colors duration-fast ease-khx
                  focus-visible:outline-none focus-visible:shadow-focus
                "
                title="删除"
              >
                <Trash2 size={14} strokeWidth={1.5} aria-hidden />
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Section wrappers
// ───────────────────────────────────────────────────────────────────────────────

function CustomSection({ skills }: { skills: Skill[] }) {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-h3 font-semibold text-fg-1">
          自定义 Skill
          <span className="text-fg-3 font-normal ml-2 tabular-nums">{skills.length}</span>
        </h2>
      </div>

      {skills.length === 0 ? (
        <div className="
          rounded-card border border-dashed border-border-default
          py-10 px-8 text-center bg-card
        ">
          <Sparkles size={40} strokeWidth={1.5} aria-hidden className="mx-auto text-fg-3" />
          <h3 className="text-h3 font-semibold text-fg-1 mt-4">
            还没有自定义 Skill
          </h3>
          <p className="text-caption text-fg-2 mt-2 max-w-md mx-auto leading-relaxed">
            点击右上「新建」或「上传 Skill」开始。也可以从内置 Skill 复制一份再修改。
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {skills.map((s) => (
            <SkillRow key={s.name} skill={s} />
          ))}
        </div>
      )}
    </section>
  );
}

function BuiltInSection({ skills }: { skills: Skill[] }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-h3 font-semibold text-fg-1">
          内置 Skill
          <span className="text-fg-3 font-normal ml-2 tabular-nums">{skills.length}</span>
        </h2>
        <span className="
          inline-flex items-center gap-1 px-2 py-0.5 rounded-pill
          bg-badge-default-bg text-badge-default-fg
          text-micro font-medium
        ">
          <Lock size={10} strokeWidth={2} aria-hidden />
          <span>只读 · 通过「复制并编辑」改造</span>
        </span>
      </div>

      <div className="
        rounded-card bg-soft p-3
      ">
        <div className="flex flex-col gap-3">
          {skills.map((s) => (
            <SkillRow key={s.name} skill={s} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN — happy path
// ═══════════════════════════════════════════════════════════════════════════════

export default function SkillsPage() {
  // TODO: from useSkillsStore()
  const customSkills = MOCK_CUSTOM_SKILLS;
  const builtInSkills = MOCK_BUILTIN_SKILLS;

  return (
    <main role="main" className="p-8 max-w-5xl mx-auto">
      <PageHeader />
      <CustomSection skills={customSkills} />
      <BuiltInSection skills={builtInSkills} />
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY CUSTOM — no custom skills yet
// ═══════════════════════════════════════════════════════════════════════════════

export function SkillsPageEmptyCustom() {
  return (
    <main role="main" className="p-8 max-w-5xl mx-auto">
      <PageHeader />
      <CustomSection skills={[]} />
      <BuiltInSection skills={MOCK_BUILTIN_SKILLS} />
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW MENU OPEN — + dropdown expanded
// ═══════════════════════════════════════════════════════════════════════════════

export function SkillsPageNewMenuOpen() {
  return (
    <main role="main" className="p-8 max-w-5xl mx-auto">
      <PageHeader isNewMenuOpen />
      <CustomSection skills={MOCK_CUSTOM_SKILLS} />
      <BuiltInSection skills={MOCK_BUILTIN_SKILLS} />
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPLOADING — file picked, validation in flight
// ═══════════════════════════════════════════════════════════════════════════════

export function SkillsPageUploading() {
  return (
    <main role="main" className="p-8 max-w-5xl mx-auto">
      <PageHeader />

      {/* Uploading banner above sections */}
      <div
        role="status"
        aria-live="polite"
        className="
          flex items-start gap-3 rounded-card-sm border border-warning-border bg-warning-bg
          px-4 py-3 mb-6
        "
      >
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          aria-hidden
          className="animate-spin text-warning-fg-strong flex-shrink-0 mt-0.5"
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="42 18"
          />
        </svg>
        <div className="flex-1">
          <p className="text-caption font-medium text-warning-fg-strong">
            正在校验 my-custom-skill.yaml…
          </p>
          <p className="text-meta text-fg-2 mt-0.5">
            检查 YAML 结构、变量引用、推荐模型是否合法。
          </p>
        </div>
      </div>

      <CustomSection skills={MOCK_CUSTOM_SKILLS} />
      <BuiltInSection skills={MOCK_BUILTIN_SKILLS} />
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPLOAD FAILED — YAML validation failed
// ═══════════════════════════════════════════════════════════════════════════════

export function SkillsPageUploadFailed() {
  return (
    <main role="main" className="p-8 max-w-5xl mx-auto">
      <PageHeader />

      <div
        role="alert"
        className="
          flex items-start gap-3 rounded-card-sm border border-danger-border bg-danger-bg
          px-4 py-3 mb-6
        "
      >
        <AlertTriangle
          size={18}
          strokeWidth={1.5}
          aria-hidden
          className="text-danger-fg flex-shrink-0 mt-0.5"
        />
        <div className="flex-1">
          <p className="text-caption font-medium text-fg-1">
            上传失败:my-broken-skill.yaml 不是合法的 Skill 文件
          </p>
          <p className="text-meta text-fg-2 mt-1">
            YAML 解析错误(第 14 行):缺少必填字段 <span className="font-mono text-danger-fg">prompt_template</span>。
            请参考{' '}
            <a
              href="#"
              className="
                text-indigo font-medium hover:text-indigo-hover hover:underline
                transition-colors duration-fast ease-khx
              "
            >
              Skill 规范
            </a>
            ,修正后重新上传。
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          className="
            p-1 rounded-pill text-fg-2 hover:text-fg-1 hover:bg-navy-faint
            transition-colors duration-fast ease-khx
            focus-visible:outline-none focus-visible:shadow-focus
          "
        >
          <X size={14} strokeWidth={1.5} aria-hidden />
        </button>
      </div>

      <CustomSection skills={MOCK_CUSTOM_SKILLS} />
      <BuiltInSection skills={MOCK_BUILTIN_SKILLS} />
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOAST VISIBLE — success toast shown after delete / upload
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SkillsPageToastVisible — main page with a global Toast hovering top-right.
 * Real Toast is rendered via ToastProvider portal (Step 2 §B.1). This draft
 * inlines the toast structure so designers can see it in place.
 */
export function SkillsPageToastVisible() {
  return (
    <>
      <main role="main" className="p-8 max-w-5xl mx-auto">
        <PageHeader />
        <CustomSection skills={MOCK_CUSTOM_SKILLS} />
        <BuiltInSection skills={MOCK_BUILTIN_SKILLS} />
      </main>

      {/* Inline toast preview — real implementation via ToastProvider portal */}
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        className="fixed top-12 right-4 z-toast flex flex-col gap-2"
      >
        <div
          role="status"
          className="
            w-80 rounded-card-sm bg-success-bg border border-success-border
            shadow-nav overflow-hidden
            flex items-stretch
          "
        >
          <div className="w-1 bg-success-fg flex-shrink-0" aria-hidden />
          <div className="flex-1 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2
                size={20}
                strokeWidth={1.5}
                aria-hidden
                className="text-success-fg flex-shrink-0 mt-0.5"
              />
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-caption font-semibold text-fg-1">
                    已删除 Skill
                  </p>
                  <button
                    type="button"
                    aria-label="Dismiss"
                    className="
                      p-0.5 rounded-pill text-fg-3 hover:text-fg-1 hover:bg-navy-faint
                      transition-colors duration-fast ease-khx
                      focus-visible:outline-none focus-visible:shadow-focus
                    "
                  >
                    <X size={14} strokeWidth={1.5} aria-hidden />
                  </button>
                </div>
                <p className="text-meta text-fg-2 mt-1">
                  「方法论提取」已从自定义 Skill 中移除
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
