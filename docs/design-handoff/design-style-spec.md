# SGHUB V2.2 设计风格规范 — SGHUB Capsule

> 内部命名:**SGHUB Capsule**
> 灵感来源:**KnowledgeHub X (KHX)** — Webflow 模板「knowledgehubtemplate.webflow.io」
> 权威 token 源:`./1-tokens/khx-reference/`(由 claude.ai 从实景截图提取的 5 套配置文件)
> 与 V2.1.0 关系:**整体替换**,不保留向后兼容(品牌色 / 圆角 / 间距 / 阴影全部刷新)

---

## 0. 关于风格命名

**SGHUB Capsule** = 「胶囊主义」+「桌面学术工具」的合成。

- **Capsule** 来自 KHX 的核心识别:导航、按钮、单行输入、徽章全部 `999px` 圆角胶囊。
- **SGHUB** 限定语用域:虽然底层 token 直接采用 KHX,但 SGHUB 是密集型桌面工具
  (非 landing page / help center),需要在保留 KHX 气质的同时,引入暗色主题、
  侧栏深色面板、Source 徽章、阅读状态色条等 SGHUB 专属元素。

**不是**:
- 不是「Webflow 模板的 1:1 复刻」 — KHX 是浅色 help center,SGHUB 要支持暗色 + 桌面密度。
- 不是「保留 V2.1.0 配色微调」 — 这是整体换装,V2.1.0 的芥黄 accent `#D4A017` 已淘汰。

---

## 1. 5 大视觉支柱

来自 KHX,SGHUB 全盘采用。

### 1.1 胶囊主义(Pill everywhere)
单行交互元素一律 `999px` 圆角:导航、按钮、单行输入、徽章、chip、tag。
只有多行 `textarea` 用 14px 圆角(因为单行胶囊放不进多行内容)。

### 1.2 深色重音(Single dark CTA)
主按钮 = `#1F2E4D` 深海军蓝,**全应用唯一的深色 CTA**。
不允许靛紫 `#4F46E5` 出现在主按钮上 — 那是次级强调专用。
不允许「同一画面两个深色实心按钮」 — 主次必须分明。

### 1.3 靛紫次级(Indigo for icons & links)
靛蓝紫 `#4F46E5` 只用于:
- 图标盒底色(`#EEF0FF` 软底)+ 图标本身
- 文本链接 / 内联链接按钮
- 信息类徽章(replace V2.1.0 的 NEW emerald 徽章)

### 1.4 大圆角柔阴影(Soft cards)
卡片 `16px` 圆角 + **双层阴影**:`1px hairline + 24px 漫射`。
KHX 的关键质感来源,**禁止**把卡片改成「border 描边、无阴影」。

### 1.5 紫蓝氛围(Purple-blue glow ambiance)
Hero 区 / 空状态 / 入门引导用 `linear-gradient + radial-gradient` 光晕组合:
- 底层:`#F8FAFF → #F0F2FB` 135° 渐变
- 紫光晕:`rgba(125, 66, 251, 0.18)` 右上角
- 蓝光晕:`rgba(141, 173, 253, 0.22)` 左下角

SGHUB 应用位置(强烈推荐):SkillGenerator 空态 / Chat 空态 / Library 空态 / Welcome 引导。

---

## 2. Design Tokens(权威源 = KHX 实景值)

> 全部数值来自 `./1-tokens/khx-reference/tokens.css`,本节是 SGHUB 适配总览。

### 2.1 颜色 — 品牌(亮色 = KHX 原值,暗色 = SGHUB 推导)

| Token | 亮色(KHX) | 暗色(SGHUB 推导) | 用途 |
|---|---|---|---|
| `--navy` | `#1F2E4D` | `#3D5688`(提亮 + 加饱和) | **主按钮 / H1 / 选中态** |
| `--navy-hover` | `#2A3A5F` | `#4A6BA8` | 主按钮 hover |
| `--navy-active` | `#15203A` | `#5A7BC8` | 主按钮 active |
| `--indigo` | `#4F46E5` | `#7B73F0` | 链接 / 图标 / 强调 |
| `--indigo-hover` | `#3730A3` | `#9890F5` | 链接 hover |
| `--indigo-soft` | `#EEF0FF` | `#1F1F33` | 图标盒底色 |
| `--indigo-light` | `#E0E5FF` | `#2A2A4D` | 更浅强调底 |

