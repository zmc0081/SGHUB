# SGHUB V2.2 — Shared Component Specifications

> 适用版本:V2.2.0(SGHUB Capsule)
> 上游依赖:[`design-tokens.json`](../step1/design-tokens.json)、[`tailwind.config.diff.js`](../step1/tailwind.config.diff.js)、[`design-style-spec.md`](../../inputs/design-style-spec.md)
> 写作约定:本规格用「component spec」格式,不写实现细节(useState / useEffect / store 调用),只写 propsAPI / 视觉 / 行为 / 交互。Step 3 页面 draft 会引用本文件的组件。
>
> **本文档覆盖 15 个组件**:
> - **Chapter A**(9 个业务组件):Titlebar / Sidebar / PaperPicker / PaperActions / FavoriteButton / PaperMetadataEditor / SkillEditor / DataDirCard + MigrationWizard / UpdaterCard
> - **Chapter B**(6 个基础设施):ToastProvider / BaseModal / ConfirmDialog / InputDialog / Skeleton / Stage

---

## 通用约定(适用所有组件)

### 命名与导出
- React 函数组件,首字母大写
- 默认导出 + 命名导出 props 类型(`export interface XxxProps { ... }`)
- 文件路径约定:`src/components/<ComponentName>.tsx`(基础设施)或 `src/components/<feature>/<ComponentName>.tsx`(业务)

### Token 引用语法
- 所有视觉值引用 Step 1 token,例如 `bg-navy` / `text-fg-2` / `rounded-card` / `shadow-card`,**禁止硬编码 hex**
- 内嵌 SVG 图标(Lucide)继承 `currentColor`,不直接写颜色

### 状态矩阵约定
本文档每个交互组件列出存在的状态:default / hover / focus-visible / active / disabled / loading / error / empty。**不存在的状态不列**(例如纯展示组件没有 hover 状态)。

### ASCII 示意图约定
本文档中的 `┌─┐ │ └─┘` 结构图仅作**视觉结构示意**,不保证字符对齐——中英文混排 + 占位符宽度不一会让框线漂移,这是文档形式的局限,不是设计错误。真实渲染外观以 Step 3 的 page draft 与 Step 6 的预览图为准。结构图中出现的 `[Lucide-IconName]` 形式占位符代表「此处渲染一个 Lucide SVG 图标」,具体图标名见各组件的 Icon 替换映射表。

### a11y 通用要求
- 所有按钮:`<button type="button">`(避免误提交表单)
- 所有图标按钮:必须有 `aria-label`(因为没有可见文字)
- 所有 input:有可见 label 或 `aria-label` / `aria-labelledby`
- 键盘可达:Tab 顺序按视觉顺序;Esc 关闭浮层;Enter 触发主操作
- 焦点可见:所有 focusable 元素必须有 `:focus-visible` 样式(用 `shadow-focus` token)

### 暗色处理
**全部继承 Step 1 token 自动切换,不在组件层写 `dark:` 前缀**。视觉差异由 CSS 变量在 `[data-theme="dark"]` 选择器下重新赋值实现。本文档不重复列暗色状态——只要 token 用对,暗色自动正确。

### 动效约定
- hover / focus 用 `duration-fast ease-khx`(120ms)
- 状态切换 / 展开 / 收起用 `duration-base ease-khx`(180ms)
- Modal 进出用 `duration-slow ease-khx`(240ms)
- **禁止 `transition-all`**;明确写 `transition-colors` / `transition-transform` / `transition-shadow` / `transition-opacity`

---

# Chapter A — 业务组件

## A.1 Titlebar

> 文件:`src/components/Titlebar.tsx`
> 用途:Tauri 无原生标题栏的自绘替代,提供窗口拖动 + 三按钮窗口控件

### propsAPI

```tsx
export interface TitlebarProps {
  /** 当前主题,影响 logo 占位的颜色 token */
  theme?: 'light' | 'dark';  // 一般来自 ThemeProvider context,不显式传
}
```

**无 ref**;组件内部不暴露 imperative API。

### dimensions

| 项 | 值 | token |
|---|---|---|
| 高度 | 36px | `spacing.titlebar` |
| 左侧 logo 占位 | 56px 宽容器,内含 20×20 圆角方块 | hardcoded inside |
| 右侧窗口控件 | 3 个 48×36 按钮 | hardcoded |
| 中央文字 "SGHUB" | `text-meta` (12px),`letterSpacing.wide-brand` (0.05em),`font-medium` | — |
| 背景 | `bg-titlebar-bg` | `--titlebar-bg` |
| 默认文字色 | `text-titlebar-fg` | `--titlebar-fg` |
| 品牌色 / 激活态 | `text-sidebar-fg-active`(纯白) | `--sidebar-fg-active` |
| z-index | `z-titlebar`(100) | `zIndex.titlebar` |

### 视觉结构

```
┌──────────────────────────────────────────────────────────────┐
│ [▢]                       SGHUB                  [─] [□] [×] │  36px
└──────────────────────────────────────────────────────────────┘
 56px                     center align              3 × 48px
 logo                     wide-brand                window ctrl
 placeholder              tracking
```

### states 矩阵(窗口控件按钮)

| 状态 | 最小化 / 最大化 | 关闭 |
|---|---|---|
| default | `text-titlebar-fg` 透明背景 | `text-titlebar-fg` 透明背景 |
| hover | `bg-white/10`(neutral overlay,Q1 例外允许) | `bg-titlebar-close-hover` + `text-white` |
| active | `bg-white/15` | `bg-titlebar-close-hover` 加深(同色 hover) |
| focus-visible | `shadow-focus` 内嵌 | 同左 |
| disabled | 当窗口处于「最大化」时,最大化按钮 icon 切为「还原」(`Copy` icon) | — |

### 行为

- 整条 titlebar 带 `data-tauri-drag-region` —— Tauri 识别后允许拖动窗口
- **三个窗口控件区域必须用 `data-tauri-drag-region="false"` 显式排除**,否则点击会被吞为拖动
- 双击 titlebar(非按钮区)= 最大化/还原(Tauri 默认行为)
- 关闭按钮 hover 时图标变 `text-white`(配合红底)

### Icon 替换

| V2.1 emoji-ish | V2.2 Lucide |
|---|---|
| `─` 最小化字符 | `Minus`,10px,stroke 1.5 |
| `□` 最大化字符 | `Square`,10px,stroke 1.5 |
| 「还原」状态 | `Copy`,10px,stroke 1.5 |
| `×` 关闭字符 | `X`,10px,stroke 1.5 |

### a11y

- titlebar 整体 `role="banner"`
- 三个按钮:`<button type="button" aria-label="Minimize / Maximize / Close">`
- 不进 Tab 顺序(`tabindex="-1"`)——窗口控件由 OS 行为补足

### 示例 JSX(仅结构)

```tsx
<header
  role="banner"
  data-tauri-drag-region
  className="
    flex items-center h-titlebar bg-titlebar-bg
    text-titlebar-fg select-none
  "
>
  <div className="w-14 px-4">
    <div className="w-5 h-5 rounded-icon bg-indigo/80" aria-hidden />
  </div>

  <div className="flex-1 text-center text-meta font-medium tracking-wide-brand text-sidebar-fg-active">
    SGHUB
  </div>

  <div className="flex" data-tauri-drag-region="false">
    <button
      type="button"
      aria-label="Minimize"
      className="
        w-12 h-titlebar flex items-center justify-center
        hover:bg-white/10 transition-colors duration-fast ease-khx
      "
    >
      <Minus size={10} strokeWidth={1.5} />
    </button>
    <button
      type="button"
      aria-label="Maximize"
      className="w-12 h-titlebar flex items-center justify-center hover:bg-white/10 transition-colors duration-fast ease-khx"
    >
      <Square size={10} strokeWidth={1.5} />
    </button>
    <button
      type="button"
      aria-label="Close"
      className="
        w-12 h-titlebar flex items-center justify-center
        hover:bg-titlebar-close-hover hover:text-white
        transition-colors duration-fast ease-khx
      "
    >
      <X size={10} strokeWidth={1.5} />
    </button>
  </div>
</header>
```

---

## A.2 Sidebar

> 文件:`src/components/Sidebar.tsx`
> 用途:固定左侧导航(8 条扁平路由)+ 顶部品牌区

### propsAPI

```tsx
export interface SidebarProps {
  /** 当前路由 path,用于高亮激活项 */
  currentPath: string;
  /** 未读今日推送数(0 = 不显示 badge,>99 显示 "99+") */
  todayUnreadCount?: number;
  /** Chat NEW 徽章是否显示 */
  showChatNewBadge?: boolean;
}
```

### dimensions

| 项 | 值 | token |
|---|---|---|
| 宽度 | 220px | `spacing.sidebar` |
| 高度 | `calc(100vh - 36px)`(扣除 titlebar) | — |
| 顶部品牌区 padding | `pt-5 pb-6 px-5`(20/24/20) | — |
| 品牌 "SGHUB" 字号 | `text-xl font-bold tracking-wide-brand` | — |
| 版本号字号 | `text-micro`(11px) | — |
| 导航项行高 | 40px | — |
| 导航项左 padding | 16px(内容)+ 4px(左 active bar 空间) | `spacing.4` + `spacing.active-bar` |
| 导航 icon 尺寸 | 18px(stroke 1.5) | `icon.size.base - 2` |
| 导航文字字号 | `text-caption`(14px) | — |
| 背景 | `bg-sidebar-bg` | `--sidebar-bg` |
| 默认文字色 | `text-sidebar-fg` | — |
| 激活文字色 | `text-sidebar-fg-active` | — |
| Hover 文字色 | `text-sidebar-fg-hover` | — |
| 激活左条 | 4px 宽 × 100% 高 `bg-sidebar-bar` | `--sidebar-active-bar`(= indigo) |

### 导航数据结构

