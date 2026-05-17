# SGHUB UI 设计需求清单 (V2.1.0)

> 用途:为后续 UI 重构 / Figma 重做 / 前端代码重构提供完整的需求清单与现状基线。
> 来源:对仓库中 9 个页面、7 个共享组件、3 个 Chat 子组件、`tailwind.config.js`、
> `src/styles/index.css`、`locales/{zh-CN,en-US}.json` 的逐文件审计。
> 适用人群:设计师(无需读源码即可在 Figma 中复刻全部界面)、前端重构工程师、PM。

---

## 0. 系统总览

### 应用形态
- **桌面应用**:Tauri 2(Rust + WebView)。窗口默认 1280×800,最小 960×600,**无原生标题栏**(自绘 Titlebar)。
- **平台**:Windows 10/11、macOS 12+(release 构建)、Linux(dev 可用)。
- **多语言**:简体中文 / English,跟随系统;Setting 页内可手动切换,无需重启。

### 全局布局(所有页面共用)
```
┌────────────────────────────────────────────────────────────┐
│ Titlebar  36px ─── drag region + window controls            │
├──────────┬─────────────────────────────────────────────────┤
│          │                                                  │
│ Sidebar  │   Page route content                             │
│ 220px    │   (该页面自管理 header / scroll / footer)         │
│ dark     │                                                  │
│          │                                                  │
└──────────┴─────────────────────────────────────────────────┘
```

- 没有「全局页面 header」;每个页面自带 H1 + 副标题 + 该页面专属工具条。
- `body { overflow: hidden }` —— 唯一的滚动容器是 page content 内部。
- 全局共有 9 条路由,Skill 模块下还有 4 条子路由(详见第 12 节)。

### 主要技术栈(影响 UI 实现)
| 关注点 | 技术选型 |
|---|---|
| 框架 | React 18 + TypeScript |
| 路由 | TanStack Router |
| 状态 | Zustand(`chatStore`、`libraryStore`、`skillGeneratorStore`) |
| 样式 | TailwindCSS 3 + CSS variables(主题切换) |
| Markdown 渲染 | `react-markdown` + `remark-gfm` + `rehype-highlight`(GitHub 高亮主题) |
| 图表 | `recharts`(只在 Models 7 天柱状图用) |
| 命令面板 | `cmdk`(只在 PaperPicker) |
| 拖拽 | `@dnd-kit/core`(只在 Library) |
| 代码编辑 | `@monaco-editor/react`(只在 SkillEditor) |
| 国际化 | `i18next` + `react-i18next` + `i18next-browser-languagedetector` |

---

## 1. 设计 Tokens

### 1.1 颜色(`src/styles/index.css` CSS 变量)

| Token | 亮色 | 暗色 | 主要用途 |
|---|---|---|---|
| `--primary` | `#1F3864` 深海军蓝 | `#4A78C8` 中蓝 | 所有 H1、主操作按钮、关键图标 |
| `--accent` | `#D4A017` 芥黄 | `#E6B536` 金黄 | NEW 徽章、drag-over ring、未读小圆点 |
| `--bg` | `#F8F6F1` 暖米白 | `#0F1115` 近黑 | 整页背景 |
| `--fg` | `#1A1F2E` 深墨蓝 | `#E8E8EC` 灰白 | 正文文本 |
| `--sidebar-bg` | `#1A1F2E` | `#0A0C12` | 侧栏深色面板 |
| `--sidebar-fg` | `#C8C8D0` | `#B0B0BC` | 侧栏未选中文字 |
| `--sidebar-fg-active` | `#FFFFFF` | `#FFFFFF` | 侧栏选中文字 / 品牌 logo |
| `--titlebar-bg` | `#1A1F2E` | `#0A0C12` | 标题栏背景(同 sidebar) |
| `--border` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.1)` | 通用 1px 分割线 |

#### 1.1.1 文献来源徽章(硬编码)
| Source | 背景色 | 文字色 |
|---|---|---|
| `arxiv` | `#B31B1B` | `#FFF` |
| `semantic_scholar` | `#1857B6` | `#FFF` |
| `pubmed` | `#00897B` | `#FFF` |
| `openalex` | `#7B3FBF` | `#FFF` |
| `local` | `#6B7280` (gray-500) | `#FFF` |

#### 1.1.2 阅读状态色条(Library 卡片左侧 10px 竖条)
| 状态 | 颜色 |
|---|---|
| `unread` | `bg-gray-300` |
| `reading` | `bg-amber-400` |
| `read` | `bg-emerald-500` |
| `parsed` | `bg-indigo-500` |

#### 1.1.3 标签调色板(Library 标签云,循环使用)
`#1F3864 #D4A017 #10B981 #EF4444 #8B5CF6 #06B6D4 #F97316 #EC4899`