### 2.2 颜色 — 文字(亮 + 暗)

| Token | 亮色 | 暗色 | 用途 |
|---|---|---|---|
| `--text-1` | `#1F2E4D` | `#E8E8EC` | 主文字 / 标题 |
| `--text-2` | `#5C6B88` | `#9CA3B8` | 正文 / 描述 |
| `--text-3` | `#939EB3` | `#5C6478` | 占位符 / 辅助 |
| `--text-inverse` | `#FFFFFF` | `#FFFFFF` | 深底反白(主按钮上文字)|
| `--text-link` | `#4F46E5` | `#7B73F0` | 链接色 |

### 2.3 颜色 — 边框、背景、聚焦

| Token | 亮色 | 暗色 | 用途 |
|---|---|---|---|
| `--border` | `#ECEEF5` | `#252A38` | 默认边框 / 分割 |
| `--border-strong` | `#D9DEEA` | `#363B4D` | 强调边 |
| `--border-focus` | `#1F2E4D` | `#7B73F0` | 输入聚焦 |
| `--bg-page` | `#FFFFFF` | `#0F1115` | 页面底 |
| `--bg-soft` | `#F8FAFF` | `#161922` | 次背景 / disabled |
| `--bg-card` | `#FFFFFF` | `#1A1E2A` | 卡片底 |

### 2.4 颜色 — 氛围渐变(Hero/Contact/空状态)

| Token | 亮色 | 暗色 |
|---|---|---|
| `--bg-gradient` | `linear-gradient(135deg, #F8FAFF 0%, #F0F2FB 100%)` | `linear-gradient(135deg, #161922 0%, #1F2335 100%)` |
| `--glow-purple` | `radial-gradient(circle, rgba(125,66,251,0.18) 0%, transparent 70%)` | `radial-gradient(circle, rgba(125,66,251,0.25) 0%, transparent 70%)` |
| `--glow-blue` | `radial-gradient(circle, rgba(141,173,253,0.22) 0%, transparent 70%)` | `radial-gradient(circle, rgba(141,173,253,0.30) 0%, transparent 70%)` |

### 2.5 颜色 — 徽章语义(4 类,直接采用 KHX)

| 语义 | 亮色 bg / fg | 暗色 bg / fg | 用途映射(SGHUB) |
|---|---|---|---|
| `update` | `#EEF0FF` / `#4F46E5` | `#1F1F33` / `#7B73F0` | NEW Skill / NEW Chat |
| `improve` | `#DEF5E2` / `#1A8A3A` | `#0F2A1F` / `#4ADE80` | 自动更新可用 / 文献已解析 |
| `bug` | `#FFE0E0` / `#C8323C` | `#2A0F0F` / `#F87171` | 错误 / 删除确认 |
| `new` | `#FFF3C2` / `#8A6D00` | `#2A2208` / `#FCD34D` | 待补全元数据 / 配置缺失 |

### 2.6 颜色 — 反馈(Toast / 表单校验,同 KHX 语义池复用)

| 类型 | bg-soft / fg | 用途 |
|---|---|---|
| `success` | `#DEF5E2` / `#1A8A3A`(暗 `#4ADE80`) | 成功 toast |
| `danger` | `#FFE0E0` / `#C8323C`(暗 `#F87171`) | 错误 toast |
| `warning` | `#FFF3C2` / `#D4AE00`(暗 `#FCD34D`) | 警告 toast |
| `info` | `#EEF0FF` / `#4F46E5`(暗 `#7B73F0`) | 提示 toast |

### 2.7 颜色 — SGHUB 专属(KHX 没有,我自加)

| Token | 亮色 | 暗色 | 用途 |
|---|---|---|---|
| `--sidebar-bg` | `#1F2E4D`(= navy) | `#0F1115` | 左侧栏深色背景 |
| `--sidebar-fg` | `#C8C8D0` | `#B0B0BC` | 侧栏未选中文字 |
| `--sidebar-fg-active` | `#FFFFFF` | `#FFFFFF` | 侧栏选中文字 |
| `--titlebar-bg` | `#1F2E4D`(= navy) | `#0F1115` | 标题栏 |

