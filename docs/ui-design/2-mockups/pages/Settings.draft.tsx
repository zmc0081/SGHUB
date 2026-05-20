/**
 * Settings.draft.tsx — V2.2 SGHUB Capsule
 *
 * Static structural draft for /settings (设置 / Settings).
 *
 * Layout: single column, p-8 max-w-3xl mx-auto
 *   1. PageHeader (title + subtitle with config file path)
 *   2. GeneralCard — 4 rows: 语言 / 主题 / 默认模型 / 日志级别
 *      (Theme switch is NEW in V2.2, see Step 2 §7.1 todo)
 *   3. UpdaterCardInline — embedded UpdaterCard (Step 2 §A.9 full spec)
 *   4. DataDirCardInline — embedded DataDirCard (Step 2 §A.8 full spec)
 *
 * MigrationWizard is rendered as an overlay <BaseModal>; only Step 1 is
 * detailed here. Other steps (2/3/executing/done) are sketched in Step 5
 * as Mermaid state diagrams.
 */

import {
  Settings as SettingsIcon,
  Globe,
  Sun,
  Moon,
  Monitor,
  Bot,
  ScrollText,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FolderOpen,
  Undo2,
  Copy,
  Check,
  ChevronDown,
  Download,
  Loader2,
  X,
} from 'lucide-react';
// import { useTranslation } from 'react-i18next';
// import { useSettingsStore } from '@/stores/settingsStore';

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────

type Theme = 'system' | 'light' | 'dark';
type LogLevel = 'error' | 'warn' | 'info' | 'debug';
type Locale = 'system' | 'zh-CN' | 'en-US';
type Frequency = 'daily' | 'weekly';
type OnUpdateFound = 'notify' | 'silent-download' | 'mark-only';

interface SettingsState {
  locale: Locale;
  theme: Theme;
  defaultModel?: string;
  logLevel: LogLevel;
  configFilePath: string;
}

interface UpdaterConfig {
  enabled: boolean;
  frequency: Frequency;
  dailyEveryNDays: number;
  weeklyDays: number[];          // 0-6 (Mon-Sun)
  timeOfDay: string;             // "HH:mm"
  onUpdateFound: OnUpdateFound;
}

interface UpdaterStatus {
  currentVersion: string;
  lastCheckAt?: string;
  pendingVersion?: string;
  nextCheckAt?: string;
}

interface DataDir {
  path: string;
  isDefault: boolean;
  sizeBytes: number;
  fileCount: number;
}

// ───────────────────────────────────────────────────────────────────────────────
// Mock data
// ───────────────────────────────────────────────────────────────────────────────

const MOCK_SETTINGS: SettingsState = {
  locale: 'system',
  theme: 'system',
  defaultModel: 'claude-opus-4-7',
  logLevel: 'info',
  configFilePath: '/Users/cwz/Library/Application Support/SGHUB/config.toml',
};

const MOCK_UPDATER_CONFIG: UpdaterConfig = {
  enabled: true,
  frequency: 'weekly',
  dailyEveryNDays: 1,
  weeklyDays: [0, 2, 4],  // Mon / Wed / Fri
  timeOfDay: '10:00',
  onUpdateFound: 'silent-download',
};

const MOCK_UPDATER_STATUS: UpdaterStatus = {
  currentVersion: '2.2.0',
  lastCheckAt: '2 小时前',
  nextCheckAt: '今天 22:00',
};

const MOCK_DATADIR_DEFAULT: DataDir = {
  path: '/Users/cwz/Library/Application Support/SGHUB',
  isDefault: true,
  sizeBytes: 1_268_435_456,
  fileCount: 245,
};

const MOCK_DATADIR_CUSTOM: DataDir = {
  path: '/Volumes/External SSD/SGHUB-data',
  isDefault: false,
  sizeBytes: 4_823_847_321,
  fileCount: 812,
};

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

// ───────────────────────────────────────────────────────────────────────────────
// Page header
// ───────────────────────────────────────────────────────────────────────────────

