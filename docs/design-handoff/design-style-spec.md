# SGHUB V2.2 设计风格规范 — Editorial Calm(编辑·静谧)

> 这是 V2.2 重设计的 ground truth。所有交付物必须遵循。
> 与 `ui-design-requirements.md`(V2.1.0 现状)有冲突时,以本文件为准。

---

## 0. 关于风格命名

**Editorial Calm** — 编辑书卷气 + 桌面静谧感。

灵感参考:
- **Editorial** — Stripe Press / Are.na / 《Eye on Design》杂志线上版 — 字距与版心呼吸感
- **Calm** — Linear / Things 3 / Reader by Readwise — 默认低饱和、灰阶为主、色彩克制
- **Scholarly** — Nature / arXiv 的版式纪律 — 数字 / 引用 / 元数据排版严谨

**不是**:
- 不是「macOS Big Sur 毛玻璃」(过于装饰)
- 不是「Neumorphism / Glassmorphism」(不耐看,无障碍差)
- 不是「Notion 灰白扁平」(缺品牌识别)

---

## 1. 设计支柱(5 条)

### 1.1 Editorial typography first(排版先行)
- 优先解决「读起来舒服」,而不是「看起来好看」。
- 严格的字号阶 + 行高规则,数字一律 tabular-nums 等宽。
- 关键元数据(作者 / DOI / 日期)用 monospace 字体,与正文区分。

### 1.2 Quiet by default, expressive on demand(默认安静,关键发声)
- 默认 UI = 90% 灰阶 + 10% 品牌色。
- 品牌色只在以下位置:① 主操作按钮 ② 选中态 ③ 状态徽章 ④ 数据可视化。
- 卡片**不**默认带 primary 色边框 — 用 `border-neutral-200` + `shadow-sm`。
- 避免「视觉降噪不彻底」:同屏幕同时出现 3 种以上彩色块 = 失败。

### 1.3 Refined density(精炼密度)
- 桌面应用密度,不是 landing page 稀疏。
- 8px 基线网格 + 严格间距阶:`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64`(不允许 6/10/14 等)。
- 一个卡片内部最多 3 层嵌套间距。
- 信息分组用「白空间 ≥ 边框」表达,优先用间距,其次才用 border / divider。

### 1.4 First-class dark mode(暗色不是反色)
- 暗色独立调色,非「亮色简单取反」。
- 暗色背景从 `#0F1115` 升到 `#13161D`(略偏蓝),减少纯黑带来的「黑洞」感。
- 文本主色 `#E8E8EC`(冷白)而非 `#FFFFFF`(减少视觉锐利)。
- 品牌色在暗色下提亮 + 提饱和度(因为暗色背景吃饱和度)。
- 阴影在暗色下减弱(暗色背景上阴影几乎不可见,改用 border-top highlight 模拟立体)。

### 1.5 Motion as feedback, not decoration(动效是反馈)
- 动效只在状态变化时出现:hover / open / close / loading / success。
- 不做进场动画 / 装饰性 parallax / 视差滚动。
- 标准时长 150ms,长不超 300ms,短不少 100ms。
- 缓动函数固定 3 个:`standard / decelerate / accelerate`,不随手写 `ease-in-out`。

---

## 2. Design Tokens — 色彩

### 2.1 品牌色(保留 DNA,微调)

| Token | V2.1 现状 | V2.2 亮色 | V2.2 暗色 | 用途 |
|---|---|---|---|---|
| `--primary` | `#1F3864` | `#1F3864`(保持) | `#5B8BD8`(从 `#4A78C8` 提亮) | 主操作 / H1 / 选中 |
| `--primary-hover` | (无,用 /90) | `#172A4D` | `#7AA3E4` | hover |
| `--primary-fg` | `#FFF` | `#FFF` | `#0F1115` | primary 背景上的文字 |
| `--accent` | `#D4A017` | `#D4A017`(保持) | `#F0C04A`(从 `#E6B536` 微调) | NEW 徽章 / drag-over / 强调 |
| `--accent-fg` | (无) | `#1A1F2E` | `#0F1115` | accent 背景上的文字 |

### 2.2 中性灰(新增 9 阶,替代 `text-app-fg/50/60/70` 半透明)