> **决策**:侧栏与 Titlebar 直接复用 `--navy` 主色,使整个应用色调统一(deep navy 一致),
> 而不是 V2.1 中独立的 `#1A1F2E` 灰墨色。

### 2.8 文献来源徽章(SGHUB 专属,KHX 无)

External brand colors,固定不变(亮暗同色,仅暗色稍提亮 10%):

| Source | Bg | Fg |
|---|---|---|
| `arxiv` | `#B31B1B`(暗 `#D62828`) | `#FFFFFF` |
| `semantic_scholar` | `#1857B6`(暗 `#3A7BD5`) | `#FFFFFF` |
| `pubmed` | `#00897B`(暗 `#1FAE9F`) | `#FFFFFF` |
| `openalex` | `#7B3FBF`(暗 `#9F5FE0`) | `#FFFFFF` |
| `local` | `#6B7280`(暗 `#9CA3AF`) | `#FFFFFF` |

### 2.9 阅读状态色条(SGHUB 专属)

10px 宽竖条,Library 卡片左侧:

| 状态 | 颜色 |
|---|---|
| `unread` | `--border-strong` (`#D9DEEA` / 暗 `#363B4D`) |
| `reading` | `--warning` (`#D4AE00` / 暗 `#FCD34D`) |
| `read` | `--success` (`#1A8A3A` / 暗 `#4ADE80`) |
| `parsed` | `--indigo` (`#4F46E5` / 暗 `#7B73F0`) |

> **决策**:替换 V2.1 的 Tailwind 默认色(`bg-amber-400` / `bg-emerald-500` / `bg-indigo-500`),
> 改用 token,主题切换时同步生效。

### 2.10 标签调色板(SGHUB 专属)

Library 标签云 8 色循环,基于 KHX 调色板抽取的协调色:

```
#1F2E4D  navy        (主)
#4F46E5  indigo      (次)
#1A8A3A  success     (绿)
#C8323C  danger      (红)
#7D42FB  glow-purple (亮紫)
#06B6D4  cyan        (青)
#D4AE00  warning     (金)
#EC4899  pink        (粉)
```

暗色下统一 `opacity 0.85` + 提亮 10%。

---

## 3. Tokens — 字体 / 间距 / 圆角 / 阴影 / 动效

### 3.1 字体

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont,
             'PingFang SC', 'Microsoft YaHei', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