### 1.2 字体

- **正文**:`-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif`
- **等宽**(代码、文件名、密钥):Tailwind `font-mono`
- **Monaco 编辑器**:`'JetBrains Mono', 'Fira Code', Consolas, monospace`,13px

#### 字号常用阶
| Class | 用途 |
|---|---|
| `text-2xl` (24px) | 页面 H1(Search、Library、Models、Settings、Skills) |
| `text-xl` (20px) | 页内 section H1(Feed、Parse) |
| `text-sm` (14px) | 正文 / 控件文字 |
| `text-xs` (12px) | 表单 label、meta line、列表项 |
| `text-[11px]` | tooltip、置顶分组标签 |
| `text-[10px]` | uppercase mini-label、徽章 |
| `text-[9px]` | NEW 徽章 |

> 大量使用 `text-app-fg/50` `/60` `/70` 来分层信息,**不要**用 `text-gray-400` 等绝对值,以便主题切换。

### 1.3 尺寸 / 间距

| Token | 值 | 用途 |
|---|---|---|
| `spacing.sidebar` | `220px` | 全局侧栏宽度(仅 Sidebar) |
| `spacing.titlebar` | `36px` | 标题栏高度 |
| Chat 会话列表 | `w-60` (240px) | 仅 ChatSessionList |
| Parse 历史列表 | `w-64` (256px) | 仅 Parse 历史侧栏 |
| Feed / Library 侧栏 | `w-72` (288px) | Feed 订阅列表 / Library 文件夹树 |
| 默认页面 padding | `p-8` (32px) | Search / Models / Settings / Skills |
| 容器最大宽度 | `max-w-3xl` / `max-w-5xl` | Settings 用 3xl,其余用 5xl |
| Modal 默认 | `max-w-xl` / `max-w-2xl` + `max-h-[90vh]` | 数据迁移向导用 xl,元数据编辑器用 2xl |

### 1.4 边框 / 半透明命名规律

| Pattern | 用途 |
|---|---|
| `border-black/10` | 卡片、输入框默认分割线 |
| `border-black/5` | 卡内嵌套分割线 |
| `bg-white/30` `/40` `/60` | 半透明面板背景(覆盖在 `--bg` 上) |
| `bg-primary/5` `/10` | hover / 选中态填充 |
| `ring-1 ring-primary/20` | 选中卡片描边 |
| `hover:border-primary/30` | 输入框 / 卡片 hover 边框 |
| `disabled:opacity-50` (或 `40`) | 通用禁用态 |

### 1.5 反馈色

| 类型 | bg | border | text |
|---|---|---|---|
| Success | `bg-emerald-50` | `border-emerald-200/300` | `text-emerald-700/800/900` |
| Warning | `bg-amber-50` | `border-amber-200/300` | `text-amber-700/800` |
| Error | `bg-red-50` | `border-red-200` | `text-red-600/700` |
| Info | `bg-primary/5` | `border-primary/20` | `text-primary` |

---

## 2. 全局 Chrome

### 2.1 Titlebar (`src/components/Titlebar.tsx`)
- 高度固定 36px,深色背景。
- 整条 `data-tauri-drag-region`(可拖动窗口)。
- **左** 56px 槽位:20px 圆角方块,`bg-accent/80`(占位 logo)。
- **中** 居中文字 "SGHUB",`text-xs font-medium tracking-wider`。
- **右** 三个 48px 窗口控件按钮:
  - 最小化(─ 图标),hover `bg-white/10`
  - 最大化(□ 图标),hover `bg-white/10`
  - 关闭(× 图标),hover `bg-red-600 text-white`
  - 每个按钮内 SVG 图标 10px,描边 1.5

