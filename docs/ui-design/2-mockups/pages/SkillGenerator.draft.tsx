/**
 * SkillGenerator.draft.tsx — V2.2 SGHUB Capsule
 *
 * Static structural draft for /skills/generate (用 AI 创建 Skill).
 *
 * Layout: 50/50 horizontal split
 *   ┌─────────────────────────┬─────────────────────────────────┐
 *   │ LEFT: Conversation      │ RIGHT: Preview with Tabs        │
 *   │   - Header + ModelPicker│   - [配置] [YAML 源码] [测试运行] │
 *   │   - Conversation area   │   - Tab panel content            │
 *   │     (scrolls)           │   - (scrolls)                    │
 *   │   - Input (textarea +   │   - Footer:                      │
 *   │     send)               │     [保存为 Skill] (primary)     │
 *   │                         │     [切换到高级编辑器] (link)    │
 *   │                         │     [重新开始] (danger link)     │
 *   └─────────────────────────┴─────────────────────────────────┘
 *
 * 5 conversation bubble forms (per requirement):
 *   1. EmptyTipsBubble (left col empty state) — 3 example prompts
 *   2. NoModelBanner — no usable model configured
 *   3. GeneratingBubble — AI is generating ("正在生成…")
 *   4. FirstGenDoneBubble — first generation completed
 *   5. RefinedBubble — refinement applied, with optional auto-retry sub-line
 *
 * These bubbles compose into 6 page-level exports:
 *   Main / EmptyTipsCard / NoModelBanner / FirstGeneration / Refining /
 *   Refined / YamlTab / TestRunTab / AutoRetry
 */

import {
  Sparkles,
  ArrowUp,
  Loader2,
  Save,
  Settings as SettingsIcon,
  Trash2,
  Bot,
  User,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  Play,
  Lightbulb,
  RotateCcw,
  FileCode,
  TestTube2,
  Check,
} from 'lucide-react';
// import { useTranslation } from 'react-i18next';
// import { useSkillGeneratorStore } from '@/stores/skillGeneratorStore';

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────

type RightTab = 'config' | 'yaml' | 'test';

interface GeneratorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** AI message variants */
  variant?: 'generating' | 'first-done' | 'refined' | 'auto-retry';
  autoRetryNote?: string;  // shown below message body for auto-retry variant
}

interface SkillDraft {
  name: string;
  displayName: string;
  description: string;
  recommendedModels: string[];
  outputDimensions: Array<{ key: string; label: string; description: string }>;
  promptTemplate: string;
  yamlSource: string;
}

// ───────────────────────────────────────────────────────────────────────────────
// Mock data
// ───────────────────────────────────────────────────────────────────────────────

const MOCK_SKILL_DRAFT: SkillDraft = {
  name: 'experimental-evaluation-extractor',
  displayName: '实验评估提取',
  description: '从论文的实验章节中提取数据集、评估指标、对比基线、消融实验,产出结构化的实验摘要。',
  recommendedModels: ['claude-opus-4-7', 'gpt-4o'],
  outputDimensions: [
    { key: 'datasets', label: '数据集', description: '使用了哪些数据集,规模与划分' },
    { key: 'metrics',  label: '评估指标', description: '主要指标 + 选择该指标的理由' },
    { key: 'baselines', label: '对比基线', description: '与哪些方法对比,基线的关键引用' },
    { key: 'ablations', label: '消融研究', description: '消融实验设计与得出的结论' },
  ],
  promptTemplate: `你是一位严谨的科研助手。请从以下论文的实验章节中提取关键信息。

论文标题:{{title}}
作者:{{authors}}
摘要:{{abstract}}
全文:{{full_text}}

请按以下维度结构化输出...`,
  yamlSource: `name: experimental-evaluation-extractor
display_name: 实验评估提取
description: |
  从论文的实验章节中提取数据集、评估指标、对比基线、
  消融实验,产出结构化的实验摘要。
icon: TestTube2
category: extraction
recommended_models:
  - claude-opus-4-7
  - gpt-4o

output_dimensions:
  - key: datasets
    label: 数据集
  - key: metrics
    label: 评估指标
  - key: baselines
    label: 对比基线
  - key: ablations
    label: 消融研究

prompt_template: |
  你是一位严谨的科研助手。请从以下论文的实验章节中提取
  关键信息。

  论文标题:{{title}}
  作者:{{authors}}
  摘要:{{abstract}}
  全文:{{full_text}}

  请按以下维度结构化输出...`,
};