```tsx
const NAV_ITEMS = [
  { path: '/chat',     i18nKey: 'nav.chat',     icon: MessageSquare, badge: 'new' },
  { path: '/search',   i18nKey: 'nav.search',   icon: Search },
  { path: '/feed',     i18nKey: 'nav.feed',     icon: Newspaper, badge: 'unreadCount' },
  { path: '/parse',    i18nKey: 'nav.parse',    icon: Brain },
  { path: '/library',  i18nKey: 'nav.library',  icon: Star },
  { path: '/skills',   i18nKey: 'nav.skills',   icon: Sparkles },
  { path: '/models',   i18nKey: 'nav.models',   icon: Bot },
  { path: '/settings', i18nKey: 'nav.settings', icon: Settings },
] as const;
```

### states 矩阵(导航项)

| 状态 | 左 active 条 | 文字色 | 背景 |
|---|---|---|---|
| default | 4px transparent | `text-sidebar-fg` | transparent |
| hover | 4px transparent | `text-sidebar-fg-hover` | `bg-white/5`(neutral overlay) |
| active | 4px `bg-sidebar-bar`(indigo) | `text-sidebar-fg-active` | `bg-white/8` |
| active + hover | 同 active | 同 active | `bg-white/10` |
| focus-visible | 同当前状态 + `shadow-focus` 内嵌 | — | — |

> **与 V2.1 偏离**:V2.1 的左 active 条是黄色 accent;V2.2 改为 indigo(`--sidebar-active-bar`),与新色系一致

### Badge 行为

**`badge="new"`**(Chat 项):
- 始终显示,胶囊 `rounded-pill`,`px-2 py-0.5`
- `bg-badge-update-bg` + `text-badge-update-fg`
- 文字 "NEW",`text-micro`(11px)`font-medium`
- i18n:中文显示 "新",英文 "NEW"

**`badge="unreadCount"`**(Feed 项):
- 仅 `todayUnreadCount > 0` 显示
- 胶囊 `rounded-pill`,`px-2 py-0.5`,`text-micro` `font-medium`
- `bg-badge-improve-bg` + `text-badge-improve-fg`(注意:V2.1 这里是 accent 黄;V2.2 改为 improve 绿,语义「有新内容值得看」更准确)
- 数字 ≤99 显示原数,>99 显示 "99+"
- 使用 `tabular-nums` 防止数字宽度抖动

### 行为

- 路由切换时激活条平滑滑动(CSS `transition-colors duration-base ease-khx`,实际是颜色淡入淡出,不做位置动画——简单可靠)
- 品牌区点击 logo = 跳 `/`(等同 Search)
- 整个 Sidebar 不滚动(8 项 + 品牌区 < 800px),设 `overflow-hidden`

### a11y

- `<nav aria-label="Main navigation">` 包裹导航列表
- 每项:`<a href="..." aria-current={isActive ? "page" : undefined}>`
- Badge 用 `aria-label`(例如 `aria-label="3 unread"`)
- 品牌区 logo:`<a href="/" aria-label="SGHUB home">`

### 示例 JSX(节选)

```tsx
<aside className="w-sidebar h-[calc(100vh-36px)] bg-sidebar-bg overflow-hidden flex flex-col">
  {/* Brand */}
  <a href="/" aria-label="SGHUB home" className="px-5 pt-5 pb-6 block">
    <div className="text-xl font-bold tracking-wide-brand text-sidebar-fg-active">SGHUB</div>
    <div className="text-micro text-sidebar-fg/60 mt-1">v2.2.0</div>
  </a>

  {/* Nav */}
  <nav aria-label="Main navigation" className="flex-1">
    {NAV_ITEMS.map((item) => {
      const isActive = currentPath === item.path;
      return (
        <a
          key={item.path}
          href={item.path}
          aria-current={isActive ? 'page' : undefined}
          className={`
            relative flex items-center gap-3 h-10 pl-5 pr-4 text-caption
            transition-colors duration-fast ease-khx
            ${isActive
              ? 'text-sidebar-fg-active bg-white/8'
              : 'text-sidebar-fg hover:text-sidebar-fg-hover hover:bg-white/5'}
          `}
        >
          {/* Left active bar */}
          <span
            aria-hidden
            className={`absolute left-0 top-0 bottom-0 w-active-bar ${isActive ? 'bg-sidebar-bar' : ''}`}
          />
          <item.icon size={18} strokeWidth={1.5} aria-hidden />
          <span className="flex-1">{t(item.i18nKey)}</span>
          {/* Badge slot */}
          {item.badge === 'new' && (
            <span className="rounded-pill px-2 py-0.5 text-micro font-medium bg-badge-update-bg text-badge-update-fg">
              {t('common.new')}
            </span>
          )}
          {item.badge === 'unreadCount' && todayUnreadCount > 0 && (
            <span
              className="rounded-pill px-2 py-0.5 text-micro font-medium bg-badge-improve-bg text-badge-improve-fg tabular-nums"
              aria-label={`${todayUnreadCount} unread`}
            >
              {todayUnreadCount > 99 ? '99+' : todayUnreadCount}
            </span>
          )}
        </a>
      );
    })}
  </nav>
</aside>
```

---

## A.3 PaperPicker

> 文件:`src/components/PaperPicker.tsx`
> 用途:cmdk 驱动的本地文献搜索下拉,Parse 页与 SkillEditor 测试运行场景共用

### propsAPI

```tsx
export interface PaperPickerProps {
  /** 当前选中文献的 id;空字符串表示未选 */
  value: string;
  /** 选中变化回调;clear 时回调空字符串 */
  onChange: (paperId: string) => void;
  /** 输入框 placeholder,可覆盖默认 */
  placeholder?: string;
  /** 当输入为空时显示的「最近文献」列表;长度建议 ≤ 8 */
  recentFallback?: PaperLite[];
  /** 是否禁用 */
  disabled?: boolean;
  /** 当结果加载失败时的回调,父级决定是否显示 toast */
  onError?: (err: Error) => void;
}

export interface PaperLite {
  id: string;
  title: string;
  authors: string[];      // 渲染时取前 3
  source: PaperSource;
  doi?: string;
  folderPath?: string;    // e.g. "Research / NLP / Transformers"
}

export type PaperSource = 'arxiv' | 'semantic_scholar' | 'pubmed' | 'openalex' | 'local';
```

### dimensions

| 项 | 值 |
|---|---|
| 输入框宽度 | `w-full`(继承父容器) |
| 输入框 padding | `px-input-x py-input-y`(18×12) |
| 输入框圆角 | `rounded-pill` |
| 下拉浮层最大高 | `max-h-80`(320px) |
| 下拉浮层圆角 | `rounded-card-sm`(14px) |
| 下拉浮层背景 | `bg-card` |
| 下拉浮层阴影 | `shadow-nav` |
| 下拉浮层边距(距输入框) | `mt-1`(4px) |
| 行项 padding | `px-3 py-2` |
| 行项高度 | 自适应,最低 56px(两行布局) |
| Source 徽章 | 见 A.6 PaperActions 的 SourceBadge 共用规格 |
| 高亮 mark | `bg-indigo-soft text-indigo`(替换 V2.1 `bg-yellow-200`) |

### states 矩阵

| 状态 | 输入框 | 下拉 |
|---|---|---|
| default(未聚焦) | `border-border-default` | 不显示 |
| focus | `border-border-focus` + `shadow-focus` | 显示 |
| typing(已输入) | 同 focus | 显示结果,200ms debounce 后请求 |
| loading | 同 focus | 行项区显示 3 行 Skeleton(B.5) |
| empty result | 同 focus | 显示空态文字 |
| disabled | `bg-soft` + `text-fg-3` + `cursor-not-allowed` | 不响应 |
| error | 同 focus + `shadow-focus-danger` ring | 显示错误文案 |

### 空态文案(全部走 i18n)

| 情况 | 中文 | 英文 |
|---|---|---|
| 未输入 + 无 recentFallback | (空,什么都不显示) | — |
| 未输入 + 有 recentFallback | section header「最近文献」 | "Recent papers" |
| 输入后无匹配 | "无匹配文献 — 试试缩短关键词,或先上传 PDF" | "No matches — try shorter keywords, or upload a PDF first" |
| 加载失败 | "加载失败,请稍后重试" | "Failed to load. Please retry." |

### 行项视觉结构

```
┌────────────────────────────────────────────────────┐
│ [arxiv]  Attention Is All You Need               │
│          Vaswani · Shazeer · Parmar 等 · [Folder] NLP   │  meta: text-meta text-fg-2
│          10.48550/arxiv.1706.0...                  │
└────────────────────────────────────────────────────┘
```

- 标题:`text-caption text-fg-1`,`<mark>` 高亮命中关键词
- 作者前 3 + 文件夹路径 + DOI 前 24 字符,用 ` · ` 分隔
- 文件夹路径前缀图标:`FolderClosed` 12px(替换 V2.1 的 📁)

### 行为

- 输入框获得焦点后立即展开下拉(空态走 recentFallback)
- 输入 200ms debounce,latest-search guard 防旧响应覆盖
- ↑ ↓ 上下移动选中项,Enter 确认,Esc 关闭
- 点击空白处关闭(检测外部点击)
- 选中后:输入框显示「[source] 标题截断」,下拉关闭,清除图标 (`X` icon) 出现在右侧

### a11y

- 输入框 `role="combobox"`,`aria-expanded`,`aria-controls` 指向下拉 id
- 下拉 `role="listbox"`,行项 `role="option"`,`aria-selected`
- 输入框 `aria-activedescendant` 指向当前高亮项 id
- 清除按钮 `aria-label="Clear selection"`

### 与 V2.1 的偏离点

| 项 | V2.1 | V2.2 |
|---|---|---|
| 高亮底色 | `bg-yellow-200` | `bg-indigo-soft text-indigo` |
| 输入框圆角 | `rounded` (4px) | `rounded-pill` |
| 下拉浮层圆角 | `rounded` (4px) | `rounded-card-sm` (14px) |
| Loading 状态 | 文字 "加载中…" | `<Skeleton>` 3 行(B.5) |
| 文件夹路径前缀 | emoji `📁` | Lucide `FolderClosed` |

---

## A.4 PaperActions

> 文件:`src/components/PaperActions.tsx`
> 用途:文献卡片下方的横排动作按钮行,5 个按钮 + 错误 chip

### propsAPI