### 2.2 Sidebar (`src/components/Sidebar.tsx`)
- 固定 220px 宽,深色 `bg-sidebar`,文字 `text-sidebar-fg`(#C8C8D0)。
- **顶部品牌区**(`px-5 pt-5 pb-6`):
  - "SGHUB" 主品牌,`text-xl font-bold tracking-wider`,白色
  - 版本号 "v2.1.0",`text-[10px] text-sidebar-fg/60`
- **导航列表**(扁平,无分组):
  | # | Icon | 中 / EN key | 路由 | 备注 |
  |---|---|---|---|---|
  | 1 | 💬 | Chat | `/chat` | 带 `NEW` 徽章(`bg-emerald-500 text-white text-[9px]`) |
  | 2 | 🔍 | 文献检索 / Search | `/search` | |
  | 3 | 📰 | 今日推送 / Today | `/feed` | 带未读数 badge(`bg-accent text-[#1A1F2E]`,≤99 显数字,>99 显 `99+`),每 30s 轮询 |
  | 4 | 🧠 | AI 解析 / AI Parse | `/parse` | |
  | 5 | ⭐ | 收藏夹 / Library | `/library` | |
  | 6 | ✨ | Skill 管理 / Skills | `/skills` | |
  | 7 | 🤖 | 模型配置 / Models | `/models` | |
  | 8 | ⚙️ | 设置 / Settings | `/settings` | |
- **导航项交互**:
  - 默认:左侧 4px 透明 border,hover `bg-white/5 text-sidebar-fg-active`
  - 选中:左侧 4px `border-accent` 黄色条,`bg-white/5 text-sidebar-fg-active`
  - 行高 ≈ 40px,左 padding 16px

---

## 3. 通用 UI 模式

### 3.1 按钮规格

| Variant | 样式 | 用途 |
|---|---|---|
| Primary | `bg-primary text-white px-3 py-1.5 text-sm rounded hover:bg-primary/90 disabled:opacity-50` | 主要操作(保存、检索、运行) |
| Primary Outline | `border border-primary text-primary hover:bg-primary hover:text-white transition-colors` | 二级主操作(立即检查、测试连接) |
| Ghost | `border border-black/10 text-app-fg/70 hover:bg-black/5` | 取消、关闭、次要操作 |
| Danger | `bg-red-600 text-white hover:bg-red-700` | 不可逆操作(执行迁移) |
| Danger Ghost | `text-red-600 hover:bg-red-50 border border-black/10 hover:border-red-600` | 删除模型 / Skill |
| Icon Round | `w-8 h-8 rounded-full border border-black/10` 或 `w-9 h-9 rounded-full bg-primary text-white` | Chat 输入区的 + 和 发送按钮 |
| Chip / Toggle | `text-xs px-2.5 py-1 rounded border ...` 选中态 `border-primary bg-primary/10 text-primary` 前缀 `✓` | Feed 数据源、Updater 星期 |
| Text Link | `text-primary hover:underline text-xs` | 「+ 新建」「跳转」「前往模型配置」 |

### 3.2 输入控件

- **文本输入**:`px-2.5 py-1.5 text-sm bg-white border border-black/10 rounded focus:outline-none focus:border-primary`
- **textarea**:同上 + `resize-none`,自动撑高常用范围 44-200px
- **下拉 `<select>`**:`px-2 py-1 text-sm bg-white border border-black/10 rounded`
- **数字 input**:同文本,`step` 0.01 / 1 视字段定
- **密码 input**:`type="password"`,monospace 字体
- **复选框 / 单选**:原生 `<input>`,通常 `h-4 w-4`
- **`PaperPicker`**:cmdk 驱动的搜索下拉(详见第 6 章)

### 3.3 Modal / Dialog

| 类型 | 实现 | 使用场景 |
|---|---|---|
| 全屏遮罩 + 居中卡片 | `fixed inset-0 z-50 bg-black/40 flex items-center justify-center` | 数据迁移向导、PaperMetadataEditor |
| 浮层下拉(锚定按钮) | `absolute z-20/30` + `bg-white border rounded shadow-md` | Sidebar / FavoriteButton / Chat + 菜单 / Skills New 菜单 |
| 内嵌表单(非真 Modal) | 卡片插入到列表顶部 | Feed 订阅表单、Models Add/Edit |
| 原生 `confirm()` / `prompt()` / `alert()` | window API | 文件夹删除、标签删除、Skill 删除等所有破坏性操作 |

> **重构建议**:把所有原生对话框替换为自绘 Modal,统一交互与可访问性。

### 3.4 Toast / 内联反馈

当前实现**不统一**,共有 3 种风格:
1. **Skills 自定义 ToastList**(`top-12 right-4 z-50`,max-width md,emerald/red 双色,6s 自动消失,× 手动关闭)— 仅 Skills 用
2. **FavoriteButton 内嵌 toast stack**(`fixed bottom-4 right-4`)— 仅 FavoriteButton 用
3. **内联 banner**(`text-xs text-red-700 bg-red-50 border ...`)— 大部分页面

> **重构建议**:抽出全局 Toast Provider,所有页面通过 hook(`useToast`)调用。位置统一(建议 `top-12 right-4`),消失时间统一 4-6s。

### 3.5 Tabs / 分段控件

只有 SkillGenerator 和 SkillEditor 用 Tabs:
- 风格:`px-3 py-1.5 text-xs rounded-t border-b-2`,选中 `border-primary text-primary font-medium`,未选 `border-transparent text-app-fg/60 hover:text-app-fg`
- 位置:卡片头部底边,横排

### 3.6 表格(暂无,只有卡片列表)

当前所有「列表」都是卡片堆叠或 dl 风格的 grid。无传统表格组件。

> **重构建议**:如果未来 Library / Feed 要支持密集视图,需要补一个表格组件规范。

### 3.7 加载 / 空 / 错误状态

| 状态 | 当前 pattern |
|---|---|
| 加载中 | 简单 `text-sm text-app-fg/60` 文字 +(Search 用)弹跳 dot |
| 空数据 | 居中文字 + 引导动作链接,有些用 dashed border 卡片(Models / Skills) |
| 错误 | 内联红色 banner(`text-sm text-red-600 bg-red-50 border border-red-200`),前缀 `错误: ` |
| 流式生成中 | 4-6px × 12-16px `bg-primary/60 animate-pulse` 光标 |

---

## 4. 各页面详细规格

### 4.1 Search `/search`

| 区域 | 规格 |
|---|---|
| **布局** | 单栏,`p-8 max-w-5xl`,>100 条时切到虚拟滚动(`@tanstack/react-virtual`,容器 `height: calc(100vh - 280px)`) |
| **Header** | H1 "文献检索" / "Literature search" + 副标题(多源聚合说明) |
| **搜索栏** | text input + Source 下拉 + Search 按钮 |
| **副筛选** | 「时间:」`不限/近7天/近30天/近1年`;「排序:」`相关性/最新/引用(待支持)` |
| **结果卡** | Source 徽章 + 标题(truncate) + 作者(前 5 + N 等) + DOI + 摘要(`line-clamp-3`) + `<PaperActions />` |
| **结果计数** | `N 条结果 (从 M 条中筛选) · Xms · 已启用虚拟滚动` |
| **空状态** | 无查询:`输入关键词后回车开始检索`;有查询无结果:`暂无结果` |
| **加载** | 弹跳 accent dot + `正在并发请求 arXiv 与 Semantic Scholar…` |
| **错误** | 红色 banner,`错误: <message>` |

### 4.2 Feed `/feed`

| 区域 | 规格 |
|---|---|
| **布局** | 左 `w-72` 订阅列表 + 右主区。各自独立滚动 |
| **侧栏 Header** | mini-label "订阅" + 「+ 新建」链接,下方「📰 全部推送」伪项 |
| **侧栏项** | 状态点(emerald=active,gray=paused)+ 关键词(font-mono,truncate) + unread badge + meta(sources, frequency, last_run) + hover 显示 暂停/启用 / 编辑 / 删除 |
| **主 Header** | H1 "今日推送" + 计数 + 「🔄 立即刷新」按钮 |
| **结果卡** | 未读 dot + Source 徽章 + 标题 + 时间戳 + 作者 + 摘要 `line-clamp-2` + `<PaperActions />` +「标已读」按钮 |
| **新建/编辑表单** | **内嵌卡片**(非 Modal),包含:关键词输入、Sources chip 组(至少选 1)、Frequency 下拉、Max Results number。底部 Cancel + Save |
| **空状态** | 无订阅:`还没有订阅 — 点左侧「+ 新建」开始`;有订阅无结果:`暂无推送结果 — 点右上「立即刷新」立即跑一次活跃订阅` |
| **删除** | 原生 `confirm("删除订阅「<keyword>」?所有推送结果一并清除。")` |

### 4.3 Library `/library`

| 区域 | 规格 |
|---|---|
| **布局** | 左 `w-72`(文件夹树 + 底部标签云,内部纵向分割)+ 右主区。全页 DnD 包裹 |
| **侧栏** | 「文件夹」section header + 「+ 新建」链接 → 递归 `FolderTreeItem`(📁 + 名称 + 计数 + hover ✏️/🗑)。底部「标签」section + chip cloud |
| **主 Header** | H1 = 当前文件夹名(默认「收藏夹」)+ 计数 |
| **工具条** | 文件夹内搜索框 + 状态过滤下拉(`全部状态/未读/在读/已读/已解析`)+「导出 BibTeX」按钮 |
| **文献卡** | 左侧 10px 阅读状态色条(点击循环切换)+ Source 徽章 + 标题 + 作者(前 4 + 等)+ 摘要 `line-clamp-2` + `<PaperActions />`,local 文献额外有「♻ 重新提取」按钮 |
| **拖拽** | PointerSensor,5px 激活;卡片可拖到左侧文件夹;drag-over `ring-2 ring-accent ring-inset bg-accent/10`;ghost `shadow-lg opacity-60` |
| **分页** | total > 50 时显示「上一页 / 第 X / Y 页 / 下一页」 |
| **空状态** | 文件夹无文献:`该文件夹暂无文献 — 在「文献检索」搜到论文后,把卡片拖到左侧文件夹`;过滤后无:`无匹配过滤条件的文献` |
| **重新提取** | 弹 `PaperMetadataEditor` Modal |

> **设计约束**:`00000000-0000-0000-0000-000000000001` 是「未分类」固定文件夹,不可删除,提示「默认「未分类」不可删除」。

### 4.4 Parse `/parse`(AI 解析)

| 区域 | 规格 |
|---|---|
| **布局** | 左 `w-64` 历史 + 右主列(配置块 / 输出滚动 / 状态栏) |
| **左侧栏** | mini-label "解析历史"。空状态:`选择文献后查看历史` / `该文献暂无历史`。每条:Skill 名 + 相对时间 + `model · in≈X · out≈Y · Ns`,点击恢复结果 |
| **配置块** | 三行:文献(`PaperPicker` + 📤 上传按钮)/ 模型(`select` + 「开始解析」主按钮)/ Skill(`select`)。Skill 下方展示 description + 推荐模型 |
| **上传状态横幅** | 上传中:琥珀色背景,进度条 + N/M;完成:绿色 `✓ 已上传 N 个文件`,失败:红色 `上传完成:✓ X / ✗ Y` + 每文件列表(⏳/✓/✗ + filename + 错误摘要或「待补全元数据」chip) + × 关闭 |
| **输出区** | 有 `output_dimensions`:2 列网格的 `DimensionCard`(标题 + 内容 + 流式光标);无 dimensions:`RawOutput` 整块。空:居中 `选好文献 / Skill / 模型,点「开始解析」开始` |
| **状态栏** | `in ≈ N · out ≈ N`、`耗时 Ns`、`预估成本 $0.00 (待接定价表)`、右侧 `● 流式输出中…` |
| **元数据补全 Modal** | 单文件上传后若 `needs_user_review = true` 自动弹出 |

### 4.5 Chat `/chat`

| 区域 | 规格 |
|---|---|
| **布局** | 三区:左 `w-60` SessionList + 右(header / messages 滚动 / InputArea 底贴) |
| **SessionList** | 顶部「+ 新建对话」全宽 primary 按钮;空状态 `还没有对话`;`置顶` / `最近` 两个分组;每行 hover 显示「置顶/取消置顶 · 重命名 · 删除」 |
| **Chat Header** | 36px 高,标题 + `N 条消息 · 正在生成…` 副标题 |
| **Message 气泡** | 28px 圆头像(用户「我」on primary,AI 🤖 on accent/20);用户右蓝、AI 左白带边框;markdown 渲染(GFM + 高亮);附件 chip(icon + filename + size + ✓);hover 显示 复制 / 重新生成 / · model · N tok |
| **InputArea** | + 按钮 popover(📎 上传附件 / Skill 列表);auto-grow textarea(44-200px);模型下拉(`w-[160px]`);发送按钮(idle ↑ / streaming 旋转 / uploading 旋转) |
| **上传 chip** | 上传中:黄色边框 + 270° 旋转 ring(`SpinnerRing`,Claude 风格)+ 最小 400ms 可见;失败:红色边框 + ✗;成功:消失,文件进入 attachments 行 |
| **空状态** | 未选会话:`选好模型 / Skill / 附件,在下方输入开始对话`;选了空会话:`(会话为空 — 在下方输入开始)` |

### 4.6 Models `/models`

| 区域 | 规格 |
|---|---|
| **布局** | 单栏,`p-8 max-w-5xl` |
| **Header** | H1 "模型配置" + 副标题(BYOK 说明)+ 右上「重建统计」灰色链接 |
| **统计卡 × 4** | 已配置模型数 / 近 7 天调用 / 近 7 天 Token(`1.2M` 缩写)/ 近 7 天成本(USD)。每卡:label + 大字 value + hint |
| **柱状图** | 120px 高 recharts BarChart,X 轴 `MM/DD`,Y 轴 token 数,hover tooltip 显示 `当日: N 次调用 / 输入 X / 输出 Y / 成本 $Z` |
| **模型卡** | 28px provider icon(🅰️🟢🦙🔧)+ 名称 + 默认徽章 + Provider chip + endpoint·model_id·max_tokens(monospace)+ Key 状态(绿/灰/橙)+ 近 7 天用量行 + 右侧 4 按钮:测试连接 / 设为默认 / 编辑 / 删除 |
| **添加表单** | **内嵌卡片**(非 Modal,`border-primary/30`):预设 chip → 名称 / Provider / Endpoint / Model ID / Max Tokens / 输入价格 / 输出价格 / API Key |
| **价格字段** | 两个 number input,step 0.01,title hint「用于成本估算,可在模型提供商官网查询定价」 |
| **空状态** | dashed border 卡片:`还没配置任何模型 — 点下方「添加模型」开始` |
| **重建统计** | 点击后写 `✓ 已重建 N 行` 绿字 toast(4s) |

### 4.7 Skills `/skills`

| 区域 | 规格 |
|---|---|
| **布局** | 单栏,`p-8 max-w-5xl` |
| **Header** | 面包屑「设置 / Skill 管理」+ H1 + 副标题。右上两个按钮:「+ 新建 ▾」下拉(✨ 用 AI 创建 / 📝 手动创建)+「⬆ 上传 Skill」主按钮(隐藏的 `<input type=file>` 接 `.yaml/.yml/.skill/.zip`) |
| **自定义 Section** | uppercase header + count。空状态:dashed 卡片 `还没有自定义 Skill — 点右上「上传 Skill」开始` |
| **内置 Section** | 同上结构,但整体 `bg-black/5` + opacity-90,行内只显示「复制并编辑」按钮 |
| **SkillRow** | 24px icon + 显示名 + name code + version + author + 描述 `line-clamp-2` + 推荐模型 chips + 右侧动作纵列(编辑 / 复制并编辑 / 删除) |
| **Toast** | 自定义 `ToastList` 见 §3.4 |
| **删除** | 原生 `confirm("确定删除自定义 Skill「<name>」?")` |

### 4.8 SkillGenerator `/skills/generate`(AI Skill 生成)

| 区域 | 规格 |
|---|---|
| **布局** | 左右 50/50 split,各自 header + 滚动 + footer |
| **左 Header** | H1 "✨ 用 AI 创建 Skill" + 副标题 + 右上 ModelPicker(label + 下拉,max-width 180) |
| **左对话区** | 空时显示 TipsCard(primary tint,3 个示例);无模型时显 amber banner + 「前往模型配置 →」链接;消息:用户右蓝、AI 白短卡片(显示「正在生成…」/「✅ Skill 已生成,在右侧预览」/「✓ 已根据反馈更新」/「💡 已自动重试修正」amber 副行) |
| **左输入** | 3 行 textarea,首次 placeholder `描述你想要的 Skill(回车发送 / Shift+Enter 换行)`,后续 `描述你想要的 Skill,或者对当前 Skill 提建议…`;IME 安全;无模型时禁用 |
| **右 Tabs** | `配置 / YAML 源码 / 测试运行` |
| **配置 Tab** | 名称卡 + 描述卡 + 推荐模型卡 + 输出维度卡(列表)+ 可折叠 Prompt 模板卡 |
| **YAML Tab** | 整块只读 `<pre>` |
| **测试运行 Tab** | 文献下拉 + 模型下拉 + 「运行测试」按钮;输出区 `min-h-[200px]`,流式时尾部 `● 流式输出中` |
| **右 Footer** | 「💾 保存为 Skill」主按钮(spec 有效才可点)+「✏️ 切换到高级编辑器」链接(通过 sessionStorage 传 YAML)+「🗑️ 重新开始」红链接 |
| **草稿** | localStorage 自动保存,刷新不丢 |

### 4.9 Settings `/settings`

| 区域 | 规格 |
|---|---|
| **布局** | 单栏,`p-8 max-w-3xl` |
| **Header** | H1 "设置" + 副标题(配置文件路径)|
| **常规设置卡** | `<dl>` grid `[140px_1fr]`,行:语言(下拉,「跟随系统」+ 简体中文 / English,跟随系统时显示当前 OS locale)/ 主题(只读)/ 默认模型(monospace 或灰字「未设置」)/ 日志级别(只读) |
| **UpdaterCard** | 见 §5.7 |
| **DataDirCard** | 见 §5.8 |

---

## 5. 共享业务组件

### 5.1 PaperPicker(cmdk 搜索下拉)

- 输入框 + 浮层下拉,200ms debounce,latest-search guard 防止旧响应覆盖
- 占位符可覆盖,默认 `🔍 搜索本地文献(标题/作者/DOI)…`
- 空输入时显示 `最近文献`(若 caller 传了 recentFallback)
- 输入后下拉:Source 徽章 + 标题(`<mark>` 黄色高亮 `bg-yellow-200`)+ meta line(前 3 作者 + 文件夹 `📁 path` + DOI 前 24 字符)
- 无匹配:`无匹配文献 — 试试缩短关键词,或先上传 PDF`

### 5.2 PaperActions(论文级动作按钮行)

横排 5 个按钮(可配置 size sm/md):
1. ⭐ `FavoriteButton` compact(可隐藏)
2. 🧠 AI 精读 → `/parse?paper_id=<id>`
3. 📄 原文 → 调 `resolve_paper_url` + 默认浏览器打开。无链接显示红字 `该文献无可用的原文链接`
4. PDF 槽(三态互斥):
   - 已有本地:📂 打开 PDF
   - 下载中:96px 进度条 + 百分比 + 红 × 取消
   - 未下载:📥 下载 PDF(非 OA 时禁用,tooltip `非开放获取,无法下载`)
5. 内联错误 chip(`⚠ <msg>`,2.2/4.2s 自动消失)

### 5.3 FavoriteButton

- 触发按钮(compact/full 两个 variant):
  - 未收藏:`☆ 收藏 ▾`,border-black/10
  - 已收藏:`⭐ 已收藏 ▾`,`border-amber-400 bg-amber-50 text-amber-700`,title 显示所有所在文件夹
- 下拉(`w-60`):
  - 顶部「⭐ 快速收藏到「未分类」」(已在则禁用)
  - 文件夹树(max-h 240,递归 + 深度缩进)— ✓ 标记已在
  - 「+ 新建文件夹」row → 展开输入框 + 创建按钮
  - 已收藏时底部红色「✕ 取消收藏」
- 操作完成右下角 toast(stack):`✓ 已加入「X」` / `✓ 已移动到「X」` / `✓ 已从「X」移除` / `✓ 已取消收藏` / `操作失败: ...`

### 5.4 PaperMetadataEditor(元数据补全 Modal)

- 全屏遮罩 + 居中 `max-w-2xl max-h-[90vh]`
- Header:标题 + 提取来源(PDF /Info / 首页 / 文件名)+ **置信度百分比**(色阶绿/黄/红)+ optional「📄 对照原文」按钮 + × 关闭
- Body(可滚):
  - 标题输入(必填)
  - 作者列表(可增删,placeholder `First Last`,空时显示 `暂无 — 点击「+ 添加」录入`)
  - 摘要 textarea(5 行)
  - DOI 输入(monospace,placeholder `10.1234/example`)
- Footer:`跳过(保留原提取)` ghost + `保存` primary(保存中显示 `保存中…`)

### 5.5 SkillEditor(`/skills/new` `/skills/$name/edit` `/skills/$name/copy`)

- 3 列布局:`280px 左表单 / flex-1 Monaco / 360px 右预览`
- 顶部 bar:← 返回 + 标题(模式不同)+ 未保存 marker `●` + 解析错误标识 + 右侧「测试 Skill」「另存为新 Skill」「保存」
- 左表单:`name / display_name / description(3 行)/ icon + category 2 列 / recommended_models`,YAML 解析失败时显示 amber 提示
- Monaco:vs-dark,YAML language,Ctrl+S 触发保存,自定义 `{{title}} {{authors}} {{abstract}} {{full_text}} {{language}}` 补全
- 右预览 Tabs:`渲染后的 Prompt`(选示例文献 + 估算 token)/`测试运行结果`(按 output_dimensions 拆分 + 流式光标)
- 自动草稿(30s 保存到 localStorage)+ 还原 prompt
- `beforeunload` 警告

### 5.6 DataDirCard + 迁移向导

- 卡片:Default/Custom amber badge + 占用 GB/MB + monospace 路径(点击复制)+ 按钮 `📂 打开目录 / 🔄 修改路径 / ↩️ 恢复默认`(仅 custom)
- **3 步向导 Modal**(`max-w-xl`):
  - Step 1:选目录 → 即时校验(✓ 路径可用 / ⚠ 已有 SGHUB 数据 / ✗ 错误)
  - Step 2:3 个 radio card(迁移现有数据 / 新路径从零 / 使用已有数据)
  - Step 3:摘要(旧→新+模式)+ 红色警告 `操作期间请勿关闭应用,完成后应用将自动重启`
  - 执行:进度条 + 当前文件名(`data_migration:progress` 事件)
  - 完成:勾选「保留/删除旧目录」+ 「立即重启」按钮

### 5.7 UpdaterCard

- 白卡 + 顶部 master 开关(标题右侧的复选框)
- 关闭时下方所有控件 `opacity-40 pointer-events-none`
- 频率:radio `每日 / 每周`
  - 每日:`每 N 天` number input(1-30)
  - 每周:7 个 weekday 切换 chip,至少选 1
- 时间:96 项 15min step 下拉
- 检查到更新后:radio `弹通知 / 静默下载 / 只标记`
- 状态网格:当前版本 / 最近一次检查 / 下次计划检查(前端 `nextCheckAt` 实时算)/(若有)待安装版本(emerald)
- 操作:`立即检查 / 立即安装`(后者仅 pending 时显示),内联 toast `已是最新版本` / 红色错误

---

## 6. 路由清单

| 路径 | 页面 | 备注 |
|---|---|---|
| `/` | index → 重定向 `/search` | 默认入口 |
| `/search` | Search | |
| `/feed` | Feed | |
| `/library` | Library | |
| `/parse` | Parse | 接受 `?paper_id` `?skill` 查询参数 |
| `/models` | Models | |
| `/skills` | Skills | |
| `/skills/new` | SkillEditor (mode=new) | 可被 SkillGenerator 注入 prefill |
| `/skills/generate` | SkillGenerator | |
| `/skills/$name/edit` | SkillEditor (mode=edit) | |
| `/skills/$name/copy` | SkillEditor (mode=copy) | |
| `/chat` | Chat | |
| `/settings` | Settings | |

---

## 7. 重构待办建议(本审计发现的不一致 / 改进点)

### 7.1 高优先级
1. **统一 Toast 系统** — 当前 Skills 有自定义 ToastList、FavoriteButton 有自己的 stack、其余页面只有内联 banner。建议抽 `useToast` hook + 全局 Provider,位置统一 `top-12 right-4 z-50`。
2. **统一 Modal 系统** — 当前混用「真 Modal」「内嵌表单」「原生 confirm/prompt/alert」。建议:
   - 编辑表单类(Feed 订阅、Models 添加)→ 真 Modal
   - 破坏性确认(删除文件夹/标签/Skill)→ 自绘 ConfirmDialog
   - 输入类(重命名)→ 自绘 InputDialog
3. **Settings 「主题」是只读** — 没有切换 UI,但 CSS 已写好 `[data-theme="dark"]`。补一个亮/暗/跟随系统下拉。
4. **「重新开始」按钮 confirm 文案** — SkillGenerator 用 `t("skill_gen.reset")`(按钮 label 本身)做 confirm 文字,语义滥用。补 `skill_gen.reset_confirm` key。
5. **删除按钮一致性** — Models / Skills / Feed 都有「删除」,但样式不同(红色 ghost 还是 danger fill)。统一为 Danger Ghost。

### 7.2 中优先级
6. **页面 H1 字号不统一** — Search/Models/Settings/Skills 用 `text-2xl`,Feed/Parse 用 `text-xl`,Chat 标题用 `text-sm`。建议统一 `text-2xl` 为页面 H1。
7. **空状态插画** — 当前空状态都是纯文字。可考虑设计一组简洁线条插画(Library 空、订阅空、模型空、对话空、生成器引导)。
8. **加载 skeleton** — 当前所有加载都是文字 `加载中…`,可考虑给列表项加 skeleton(灰色脉冲块)提升感知速度。
9. **dark 主题验证** — CSS 变量已支持,但所有硬编码颜色(Source 徽章、标签调色板)需要在暗色下复核对比度。
10. **PaperPicker 高亮 `<mark>` 的暗色** — 当前 `bg-yellow-200 text-app-fg`,暗色下需检查可读性。

### 7.3 低优先级 / 长期
11. **键盘导航完整性** — 列表行没有 `tabindex`,Modal 没有 focus trap。
12. **窗口尺寸响应** — 当前所有 split pane 用固定 px(`w-60/64/72/220`),小窗口(960×600)下右侧主区可能过窄,需要响应式断点。
13. **i18n 缺失字符串审计** — 仍有少量硬编码中文(SkillEditor 的 alert、Library 的 prompt 等)未走 `t()`,需要补完。
14. **icon 一致性** — 大量 emoji 作为图标(📎📄🧠⭐✨🤖等),长期建议替换为统一 SVG 图标库(如 Lucide / Heroicons)以便统一描边粗细、暗色适配。
15. **加成本 chart 后 JS 体积** — recharts ≈ +360 KB,bundle 已达 1.34 MB。重构时考虑动态 import Models 页(仅访问时加载 recharts)。

---

## 8. Figma 还原参考(给设计师)

1. **画板尺寸**:1280×800(默认窗口),最小 960×600。
2. **网格**:8px base(Tailwind 默认 spacing)。
3. **圆角**:卡片 `rounded-md` (6px)、chip `rounded` (4px)、按钮 `rounded` (4px)、圆形按钮 `rounded-full`。
4. **阴影**:仅 Modal 用 `shadow-xl`,Toast/下拉用 `shadow-lg/md`。卡片**不使用阴影**,只用 `border-black/10` 描边。
5. **emoji** 列表(全局):💬 🔍 📰 ⭐ 🧠 ✨ 🤖 ⚙️ 📁 🏷️ 📎 📄 📂 📥 📤 🅰️ 🟢 🦙 🔧 ★ ✓ ✕ ⚠ 🔒 🔄 ↩️ 💾 ✏️ 🗑️ 🆕 ▾ ●

---

> 本文档基于 V2.1.0(commit `a472a10` 时点),后续如有界面改动应同步更新此清单。
> 维护者:在每次合并 UI 变更 PR 时检查本文档是否需修正。