```

> KHX 用 Inter。SGHUB 也采用 Inter(开源 OFL,与 MIT 兼容)。中英 fallback 已含 PingFang SC + Microsoft YaHei。
> Monospace 用于 DOI / API endpoint / model id / 路径(KHX 没明确要求,SGHUB 自加)。

### 3.2 字号(KHX 9 阶,SGHUB 全部沿用)

| Token | 字号 | 行高 | 字重 | 用途 |
|---|---|---|---|---|
| `text-display` | 60px | 1.2 | 700 | (SGHUB 暂不用,landing page 才需要) |
| `text-display-sm` | 48px | 1.2 | 700 | (同上) |
| `text-h1` | 36px | 1.25 | 700 | 极端强调(暂无场景) |
| `text-h2` | 24px | 1.3 | 600 | **页面 H1**(统一) |
| `text-h3` | 18px | 1.4 | 600 | section 标题 / 卡片标题 |
| `text-body-lg` | 18px | 1.65 | 400 | 主对话气泡 / Markdown 渲染默认 |
| `text-body` | 16px | 1.65 | 400 | 默认正文 |
| `text-caption` | 14px | 1.5 | 400 | label / 控件文字 / chip |
| `text-meta` | 12px | 1.5 | 500 | 时间戳 / 计数 / 极小标签 |

> **决策**:V2.1 存在 H1 字号不统一(Feed/Parse 用 xl,其余用 2xl),
> V2.2 **统一所有页面 H1 = `text-h2` (24px)**。`text-h1` (36px) 仅留作未来 landing 用。

### 3.3 间距(KHX 9 阶,4px 基线)

```
--space-1: 4px      --space-2: 8px      --space-3: 12px
--space-4: 16px     --space-5: 24px     --space-6: 32px
--space-7: 48px     --space-8: 64px     --space-9: 96px
```

**禁止**:6 / 10 / 14 / 18 / 20 / 28px(允许 Tailwind 任意值 `[18px]` 的唯一例外:
匹配 KHX 已定值 `padding: 12px 18px / 12px 22px`)。

### 3.4 圆角(KHX 5 档)

| Token | 值 | 用途 |
|---|---|---|
| `--radius-pill` | **999px** | **按钮 / 导航 / 单行输入 / 徽章 / chip / tag**(胶囊主义核心) |
| `--radius-card` | 16px | 主卡片(Library 文献卡、Models 模型卡、Settings 卡) |
| `--radius-card-sm` | 14px | 侧栏卡 / Changelog 卡 / **textarea** |
| `--radius-icon` | 10px | 图标盒 |
| `--radius-sm` | 8px | 极小元素(若有) |

> **决策**:V2.1 卡片用 `rounded-md` (6px),V2.2 升至 `16px`。chip 从 4px 升至 999px。

### 3.5 阴影(KHX 6 阶,光色 navy 染色)

| Token | 值 | 用途 |
|---|---|---|
| `--shadow-card` | `0 1px 2px rgba(31,46,77,.04), 0 8px 24px rgba(31,46,77,.06)` | 主卡片默认 |
| `--shadow-card-sm` | `0 1px 2px rgba(31,46,77,.04), 0 4px 14px rgba(31,46,77,.05)` | 次卡片 |
| `--shadow-nav` | `0 4px 24px rgba(31,46,77,.08)` | 悬浮导航 / dropdown |
| `--shadow-btn` | `0 4px 12px rgba(31,46,77,.18)` | **主按钮(必须有)** |
| `--shadow-modal` | `0 20px 40px rgba(31,46,77,.18)` | Modal |
| `--shadow-focus` | `0 0 0 3px rgba(31,46,77,.08)` | 输入聚焦光环 |

> **关键决策**:阴影颜色不用 black,用 `rgba(31,46,77,xx)`(navy 染色),
> 让阴影也带品牌色温,与 KHX 一致。

暗色阴影:同结构但用 `rgba(0,0,0,xx)` 加大不透明度(暗背景下黑阴影才看得见)。

### 3.6 动效(KHX 极简 3 档)

```
--ease:             cubic-bezier(0.4, 0, 0.2, 1)
--duration-fast:    120ms   (hover / focus)
--duration-base:    180ms   (展开 / 切换 / 标准过渡)
--duration-slow:    240ms   (Modal 进出)
```

> **决策**:V2.1 没动效 token,V2.2 全量采用。
> 主按钮 hover 必带 `transform: translateY(-1px)`(KHX 特征,微抬起)。

### 3.7 z-index(KHX 没定义,SGHUB 沿用 Editorial Calm 草案)

```
--z-base: 0    --z-elevated: 10    --z-dropdown: 20
--z-popover: 30    --z-modal: 40    --z-toast: 50    --z-tooltip: 60
```

---

## 4. 组件级偏好(继承 KHX + SGHUB 扩展)

### 4.1 按钮(5 variant,与 KHX 完全对齐 + 1 个 SGHUB 扩展)

| Variant | KHX 类名 | 样式简述 |
|---|---|---|
| `primary` | `.btn-khx-primary` | navy bg + 白字 + 999px + `shadow-btn` + hover translateY(-1px) |
| `secondary` | `.btn-khx-secondary` | 白底 + navy 字 + border-khx-border + hover border-navy |
| `link` | `.btn-khx-link` | 透明 + indigo 字 + semibold + 可带 → 箭头 |
| `icon` | (无 KHX 类)| 圆形 36×36,KHX 风:白底 + shadow-card-sm + hover translateY(-1px) |
| `danger`(SGHUB 加) | (无 KHX 类)| 危险版 primary:bg = `--danger` `#C8323C` + 白字 + 同结构 |

**禁止**:`primary` 用 indigo / `danger` 用 navy(混乱主次)。

### 4.2 输入框(单行 pill,多行 14px)

| 元素 | 样式 |
|---|---|
| `.input-khx`(单行) | `padding: 12px 18px` + 13px 字号 + 999px + 1px border + focus 时 `shadow-focus` 光环 |
| `.textarea-khx`(多行) | `padding: 14px 18px` + `min-h: 90px` + 14px 圆角 + resize-y |
| `<select>`(SGHUB 加) | 复用 `.input-khx`,右侧 16px 的 chevron-down 图标(替换原生箭头) |