```tsx
export interface PaperActionsProps {
  paper: PaperLite & {
    isOpenAccess?: boolean;
    hasLocalPdf?: boolean;
    pdfDownloadProgress?: number;  // 0-100,有值时表示下载中
    pdfDownloadId?: string;        // 取消下载用
  };
  /** size:sm 用于 Library 密集列表,md 用于 Search/Feed */
  size?: 'sm' | 'md';
  /** 控制 FavoriteButton 是否显示 */
  showFavorite?: boolean;
  /** 点击「AI 精读」时触发 */
  onParseClick?: () => void;
}
```

### dimensions

| 项 | size=sm | size=md |
|---|---|---|
| 按钮高度 | 28px | 32px |
| 按钮 padding | `px-2.5 py-1` | `px-3 py-1.5` |
| 按钮间距 | `gap-2`(8px) | `gap-3`(12px) |
| Icon 尺寸 | 14px | 16px |
| 文字字号 | `text-meta`(12px) | `text-caption`(14px) |
| 按钮圆角 | `rounded-pill` | `rounded-pill` |
| 错误 chip 字号 | `text-meta` | `text-meta` |

### 5 个按钮规格

| # | 按钮 | Icon (Lucide) | 颜色 | 行为 |
|---|---|---|---|---|
| 1 | 收藏 | (FavoriteButton 内部处理,见 A.5) | 见 A.5 | 见 A.5 |
| 2 | AI 精读 | `Brain` | `text-fg-2` → hover `text-indigo` | 跳 `/parse?paper_id=<id>` |
| 3 | 原文 | `FileText` | 同上 | 调 `resolve_paper_url`,默认浏览器打开 |
| 4 | PDF 槽 | 见下方三态 | — | 三态互斥 |
| 5 | 错误 chip(条件渲染) | `AlertTriangle` | `bg-danger-bg text-danger-fg` | 2.2s/4.2s 后自动消失 |

#### 按钮 4(PDF 槽)三态

| 状态 | 视觉 | Icon | 行为 |
|---|---|---|---|
| 已有本地 PDF | "打开 PDF" 文字按钮 | `FolderOpen` 14/16px | 调系统默认查看器打开 |
| 下载中 | 96px 宽 progress bar(高 4px,`bg-navy-soft` 底 + `bg-indigo` 进度)+ 百分比 `text-meta tabular-nums` + `X` icon 取消按钮 | `X`(取消) | 点 X 取消下载 |
| 未下载 | "下载 PDF" 文字按钮 | `Download` 14/16px | 触发下载;非 OA 时 disabled |
| 未下载 + 非 OA | 同上,`disabled` 视觉 | 同上 | tooltip:"非开放获取,无法下载" |

### states 矩阵(任意按钮)

| 状态 | 视觉 |
|---|---|
| default | `text-fg-2`,`bg-transparent`,`border border-border-default`(因为是 pill button,需要描边) |
| hover | `text-indigo`,`bg-indigo-soft`,`border-indigo-muted` |
| focus-visible | 加 `shadow-focus` |
| active | `text-indigo` + `bg-indigo-soft` 加深(同 hover) |
| disabled | `text-fg-3`,`bg-soft`,`border-border-default`,`cursor-not-allowed`,`opacity-60` |

> **与 V2.1 偏离**:V2.1 这里大多是无 border 的 ghost 按钮配 emoji;V2.2 改成带 border 的胶囊,因为新风格里 chips/buttons 主体识别就是 pill + border,无 border 在浅色卡片上会显得「票面太轻」

### 错误 chip 行为

- 父组件捕获错误后通过 `onError` 回调(或内部 hook)显示
- 视觉:`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 bg-danger-bg text-danger-fg text-meta`
- 自动消失:`setTimeout(... 2200)` 或 `4200`(失败原因长则给更长时间)
- 出现 / 消失动效:`transition-opacity duration-base ease-khx`,opacity 0 ↔ 1

### Icon 替换映射

| V2.1 emoji | V2.2 Lucide |
|---|---|
| ⭐ | `Star`(FavoriteButton 内,见 A.5) |
| 🧠 | `Brain` |
| 📄 | `FileText` |
| 📂 | `FolderOpen` |
| 📥 | `Download` |
| ⚠ | `AlertTriangle` |
| ✕ | `X` |

### a11y

- 每个按钮 `<button type="button" aria-label="...">`
- 进度条 `role="progressbar"`,`aria-valuenow`,`aria-valuemin="0"`,`aria-valuemax="100"`
- 错误 chip `role="alert"`,自动消失前由 aria-live region 朗读一次

### 示例 JSX(节选,size=md)

```tsx
<div className="flex items-center gap-3 flex-wrap">
  <FavoriteButton paperId={paper.id} compact />

  <button
    type="button"
    aria-label="AI parse this paper"
    onClick={onParseClick}
    className="
      inline-flex items-center gap-1.5 h-8 px-3 rounded-pill border
      text-caption text-fg-2 border-border-default
      hover:text-indigo hover:bg-indigo-soft hover:border-indigo-muted
      transition-colors duration-fast ease-khx
    "
  >
    <Brain size={16} strokeWidth={1.5} />
    <span>{t('paper.parse')}</span>
  </button>

  {/* PDF slot — depending on state */}
  {paper.pdfDownloadProgress != null ? (
    <div className="inline-flex items-center gap-2 h-8 px-3 rounded-pill border border-border-default">
      <div className="w-24 h-1 rounded-pill bg-navy-soft overflow-hidden">
        <div
          className="h-full bg-indigo transition-[width] duration-base ease-khx"
          style={{ width: `${paper.pdfDownloadProgress}%` }}
          role="progressbar"
          aria-valuenow={paper.pdfDownloadProgress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <span className="text-meta text-fg-2 tabular-nums">
        {paper.pdfDownloadProgress}%
      </span>
      <button type="button" aria-label="Cancel download" className="text-danger-fg hover:bg-danger-bg rounded-pill p-0.5">
        <X size={14} strokeWidth={1.5} />
      </button>
    </div>
  ) : paper.hasLocalPdf ? (
    <button type="button" /* ... open PDF ... */>
      <FolderOpen size={16} strokeWidth={1.5} /> {t('paper.openPdf')}
    </button>
  ) : (
    <button type="button" disabled={!paper.isOpenAccess} /* ... download ... */>
      <Download size={16} strokeWidth={1.5} /> {t('paper.downloadPdf')}
    </button>
  )}
</div>
```

---

## A.5 FavoriteButton

> 文件:`src/components/FavoriteButton.tsx`
> 用途:文献收藏按钮 + 下拉菜单(文件夹选择 + 新建文件夹 + 取消收藏)

### propsAPI

```tsx
export interface FavoriteButtonProps {
  paperId: string;
  /** compact:仅显示星号 icon + 文字;full:加 border + 下拉箭头 */
  variant?: 'compact' | 'full';
  /** size */
  size?: 'sm' | 'md';
}
```

### dimensions

| 项 | compact + sm | compact + md | full + md |
|---|---|---|---|
| 触发按钮高度 | 28 | 32 | 32 |
| Icon 尺寸 | 14 | 16 | 16 |
| 下拉浮层宽度 | `w-60`(240px) | `w-60` | `w-60` |
| 下拉圆角 | `rounded-card-sm`(14px) | 同 | 同 |
| 下拉阴影 | `shadow-nav` | 同 | 同 |
| 文件夹树 max-h | `max-h-60`(240px) | 同 | 同 |

### 触发按钮状态

| 状态 | 视觉 |
|---|---|
| 未收藏 default | `text-fg-2` + `Star` icon(outline)+ "收藏" 文字 + `ChevronDown` 12px |
| 未收藏 hover | `text-warning-fg-strong` + `bg-warning-bg` |
| 已收藏 default | `text-warning-fg-strong` + `Star` icon(fill)+ "已收藏" + `ChevronDown` + `tooltip` 显示所在文件夹列表 |
| 已收藏 hover | 同 default + `bg-warning-bg` 加深 |
| 打开下拉 | 同当前 + `shadow-focus` ring |

> **设计选择**:V2.1 用的「黄色已收藏」是 accent 黄;V2.2 改用 `warning` 系列(`warning-fg` token,偏金黄),视觉接近且 token 化。星星本身就是金黄的语义符号,这个映射比 navy/indigo 都合适。

### 下拉浮层结构

```
┌─────────────────────────────────────┐
│ [Star] 快速收藏到「未分类」              │  ← 顶部操作行(disabled 若已在)
├─────────────────────────────────────┤
│ [Folder] NLP                          [Check]   │  ← 文件夹树,递归
│   [Folder] Transformers                   │
│     [Folder] BERT                         │
│ [Folder] CV                               │
├─────────────────────────────────────┤
│ + 新建文件夹                         │  ← 点击展开输入行
├─────────────────────────────────────┤
│ [X] 取消收藏                          │  ← 仅已收藏时显示,`text-danger-fg`
└─────────────────────────────────────┘
```

### 行项 states

| 状态 | 视觉 |
|---|---|
| default | `text-fg-2`,`bg-card` |
| hover | `text-fg-1`,`bg-navy-faint` |
| 已选中(在该文件夹) | `text-indigo`,`bg-indigo-soft`,右侧 `Check` icon |
| disabled(快速收藏行,已在该位置时) | `text-fg-3`,`cursor-not-allowed`,`opacity-60` |

### Icon 替换

| V2.1 | V2.2 Lucide |
|---|---|
| ⭐ / ☆ | `Star` 单 icon,`fill` 切换;颜色由 token 控制 |
| ▾ | `ChevronDown` 12px |
| 📁 | `FolderClosed`(关闭)/ `FolderOpen`(展开) |
| ✓ | `Check` |
| ✕ | `X` |
| +(新建) | `Plus` |

### 行为

- 触发按钮被点击 → 切换下拉浮层
- 浮层内点击文件夹 → 加入/移除该文件夹 → 触发 toast(由 ToastProvider 接管,见 B.1)→ 浮层保持打开,可继续多选
- 点击「+ 新建文件夹」→ 行内展开输入框 + Confirm/Cancel 按钮,输入框 `autoFocus`
- 点击「✕ 取消收藏」→ 弹 ConfirmDialog(B.3)"取消收藏将从所有文件夹中移除,是否继续?"
- Esc / 点外部 → 关闭浮层