| Token | 亮色 | 暗色 | 用途 |
|---|---|---|---|
| `--neutral-0` | `#FFFFFF` | `#13161D` | 卡片背景 |
| `--neutral-50` | `#F8F6F1`(保持 bg) | `#191D26` | 页面背景 |
| `--neutral-100` | `#F0EEE8` | `#1F232E` | 嵌套背景(代码块、内嵌卡) |
| `--neutral-200` | `#E5E2D9` | `#2A2F3D` | 默认边框 |
| `--neutral-300` | `#D1CDC0` | `#363B4D` | hover 边框 |
| `--neutral-400` | `#9B9586` | `#5A607A` | placeholder / disabled 文字 |
| `--neutral-500` | `#6B6657` | `#7B829E` | meta 信息文字 |
| `--neutral-600` | `#4A4639` | `#A0A8C4` | 次要正文 |
| `--neutral-700` | `#2A2820` | `#C8CFE2` | 副标题 |
| `--neutral-800` | `#1A1F2E`(保持 fg) | `#E8E8EC` | 主正文 |
| `--neutral-900` | `#0F1115` | `#FFFFFF` | H1 / 加粗强调 |

> 替换原则:任何 V2.1 出现 `text-app-fg/50/60/70` 的位置改用 `text-neutral-{500..700}`。

### 2.3 反馈色(语义)

| Token | 亮色 bg/border/fg | 暗色 bg/border/fg | 用途 |
|---|---|---|---|
| `--success` | `#ECFDF5` / `#86EFAC` / `#065F46` | `#0F2A1F` / `#10B981` / `#86EFAC` | 成功 toast / badge |
| `--warning` | `#FFFBEB` / `#FCD34D` / `#92400E` | `#2A1F08` / `#F59E0B` / `#FCD34D` | 警告 toast |
| `--danger` | `#FEF2F2` / `#FCA5A5` / `#991B1B` | `#2A0F0F` / `#EF4444` / `#FCA5A5` | 错误 / 删除 |
| `--info` | `#EFF6FF` / `#93C5FD` / `#1E40AF` | `#0F1A2E` / `#3B82F6` / `#93C5FD` | 提示 toast |

### 2.4 文献来源(替代硬编码,从 §1.1.1 抽出)

| Token | 颜色 | 亮色文字 | 暗色背景需提亮 |
|---|---|---|---|
| `--source-arxiv` | `#B31B1B` | `#FFF` | `#D62828` |
| `--source-semantic_scholar` | `#1857B6` | `#FFF` | `#3A7BD5` |
| `--source-pubmed` | `#00897B` | `#FFF` | `#1FAE9F` |
| `--source-openalex` | `#7B3FBF` | `#FFF` | `#9F5FE0` |
| `--source-local` | `#6B7280` | `#FFF` | `#9CA3AF` |

### 2.5 阅读状态(替代 §1.1.2 硬编码 Tailwind)

| Token | 颜色 | 用途 |
|---|---|---|
| `--read-unread` | `--neutral-300` | 未读 |
| `--read-reading` | `#F59E0B`(amber-500) | 在读 |
| `--read-read` | `#10B981`(emerald-500) | 已读 |
| `--read-parsed` | `#8B5CF6`(violet-500) | 已解析 |

### 2.6 标签调色板(8 色循环,保留)

`#1F3864 / #D4A017 / #10B981 / #EF4444 / #8B5CF6 / #06B6D4 / #F97316 / #EC4899`

暗色下统一加 `opacity 0.85` + 提亮 10%。

---

## 3. Design Tokens — 排版 / 间距 / 圆角 / 阴影 / 动效

### 3.1 字体

```
--font-sans:  -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter",
              "Microsoft YaHei", "PingFang SC", sans-serif;
--font-mono:  "JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace;
--font-serif: "Source Serif Pro", "Noto Serif SC", Georgia, serif;
              ↑ 仅用于「文献标题」「引言级摘要」(可选,在 Chat 长输出 / SkillEditor 预览的引用块用)
```

数字一律 `font-variant-numeric: tabular-nums`(影响:Models 统计卡、Library 计数、Updater 时间)。

### 3.2 字号 / 行高(严格阶梯)