### 4.3 卡片

| 元素 | 样式 |
|---|---|
| `.card-khx`(主)| 16px + `shadow-card` + `padding: 24px` |
| `.card-khx-sm`(次)| 14px + `shadow-card-sm` + `padding: 20px` |
| **禁止**:卡片描边代替阴影 | 描边只用于 input,卡片必须用阴影 |

### 4.4 徽章(4 + N)

KHX 4 个语义徽章 + SGHUB 扩展:
- `.badge-khx-update` → SGHUB 用于「NEW Skill」「NEW Chat」
- `.badge-khx-improve` → SGHUB 用于「文献已解析」「更新可用」
- `.badge-khx-bug` → SGHUB 用于「连接失败」「Key 缺失」
- `.badge-khx-new` → SGHUB 用于「待补全元数据」

SGHUB 自加:
- `.badge-source-{arxiv,semantic_scholar,pubmed,openalex,local}` — Source 徽章(§2.8)
- `.badge-default` — 灰色中性,用于 model_id / Skill name 等

### 4.5 图标(替换全部 emoji)

**KHX 范式**:`.icon-box-khx` — 44×44 + 10px 圆角 + `bg-indigo-soft` + `text-indigo` + 22px 图标。

SGHUB 复用,但分 3 个尺寸:
- 大图标盒(44px)— SkillGenerator TipsCard / Models 提供商图标 / Library 空状态
- 中图标(20px)— 按钮内 / 列表行
- 小图标(16px)— meta line / chip

**图标库**:Lucide(`lucide-react`,~4KB tree-shaken),描边 1.5px。

emoji → Lucide 映射表见 `3-specs/icon-map.md`(Step 4 产出)。

### 4.6 悬浮胶囊导航(KHX 特色,SGHUB 可考虑)

KHX 提供 `.nav-khx`(白底 + 999px + shadow-nav)。SGHUB 当前是固定侧栏,可考虑:
- **场景 1**:Library 内文件夹快速跳转(顶部悬浮 chip 行)
- **场景 2**:SkillEditor 内 Tab 切换(`渲染后 Prompt / 测试运行结果`)
- **场景 3**:Settings 内 section 锚点跳转

> 设计师可灵活提案,但不要强行替换主 Sidebar(220px 深色面板是 SGHUB 的强识别)。

### 4.7 SGHUB 专属基础设施(KHX 没有,V2.2 必须自建)

| 组件 | 用途 |
|---|---|
| `<ToastProvider>` | 全局 1 套,top-12 right-4,带 4 色语义 |
| `<BaseModal>` | 12px 圆角 + `shadow-modal` + Esc/点遮罩关 + focus trap |
| `<ConfirmDialog>` | 替换全部 `window.confirm` |
| `<InputDialog>` | 替换全部 `window.prompt`(如重命名) |
| `<Skeleton>` | 灰脉冲块,替换「加载中…」文字 |
| `<Stage>`(KHX 紫光晕容器) | Hero / 空状态 / Welcome 引导用 |

---

## 5. SGHUB 特有页面与 KHX 风格的映射

| SGHUB 页面 | V2.1 现状 | V2.2 (KHX 改造)|
|---|---|---|
| Sidebar 220px 深色 | `#1A1F2E` 灰墨 + 黄边选中 | **`--navy` 深海军蓝**(统一品牌色) + indigo 边选中 |
| Search 结果卡 | `rounded-md` + border | **16px + shadow-card**,无 border |
| Search 输入栏 | 普通 rounded input | **`.input-khx` 胶囊**,右侧 navy 圆形 search 按钮 |
| Feed 订阅 chip | `text-xs rounded` | **`.badge-khx` 999px + 4 语义色映射** |
| Library 文献卡 | 左侧色条 + 描边 | **16px + shadow-card + 色条**,卡内信息分层 |
| Parse 配置块 | 普通输入 + select | **`.input-khx` 全胶囊** + PaperPicker 复用 |
| Chat 气泡 | 用户右蓝(`bg-primary`) + AI 白带边 | 用户右 navy(`bg-navy text-white`)+ AI **`.card-khx-sm`** |
| Chat 附件 chip | 黄边 / 绿边 / 红边 | **`.badge-khx-{update,improve,bug}`** |
| Models 统计卡 × 4 | 单层阴影 / hover 抬起 | **`.card-khx`** 标准化 |
| Models 提供商图标 | emoji 🅰️🟢🦙🔧 | **`.icon-box-khx`** 44px + 自绘 SVG provider 图标 |
| Skills 自定义 vs 内置 | 两 section | **`.card-khx` 列表** + 内置组 `bg-khx-bg` 软底 |
| SkillGenerator 左右 50/50 | 普通 split | 右栏 = **`<Stage>` 紫光晕** + 配置/YAML/测试 Tabs |
| Settings dl grid | 普通 grid | **`.card-khx` 包裹**,语言/主题/默认模型/日志/更新/数据目录各一张 |
| UpdaterCard | 白卡 + 复选框 | **`.card-khx` + `.badge-khx-improve`**(有新版时) |
| DataDirCard | 白卡 + amber badge | **`.card-khx` + `.badge-khx-update`**(自定义路径时) |