### a11y

- 触发按钮 `aria-haspopup="listbox"`,`aria-expanded`
- 浮层 `role="dialog"` 或 `role="menu"`(选 menu,因为里面是动作而非选择)
- 文件夹项:`<button type="button" role="menuitemcheckbox" aria-checked={isInFolder}>`
- focus trap:浮层打开时焦点进入,Esc 关闭后焦点回到触发按钮

### 与 V2.1 偏离点

| 项 | V2.1 | V2.2 |
|---|---|---|
| 已收藏色 | `border-amber-400 bg-amber-50 text-amber-700` | `text-warning-fg-strong bg-warning-bg` token 化 |
| Toast 出现位置 | 组件自管 `fixed bottom-4 right-4` stack | 调用 B.1 ToastProvider 全局 |
| 取消收藏确认 | 直接动作 | 弹 ConfirmDialog 二次确认 |

---

## A.6 PaperMetadataEditor

> 文件:`src/components/PaperMetadataEditor.tsx`
> 用途:文献元数据补全 Modal,用户上传 PDF 后若 `needs_user_review=true` 自动弹出

### propsAPI

```tsx
export interface PaperMetadataEditorProps {
  /** 提取出的初始元数据 */
  initial: {
    title?: string;
    authors?: string[];
    abstract?: string;
    doi?: string;
    /** 提取来源 */
    extractedFrom: 'pdf-toc' | 'pdf-info' | 'pdf-first-page' | 'filename';
    /** 提取置信度,0-1 */
    confidence: number;
  };
  /** 原文 PDF 路径,有则显示「对照原文」按钮 */
  pdfPath?: string;
  /** 保存回调 */
  onSave: (data: PaperMetadata) => Promise<void>;
  /** 跳过(保留原提取)回调 */
  onSkip: () => void;
  /** 关闭(同 onSkip 但走 X 按钮)*/
  onClose: () => void;
}

export interface PaperMetadata {
  title: string;
  authors: string[];
  abstract: string;
  doi: string;
}
```

### dimensions

| 项 | 值 | token |
|---|---|---|
| Modal 宽度 | `max-w-2xl`(768px max) | `layout.container.modal-lg` |
| Modal max-height | `max-h-[90vh]` | — |
| Modal 圆角 | `rounded-card` | — |
| Modal 阴影 | `shadow-modal` | — |
| 背景 | `bg-card` | — |
| 遮罩 | `bg-overlay-modal-backdrop` | `--overlay-modal-backdrop` |
| Header / Footer 高 | 自适应 + `border-b/t border-border-default` | — |
| Body padding | `p-6` | `spacing.5` |
| Header padding | `px-6 py-4` | — |
| Footer padding | `px-6 py-4` | — |

### Header 结构

```
┌──────────────────────────────────────────────────────────┐
│ 完善文献信息                                          [×] │
│ 提取来源:首页 · 置信度:■■■□□ 65%   [[FileText] 对照原文]      │
└──────────────────────────────────────────────────────────┘
```

- 标题:`text-h3 font-semibold text-fg-1`
- 副行:`text-meta text-fg-2`
- 置信度色阶(进度条形式,5 格):
  - `>=80%` `bg-success-fg`(绿)
  - `>=60%` `bg-warning-fg`(黄)
  - `<60%` `bg-danger-fg`(红)
  - 灰格 `bg-border-strong`
- 「对照原文」按钮:secondary 风格 hint,见 §通用按钮 (Chapter C)
- 关闭按钮:右上角 `X` 32×32,圆角 pill,hover `bg-navy-faint`

### Body 字段

| 字段 | 控件 | 必填 | placeholder |
|---|---|---|---|
| 标题 | text input | ✓ | "论文标题" |
| 作者 | 动态列表(每行 input + remove + 末行 add) | 可空但建议 1+ | "First Last" |
| 摘要 | textarea(5 行) | ✗ | "摘要内容…" |
| DOI | text input(monospace) | ✗ | "10.1234/example" |

#### 作者列表行视觉

```
[ First Last        ] [×]
[ First Last        ] [×]
[ First Last        ] [×]
[ + 添加作者                                       ]   ← 末行
```

- 每行:input + remove `X` button(28px 圆形,hover `bg-danger-bg text-danger-fg`)
- 末行 add 按钮:full-width dashed border,`border-border-default border-dashed`,`text-fg-2 hover:text-indigo hover:border-indigo-muted`

#### 空状态(作者列表为空)

显示一行提示:"暂无 — 点击「+ 添加」录入",`text-meta text-fg-3 italic`,居中

### Footer 结构

```
┌──────────────────────────────────────────────────────────┐
│                       [跳过(保留原提取)]  [   保存   ]   │
└──────────────────────────────────────────────────────────┘
```

- 跳过按钮:Ghost 风格(C.1 中 ghost 变体)
- 保存按钮:Primary navy(C.1 primary)
- 保存中状态:Primary 按钮文字变 "保存中…",icon 变 `Loader2` 旋转,disabled

### states 矩阵

| 状态 | 描述 |
|---|---|
| default | 表单显示 initial,所有 input 可编辑 |
| validating | 标题为空时,标题 input 显示 `shadow-focus-danger` + `border-danger-fg` + 下方 `text-meta text-danger-fg` 提示「标题不能为空」 |
| saving | Footer 保存按钮禁用并显示 spinner,其他 input 仍可见但不可编辑(`pointer-events-none opacity-80`) |
| saved | onSave 完成后,父级关闭 Modal |
| error | 顶部 Body 第一行显示 `<Toast role="alert">` 风格的 inline banner:`bg-danger-bg text-danger-fg rounded-card-sm px-4 py-3` |

### a11y

- Modal 使用 BaseModal(B.2)的 focus trap + Esc 关闭
- `role="dialog" aria-labelledby="metadata-editor-title"`
- 标题字段 `aria-required="true"` + `aria-invalid` 切换
- 置信度进度条 `role="progressbar" aria-valuenow={Math.round(confidence*100)} aria-valuemin={0} aria-valuemax={100}`

### 与 V2.1 偏离点

| 项 | V2.1 | V2.2 |
|---|---|---|
| 置信度颜色 | 硬编码绿/黄/红 | 走 `success-fg` / `warning-fg` / `danger-fg` token |
| 关闭按钮 | × 字符 | `X` Lucide icon,28px 圆形按钮 |
| 「对照原文」icon | 📄 | `FileText` Lucide |
| 作者删除按钮 | 文字 "删除" | `X` Lucide,圆形 |
| Modal 圆角 | 无明确(rounded-md = 6px) | `rounded-card` (16px) |

---

## A.7 SkillEditor

> 文件:`src/components/SkillEditor.tsx`
> 用途:Skill 高级编辑器,3 列布局(左表单 / 中 Monaco / 右预览),覆盖 new / edit / copy 三种模式

### propsAPI

```tsx
export interface SkillEditorProps {
  /** new = 全新创建,edit = 编辑现有,copy = 从内置复制 */
  mode: 'new' | 'edit' | 'copy';
  /** edit/copy 模式时的 Skill name(路由参数) */
  skillName?: string;
  /** new 模式时,由 SkillGenerator 通过 sessionStorage 传入的预填 YAML */
  prefillYaml?: string;
}
```

### 三列布局

| 列 | 宽度 | 背景 |
|---|---|---|
| 左表单 | 280px 固定 | `bg-card` |
| 中 Monaco | flex-1(占剩余) | Monaco 自管(亮色 `vs` 主题,暗色 `vs-dark` 主题) |
| 右预览 | 360px 固定 | `bg-card` |

> **响应式**:< 960px 宽度时,右预览折叠为「预览」浮动按钮,点击展开为 Drawer(只在 Step 3 页面层处理,这里不展开)