| Token | 字号 / 行高 | 用途 |
|---|---|---|
| `text-xs` | 12 / 16 | 表单 label / meta line / chip |
| `text-sm` | 14 / 20 | 正文 / 按钮 / 控件 |
| `text-base` | 15 / 22 | 文献卡标题 / Chat 气泡 |
| `text-lg` | 17 / 24 | section 标题 |
| `text-xl` | 20 / 28 | 页面 H1 副标题 |
| `text-2xl` | 24 / 32 | 页面 H1(统一) |
| `text-3xl` | 32 / 40 | 仅 Models 统计卡大数字 |

> **重要**:V2.1 存在 H1 字号不统一(Feed/Parse 用 xl,其余用 2xl)。V2.2 **统一所有页面 H1 = text-2xl**。

### 3.3 字重

`font-weight: 400 / 500 / 600 / 700`,不用 300 / 800 / 900。
默认 400,按钮 500,标题 600,极强调 700。

### 3.4 间距(严格 8 倍阶,4 为最小例外)

```
--space-1:  4px    chip 内 padding 等极小空隙
--space-2:  8px    控件内部 padding / 元素间最小间距
--space-3:  12px   卡片内部小段间距
--space-4:  16px   卡片内部段落间距
--space-6:  24px   卡片间距 / section 内部间距
--space-8:  32px   section 间距 / 页面 padding 默认
--space-12: 48px   section 大间距
--space-16: 64px   页面顶部留白
```

**禁止**:6 / 10 / 14 / 18 / 20 / 28 等。

### 3.5 圆角(整体上调,体现现代感)

| Token | V2.1 | V2.2 | 用途 |
|---|---|---|---|
| `--radius-sm` | 4px | **4px**(保持) | chip / badge / small button |
| `--radius` | 4-6px | **6px** | 按钮 / 输入框 |
| `--radius-md` | 6px | **8px** | 卡片 |
| `--radius-lg` | (无) | **12px** | Modal / 大型 panel |
| `--radius-full` | 9999px | 9999px | 圆形按钮 / avatar |

### 3.6 阴影(从 1 阶扩展到 5 阶 elevation)

| Token | 值 | 用途 |
|---|---|---|
| `--shadow-none` | `none` | 默认 |
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.04)` | **卡片默认**(替代 border) |
| `--shadow-md` | `0 4px 8px rgba(0,0,0,0.06)` | hover 抬起 / dropdown |
| `--shadow-lg` | `0 8px 16px rgba(0,0,0,0.08)` | popover / toast |
| `--shadow-xl` | `0 20px 40px rgba(0,0,0,0.12)` | Modal |

暗色下阴影通通改为「顶部 1px highlight」模拟立体:
```
--shadow-sm-dark: inset 0 1px 0 rgba(255,255,255,0.04);
```

### 3.7 动效(新增 motion tokens)

```
--duration-instant: 100ms    立即反馈(按钮按下)
--duration-fast:    150ms    标准过渡(hover / focus)
--duration-base:    200ms    展开 / 折叠 / 切换
--duration-slow:    300ms    Modal 进出