---

## 6. 暗色主题派生(KHX 不含,SGHUB 必须有)

KHX 是 light-only 模板。SGHUB 桌面应用必须双主题,暗色推导原则:

### 6.1 颜色映射规则
1. **背景反转,不简单取反**:`#FFFFFF → #0F1115`(不用纯黑,留余地),`#F8FAFF → #161922`
2. **文字反转**:`#1F2E4D → #E8E8EC`(不用 `#FFFFFF`,减锐利感)
3. **主品牌色提亮**:`#1F2E4D` 在暗色下变 `#3D5688`(提亮 + 加饱和度,补偿暗色吃饱和)
4. **靛紫同理**:`#4F46E5 → #7B73F0`
5. **柔色底反转**:`#EEF0FF → #1F1F33`(保持「indigo 染色」气质)
6. **边框降饱和**:`#ECEEF5 → #252A38`(暗色边框不能太亮)

### 6.2 阴影策略
- 亮色阴影:navy 染色(`rgba(31,46,77,xx)`)— 突出立体感
- 暗色阴影:`rgba(0,0,0,xx)` + 加大不透明度 — 暗背景上黑阴影才可见
- 或改用「顶部 1px highlight」模拟立体:`inset 0 1px 0 rgba(255,255,255,0.04)`

### 6.3 紫光晕在暗色下
不衰减,反而加强(`0.18 → 0.25`,`0.22 → 0.30`),让暗色下的氛围感不丢失。

---

## 7. 反模式(明确禁止)

来自 KHX README 的 5 条 + SGHUB 加 5 条:

### KHX 原则
1. ❌ **主按钮不是 indigo** — `--navy` 是 CTA 唯一深色,indigo 仅次级强调
2. ❌ **打破胶囊主义** — 单行交互元素改 8px / 12px 圆角,会立刻「不像 KHX」
3. ❌ **图标盒色搭混乱** — `bg: indigo-soft + fg: indigo` 是固定 pair,不要换色
4. ❌ **新增 Changelog 徽章色** — 4 色固定 4 含义,不允许第 5 色
5. ❌ **省略中文 fallback** — 必须含 `PingFang SC` 与 `Microsoft YaHei`,中英混排无额外配置

### SGHUB 加补
6. ❌ **任何位置硬编码 `#XXXXXX`** — 全部走 token
7. ❌ **`text-app-fg/50/60/70` opacity 文字分层** — V2.1 旧法,V2.2 用 `--text-1/2/3`
8. ❌ **同屏 >3 种彩色块**(灰阶不算)— 违反「深色重音」
9. ❌ **emoji 作为图标** — 全部 Lucide SVG 替换
10. ❌ **`window.confirm/prompt/alert`** — 全部走 `<ConfirmDialog>` / `<InputDialog>`
11. ❌ **`transition-all duration-500`** — 必须用 motion token
12. ❌ **卡片用描边代替阴影** — `--shadow-card` 是 KHX 灵魂

---

## 8. 与 V2.1.0 现状的偏离点(显式记录)

设计师交付时必须在「设计决策总结」里列出每一条偏离。