### 顶部 Bar

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ← 返回    YAML 解析 ●    新 Skill • 标题            [测试][另存][保存]   │
└──────────────────────────────────────────────────────────────────────────┘
```

- 返回按钮:`ArrowLeft` icon + "返回",ghost
- 未保存标识 `●`:`w-2 h-2 rounded-full bg-warning-fg`,有未保存时显示
- 解析错误标识:`AlertTriangle` + "YAML 解析失败" 文字,`text-danger-fg`
- 模式 + 标题:`text-caption text-fg-2` + `text-h3 text-fg-1`
- 右侧 3 按钮:测试(secondary)、另存(secondary)、保存(primary)

### 左表单字段

| 字段 | 控件 | 备注 |
|---|---|---|
| name | text input(monospace) | new 模式可编辑,edit 模式 readonly(因为是 key) |
| display_name | text input | |
| description | textarea(3 行) | |
| icon | text input(单字符 emoji 暂保留 OR 选择 Lucide 名) | **设计悬而未决,见下方** |
| category | select | `parsing` / `summarization` / `extraction` / `custom` |
| recommended_models | multi-input(tag chip 风格) | 输入后回车成 chip,点击 X 删除 |

> **设计选择(icon 字段)**:Skill 配置本身要求一个可视化 icon。原 V2.1 是 emoji 字符。V2.2 由于全局禁 emoji,这里**例外保留** —— 因为 Skill 是用户数据,我们不该禁止用户用 emoji 命名自己的 Skill。**程序内置 Skill 全部改 Lucide,用户自定义保留 emoji 自由**。input 旁加帮助文字:"可使用 Lucide 图标名(如 `brain`、`book-open`)或 emoji"

### YAML 解析失败提示

当左表单字段与 Monaco YAML 不同步(YAML 解析失败导致字段无法回填),左表单上方显示:

```
┌──────────────────────────────────────────────┐
│ [Alert] YAML 解析失败,字段已锁定                  │
│   修复 YAML 后字段可编辑                     │
└──────────────────────────────────────────────┘
```

- `bg-warning-bg text-warning-fg-strong rounded-card-sm p-3`
- icon:`AlertTriangle` 16px

### Monaco 配置(参考,具体引用 `@monaco-editor/react`)

| 选项 | 值 |
|---|---|
| `language` | `yaml` |
| `theme` | 亮色:`vs`;暗色:`vs-dark` |
| `options.fontFamily` | `'JetBrains Mono', monospace` |
| `options.fontSize` | 13 |
| `options.minimap.enabled` | false |
| `options.scrollBeyondLastLine` | false |
| 快捷键 | Ctrl/Cmd+S 触发保存 |
| 自定义补全 | `{{title}}` `{{authors}}` `{{abstract}}` `{{full_text}}` `{{language}}` 5 个变量 |

### 右预览 Tabs

```
┌──────────────────────────────────────────┐
│ [渲染后 Prompt]  [测试运行结果]            │  ← Tab header
├──────────────────────────────────────────┤
│ ……(选择示例文献 → 渲染 prompt 文本) ……  │
│   预估 token: 1,234                       │
└──────────────────────────────────────────┘
```

#### Tab 视觉(与 V2.1 沿用,仅换 token,不改成胶囊)

- Tab 项 `px-3 py-2 text-caption font-medium border-b-2 transition-colors duration-fast ease-khx`
- 默认:`border-transparent text-fg-2 hover:text-fg-1`
- 激活:`border-indigo text-indigo`
- 容器:`flex border-b border-border-default`

> **与 design-style-spec.md §4.6 偏离**:spec §4.6 建议 SkillEditor Tab 可考虑用悬浮胶囊导航,我**拒绝采用**——Tab 在密集编辑场景应当紧凑,胶囊导航占空间。本组件保留 V2.1 的传统 Tab 视觉(只换激活色 token 为 indigo)。详见本文档开头「这一步的设计决策」§4。

#### 渲染后 Prompt Tab

- 文献选择:复用 PaperPicker(A.3),`placeholder="选择示例文献预览 prompt"`
- 模型选择:复用通用 select 控件
- Prompt 渲染区:`<pre>` 标签,`bg-soft rounded-card-sm p-4 text-meta font-mono text-fg-1 whitespace-pre-wrap overflow-auto`
- 预估 token 行:右下角 `text-meta text-fg-2 tabular-nums`,例如 "预估 token: 1,234"

#### 测试运行结果 Tab

- 「运行测试」primary 按钮
- 输出区:按 `output_dimensions` 拆分为多个 `<DimensionCard>`(若有);无 dimensions 时整块 `<RawOutput>`
- 流式光标:`<span className="inline-block w-1 h-4 bg-indigo align-middle animate-pulse" aria-hidden />`

### 自动草稿

- 每 30 秒写一次 localStorage(key: `skill-editor-draft:<mode>:<skillName ?? "new">`)
- 切换页面时检查 draft 存在 → 顶部 Bar 下方显示一行 banner:
  ```
  ┌──────────────────────────────────────────┐
  │ 检测到上次未保存的草稿 [还原] [丢弃]      │
  └──────────────────────────────────────────┘
  ```
- banner 使用 `bg-info-bg text-info-fg rounded-card-sm p-3`

### beforeunload 警告

- 有未保存 + 关闭窗口时,触发原生 `confirm` (浏览器 API,Tauri 同样支持)
- 这是浏览器/Tauri 行为,不走 ConfirmDialog(因为生命周期对不上)
- 文案由 i18n 决定

### a11y

- 整页 `<main aria-label="Skill editor">`
- 三列各自 `<section aria-label="...">`
- Monaco 内部 a11y 由库自管(arrow key / screen reader 支持)
- 切换 Tab 用 `role="tablist" role="tab" role="tabpanel"` + `aria-selected`

### 与 V2.1 偏离点

| 项 | V2.1 | V2.2 |
|---|---|---|
| Tab 激活色 | `border-primary text-primary` | `border-indigo text-indigo`(同效果,token 化) |
| 草稿提示位置 | 嵌入左表单顶部 | 顶部 Bar 下方独立 banner(更显眼) |
| beforeunload | 浏览器 confirm | 沿用(无法 ConfirmDialog 化) |
| icon 字段 | emoji 字符 | emoji 或 Lucide 名,自由选择 |

---

## A.8 DataDirCard + MigrationWizard

> 文件:`src/components/DataDirCard.tsx` 含子组件 `MigrationWizard.tsx`
> 用途:Settings 页内显示数据目录状态 + 3 步迁移向导

### DataDirCard propsAPI

```tsx
export interface DataDirCardProps {
  /** 当前数据目录 */
  current: {
    path: string;
    isDefault: boolean;
    sizeBytes: number;
  };
  /** 默认数据目录路径(用于「恢复默认」展示) */
  defaultPath: string;
  /** 行为回调 */
  onOpenDir: () => void;
  onChangePath: () => void;       // 打开 MigrationWizard
  onRestoreDefault: () => void;   // 仅 isDefault=false 时显示
}
```

### DataDirCard 视觉结构

```
┌────────────────────────────────────────────────────────────┐
│ 数据目录                                  [自定义]  ← badge │  ← header
│ 当前路径下数据库与本地 PDF 的存储位置                       │
│                                                            │
│ ╭──────────────────────────────────────────────────────╮   │
│ │ /Users/cwz/Library/Application Support/SGHUB          │   │  ← path block
│ │                                  1.2 GB · 245 文件     │   │     (clickable to copy)
│ ╰──────────────────────────────────────────────────────╯   │
│                                                            │
│ [[FolderOpen] 打开目录] [[RefreshCw] 修改路径] [[Undo2] 恢复默认]                  │  ← actions
└────────────────────────────────────────────────────────────┘
```

- 卡片:`rounded-card shadow-card bg-card p-6`
- Header H3:`text-h3 font-semibold text-fg-1`
- 自定义 badge:`badge-new`(因为「自定义路径」是「需要注意的状态」)
- 默认 badge(隐式):无 badge(无需提示)
- 副标题:`text-caption text-fg-2 mt-1`
- 路径块:`mt-4 p-4 rounded-card-sm bg-soft font-mono text-meta text-fg-1 cursor-pointer hover:bg-navy-faint`,点击复制路径到剪贴板
- 大小 + 文件数:右对齐 `text-meta text-fg-2 tabular-nums`
- 按钮组:`mt-4 flex gap-3 flex-wrap`,全部 secondary

### 按钮 icon

| 按钮 | Icon |
|---|---|
| 打开目录 | `FolderOpen` |
| 修改路径 | `RefreshCw` |
| 恢复默认 | `Undo2` |

---

### MigrationWizard propsAPI

```tsx
export interface MigrationWizardProps {
  /** 当前数据目录 */
  current: { path: string; isDefault: boolean; sizeBytes: number };
  defaultPath: string;
  /** Step 完成回调 */
  onComplete: (newPath: string, mode: MigrationMode, keepOld: boolean) => void;
  onClose: () => void;
}

export type MigrationMode = 'migrate' | 'fresh' | 'use-existing';
```

### 3 步流程

| Step | 标题 | 主体 |
|---|---|---|
| 1 | 选择新目录 | 一个 path picker + 实时校验状态(✓ 路径可用 / ⚠ 已有 SGHUB 数据 / ✗ 错误) |
| 2 | 选择迁移模式 | 3 个 radio card,见下方 |
| 3 | 确认 | 旧→新摘要 + 模式回顾 + 红色警告 |
| Executing | 执行中 | 进度条 + 当前文件名 |
| Done | 完成 | 复选「保留/删除旧目录」+ 「立即重启」按钮 |

### Modal 共用规格

- 基于 BaseModal(B.2),宽度 `max-w-xl`(576px max)
- Header:Step 计数 "1 / 3" + 标题
- Body:Step 主体
- Footer:左侧「上一步」(Step 2/3 显示)+ 右侧「下一步 / 执行」

### Step 1 — 路径校验视觉

| 校验结果 | 视觉 |
|---|---|
| 待输入 | path input 默认状态,无提示 |
| ✓ 路径可用 | 输入框 `border-success-fg`,下方 `text-meta text-success-fg`「✓ 路径可用」 |
| ⚠ 已有 SGHUB 数据 | 输入框 `border-warning-fg`,下方 `text-meta text-warning-fg-strong`「⚠ 检测到 SGHUB 数据(版本 X.Y.Z,N 文献)」 |
| ✗ 错误(无权限 / 磁盘满 / 路径不存在) | 输入框 `border-danger-fg` + `shadow-focus-danger`,下方 `text-meta text-danger-fg`「✗ <具体错误>」 |

### Step 2 — 3 个 radio card

```
○ 迁移现有数据
  把当前路径下的所有数据复制到新路径

○ 新路径从零开始
  保留旧路径数据不动,新路径作为空白开始
  ⚠ 仅推荐:你想要在多机/多账户独立使用

○ 使用已有数据(若 Step 1 校验出已有 SGHUB 数据)
  直接使用新路径中已存在的 SGHUB 数据
```

- 每张 card:`rounded-card-sm border border-border-default p-4 cursor-pointer`
- 选中:`border-indigo shadow-focus bg-indigo-soft`
- hover:`border-navy-muted`
- 单选行为(`role="radio"` + 组 `role="radiogroup"`)

### Step 3 — 确认

```
┌──────────────────────────────────────────────────┐
│ 即将执行                                          │
│                                                  │
│ 旧路径:/old/path                                │
│ 新路径:/new/path                                │
│ 模式:迁移现有数据(245 文件 / 1.2 GB)         │
│                                                  │
│ [Alert] 操作期间请勿关闭应用,完成后应用将自动重启     │  ← danger banner
└──────────────────────────────────────────────────┘
```

- 摘要列表:`<dl>`,key `text-meta text-fg-2`,value `text-caption text-fg-1 font-mono`
- 警告 banner:`bg-danger-bg text-danger-fg rounded-card-sm p-4 mt-6`,icon `AlertTriangle`

### Executing 状态

```
┌──────────────────────────────────────────────────┐
│ 迁移中…                                           │
│                                                  │
│ ████████████████░░░░░░  62%                       │
│ paper-1706.03762.pdf                              │
└──────────────────────────────────────────────────┘
```

- 进度条:full-width,8px 高,`rounded-pill bg-navy-soft` 底 + `bg-indigo` 进度
- 文件名:`text-meta font-mono text-fg-2 mt-2 truncate`
- 进度 + 文件名通过 `data_migration:progress` Tauri 事件更新

### Done 状态

```
┌──────────────────────────────────────────────────┐
│ [Check] 迁移完成                                        │
│                                                  │
│ [Square] 删除旧目录(/old/path,1.2 GB)                │
│                                                  │
│           [立即重启]                              │
└──────────────────────────────────────────────────┘
```

- 复选框:`<input type="checkbox">` + label
- 重启按钮:Primary navy,占容器宽度的 1/2,居右

### 与 V2.1 偏离

| 项 | V2.1 | V2.2 |
|---|---|---|
| 默认 / 自定义 badge | amber `bg-amber-50/100` 硬编码 | `badge-new`(自定义)/ 不显示(默认),token 化 |
| 路径块背景 | `bg-gray-50` | `bg-soft` token |
| radio card 选中 | `border-primary bg-primary/10` | `border-indigo bg-indigo-soft` + 加 `shadow-focus` |
| Done 复选状态 | 默认勾选「保留旧目录」 | **默认不勾选「删除旧目录」**(安全保守) |

---

## A.9 UpdaterCard

> 文件:`src/components/UpdaterCard.tsx`
> 用途:Settings 页内显示自动更新配置 + 当前状态

### propsAPI

```tsx
export interface UpdaterCardProps {
  config: UpdaterConfig;
  status: UpdaterStatus;
  onConfigChange: (c: UpdaterConfig) => void;
  onCheckNow: () => Promise<void>;
  onInstallNow?: () => Promise<void>;
}