--ease-standard:    cubic-bezier(0.2, 0, 0, 1)        默认
--ease-decelerate:  cubic-bezier(0, 0, 0.2, 1)         进入(对话框打开)
--ease-accelerate:  cubic-bezier(0.4, 0, 1, 1)         退出(对话框关闭)
```

**禁止**:`transition-all duration-500` 等随手写法。

### 3.8 z-index(语义化)

```
--z-base:      0     默认
--z-elevated:  10    sticky bar
--z-dropdown:  20    下拉菜单
--z-popover:   30    popover
--z-modal:     40    Modal
--z-toast:     50    Toast
--z-tooltip:   60    Tooltip
```

---

## 4. 主题切换实现约定

- 所有 token 通过 `[data-theme="light"]`(默认) / `[data-theme="dark"]` 切换。
- 颜色 token 必须双套都定义,不允许只在亮色下定义然后让暗色「自动适应」。
- 主题切换支持「跟随系统 / 强制亮 / 强制暗」三档,Settings 页提供下拉。
- 切换不闪烁:在 `<html>` 设置 `color-scheme: light dark`,首次渲染前从 localStorage 读取 + 立即应用。

---

## 5. 组件层偏好

### 5.1 图标系统(替换全部 emoji)

| V2.1 emoji | 用途 | V2.2 Lucide 名称 |
|---|---|---|
| 💬 | Chat | `message-square` |
| 🔍 | Search | `search` |
| 📰 | Feed | `newspaper` |
| ⭐ | Library / Favorite | `star` |
| 🧠 | AI Parse | `brain` |
| ✨ | AI Gen | `sparkles` |
| 🤖 | Models | `bot` |
| ⚙️ | Settings | `settings` |
| 📁 | Folder | `folder` |
| 🏷️ | Tag | `tag` |
| 📎 | Attachment | `paperclip` |
| 📄 | Paper / Document | `file-text` |
| 📂 | Open folder | `folder-open` |
| 📥 | Download | `download` |
| 📤 | Upload | `upload` |
| 🅰️ | Anthropic | `circle-a`(自绘) |
| 🟢 | OpenAI | `circle-o`(自绘) |
| 🦙 | Ollama | `feather`(代替) |
| 🔧 | Custom Provider | `wrench` |
| ★ | Filled star | `star`(`fill="currentColor"`) |
| ✓ | Check | `check` |
| ✕ | Close | `x` |
| ⚠ | Warning | `alert-triangle` |
| 🔒 | Lock / Key | `lock` |
| 🔄 | Refresh | `refresh-cw` |
| ↩️ | Undo / Restore | `rotate-ccw` |
| 💾 | Save | `save` |
| ✏️ | Edit | `pencil` |
| 🗑️ | Delete | `trash-2` |
| 🆕 | New | `plus-circle` |
| ▾ | Dropdown caret | `chevron-down` |
| ● | Status dot | `<span class="size-2 rounded-full bg-…"/>` |

**实现**:可直接用 `lucide-react`(gzip ~ 4KB tree-shaken),或交付 SVG 字符串再让 Claude Code 包成 `<Icon name="…" />` 组件。

图标尺寸阶:`12 / 14 / 16 / 18 / 20 / 24`,描边粗细统一 `1.5px`。

### 5.2 Toast 系统(统一 1 套)

废弃 V2.1 的 3 套(Skills ToastList / FavoriteButton stack / inline banner),全局唯一 `<ToastProvider>`:

- 位置:`fixed top-12 right-4 z-toast`
- 最大并发:3 条,溢出排队
- 自动消失:default 4s / success 3s / error 6s / warning 5s
- 手动关闭:右侧 × 按钮
- 进出动画:slide + fade,200ms
- API:`useToast()` hook,`toast.success(msg) / .error(msg) / .warning(msg) / .info(msg)`

### 5.3 Modal 系统(统一 3 件套)

废弃 V2.1 的「真 Modal + 内嵌表单 + 原生 confirm/prompt/alert」混用,改为:

| 组件 | 用途 |
|---|---|
| `<BaseModal>` | 通用 Modal,支持自定义 children;Esc / 点遮罩关闭;focus trap;`shadow-xl` + `--radius-lg` |
| `<ConfirmDialog>` | 确认/取消二选一,带 `tone: default / danger`;替换所有 `window.confirm` |
| `<InputDialog>` | 输入文本确认,替换所有 `window.prompt`(如重命名文件夹) |

> Feed 订阅表单 / Models 添加表单 V2.1 用「内嵌卡片」,V2.2 改为 `<BaseModal>`,统一交互。

### 5.4 空状态(每页一张极简插画)

| 页面 | 插画主题 | 文案模式 |
|---|---|---|
| Library 空 | 一个空书架轮廓 | `还没有收藏 — 在「文献检索」找到论文,把卡片拖到左侧文件夹` |
| Feed 空 | 一个空信箱 | `还没有订阅 — 点左侧「+ 新建」开始` |
| Models 空 | 一个空插头 | `还没配置任何模型 — 点下方「添加模型」` |
| Chat 空 | 一个开放的对话框气泡 | `选好模型,在下方输入开始对话` |
| SkillGenerator 空 | 一颗发芽的种子 | `用一句话描述你想要的 Skill` |

线稿样式:viewBox 200×160,只用 1.5px 描边,无填充,颜色继承 `text-neutral-400`。

### 5.5 加载状态(三种 pattern)

| 场景 | Pattern |
|---|---|
| 列表加载 | **Skeleton**(灰脉冲块,模拟 3-5 行真实结构),不要再用「加载中…」文字 |
| 按钮加载 | 按钮文字旁加 `<Spinner size=14>`,文字保留 |
| 流式生成 | 4px × 14px `bg-primary animate-pulse` 光标(保留 V2.1) |
| 进度任务 | 进度条 + 百分比 + 当前文件名(保留 V2.1 上传 / 迁移的设计) |

### 5.6 按钮规格(从 8 个变体收敛到 5 个)

| Variant | 用途 |
|---|---|
| `primary` | 主操作(单页面最多 1 个) |
| `secondary` | 次操作(outline) |
| `ghost` | 中性(取消 / 关闭 / 次要) |
| `danger` | 不可逆破坏(删除 / 执行迁移) |
| `icon` | 圆形 icon-only(send / close / toolbar) |

**废弃**:V2.1 的 `Primary Outline / Danger Ghost / Chip Toggle / Text Link` 单列变体,
统一并入 `secondary` / `danger` / `ghost` + 可选 `as: "link"` 模式。

---

## 6. 反模式(明确禁止)

| ❌ 反模式 | 为什么 |
|---|---|
| 任何位置硬编码 `#1F3864` `#D4A017` 等色值 | token 才是唯一来源 |
| `text-gray-400` `bg-red-500` 等 Tailwind 默认色名 | 主题切换失效 |
| `text-app-fg/50 /60 /70` 半透明文字 | V2.1 旧法,V2.2 用 `text-neutral-{500..700}` |
| 同屏出现 >3 种彩色块(灰阶不算) | 违反「Quiet by default」 |
| 用 emoji 作为图标 | 已替换为 SVG |
| `transition-all duration-500` 等随手过渡 | 必须用 motion tokens |
| 调用 `window.confirm` `prompt` `alert` | 用 ConfirmDialog / InputDialog |
| Modal 用 `shadow-md` / 卡片用 `shadow-xl` | 阴影 elevation 阶必须对应 |
| 字号用 13 / 18 / 22 等非阶梯值 | 严格 6 阶字号 |
| 间距 10px / 18px / 22px | 严格 4/8/12/16/24/32/48/64 |