| 维度 | V2.1.0 | V2.2 (SGHUB Capsule)|
|---|---|---|
| Primary 色 | `#1F3864` | **`#1F2E4D`**(KHX) |
| Accent 色 | `#D4A017` 芥黄 | **淘汰**,改用 `#4F46E5` 靛紫 |
| 卡片圆角 | 6px (rounded-md) | **16px** |
| 按钮圆角 | 4px (rounded) | **999px** pill |
| chip / 输入圆角 | 4-6px | **999px** pill(textarea 例外) |
| 卡片阴影 | 无(仅 border) | **`shadow-card` 双层柔阴影** |
| 主按钮 hover | `bg-primary/90` | **navy-hover + translateY(-1px)** |
| 文字分层 | opacity-50/60/70 | **`--text-1/2/3` 实色** |
| Sidebar bg | `#1A1F2E` 独立灰墨 | **`#1F2E4D`(= navy)**,与品牌统一 |
| 字体 | system + Microsoft YaHei | **Inter** + 中文 fallback |
| 动效 | 几乎无 | **120/180/240ms + ease-khx** |
| 图标 | emoji | **Lucide SVG** |
| Toast | 3 套并存 | **1 套全局** |
| Modal | 真 Modal + 内嵌 + native | **统一 3 件套** |
| 空状态 | 纯文字 | **`<Stage>` 紫光晕 + 线稿插画** |
| 加载 | 「加载中…」文字 | **`<Skeleton>` 灰脉冲** |

---

## 9. 质量自检(7 条,每步交付必须自查)

| # | 检查项 | 标准 |
|---|---|---|
| 1 | 颜色无硬编码 | 全部走 token,grep 不到 `#[0-9A-F]{6}`(KHX reference 文件除外)|
| 2 | 亮 / 暗双套 | 都呈现,对比度 ≥ WCAG AA(正文 4.5:1,大字 3:1)|
| 3 | 胶囊主义贯穿 | 单行输入 / 按钮 / 导航 / 徽章一律 999px,textarea 例外 14px |
| 4 | 主按钮唯一 navy | 全应用 `bg-navy` 只用于真正的 primary CTA,不用于次级 |
| 5 | 双尺寸 | 1280×800 + 960×600 都不破版 |
| 6 | emoji → SVG | grep 不到 emoji 字符(包括标签、按钮、空状态)|
| 7 | 双语 | 模拟最长英文态(Sidebar `Subscriptions` / Settings `Application data location`)不溢出 |

---

## 10. 给设计师的实施提示

### 10.1 用什么文件作为底图
- 直接打开 `./1-tokens/khx-reference/tokens.css` 看到全部 KHX 原值
- 套用规则:**值原样用**,**key 改成 SGHUB 风格**(去掉 `--khx-` 前缀)
- 暗色推导按 §6.1 规则做(我已在 §2 表格里给了完整暗色值,可直接复制)

### 10.2 5 套 token 文件的取舍
| 文件 | 用途 | SGHUB 选择 |
|---|---|---|
| `tokens.css` | 纯 CSS Variables | ✅ 同步到 `src/styles/index.css` |
| `tailwind.config.js` | Tailwind v3 | ✅ 我们用 Tailwind v3,采用 |
| `tailwind-v4.css` | Tailwind v4 | ❌ 不用(版本不匹配)|
| `tokens.scss` | SCSS | ❌ 不用(项目无 SCSS)|
| `README.md` | 用法说明 | ✅ 保留作设计文档 |

### 10.3 可直接复用的 5 个组件级 utility class

KHX 提供了如下复合类,**Claude Code 重构时可机械化复用**:
- `.btn-khx-primary` / `.btn-khx-secondary` / `.btn-khx-link`
- `.input-khx` / `.textarea-khx`
- `.card-khx` / `.card-khx-sm`
- `.icon-box-khx`
- `.badge-khx-{update,improve,bug,new}`
- `.nav-khx`(可选)

可以选择:
- (a) 全量 `@apply` 进 `src/styles/components.css` 让 SGHUB 组件直接用类名
- (b) 仅作参考,SGHUB 组件继续用 Tailwind 原子类(便于调整)
- **推荐 (a)**:设计意图更清晰,Claude Code 替换 markup 时更机械

---

> 维护:V2.2 上线后,本文件归档到 `docs/archive/v2.2-design-style-spec.md`。
> 下次重设计另起新文件,KHX reference 永久保留在 `1-tokens/khx-reference/`。