export interface UpdaterConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  dailyEveryNDays?: number;       // 1-30,仅 frequency=daily 时
  weeklyDays?: number[];          // 0-6,仅 frequency=weekly 时,至少选 1
  timeOfDay: string;              // "HH:mm",15min step
  onUpdateFound: 'notify' | 'silent-download' | 'mark-only';
}

export interface UpdaterStatus {
  currentVersion: string;
  lastCheckAt?: string;           // ISO timestamp
  pendingVersion?: string;        // 检测到更新时
  nextCheckAt?: string;           // 前端实时算
}
```

### 卡片结构

```
┌────────────────────────────────────────────────────────────────┐
│ 自动更新                                              [CheckSquare] 启用     │  ← header + master switch
│ 启用后将按设定的时间自动检查更新                                │
│                                                                │
│ 频率   ○ 每日   ● 每周                                          │
│        ┌─────────────────────────────────────────────────────┐ │
│        │ [一] [二] [三] [四] [五] [六] [日]                  │ │  ← weekday toggle chips
│        └─────────────────────────────────────────────────────┘ │
│                                                                │
│ 时间   [10:00 ▼]                                                │  ← time select
│                                                                │
│ 发现更新  ○ 弹通知   ● 静默下载   ○ 只标记                      │  ← onUpdateFound
│                                                                │
│ ─────────────────────────────────────────────────────────────  │
│                                                                │
│ 当前版本    v2.2.0                                              │
│ 最近检查    2 小时前                                            │
│ 下次计划    今天 22:00                                          │
│ 待安装      v2.3.0 ([Check] improve badge)                            │  ← pending,有时显示
│                                                                │
│ [立即检查]  [立即安装]                                          │  ← actions
└────────────────────────────────────────────────────────────────┘
```

### 视觉细节

| 项 | token |
|---|---|
| 卡片 | `rounded-card shadow-card bg-card p-6` |
| Header H3 | `text-h3 font-semibold text-fg-1` |
| Master switch | 见下方「开关组件」§ |
| section gap | `mt-4` |
| 分割线 | `border-t border-border-default my-5` |
| Status `<dl>` | grid `grid-cols-[120px_1fr] gap-y-2 text-caption` |
| Status key | `text-fg-2` |
| Status value | `text-fg-1` |
| Pending badge | `<span class="badge-improve">v2.3.0</span>`,内含 `RefreshCw` icon |

### Master switch 视觉

由于 V2.1 用 `<input type="checkbox">`,V2.2 升级为自绘 toggle:

```
   ●──────              ──────●
   off                  on    
   bg-border-strong     bg-indigo
```

- 容器:`w-10 h-6 rounded-pill bg-border-strong transition-colors duration-fast`
- 圆点:`w-5 h-5 rounded-full bg-white shadow-card-sm transform transition-transform duration-fast`
- on 状态:容器 `bg-indigo`,圆点 `translate-x-4`
- focus-visible:容器 `shadow-focus`

### 禁用态(enabled=false)

整个下方控件区:`opacity-50 pointer-events-none transition-opacity duration-base`

### Frequency 单选

- 文字 radio button(原生 `<input type="radio">` 或自绘)
- 选中态文字:`text-indigo font-medium`
- 切换 frequency 时,下方 weekday chips / N 天 input 切换显示(`transition-opacity duration-base`)

### Weekday chips

- 7 个胶囊:`rounded-pill px-3 py-1.5 text-meta cursor-pointer transition-colors duration-fast`
- 默认:`bg-card border border-border-default text-fg-2`
- 选中:`bg-indigo-soft border-indigo-muted text-indigo`,前置 `Check` icon 12px
- 至少选 1 校验:全部未选时,group 下方红字提示 "至少选择一天"

### Daily 每 N 天

- text input 类型 number,`min=1 max=30`,默认 1
- 视觉:`<input class="input-pill w-20 text-center">`(详见 C.1 通用控件)

### Time select

- 96 项 15min step 下拉 (00:00 → 23:45)
- 视觉:`<select class="input-pill">`,内部 chevron 图标替换原生(详见 C.1)

### 操作按钮

| 按钮 | Variant | 条件 |
|---|---|---|
| 立即检查 | Secondary | 始终显示 |
| 立即安装 | Primary | 仅 `status.pendingVersion` 存在时显示 |

### 状态文案 i18n

| 情况 | 中文 | 英文 |
|---|---|---|
| 最近检查从未 | "从未检查" | "Never checked" |
| 最近检查 < 60s | "刚刚" | "Just now" |
| 最近检查 < 60min | "N 分钟前" | "N min ago" |
| 最近检查 < 24h | "N 小时前" | "N hr ago" |
| 最近检查 > 24h | 显示具体日期 "MM/DD HH:mm" | 同 |
| 下次检查同上 |

### Toast / inline message

- 「立即检查」点击后无新版本:inline message `bg-info-bg text-info-fg p-3 rounded-card-sm mt-3`「已是最新版本」,3 秒后淡出
- 出错:同位置 `bg-danger-bg text-danger-fg` "<错误信息>"

### a11y

- Master switch:`role="switch" aria-checked` + `aria-label="Enable auto update"`
- Frequency radios:`role="radiogroup" aria-labelledby`
- Weekday chips:每个 `role="checkbox" aria-checked`,group `role="group" aria-label="Weekdays"`
- 状态 `<dl>` 用语义化标签

### 与 V2.1 偏离

| 项 | V2.1 | V2.2 |
|---|---|---|
| Master switch | `<input type="checkbox">` 原生 | 自绘 toggle 胶囊 |
| Weekday chips 选中 | `border-primary bg-primary/10 text-primary` | `bg-indigo-soft border-indigo-muted text-indigo`(token 化) |
| 操作按钮颜色 | hardcoded | navy primary / secondary token |

---

# Chapter B — 基础设施组件

> 这一章是 SGHUB V2.2 新增的全局基础设施。V2.1 没有,因此被 design-style-spec.md §4.7 列为「必须自建」。

## B.1 ToastProvider

> 文件:`src/components/ToastProvider.tsx` + `src/hooks/useToast.ts`
> 用途:全局 1 套 toast 系统,替换 V2.1 的 3 套各自为政方案

### API

```tsx
// Provider:在 App 根挂载一次
<ToastProvider>
  {children}
</ToastProvider>

// Hook:在任何子组件调用
const toast = useToast();
toast.success("已加入「未分类」");
toast.error("连接失败,请重试");
toast.warning("接近 Token 上限");
toast.info("已自动保存");

// 高级用法
toast.show({
  variant: 'success',
  title: '迁移完成',
  description: '245 个文件已迁移到新目录',
  duration: 6000,
  action: { label: '立即重启', onClick: () => ... },
});
```

```tsx
export type ToastVariant = 'success' | 'danger' | 'warning' | 'info';