---

## 7. 质量自检清单(每步交付必须自查)

| # | 检查项 | 标准 |
|---|---|---|
| 1 | 颜色无硬编码 | 全部走 token,grep 不到 `#[0-9A-F]{6}` |
| 2 | 亮 / 暗双套 | 都呈现 + 对比度 ≥ WCAG AA |
| 3 | 中英双语 | 模拟最长英文态(Sidebar `Subscriptions` / Settings `Application data location`)不溢出 |
| 4 | 双尺寸 | 1280×800 + 960×600 都不破版 |
| 5 | emoji → SVG | grep 不到 emoji 字符 |
| 6 | 组件 4 态 | hover / disabled / loading / error 齐全 |
| 7 | 动效 | 只用 motion tokens,无 transition-all |

---

## 8. 与 V2.1 现状的兼容性

设计师**不需要**改动这些(Claude Code 重构时会保留):
- 13 条路由(`/search /feed /library /parse /chat /models /skills /settings` + 4 Skill 子路由)
- Zustand store shape(`chatStore / libraryStore / skillGeneratorStore`)
- Tauri command 名 + 事件名
- i18next key 命名空间(只增不改)

设计师**可以**改动这些:
- 全部 UI 视觉
- 信息架构(同一页面内的分区 / 排序)
- 弹窗 / 内嵌表单的呈现方式(改为统一 Modal 是被鼓励的)
- 图标 / 插画

设计师**必须**改动这些(V2.1 列入的重构待办):
- 统一 Toast(详见 §5.2)
- 统一 Modal(详见 §5.3)
- emoji → SVG(详见 §5.1)
- Skeleton 替代「加载中…」文字(详见 §5.5)
- Settings 主题切换 UI(亮 / 暗 / 跟随系统)

---

> 维护:本规范是 V2.2 重设计的 ground truth;V2.2 上线后归档到
> `docs/archive/v2.2-design-style-spec.md`,下次重设计另起新文件。