const MOCK_MESSAGES_FIRST_DONE: GeneratorMessage[] = [
  {
    id: 'um1',
    role: 'user',
    content: '我想要一个 Skill,能从论文里提取实验部分的关键信息:用了什么数据集、什么评估指标、和什么方法比较、有没有消融实验。',
  },
  {
    id: 'am1',
    role: 'assistant',
    content: '好的,我已经为你生成了一个 Skill「实验评估提取」,它包含 4 个输出维度(数据集 / 评估指标 / 对比基线 / 消融研究),适合用于实证类论文。在右侧可以预览配置,如果有需要调整的地方告诉我。',
    variant: 'first-done',
  },
];

const MOCK_MESSAGES_REFINING: GeneratorMessage[] = [
  ...MOCK_MESSAGES_FIRST_DONE,
  {
    id: 'um2',
    role: 'user',
    content: '能不能再加一个维度叫「实验环境」,包括硬件配置(GPU 型号 / 内存)和软件依赖(框架版本)?',
  },
  {
    id: 'am2',
    role: 'assistant',
    content: '正在更新 Skill 配置…',
    variant: 'generating',
  },
];

const MOCK_MESSAGES_REFINED: GeneratorMessage[] = [
  ...MOCK_MESSAGES_FIRST_DONE,
  {
    id: 'um2',
    role: 'user',
    content: '能不能再加一个维度叫「实验环境」,包括硬件配置(GPU 型号 / 内存)和软件依赖(框架版本)?',
  },
  {
    id: 'am2',
    role: 'assistant',
    content: '已根据反馈更新:新增了「实验环境」维度,prompt 模板里增加了对硬件配置与软件依赖的指引。右侧预览已同步刷新。',
    variant: 'refined',
  },
];

const MOCK_MESSAGES_AUTO_RETRY: GeneratorMessage[] = [
  ...MOCK_MESSAGES_FIRST_DONE,
  {
    id: 'um2',
    role: 'user',
    content: '能不能让输出更加结构化,把每个维度的结果都用 markdown 表格呈现?',
  },
  {
    id: 'am2',
    role: 'assistant',
    content: '已根据反馈更新:为每个 output_dimension 增加了 markdown 表格指令。',
    variant: 'refined',
    autoRetryNote: '已自动重试修正:首次生成的 YAML 缩进不一致,已自动修复并重新校验。',
  },
];

// ───────────────────────────────────────────────────────────────────────────────
// Left column: Model picker
// ───────────────────────────────────────────────────────────────────────────────