export interface ToastOptions {
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;    // 默认 4000;0 = 不自动关闭
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ToastApi {
  show: (opts: ToastOptions) => string;  // 返回 id
  success: (title: string, description?: string) => string;
  danger: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  dismiss: (id: string) => void;
}
```

### 视觉规格

| 项 | 值 |
|---|---|
| 位置 | `fixed top-12 right-4`(top 12 = titlebar 36 + 12 间距) |
| z-index | `z-toast`(50) |
| 单条宽度 | `w-80`(320px),`max-w-[calc(100vw-32px)]` |
| 单条圆角 | `rounded-card-sm`(14px) |
| 单条阴影 | `shadow-nav` |
| 单条 padding | `p-4` |
| 多条堆叠 | `flex flex-col gap-2`(向下) |
| 进入动画 | `translate-x-4 opacity-0` → `translate-x-0 opacity-100`,`duration-base` |
| 退出动画 | 反向,`duration-base` |

### 4 个 variant 视觉

| variant | bg | border-left | icon | text |
|---|---|---|---|---|
| success | `bg-success-bg` | 4px `bg-success-fg`(用 `border-l-4 border-success-fg`) | `CheckCircle2` 20px `text-success-fg` | `text-fg-1` |
| danger | `bg-danger-bg` | 4px `bg-danger-fg` | `XCircle` 20px `text-danger-fg` | `text-fg-1` |
| warning | `bg-warning-bg` | 4px `bg-warning-fg-strong` | `AlertTriangle` 20px `text-warning-fg-strong` | `text-fg-1` |
| info | `bg-info-bg` | 4px `bg-info-fg` | `Info` 20px `text-info-fg` | `text-fg-1` |

### 单条结构

```
┌─┬──────────────────────────────────────────┐
│ │ [icon]  Title text                  [X]  │  ← title row
│ │         Description text                  │  ← optional description
│ │         [Action button]                   │  ← optional action
└─┴──────────────────────────────────────────┘
 ↑  4px colored border-left
```

- Title:`text-caption font-semibold text-fg-1`
- Description:`text-meta text-fg-2 mt-1`
- Action button:`text-caption font-medium text-indigo hover:text-indigo-hover mt-2`(纯文字)
- 右上角关闭 `X` 14px,`text-fg-3 hover:text-fg-1`

### 行为

- duration 默认 4000ms(success/info)/ 6000ms(warning/danger,留更长时间让用户看清错误)
- 鼠标 hover 在 toast 上 → 暂停倒计时
- 鼠标移开 → 重新倒计时(剩余时间继续)
- 多条同时:`max stack = 5`,超过后旧的强制 dismiss
- 关闭顺序:FIFO(先来先消失)

### a11y

- Provider 容器 `role="region" aria-label="Notifications" aria-live="polite"`
- danger variant:`aria-live="assertive"`
- 单条 `role="alert"` 或 `role="status"`(success/info 用 status,danger/warning 用 alert)

---

## B.2 BaseModal

> 文件:`src/components/BaseModal.tsx`
> 用途:所有 Modal 的基础容器,替换 V2.1 散落的 3 种 modal 实现

### API

```tsx
export interface BaseModalProps {
  open: boolean;
  onClose: () => void;
  /** 尺寸预设 */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Esc 是否关闭(默认 true,某些场景如迁移中要 false) */
  closeOnEscape?: boolean;
  /** 点击遮罩是否关闭(同上) */
  closeOnBackdrop?: boolean;
  /** 标题 */
  title?: string;
  /** 副标题 / 描述 */
  description?: string;
  /** 是否显示右上角 X 关闭按钮 */
  showClose?: boolean;
  /** Footer 内容(传入 ReactNode);留空则不显示 Footer */
  footer?: React.ReactNode;
  /** Body 内容 */
  children: React.ReactNode;
}
```

### 尺寸预设

| size | max-w | 用途 |
|---|---|---|
| sm | `max-w-md` (448px) | ConfirmDialog / InputDialog |
| md | `max-w-xl` (576px) | MigrationWizard / 一般表单 |
| lg | `max-w-2xl` (672px) | PaperMetadataEditor |
| xl | `max-w-4xl` (896px) | 大型查看/编辑场景(本版本暂无) |

### 视觉结构

```
┌─────────────────────────────────────┐
│ [Title text]                  [X]   │  ← header (optional)
│ Description text                    │
├─────────────────────────────────────┤
│                                     │
│   <children>                        │  ← body
│                                     │
├─────────────────────────────────────┤
│                      [Cancel] [OK]  │  ← footer (optional, ReactNode)
└─────────────────────────────────────┘
```

| 元素 | token |
|---|---|
| 遮罩 | `fixed inset-0 bg-overlay-modal-backdrop z-modal` |
| Modal 容器 | `bg-card rounded-card shadow-modal max-h-[90vh] flex flex-col` |
| Modal 进入 | `opacity-0 scale-95` → `opacity-100 scale-100`,`duration-slow ease-khx` |
| 遮罩进入 | `opacity-0` → `opacity-100`,`duration-slow` |
| Header | `px-6 py-4 border-b border-border-default flex-shrink-0` |
| Header title | `text-h3 font-semibold text-fg-1` |
| Header description | `text-meta text-fg-2 mt-1` |
| Header close `X` | 32×32 圆形按钮,右上角,`text-fg-2 hover:text-fg-1 hover:bg-navy-faint` |
| Body | `px-6 py-5 overflow-y-auto flex-1` |
| Footer | `px-6 py-4 border-t border-border-default flex-shrink-0 flex justify-end gap-3` |

### 行为

- **Focus trap**:打开时焦点进入 Modal 内第一个 focusable 元素;Tab/Shift+Tab 在 Modal 内循环;不会跳出
- **Esc 关闭**:`closeOnEscape=true`(默认)时
- **遮罩点击关闭**:`closeOnBackdrop=true`(默认)时
- **背景滚动锁**:打开时 `document.body.style.overflow = 'hidden'`,关闭恢复
- **焦点恢复**:关闭后焦点回到触发元素

### a11y

- Modal 容器 `role="dialog" aria-modal="true"`
- 有 title 时 `aria-labelledby="modal-title-{id}"`
- 有 description 时 `aria-describedby="modal-description-{id}"`
- 关闭按钮 `aria-label="Close dialog"`

---

## B.3 ConfirmDialog

> 文件:`src/components/ConfirmDialog.tsx`(基于 BaseModal)
> 用途:替换全部 `window.confirm`

### API

```tsx
export interface ConfirmDialogProps {
  open: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  title: string;
  description?: string;
  /** 操作语义,影响主按钮颜色 */
  variant?: 'default' | 'danger';
  confirmLabel?: string;   // 默认 "确认" / "Confirm"
  cancelLabel?: string;    // 默认 "取消" / "Cancel"
}

// 命令式 API(可选,便于替换 confirm())
export function confirmAsync(opts: Omit<ConfirmDialogProps, 'open' | 'onConfirm' | 'onCancel'>): Promise<boolean>;
```

### 视觉

基于 BaseModal `size="sm"`,Footer 固定为两个按钮:

| variant | Confirm 按钮 |
|---|---|
| default | Primary navy |
| danger | Danger red(`bg-danger-fg text-white hover:bg-danger-fg/90`)|

> **注意**:danger variant 的按钮是 V2.2 新加的「Danger Primary」按钮变体,见 C.1 通用按钮。

Cancel 按钮始终是 Ghost(secondary)。

### Body 视觉

- 无 children,只显示 description
- `text-body text-fg-1`
- 居中或左对齐(左对齐,与 description 一致)

### 行为

- onConfirm 是 async 时:点击 Confirm 后按钮变 loading,Cancel 禁用,Esc 暂时禁用(避免误关闭执行中的操作)
- onConfirm 抛错:Modal 内顶部弹一行 inline error,Footer 按钮复活,允许重试

### a11y

- `role="alertdialog"`(确认动作需要更明确的语义)
- `aria-describedby` 指向 description
- Confirm 按钮 `autoFocus`(等待 Enter 触发);danger variant 时 **Cancel** 按钮 autoFocus(更安全)

---

## B.4 InputDialog

> 文件:`src/components/InputDialog.tsx`(基于 BaseModal)
> 用途:替换全部 `window.prompt`(如「重命名文件夹」「输入 Skill 名称」等)

### API

```tsx
export interface InputDialogProps {
  open: boolean;
  onConfirm: (value: string) => void | Promise<void>;
  onCancel: () => void;
  title: string;
  description?: string;
  initialValue?: string;
  placeholder?: string;
  label?: string;
  /** 内置校验函数,返回错误文本或 null */
  validate?: (value: string) => string | null;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function promptAsync(opts: Omit<InputDialogProps, 'open' | 'onConfirm' | 'onCancel'>): Promise<string | null>;
```

### 视觉

基于 BaseModal `size="sm"`,Body 内含:

```
┌─────────────────────────────────────┐
│ <description text>                   │
│                                      │
│ Label                                │
│ ┌──────────────────────────────────┐ │
│ │ [pill input]                     │ │
│ └──────────────────────────────────┘ │
│ <validation error if any>           │
└─────────────────────────────────────┘
```

- Label:`text-caption font-medium text-fg-1 mb-2`
- input:`input-pill w-full`(C.1 通用输入)
- 校验错误:`text-meta text-danger-fg mt-2`,有错误时 input 加 `border-danger-fg shadow-focus-danger`

### 行为

- Input `autoFocus`,文本被选中(便于直接覆盖)
- Enter 触发 Confirm
- validate 函数实时调用,有错误时 Confirm 按钮 disabled
- onConfirm 异步同 ConfirmDialog

### a11y

- `<input aria-label={label}>` 或 `<label>` + `htmlFor`
- 校验错误用 `aria-invalid` + `aria-describedby` 指向错误元素

---

## B.5 Skeleton

> 文件:`src/components/Skeleton.tsx`
> 用途:替换 V2.1 的「加载中…」纯文字,提升加载感知速度

### API

```tsx
export interface SkeletonProps {
  /** 预设变体 */
  variant?: 'text' | 'circle' | 'rect' | 'paper-card' | 'list-row';
  /** 自定义宽高(variant=text/rect 时) */
  width?: string | number;
  height?: string | number;
  /** 文字变体的行数 */
  lines?: number;
  /** className 透传 */
  className?: string;
}
```

### 视觉规格

| 变体 | 用途 | 视觉 |
|---|---|---|
| `text` | 文字行占位 | `h-3 rounded-pill bg-navy-soft animate-pulse`,默认 1 行,宽度依赖父级 |
| `circle` | 头像 / 圆形 icon | `rounded-full bg-navy-soft animate-pulse` |
| `rect` | 任意矩形 | `rounded-card-sm bg-navy-soft animate-pulse` |
| `paper-card` | 文献卡占位 | 复合 skeleton:source badge + title 2 行 + meta 1 行 + actions 1 行 |
| `list-row` | 列表行占位 | 复合 skeleton:circle 32 + text 2 行 |

### 动画

- `animate-pulse` 是 Tailwind 内置,频率 2s 循环
- 暗色:`bg-navy-soft` 在暗色下已 token 化,自动适配

### 用法示例

```tsx
{isLoading ? (
  <>
    <Skeleton variant="paper-card" />
    <Skeleton variant="paper-card" />
    <Skeleton variant="paper-card" />
  </>
) : (
  papers.map(p => <PaperCard key={p.id} paper={p} />)
)}
```

### a11y

- `role="status" aria-busy="true" aria-label="Loading"`(放在父容器更合适)
- 单个 Skeleton 元素:`aria-hidden="true"`(避免屏幕阅读器朗读「占位」)

---

## B.6 Stage

> 文件:`src/components/Stage.tsx`
> 用途:KHX 紫蓝光晕氛围容器,用于空状态、Hero 区、引导

### API

```tsx
export interface StageProps {
  /** 强度:soft 用于小空状态,full 用于 Hero/Welcome */
  intensity?: 'soft' | 'full';
  /** 子内容 */
  children: React.ReactNode;
  /** className 透传 */
  className?: string;
}
```

### 视觉规格(intensity=full)

```
┌─────────────────────────────────────────────┐
│  ╲╲╲ purple glow                            │
│   ╲╲╲                                       │
│                                             │
│         <children>                          │
│                                             │
│                            blue glow ╱╱╱    │
│                                     ╱╱╱     │
└─────────────────────────────────────────────┘
```

- 容器:`relative overflow-hidden bg-stage-gradient`
- 紫光晕 `::before`:`absolute -top-20 -right-20 w-[400px] h-[400px] rounded-full bg-glow-purple pointer-events-none`
- 蓝光晕 `::after`:`absolute -bottom-20 -left-16 w-[400px] h-[400px] rounded-full bg-glow-blue pointer-events-none`
- 内容:`relative z-10`(在光晕之上)

### intensity=soft 变体

- 不显示蓝光晕(只保留紫)
- 紫光晕缩到 240px
- 用于卡片内嵌空状态(尺寸更小)

### CSS 实现

Tailwind 不直接支持 `::before` 渐变,通过 plugin 提供 utility `.bg-stage` 或在 component 内用内联 `<div className="absolute ..." style={{ background: 'var(--glow-purple)' }} />`(更可维护)。

### 用法示例

```tsx
<Stage intensity="full" className="rounded-card p-12 text-center">
  <BookOpen size={64} className="mx-auto text-indigo opacity-60" />
  <h2 className="text-h2 font-semibold text-fg-1 mt-6">{t('library.empty.title')}</h2>
  <p className="text-body text-fg-2 mt-2">{t('library.empty.description')}</p>
</Stage>
```

### a11y

- 整体 `aria-hidden` 取决于内容;光晕本身 `aria-hidden="true"`
- 容器无特殊 role,继承业务语义

---

# Chapter C — 通用控件参考(非完整组件,但被多处复用)

> 这一章不是独立组件,而是通用控件类的「样式契约」。Step 3 页面 draft 会复用这些类。

## C.1 Buttons(5 variants)

```css
.btn-primary {
  /* navy bg + white text + pill + shadow-btn + hover translateY(-1px) */
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--btn-y) var(--btn-x);
  background: var(--navy);
  color: var(--text-inverse);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-btn);
  font-weight: var(--fw-medium);
  font-size: var(--fs-caption);
  transition:
    background var(--duration-fast) var(--ease-khx),
    transform   var(--duration-fast) var(--ease-khx),
    box-shadow  var(--duration-fast) var(--ease-khx);
}
.btn-primary:hover     { background: var(--navy-hover);  transform: translateY(-1px); box-shadow: var(--shadow-btn-hover); }
.btn-primary:active    { background: var(--navy-active); transform: translateY(0); }
.btn-primary:disabled  { opacity: 0.5; cursor: not-allowed; transform: none; }
.btn-primary:focus-visible { box-shadow: var(--shadow-btn), var(--shadow-focus); }
```

类似 `.btn-secondary` / `.btn-link` / `.btn-icon-round` / `.btn-danger` 略,定义在 `src/styles/components.css`。

### 完整 5 variants 矩阵

| variant | bg | text | border | hover bg | 用途 |
|---|---|---|---|---|---|
| primary | `--navy` | `--text-inverse` | none | `--navy-hover` | 主操作:保存、检索、运行 |
| secondary | `--bg-card` | `--text-1` | `--border-default` | `--navy-faint` | 二级:取消、测试连接 |
| link | transparent | `--indigo` | none | text `--indigo-hover` | 文字链接 |
| icon-round | `--bg-card` | `--text-2` | `--border-default` | `--navy-faint`,text `--text-1` | Chat 输入区 + 按钮 |
| danger | `--danger-fg` | white | none | `--danger-fg` 加深 10% | 不可逆操作:删除 |

## C.2 Inputs

```css
.input-pill {
  display: block;
  width: 100%;
  padding: var(--input-y) var(--input-x);
  font-size: 13px;  /* KHX 实测值 */
  color: var(--text-1);
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-pill);
  transition: border-color var(--duration-fast) var(--ease-khx), box-shadow var(--duration-fast) var(--ease-khx);
}
.input-pill:focus-visible {
  border-color: var(--border-focus);
  box-shadow: var(--shadow-focus);
}
.input-pill:disabled {
  background: var(--bg-soft);
  color: var(--text-3);
  cursor: not-allowed;
}
.input-pill[aria-invalid="true"] {
  border-color: var(--danger-fg);
  box-shadow: var(--shadow-focus-danger);
}