function PageHeader({ configFilePath }: { configFilePath: string }) {
  return (
    <header className="mb-8">
      <h1 className="text-h2 font-semibold text-fg-1">设置</h1>
      <p className="text-meta text-fg-2 mt-1">
        配置文件路径:
        <span className="font-mono text-fg-1 ml-1">{configFilePath}</span>
      </p>
    </header>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// General settings card — 4 rows
// ───────────────────────────────────────────────────────────────────────────────

/**
 * V2.2 adds theme switch (V2.1 had read-only theme display).
 * Locale follows system unless explicitly overridden.
 */
function GeneralCard({
  locale,
  theme,
  defaultModel,
  logLevel,
}: SettingsState) {
  return (
    <section
      aria-labelledby="general-settings-heading"
      className="rounded-card bg-card shadow-card p-6 mb-6"
    >
      <header className="mb-5">
        <h2 id="general-settings-heading" className="text-h3 font-semibold text-fg-1">
          常规
        </h2>
        <p className="text-meta text-fg-2 mt-1">
          界面语言、主题、默认模型、日志输出等级
        </p>
      </header>

      <dl className="grid grid-cols-[140px_1fr] gap-y-5 items-center">
        {/* Language */}
        <dt className="text-caption font-medium text-fg-1 inline-flex items-center gap-2">
          <Globe size={14} strokeWidth={1.5} aria-hidden className="text-fg-3" />
          语言
        </dt>
        <dd>
          <div className="relative inline-block">
            <select
              aria-label="Language"
              defaultValue={locale}
              className="
                appearance-none pl-input-x pr-9 py-input-y rounded-pill border border-border-default
                bg-card text-caption text-fg-1
                focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus
                transition-shadow duration-fast ease-khx
              "
            >
              <option value="system">跟随系统(当前:简体中文)</option>
              <option value="zh-CN">简体中文</option>
              <option value="en-US">English</option>
            </select>
            <ChevronDown
              size={16}
              strokeWidth={1.5}
              aria-hidden
              className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-2 pointer-events-none"
            />
          </div>
        </dd>

        {/* Theme — V2.2 NEW (switchable; V2.1 was read-only) */}
        <dt className="text-caption font-medium text-fg-1 inline-flex items-center gap-2">
          <Sun size={14} strokeWidth={1.5} aria-hidden className="text-fg-3" />
          主题
        </dt>
        <dd>
          <div role="radiogroup" aria-label="Theme" className="flex gap-1.5">
            {[
              { value: 'system' as Theme, label: '跟随系统', Icon: Monitor },
              { value: 'light'  as Theme, label: '亮色',     Icon: Sun },
              { value: 'dark'   as Theme, label: '暗色',     Icon: Moon },
            ].map((opt) => {
              const isActive = opt.value === theme;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-meta border
                    transition-colors duration-fast ease-khx
                    focus-visible:outline-none focus-visible:shadow-focus
                    ${isActive
                      ? 'bg-indigo-soft border-indigo-muted text-indigo font-medium'
                      : 'bg-card border-border-default text-fg-2 hover:text-fg-1 hover:bg-navy-faint'}
                  `}
                >
                  <opt.Icon size={12} strokeWidth={1.5} aria-hidden />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </dd>

        {/* Default model */}
        <dt className="text-caption font-medium text-fg-1 inline-flex items-center gap-2">
          <Bot size={14} strokeWidth={1.5} aria-hidden className="text-fg-3" />
          默认模型
        </dt>
        <dd>
          {defaultModel ? (
            <span className="
              inline-flex items-center gap-1.5 px-3 py-1 rounded-pill
              bg-soft text-fg-1 border border-border-default
              text-meta font-mono
            ">
              <Check size={12} strokeWidth={2} aria-hidden className="text-success-fg" />
              {defaultModel}
            </span>
          ) : (
            <span className="text-meta text-fg-3 italic">未设置</span>
          )}
          <a
            href="/models"
            className="
              ml-3 inline-flex items-center gap-1 text-meta font-medium text-indigo
              hover:text-indigo-hover hover:underline
              transition-colors duration-fast ease-khx
              focus-visible:outline-none focus-visible:underline
            "
          >
            前往模型配置
          </a>
        </dd>

        {/* Log level (read-only) */}
        <dt className="text-caption font-medium text-fg-1 inline-flex items-center gap-2">
          <ScrollText size={14} strokeWidth={1.5} aria-hidden className="text-fg-3" />
          日志级别
        </dt>
        <dd>
          <span className="
            inline-flex items-center px-2.5 py-0.5 rounded-pill
            bg-badge-default-bg text-badge-default-fg
            text-meta font-mono uppercase
          ">
            {logLevel}
          </span>
          <span className="text-meta text-fg-3 ml-3">通过环境变量 SGHUB_LOG 修改</span>
        </dd>
      </dl>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// UpdaterCardInline (Step 2 §A.9 fully expanded)
// ───────────────────────────────────────────────────────────────────────────────

function MasterSwitch({
  checked,
}: {
  checked: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="Enable auto update"
      className={`
        relative inline-flex items-center w-10 h-6 rounded-pill
        transition-colors duration-fast ease-khx
        focus-visible:outline-none focus-visible:shadow-focus
        ${checked ? 'bg-indigo' : 'bg-border-strong'}
      `}
    >
      <span
        aria-hidden
        className={`
          absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-card shadow-card-sm
          transition-transform duration-fast ease-khx
          ${checked ? 'translate-x-4' : 'translate-x-0'}
        `}
      />
    </button>
  );
}

function UpdaterCardInline({
  config,
  status,
}: {
  config: UpdaterConfig;
  status: UpdaterStatus;
}) {
  const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

  return (
    <section
      aria-labelledby="updater-heading"
      className="rounded-card bg-card shadow-card p-6 mb-6"
    >
      {/* Header + master switch */}
      <header className="flex items-start justify-between gap-4 mb-5">
        <div className="flex-1">
          <h2 id="updater-heading" className="text-h3 font-semibold text-fg-1">
            自动更新
          </h2>
          <p className="text-meta text-fg-2 mt-1">
            启用后将按设定的时间自动检查更新
          </p>
        </div>
        <MasterSwitch checked={config.enabled} />
      </header>

      {/* Controls — dimmed when master is off */}
      <div className={`
        space-y-5
        ${config.enabled ? '' : 'opacity-50 pointer-events-none'}
        transition-opacity duration-base ease-khx
      `}>
        {/* Frequency */}
        <div className="grid grid-cols-[140px_1fr] gap-y-3 items-start">
          <dt className="text-caption font-medium text-fg-1 pt-1">频率</dt>
          <dd>
            <div role="radiogroup" aria-label="Frequency" className="flex gap-1.5 mb-3">
              {[
                { value: 'daily' as Frequency, label: '每日' },
                { value: 'weekly' as Frequency, label: '每周' },
              ].map((opt) => {
                const isActive = opt.value === config.frequency;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    className={`
                      inline-flex items-center px-3 py-1.5 rounded-pill text-meta border
                      transition-colors duration-fast ease-khx
                      focus-visible:outline-none focus-visible:shadow-focus
                      ${isActive
                        ? 'bg-indigo-soft border-indigo-muted text-indigo font-medium'
                        : 'bg-card border-border-default text-fg-2 hover:text-fg-1 hover:bg-navy-faint'}
                    `}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Daily: every N days */}
            {config.frequency === 'daily' && (
              <div className="inline-flex items-center gap-2 text-meta text-fg-2">
                <span>每</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  defaultValue={config.dailyEveryNDays}
                  className="
                    w-16 text-center pl-3 pr-3 py-1 rounded-pill border border-border-default
                    bg-card text-caption text-fg-1 tabular-nums
                    focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus
                    transition-shadow duration-fast ease-khx
                  "
                />
                <span>天</span>
              </div>
            )}

            {/* Weekly: weekday chips */}
            {config.frequency === 'weekly' && (
              <div role="group" aria-label="Weekdays" className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((label, i) => {
                  const selected = config.weeklyDays.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      role="checkbox"
                      aria-checked={selected}
                      className={`
                        inline-flex items-center justify-center w-8 h-8 rounded-pill text-meta border
                        transition-colors duration-fast ease-khx
                        focus-visible:outline-none focus-visible:shadow-focus
                        ${selected
                          ? 'bg-indigo-soft border-indigo-muted text-indigo font-medium'
                          : 'bg-card border-border-default text-fg-2 hover:text-fg-1 hover:bg-navy-faint'}
                      `}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </dd>
        </div>

        {/* Time */}
        <div className="grid grid-cols-[140px_1fr] gap-y-3 items-center">
          <dt className="text-caption font-medium text-fg-1">时间</dt>
          <dd>
            <div className="relative inline-block">
              <select
                aria-label="Time of day"
                defaultValue={config.timeOfDay}
                className="
                  appearance-none pl-input-x pr-9 py-input-y rounded-pill border border-border-default
                  bg-card text-caption text-fg-1 font-mono tabular-nums
                  focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus
                  transition-shadow duration-fast ease-khx
                "
              >
                {/* Sample slots; real impl generates 96 (15-min) entries */}
                <option value="08:00">08:00</option>
                <option value="09:00">09:00</option>
                <option value="10:00">10:00</option>
                <option value="22:00">22:00</option>
                <option value="23:00">23:00</option>
              </select>
              <ChevronDown
                size={16}
                strokeWidth={1.5}
                aria-hidden
                className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-2 pointer-events-none"
              />
            </div>
          </dd>
        </div>

        {/* On update found */}
        <div className="grid grid-cols-[140px_1fr] gap-y-3 items-start">
          <dt className="text-caption font-medium text-fg-1 pt-1">发现更新</dt>
          <dd>
            <div role="radiogroup" aria-label="On update found" className="flex flex-wrap gap-1.5">
              {[
                { value: 'notify' as OnUpdateFound,           label: '弹通知' },
                { value: 'silent-download' as OnUpdateFound,  label: '静默下载' },
                { value: 'mark-only' as OnUpdateFound,        label: '只标记' },
              ].map((opt) => {
                const isActive = opt.value === config.onUpdateFound;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    className={`
                      inline-flex items-center px-3 py-1.5 rounded-pill text-meta border
                      transition-colors duration-fast ease-khx
                      focus-visible:outline-none focus-visible:shadow-focus
                      ${isActive
                        ? 'bg-indigo-soft border-indigo-muted text-indigo font-medium'
                        : 'bg-card border-border-default text-fg-2 hover:text-fg-1 hover:bg-navy-faint'}
                    `}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </dd>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border-default my-5" />

      {/* Status grid */}
      <dl className="grid grid-cols-[140px_1fr] gap-y-3 text-caption mb-5">
        <dt className="text-fg-2">当前版本</dt>
        <dd className="text-fg-1 font-mono tabular-nums">v{status.currentVersion}</dd>

        <dt className="text-fg-2">最近一次检查</dt>
        <dd className="text-fg-1 tabular-nums">{status.lastCheckAt ?? '从未检查'}</dd>

        <dt className="text-fg-2">下次计划</dt>
        <dd className="text-fg-1 tabular-nums">{status.nextCheckAt ?? '—'}</dd>

        {status.pendingVersion && (
          <>
            <dt className="text-fg-2">待安装</dt>
            <dd>
              <span className="
                inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill
                bg-badge-improve-bg text-badge-improve-fg
                text-meta font-medium
              ">
                <RefreshCw size={11} strokeWidth={2} aria-hidden />
                <span className="font-mono tabular-nums">v{status.pendingVersion}</span>
              </span>
            </dd>
          </>
        )}
      </dl>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="
            inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill border
            text-caption font-medium text-fg-1 border-border-default bg-card
            hover:border-navy-muted hover:bg-navy-faint
            transition-colors duration-fast ease-khx
            focus-visible:outline-none focus-visible:shadow-focus
          "
        >
          <RefreshCw size={14} strokeWidth={1.5} aria-hidden />
          <span>立即检查</span>
        </button>

        {status.pendingVersion && (
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
            <Download size={14} strokeWidth={1.5} aria-hidden />
            <span>立即安装</span>
          </button>
        )}
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// DataDirCardInline (Step 2 §A.8 fully expanded)
// ───────────────────────────────────────────────────────────────────────────────

function DataDirCardInline({ datadir }: { datadir: DataDir }) {
  return (
    <section
      aria-labelledby="datadir-heading"
      className="rounded-card bg-card shadow-card p-6"
    >
      <header className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 id="datadir-heading" className="text-h3 font-semibold text-fg-1">
              数据目录
            </h2>
            {!datadir.isDefault && (
              <span className="
                inline-flex items-center px-2 py-0.5 rounded-pill
                bg-badge-new-bg text-badge-new-fg
                text-micro font-medium
              ">
                自定义
              </span>
            )}
          </div>
          <p className="text-meta text-fg-2 mt-1">
            当前路径下数据库与本地 PDF 的存储位置
          </p>
        </div>
      </header>

      {/* Path block (clickable to copy) */}
      <button
        type="button"
        aria-label="Copy path to clipboard"
        title="点击复制路径"
        className="
          group block w-full text-left rounded-card-sm bg-soft border border-border-default
          p-4 mb-4
          hover:bg-navy-faint hover:border-navy-muted
          transition-colors duration-fast ease-khx
          focus-visible:outline-none focus-visible:shadow-focus
        "
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-meta text-fg-1 font-mono break-all">{datadir.path}</p>
          <Copy
            size={14}
            strokeWidth={1.5}
            aria-hidden
            className="text-fg-3 group-hover:text-fg-1 flex-shrink-0 transition-colors duration-fast ease-khx"
          />
        </div>
        <p className="text-meta text-fg-2 tabular-nums">
          <span className="text-fg-1 font-medium">{formatSize(datadir.sizeBytes)}</span>
          <span className="mx-1.5 text-fg-3">·</span>
          <span className="text-fg-1 font-medium">{datadir.fileCount}</span> 文件
        </p>
      </button>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          className="
            inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill border
            text-caption font-medium text-fg-1 border-border-default bg-card
            hover:border-navy-muted hover:bg-navy-faint
            transition-colors duration-fast ease-khx
            focus-visible:outline-none focus-visible:shadow-focus
          "
        >
          <FolderOpen size={14} strokeWidth={1.5} aria-hidden />
          <span>打开目录</span>
        </button>

        <button
          type="button"
          className="
            inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill border
            text-caption font-medium text-fg-1 border-border-default bg-card
            hover:border-navy-muted hover:bg-navy-faint
            transition-colors duration-fast ease-khx
            focus-visible:outline-none focus-visible:shadow-focus
          "
        >
          <RefreshCw size={14} strokeWidth={1.5} aria-hidden />
          <span>修改路径</span>
        </button>

        {!datadir.isDefault && (
          <button
            type="button"
            className="
              inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill border
              text-caption font-medium text-fg-1 border-border-default bg-card
              hover:border-navy-muted hover:bg-navy-faint
              transition-colors duration-fast ease-khx
              focus-visible:outline-none focus-visible:shadow-focus
            "
          >
            <Undo2 size={14} strokeWidth={1.5} aria-hidden />
            <span>恢复默认</span>
          </button>
        )}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN — happy path
// ═══════════════════════════════════════════════════════════════════════════════

export default function SettingsPage() {
  // TODO: from useSettingsStore()
  const settings = MOCK_SETTINGS;
  const updaterConfig = MOCK_UPDATER_CONFIG;
  const updaterStatus = MOCK_UPDATER_STATUS;
  const datadir = MOCK_DATADIR_DEFAULT;

  return (
    <main role="main" className="p-8 max-w-3xl mx-auto">
      <PageHeader configFilePath={settings.configFilePath} />
      <GeneralCard {...settings} />
      <UpdaterCardInline config={updaterConfig} status={updaterStatus} />
      <DataDirCardInline datadir={datadir} />
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY — no default model configured
// ═══════════════════════════════════════════════════════════════════════════════

export function SettingsPageEmptyDefaultModel() {
  const noModelSettings = { ...MOCK_SETTINGS, defaultModel: undefined };

  return (
    <main role="main" className="p-8 max-w-3xl mx-auto">
      <PageHeader configFilePath={noModelSettings.configFilePath} />
      <GeneralCard {...noModelSettings} />
      <UpdaterCardInline config={MOCK_UPDATER_CONFIG} status={MOCK_UPDATER_STATUS} />
      <DataDirCardInline datadir={MOCK_DATADIR_DEFAULT} />
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATER DISABLED — auto update master switch off
// ═══════════════════════════════════════════════════════════════════════════════

export function SettingsPageUpdaterDisabled() {
  const disabledUpdater: UpdaterConfig = { ...MOCK_UPDATER_CONFIG, enabled: false };

  return (
    <main role="main" className="p-8 max-w-3xl mx-auto">
      <PageHeader configFilePath={MOCK_SETTINGS.configFilePath} />
      <GeneralCard {...MOCK_SETTINGS} />
      <UpdaterCardInline config={disabledUpdater} status={MOCK_UPDATER_STATUS} />
      <DataDirCardInline datadir={MOCK_DATADIR_DEFAULT} />
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATER WITH PENDING — new version downloaded, "立即安装" button visible
// ═══════════════════════════════════════════════════════════════════════════════

export function SettingsPageUpdaterPending() {
  const pendingStatus: UpdaterStatus = {
    ...MOCK_UPDATER_STATUS,
    pendingVersion: '2.3.0',
  };

  return (
    <main role="main" className="p-8 max-w-3xl mx-auto">
      <PageHeader configFilePath={MOCK_SETTINGS.configFilePath} />
      <GeneralCard {...MOCK_SETTINGS} />
      <UpdaterCardInline config={MOCK_UPDATER_CONFIG} status={pendingStatus} />
      <DataDirCardInline datadir={MOCK_DATADIR_DEFAULT} />
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATADIR CUSTOM — custom data directory configured
// ═══════════════════════════════════════════════════════════════════════════════

export function SettingsPageDataDirCustom() {
  return (
    <main role="main" className="p-8 max-w-3xl mx-auto">
      <PageHeader configFilePath={MOCK_SETTINGS.configFilePath} />
      <GeneralCard {...MOCK_SETTINGS} />
      <UpdaterCardInline config={MOCK_UPDATER_CONFIG} status={MOCK_UPDATER_STATUS} />
      <DataDirCardInline datadir={MOCK_DATADIR_CUSTOM} />
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MIGRATION WIZARD STEP 1 — modal overlay on top of Settings page
// (Steps 2/3/Executing/Done covered in Step 5 Mermaid state diagram)
// ═══════════════════════════════════════════════════════════════════════════════

export function SettingsPageMigrationWizardStep1() {
  return (
    <>
      <main role="main" className="p-8 max-w-3xl mx-auto">
        <PageHeader configFilePath={MOCK_SETTINGS.configFilePath} />
        <GeneralCard {...MOCK_SETTINGS} />
        <UpdaterCardInline config={MOCK_UPDATER_CONFIG} status={MOCK_UPDATER_STATUS} />
        <DataDirCardInline datadir={MOCK_DATADIR_DEFAULT} />
      </main>

      {/* Modal overlay */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="migration-wizard-title"
        className="fixed inset-0 z-modal flex items-center justify-center bg-overlay-modal-backdrop"
      >
        <div className="
          w-full max-w-xl max-h-[90vh] flex flex-col
          rounded-card bg-card shadow-modal
        ">
          {/* Header */}
          <header className="px-6 py-4 border-b border-border-default flex items-start justify-between gap-4">
            <div>
              <p className="text-meta text-fg-3 tabular-nums">步骤 1 / 3</p>
              <h2 id="migration-wizard-title" className="text-h3 font-semibold text-fg-1 mt-0.5">
                选择新的数据目录
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close"
              className="
                p-1 rounded-pill text-fg-2 hover:text-fg-1 hover:bg-navy-faint
                transition-colors duration-fast ease-khx
                focus-visible:outline-none focus-visible:shadow-focus
              "
            >
              <X size={16} strokeWidth={1.5} aria-hidden />
            </button>
          </header>

          {/* Body */}
          <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
            <p className="text-caption text-fg-2 leading-relaxed">
              选择一个目录来存放 SGHUB 的数据库与本地 PDF。可以是外置硬盘或其他位置,SGHUB 将检查路径可用性。
            </p>

            <div>
              <label className="block text-caption font-medium text-fg-1 mb-2">
                新路径
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  defaultValue="/Volumes/External SSD/SGHUB-data"
                  aria-label="New data directory path"
                  aria-invalid={false}
                  className="
                    flex-1 pl-input-x pr-input-x py-input-y rounded-pill border border-success-fg
                    bg-card text-caption text-fg-1 font-mono
                    focus-visible:outline-none focus-visible:shadow-focus
                    transition-shadow duration-fast ease-khx
                  "
                />
                <button
                  type="button"
                  className="
                    inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill border
                    text-caption font-medium text-fg-1 border-border-default bg-card
                    hover:border-navy-muted hover:bg-navy-faint
                    transition-colors duration-fast ease-khx
                    focus-visible:outline-none focus-visible:shadow-focus
                  "
                >
                  <FolderOpen size={14} strokeWidth={1.5} aria-hidden />
                  <span>浏览</span>
                </button>
              </div>

              {/* Validation result — success state */}
              <div className="
                mt-2 inline-flex items-center gap-1.5
                text-meta text-success-fg font-medium
              ">
                <CheckCircle2 size={14} strokeWidth={1.5} aria-hidden />
                <span>路径可用 · 剩余空间 124 GB</span>
              </div>
            </div>

            {/* Sample of other validation states for reference */}
            <details className="rounded-card-sm border border-border-default bg-soft p-3 group">
              <summary className="
                text-meta text-fg-3 cursor-pointer
                flex items-center justify-between
                focus-visible:outline-none focus-visible:underline
              ">
                <span>查看其他可能的校验状态</span>
                <ChevronDown
                  size={12}
                  strokeWidth={1.5}
                  aria-hidden
                  className="transition-transform duration-fast ease-khx group-open:rotate-180"
                />
              </summary>
              <div className="mt-3 space-y-2 text-meta">
                <div className="inline-flex items-center gap-1.5 text-warning-fg-strong font-medium">
                  <AlertTriangle size={12} strokeWidth={1.5} aria-hidden />
                  <span>检测到 SGHUB 数据(v2.1.5,123 文献) — 下一步可选择是否合并</span>
                </div>
                <div className="inline-flex items-center gap-1.5 text-danger-fg font-medium">
                  <XCircle size={12} strokeWidth={1.5} aria-hidden />
                  <span>无写入权限 — 请选择其他目录</span>
                </div>
              </div>
            </details>
          </div>

          {/* Footer */}
          <footer className="px-6 py-4 border-t border-border-default flex justify-end gap-3">
            <button
              type="button"
              className="
                inline-flex items-center px-btn-x py-btn-y rounded-pill border
                text-caption font-medium text-fg-1 border-border-default bg-card
                hover:border-navy-muted hover:bg-navy-faint
                transition-colors duration-fast ease-khx
                focus-visible:outline-none focus-visible:shadow-focus
              "
            >
              取消
            </button>
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
              <span>下一步</span>
            </button>
          </footer>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESTARTING — migration done, app about to restart
// ═══════════════════════════════════════════════════════════════════════════════

export function SettingsPageRestarting() {
  return (
    <>
      <main role="main" className="p-8 max-w-3xl mx-auto opacity-40 pointer-events-none">
        <PageHeader configFilePath={MOCK_SETTINGS.configFilePath} />
        <GeneralCard {...MOCK_SETTINGS} />
        <UpdaterCardInline config={MOCK_UPDATER_CONFIG} status={MOCK_UPDATER_STATUS} />
        <DataDirCardInline datadir={MOCK_DATADIR_CUSTOM} />
      </main>

      {/* Fullscreen restart overlay */}
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-0 z-modal flex items-center justify-center bg-overlay-modal-backdrop"
      >
        <div className="
          rounded-card bg-card shadow-modal
          p-8 text-center max-w-md mx-4
        ">
          <Loader2
            size={48}
            strokeWidth={1.5}
            aria-hidden
            className="mx-auto text-indigo animate-spin"
          />
          <h2 className="text-h3 font-semibold text-fg-1 mt-4">
            正在重启 SGHUB…
          </h2>
          <p className="text-caption text-fg-2 mt-2 leading-relaxed">
            数据已迁移到新路径。应用将自动重启以加载新位置的数据库,请勿关闭窗口。
          </p>
        </div>
      </div>
    </>
  );
}