function ModelPicker({
  selectedModel,
  hasModels,
}: {
  selectedModel: string;
  hasModels: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-meta text-fg-3 flex-shrink-0">使用模型</label>
      <div className="relative max-w-[180px]">
        <div className={`
          inline-flex items-center gap-1.5 pl-3 pr-7 py-1.5 rounded-pill border w-full
          text-meta font-mono
          ${hasModels
            ? 'bg-card text-fg-1 border-border-default cursor-pointer hover:border-navy-muted hover:bg-navy-faint'
            : 'bg-soft text-fg-3 border-border-default cursor-not-allowed opacity-60'}
          transition-colors duration-fast ease-khx
        `}>
          <Bot size={12} strokeWidth={1.5} aria-hidden className={hasModels ? 'text-indigo flex-shrink-0' : 'text-fg-3 flex-shrink-0'} />
          <span className="truncate">{hasModels ? selectedModel : '无可用模型'}</span>
        </div>
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          aria-hidden
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-2 pointer-events-none"
        />
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Bubble form 1: EmptyTipsCard (left column empty state)
// ───────────────────────────────────────────────────────────────────────────────

function EmptyTipsBubble() {
  const tips = [
    '帮我做一个 Skill,从论文里提取核心贡献、方法、实验、局限性',
    '我想要一个能从医学论文里提取 PICO(人群/干预/对照/结局)的 Skill',
    '设计一个 Skill,把论文的图表解读成自然语言描述',
  ];

  return (
    <div
      role="region"
      aria-label="Tips for getting started"
      className="
        rounded-card bg-info-bg border border-info-border
        p-5
      "
    >
      <div className="flex items-start gap-3">
        <Lightbulb
          size={20}
          strokeWidth={1.5}
          aria-hidden
          className="text-info-fg flex-shrink-0 mt-0.5"
        />
        <div className="flex-1">
          <p className="text-caption font-semibold text-fg-1">
            从一个想法开始 — 试试这些例子
          </p>
          <ul className="mt-3 space-y-2">
            {tips.map((tip, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="
                    w-full text-left px-3 py-2 rounded-card-sm
                    text-meta text-fg-1 bg-card border border-border-default
                    hover:border-indigo-muted hover:bg-indigo-soft
                    transition-colors duration-fast ease-khx
                    focus-visible:outline-none focus-visible:shadow-focus
                  "
                >
                  {tip}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Bubble form 2: NoModelBanner
// ───────────────────────────────────────────────────────────────────────────────

function NoModelBanner() {
  return (
    <div
      role="alert"
      className="
        flex items-start gap-3 rounded-card-sm border border-warning-border bg-warning-bg
        px-4 py-3
      "
    >
      <AlertTriangle
        size={18}
        strokeWidth={1.5}
        aria-hidden
        className="text-warning-fg-strong flex-shrink-0 mt-0.5"
      />
      <div className="flex-1">
        <p className="text-caption font-medium text-warning-fg-strong">
          还没有可用的模型
        </p>
        <p className="text-meta text-fg-2 mt-1">
          AI 创建 Skill 需要至少一个已配置且 Key 有效的模型。请先去
          <a
            href="/models"
            className="
              inline-flex items-center gap-0.5 ml-1
              text-indigo font-medium hover:text-indigo-hover hover:underline
              transition-colors duration-fast ease-khx
              focus-visible:outline-none focus-visible:underline
            "
          >
            <span>模型配置</span>
            <ExternalLink size={11} strokeWidth={1.5} aria-hidden />
          </a>
          添加。
        </p>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Bubble forms 3-5: Generating / FirstGenDone / Refined / AutoRetry
// All rendered through a single <AssistantBubble> with `variant` prop.
// ───────────────────────────────────────────────────────────────────────────────

function AssistantBubble({ message }: { message: GeneratorMessage }) {
  const variantIndicator = {
    'generating':  { icon: Loader2, label: '正在生成…',   class: 'text-warning-fg-strong animate-spin' },
    'first-done':  { icon: Check,   label: 'Skill 已生成', class: 'text-success-fg' },
    'refined':     { icon: Check,   label: '已根据反馈更新', class: 'text-success-fg' },
    'auto-retry':  { icon: Check,   label: '已根据反馈更新', class: 'text-success-fg' },
  }[message.variant ?? 'first-done'];

  return (
    <div className="flex items-start gap-3">
      <div className="
        flex-shrink-0 w-7 h-7 rounded-full
        bg-indigo-soft text-indigo
        flex items-center justify-center
      ">
        <Bot size={14} strokeWidth={1.5} aria-hidden />
      </div>

      <div className="flex-1 max-w-[560px]">
        <article className="rounded-card bg-card shadow-card-sm border border-border-default px-4 py-3">
          {/* Status pill at top */}
          <div className="flex items-center gap-1.5 mb-2">
            <variantIndicator.icon
              size={12}
              strokeWidth={1.5}
              aria-hidden
              className={variantIndicator.class}
            />
            <span className="text-micro font-semibold uppercase tracking-wide-brand text-fg-3">
              {variantIndicator.label}
            </span>
          </div>

          <p className="text-caption text-fg-1 leading-relaxed">{message.content}</p>

          {/* Auto-retry sub-line (only present for auto-retry variant) */}
          {message.autoRetryNote && (
            <div className="
              mt-3 pt-3 border-t border-border-subtle
              flex items-start gap-2
            ">
              <Lightbulb
                size={12}
                strokeWidth={1.5}
                aria-hidden
                className="text-warning-fg-strong flex-shrink-0 mt-0.5"
              />
              <p className="text-meta text-warning-fg-strong">
                {message.autoRetryNote}
              </p>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex items-start gap-3 justify-end">
      <div className="flex-1 max-w-[560px]">
        <div className="
          inline-block bg-navy text-text-inverse rounded-card
          px-4 py-3
          max-w-full
        ">
          <p className="text-caption leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>
      </div>
      <div className="
        flex-shrink-0 w-7 h-7 rounded-full
        bg-navy flex items-center justify-center
        text-text-inverse
      ">
        <User size={14} strokeWidth={1.5} aria-hidden />
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Left column: input area
// ───────────────────────────────────────────────────────────────────────────────

function LeftInput({
  hasModels,
  isFirst,
  isGenerating,
}: {
  hasModels: boolean;
  isFirst: boolean;
  isGenerating?: boolean;
}) {
  const placeholder = isFirst
    ? '描述你想要的 Skill(回车发送 / Shift+Enter 换行)'
    : '描述你想要的 Skill,或者对当前 Skill 提建议…';

  const disabled = !hasModels || isGenerating;

  return (
    <div className="flex items-end gap-2">
      <textarea
        aria-label="Describe the skill you want"
        placeholder={placeholder}
        rows={3}
        disabled={disabled}
        className="
          flex-1 pl-textarea-x pr-textarea-x py-textarea-y rounded-card-sm border border-border-default
          bg-card text-caption text-fg-1 placeholder:text-fg-3
          resize-none
          disabled:bg-soft disabled:text-fg-3 disabled:cursor-not-allowed
          focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus
          transition-shadow duration-fast ease-khx
        "
      />
      <button
        type="button"
        aria-label="Send"
        disabled={disabled}
        className="
          w-9 h-9 rounded-full
          bg-navy text-text-inverse
          flex items-center justify-center flex-shrink-0
          shadow-btn hover:bg-navy-hover hover:shadow-btn-hover hover:-translate-y-px
          active:bg-navy-active active:translate-y-0
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-navy disabled:hover:shadow-btn disabled:hover:translate-y-0
          transition-[background,box-shadow,transform] duration-fast ease-khx
          focus-visible:outline-none focus-visible:shadow-[var(--shadow-btn),var(--shadow-focus)]
        "
      >
        {isGenerating ? (
          <Loader2 size={16} strokeWidth={1.5} aria-hidden className="animate-spin" />
        ) : (
          <ArrowUp size={16} strokeWidth={1.5} aria-hidden />
        )}
      </button>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Right column: Tabs + content panels
// ───────────────────────────────────────────────────────────────────────────────

function RightTabs({ active }: { active: RightTab }) {
  const tabs: Array<{ key: RightTab; label: string; Icon: React.ElementType }> = [
    { key: 'config', label: '配置',     Icon: SettingsIcon },
    { key: 'yaml',   label: 'YAML 源码', Icon: FileCode },
    { key: 'test',   label: '测试运行', Icon: TestTube2 },
  ];

  return (
    <div role="tablist" aria-label="Skill preview" className="flex border-b border-border-default">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`
              inline-flex items-center gap-1.5 px-4 py-3 text-caption font-medium border-b-2
              transition-colors duration-fast ease-khx
              focus-visible:outline-none focus-visible:bg-navy-faint
              ${isActive
                ? 'border-indigo text-indigo'
                : 'border-transparent text-fg-2 hover:text-fg-1'}
            `}
          >
            <tab.Icon size={14} strokeWidth={1.5} aria-hidden />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ConfigPanel({ draft }: { draft: SkillDraft }) {
  return (
    <div className="p-6 space-y-4 overflow-y-auto flex-1">
      {/* Name */}
      <div className="rounded-card-sm border border-border-default bg-card p-4">
        <p className="text-micro font-semibold uppercase tracking-wide-brand text-fg-3 mb-2">名称</p>
        <p className="text-caption font-mono text-fg-1">{draft.name}</p>
        <p className="text-meta text-fg-2 mt-1.5">{draft.displayName}</p>
      </div>

      {/* Description */}
      <div className="rounded-card-sm border border-border-default bg-card p-4">
        <p className="text-micro font-semibold uppercase tracking-wide-brand text-fg-3 mb-2">描述</p>
        <p className="text-caption text-fg-1 leading-relaxed">{draft.description}</p>
      </div>

      {/* Recommended models */}
      <div className="rounded-card-sm border border-border-default bg-card p-4">
        <p className="text-micro font-semibold uppercase tracking-wide-brand text-fg-3 mb-2">推荐模型</p>
        <div className="flex flex-wrap gap-1.5">
          {draft.recommendedModels.map((m) => (
            <span
              key={m}
              className="
                inline-flex items-center px-2 py-0.5 rounded-pill
                bg-badge-default-bg text-badge-default-fg
                text-micro font-mono
              "
            >
              {m}
            </span>
          ))}
        </div>
      </div>

      {/* Output dimensions */}
      <div className="rounded-card-sm border border-border-default bg-card p-4">
        <p className="text-micro font-semibold uppercase tracking-wide-brand text-fg-3 mb-3">
          输出维度 <span className="text-fg-3 font-normal tabular-nums">· {draft.outputDimensions.length}</span>
        </p>
        <ul className="space-y-2">
          {draft.outputDimensions.map((d) => (
            <li key={d.key} className="border-l-2 border-indigo-muted pl-3">
              <p className="text-caption font-medium text-fg-1">{d.label}</p>
              <p className="text-meta text-fg-3 mt-0.5 font-mono">{d.key}</p>
              <p className="text-meta text-fg-2 mt-1">{d.description}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Collapsible prompt template */}
      <details className="rounded-card-sm border border-border-default bg-card overflow-hidden group">
        <summary className="
          px-4 py-3 cursor-pointer
          flex items-center justify-between
          text-micro font-semibold uppercase tracking-wide-brand text-fg-3
          hover:bg-navy-faint
          transition-colors duration-fast ease-khx
          focus-visible:outline-none focus-visible:bg-navy-faint
        ">
          <span>Prompt 模板</span>
          <ChevronDown
            size={14}
            strokeWidth={1.5}
            aria-hidden
            className="transition-transform duration-fast ease-khx group-open:rotate-180"
          />
        </summary>
        <pre className="
          px-4 pb-4 pt-2 text-meta font-mono text-fg-2
          whitespace-pre-wrap overflow-x-auto leading-relaxed
        ">
          {draft.promptTemplate}
        </pre>
      </details>
    </div>
  );
}

function YamlPanel({ yaml }: { yaml: string }) {
  return (
    <div className="p-6 overflow-y-auto flex-1">
      <pre className="
        rounded-card-sm bg-soft border border-border-default
        p-4 text-meta font-mono text-fg-1
        whitespace-pre-wrap leading-relaxed overflow-x-auto
      ">
        {yaml}
      </pre>
    </div>
  );
}

function TestRunPanel() {
  return (
    <div className="p-6 overflow-y-auto flex-1 space-y-4">
      {/* Paper picker placeholder */}
      <div>
        <label className="block text-meta font-medium text-fg-1 mb-2">示例文献</label>
        <div className="relative">
          <div className="
            w-full pl-input-x pr-9 py-input-y rounded-pill border border-border-default
            bg-card text-caption text-fg-1
            cursor-pointer hover:border-navy-muted
            transition-colors duration-fast ease-khx
          ">
            Attention Is All You Need · arXiv 1706.03762
          </div>
          <ChevronDown
            size={14}
            strokeWidth={1.5}
            aria-hidden
            className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-2 pointer-events-none"
          />
        </div>
      </div>

      {/* Model picker placeholder */}
      <div>
        <label className="block text-meta font-medium text-fg-1 mb-2">模型</label>
        <div className="relative">
          <div className="
            w-full pl-input-x pr-9 py-input-y rounded-pill border border-border-default
            bg-card text-caption text-fg-1
            cursor-pointer hover:border-navy-muted
            transition-colors duration-fast ease-khx
          ">
            Claude Opus 4.7
          </div>
          <ChevronDown
            size={14}
            strokeWidth={1.5}
            aria-hidden
            className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-2 pointer-events-none"
          />
        </div>
      </div>

      <button
        type="button"
        className="
          inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill
          bg-navy text-text-inverse text-caption font-medium
          shadow-btn hover:bg-navy-hover hover:shadow-btn-hover hover:-translate-y-px
          active:bg-navy-active active:translate-y-0
          transition-[background,box-shadow,transform] duration-fast ease-khx
          focus-visible:outline-none focus-visible:shadow-[var(--shadow-btn),var(--shadow-focus)]
        "
      >
        <Play size={14} strokeWidth={1.5} aria-hidden />
        <span>运行测试</span>
      </button>

      {/* Output region — placeholder */}
      <div className="mt-4 min-h-[200px] rounded-card-sm bg-soft border border-border-default p-4">
        <p className="text-meta text-fg-3 italic">点击「运行测试」查看输出</p>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Right footer (shared by all Tab states)
// ───────────────────────────────────────────────────────────────────────────────

function RightFooter({ canSave }: { canSave: boolean }) {
  return (
    <footer className="
      flex-shrink-0 px-6 py-4 border-t border-border-default
      flex items-center gap-3 flex-wrap
    ">
      <button
        type="button"
        disabled={!canSave}
        className="
          inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill
          bg-navy text-text-inverse text-caption font-medium
          shadow-btn hover:bg-navy-hover hover:shadow-btn-hover hover:-translate-y-px
          active:bg-navy-active active:translate-y-0
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-navy disabled:hover:shadow-btn disabled:hover:translate-y-0
          transition-[background,box-shadow,transform] duration-fast ease-khx
          focus-visible:outline-none focus-visible:shadow-[var(--shadow-btn),var(--shadow-focus)]
        "
      >
        <Save size={14} strokeWidth={1.5} aria-hidden />
        <span>保存为 Skill</span>
      </button>

      <a
        href="/skills/new"
        className="
          inline-flex items-center gap-1 text-meta font-medium text-indigo
          hover:text-indigo-hover
          transition-colors duration-fast ease-khx
          focus-visible:outline-none focus-visible:underline
        "
      >
        <SettingsIcon size={12} strokeWidth={1.5} aria-hidden />
        <span>切换到高级编辑器</span>
      </a>

      <button
        type="button"
        className="
          ml-auto inline-flex items-center gap-1 text-meta font-medium text-danger-fg
          hover:underline
          transition-colors duration-fast ease-khx
          focus-visible:outline-none focus-visible:underline
        "
      >
        <RotateCcw size={12} strokeWidth={1.5} aria-hidden />
        <span>重新开始</span>
      </button>
    </footer>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Composition: page-level wrapper
// ───────────────────────────────────────────────────────────────────────────────

function PageShell({
  conversationContent,
  inputElement,
  rightTab,
  rightPanel,
  canSave,
  hasModels,
}: {
  conversationContent: React.ReactNode;
  inputElement: React.ReactNode;
  rightTab: RightTab;
  rightPanel: React.ReactNode;
  canSave: boolean;
  hasModels: boolean;
}) {
  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      {/* LEFT */}
      <section className="w-1/2 flex flex-col min-w-0 border-r border-border-default">
        {/* Header */}
        <header className="
          flex-shrink-0 px-6 pt-6 pb-4 border-b border-border-default
          flex items-start justify-between gap-4
        ">
          <div>
            <h1 className="text-h2 font-semibold text-fg-1 inline-flex items-center gap-2">
              <Sparkles size={22} strokeWidth={1.5} aria-hidden className="text-indigo" />
              <span>用 AI 创建 Skill</span>
            </h1>
            <p className="text-meta text-fg-2 mt-1">
              对话式生成,可随时反馈并迭代。完成后保存为自定义 Skill。
            </p>
          </div>
          <ModelPicker selectedModel="claude-opus-4-7" hasModels={hasModels} />
        </header>

        {/* Conversation area */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {conversationContent}
        </div>

        {/* Input */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-border-default">
          {inputElement}
        </div>
      </section>

      {/* RIGHT */}
      <section className="w-1/2 flex flex-col min-w-0">
        <RightTabs active={rightTab} />
        {rightPanel}
        <RightFooter canSave={canSave} />
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN — happy path: first generation completed, Config tab active
// ═══════════════════════════════════════════════════════════════════════════════

export default function SkillGeneratorPage() {
  return (
    <PageShell
      conversationContent={
        <div className="flex flex-col gap-5">
          <UserBubble content={MOCK_MESSAGES_FIRST_DONE[0].content} />
          <AssistantBubble message={MOCK_MESSAGES_FIRST_DONE[1]} />
        </div>
      }
      inputElement={<LeftInput hasModels isFirst={false} />}
      rightTab="config"
      rightPanel={<ConfigPanel draft={MOCK_SKILL_DRAFT} />}
      canSave
      hasModels
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY TIPS CARD — no messages yet, TipsCard visible
// ═══════════════════════════════════════════════════════════════════════════════

export function SkillGeneratorPageEmptyTipsCard() {
  return (
    <PageShell
      conversationContent={<EmptyTipsBubble />}
      inputElement={<LeftInput hasModels isFirst />}
      rightTab="config"
      rightPanel={
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <Sparkles size={48} strokeWidth={1.5} aria-hidden className="mx-auto text-fg-3" />
            <p className="text-caption text-fg-2 mt-4 italic leading-relaxed">
              在左侧描述你想要的 Skill,这里会显示生成的配置预览。
            </p>
          </div>
        </div>
      }
      canSave={false}
      hasModels
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NO MODEL BANNER — no models configured / no models with valid keys
// ═══════════════════════════════════════════════════════════════════════════════

export function SkillGeneratorPageNoModelBanner() {
  return (
    <PageShell
      conversationContent={
        <div className="flex flex-col gap-5">
          <NoModelBanner />
          <div className="opacity-60 pointer-events-none">
            <EmptyTipsBubble />
          </div>
        </div>
      }
      inputElement={<LeftInput hasModels={false} isFirst />}
      rightTab="config"
      rightPanel={
        <div className="flex-1 flex items-center justify-center p-8">
          <p className="text-caption text-fg-3 italic">等待模型配置…</p>
        </div>
      }
      canSave={false}
      hasModels={false}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIRST GENERATION — assistant is generating the first version
// ═══════════════════════════════════════════════════════════════════════════════

export function SkillGeneratorPageFirstGeneration() {
  return (
    <PageShell
      conversationContent={
        <div className="flex flex-col gap-5">
          <UserBubble content={MOCK_MESSAGES_FIRST_DONE[0].content} />
          <AssistantBubble
            message={{
              id: 'gen-1',
              role: 'assistant',
              content: '正在为你的需求生成 Skill 配置,大约需要 10-30 秒…',
              variant: 'generating',
            }}
          />
        </div>
      }
      inputElement={<LeftInput hasModels isFirst={false} isGenerating />}
      rightTab="config"
      rightPanel={
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <Loader2
              size={48}
              strokeWidth={1.5}
              aria-hidden
              className="mx-auto text-indigo animate-spin"
            />
            <p className="text-caption text-fg-2 mt-4 italic leading-relaxed">
              生成中,稍候片刻…
            </p>
          </div>
        </div>
      }
      canSave={false}
      hasModels
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REFINING — user has submitted refinement, generating updated version
// ═══════════════════════════════════════════════════════════════════════════════

export function SkillGeneratorPageRefining() {
  return (
    <PageShell
      conversationContent={
        <div className="flex flex-col gap-5">
          {MOCK_MESSAGES_REFINING.map((m) =>
            m.role === 'user' ? (
              <UserBubble key={m.id} content={m.content} />
            ) : (
              <AssistantBubble key={m.id} message={m} />
            ),
          )}
        </div>
      }
      inputElement={<LeftInput hasModels isFirst={false} isGenerating />}
      rightTab="config"
      // Right preview still showing previous version (with reduced opacity to hint update in progress)
      rightPanel={
        <div className="flex-1 overflow-y-auto opacity-60 pointer-events-none">
          <ConfigPanel draft={MOCK_SKILL_DRAFT} />
        </div>
      }
      canSave={false}
      hasModels
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REFINED — refinement applied, updated preview visible
// ═══════════════════════════════════════════════════════════════════════════════

export function SkillGeneratorPageRefined() {
  return (
    <PageShell
      conversationContent={
        <div className="flex flex-col gap-5">
          {MOCK_MESSAGES_REFINED.map((m) =>
            m.role === 'user' ? (
              <UserBubble key={m.id} content={m.content} />
            ) : (
              <AssistantBubble key={m.id} message={m} />
            ),
          )}
        </div>
      }
      inputElement={<LeftInput hasModels isFirst={false} />}
      rightTab="config"
      rightPanel={<ConfigPanel draft={MOCK_SKILL_DRAFT} />}
      canSave
      hasModels
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO RETRY — refined with auto-retry annotation
// ═══════════════════════════════════════════════════════════════════════════════

export function SkillGeneratorPageAutoRetry() {
  return (
    <PageShell
      conversationContent={
        <div className="flex flex-col gap-5">
          {MOCK_MESSAGES_AUTO_RETRY.map((m) =>
            m.role === 'user' ? (
              <UserBubble key={m.id} content={m.content} />
            ) : (
              <AssistantBubble key={m.id} message={m} />
            ),
          )}
        </div>
      }
      inputElement={<LeftInput hasModels isFirst={false} />}
      rightTab="config"
      rightPanel={<ConfigPanel draft={MOCK_SKILL_DRAFT} />}
      canSave
      hasModels
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// YAML TAB — right side switched to YAML source view
// ═══════════════════════════════════════════════════════════════════════════════

export function SkillGeneratorPageYamlTab() {
  return (
    <PageShell
      conversationContent={
        <div className="flex flex-col gap-5">
          <UserBubble content={MOCK_MESSAGES_FIRST_DONE[0].content} />
          <AssistantBubble message={MOCK_MESSAGES_FIRST_DONE[1]} />
        </div>
      }
      inputElement={<LeftInput hasModels isFirst={false} />}
      rightTab="yaml"
      rightPanel={<YamlPanel yaml={MOCK_SKILL_DRAFT.yamlSource} />}
      canSave
      hasModels
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST RUN TAB — right side switched to test runner
// ═══════════════════════════════════════════════════════════════════════════════

export function SkillGeneratorPageTestRunTab() {
  return (
    <PageShell
      conversationContent={
        <div className="flex flex-col gap-5">
          <UserBubble content={MOCK_MESSAGES_FIRST_DONE[0].content} />
          <AssistantBubble message={MOCK_MESSAGES_FIRST_DONE[1]} />
        </div>
      }
      inputElement={<LeftInput hasModels isFirst={false} />}
      rightTab="test"
      rightPanel={<TestRunPanel />}
      canSave
      hasModels
    />
  );
}