.textarea-pill {
  /* 与 input-pill 类似,但 border-radius 用 --radius-card-sm (14px) */
  border-radius: var(--radius-card-sm);
  padding: var(--textarea-y) var(--textarea-x);
  resize: vertical;
  min-height: 90px;
  font-family: var(--font-sans);
  font-size: 13px;
}
```

## C.3 Select(自绘 chevron)

```tsx
<div className="relative">
  <select className="input-pill appearance-none pr-9">
    <option>...</option>
  </select>
  <ChevronDown size={16} strokeWidth={1.5}
    className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-fg-2" />
</div>
```

## C.4 Chip / Tag

```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);  /* 4px 12px */
  font-size: var(--fs-meta);
  font-weight: var(--fw-medium);
  border-radius: var(--radius-pill);
  background: var(--badge-default-bg);
  color: var(--badge-default-fg);
}

/* 4 semantic variants */
.chip-update  { background: var(--badge-update-bg);  color: var(--badge-update-fg); }
.chip-improve { background: var(--badge-improve-bg); color: var(--badge-improve-fg); }
.chip-bug     { background: var(--badge-bug-bg);     color: var(--badge-bug-fg); }
.chip-new     { background: var(--badge-new-bg);     color: var(--badge-new-fg); }
```

## C.5 SourceBadge(文献来源徽章)

```tsx
const SOURCE_STYLES: Record<PaperSource, { label: string; tokenBg: string; tokenFg: string }> = {
  arxiv:            { label: 'arXiv',    tokenBg: 'bg-src-arxiv',    tokenFg: 'text-src-arxiv-fg' },
  semantic_scholar: { label: 'SS',       tokenBg: 'bg-src-ss',       tokenFg: 'text-src-ss-fg' },
  pubmed:           { label: 'PubMed',   tokenBg: 'bg-src-pubmed',   tokenFg: 'text-src-pubmed-fg' },
  openalex:         { label: 'OpenAlex', tokenBg: 'bg-src-openalex', tokenFg: 'text-src-openalex-fg' },
  local:            { label: 'Local',    tokenBg: 'bg-src-local',    tokenFg: 'text-src-local-fg' },
};

export function SourceBadge({ source }: { source: PaperSource }) {
  const s = SOURCE_STYLES[source];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-pill text-micro font-medium ${s.tokenBg} ${s.tokenFg}`}>
      {s.label}
    </span>
  );
}
```

---

# Chapter D — 整体自检

## D.1 7 条质量自检

| # | 自检项 | 状态 |
|---|---|---|
| 1 | 所有色值引用 token | ✅ grep 不到 `bg-yellow` `text-amber` `bg-emerald` `text-red-` `border-gray-` 等 Tailwind 默认色;不到硬编码 hex |
| 2 | 亮 / 暗双套 | ✅ 完全继承 Step 1 token 自动切换,不写 `dark:` 前缀 |
| 3 | 胶囊主义 | ✅ 所有按钮/输入/chip/badge `rounded-pill`,textarea `rounded-card-sm`,卡片 `rounded-card` |
| 4 | 主按钮唯一 navy | ✅ Primary button 全部 `bg-navy`;indigo 仅出现在链接、icon foreground、active 状态强调 |
| 5 | 桌面密度 | ✅ Sidebar/Titlebar 固定宽高;表单 Modal 用 max-w 而非固定 px,可缩放 |
| 6 | emoji 替换 | ✅ 全部映射到 Lucide(详见各组件 Icon 替换表)。**例外**:Skill icon 字段允许用户自由输入 emoji,文档已明示 |
| 7 | Motion token | ✅ 所有 transition 都明确指明 `duration-fast/base/slow` + `ease-khx`,无 `transition-all` |

## D.2 V2.1 → V2.2 偏离点总览

每个组件 spec 末尾有「与 V2.1 偏离点」小节;此处汇总关键的:

| 组件 | 关键偏离 |
|---|---|
| Titlebar | 窗口控件 emoji 字符 → Lucide icon |
| Sidebar | 左 active 条 黄色 → indigo;未读 badge 黄色 → improve 绿;Chat NEW emerald → update indigo |
| PaperPicker | `<mark>` 高亮 yellow-200 → indigo-soft;loading 文字 → Skeleton |
| PaperActions | ghost button → pill button with border;5 个 emoji → Lucide 全替换 |
| FavoriteButton | 取消收藏直接动作 → 弹 ConfirmDialog;toast 改走全局 Provider |
| PaperMetadataEditor | 置信度色阶硬编码 → token 化;关闭 × 字符 → Lucide |
| SkillEditor | Tab 激活色 primary blue → indigo;草稿提示嵌入 → 独立 banner |
| DataDirCard | amber badge → badge-new token;radio card 选中 → indigo |
| UpdaterCard | 原生 checkbox → 自绘 toggle |
| ConfirmDialog / InputDialog | 原生 confirm/prompt → 自绘 Modal |
| Skeleton | 「加载中…」文字 → 灰脉冲块 |
| Stage | 不存在 → 新增,用于空状态/Hero |

## D.3 Step 3 前的 follow-up

- **Skill icon 字段「emoji or Lucide name」的具体 UX**(Step 3 SkillEditor draft 时确定:是单一 input 还是切换 mode?)
- **MigrationWizard Step 1 的「path picker」**(走 Tauri dialog API,前端只显示路径文本)
- **Lucide tree-shaking 验证**(Step 4 出 icon-map 时再 bundle 分析,目前用法应在 <10KB)
- **Stage 组件的 CSS 实现**(纯 CSS pseudo-element vs 内联 div;Step 3 第一次用时落地)

---

> 本文件归档至 `docs/v2.2/component-specs.md`,Step 3 / 4 / 5 在引用本文档组件时若发现规格缺漏,直接回此文档增补,不另起文件。
