# SG Hub - AI 驱动的学术文献管理桌面应用

> 本文件是 Claude Code 的项目上下文,每次会话自动加载。
> 详细设计见 /docs 目录下的 PRD、架构方案与实施方案。
> 项目路径: D:\2-WORK\恒星\项目\学术文献管理系统\SG_Hub
> 当前版本: V2.2.6

## 产品定位

开源(MIT License)桌面客户端,面向科研工作者,提供:
1. 多源文献聚合检索(arXiv / PubMed / Semantic Scholar / OpenAlex / Crossref / CORE / DBLP / DOAJ)
2. 关键词订阅 + 定时本地推送(系统托盘通知)
3. 文献数据库(多级文件夹 + 标签 + 智能文件夹 + 本地 PDF 上传与集中管理)
4. AI 文献解析(多 Skill 结构化精读,流式输出)
5. Chat 自由对话(多模型切换 + 附件 / Skill / 文献引用)
6. BYOK 多模型配置中心(Claude / GPT / DeepSeek / Ollama 本地)
7. AI Store(对接独立的 SG AI Store 中转服务,购买即用的大模型配额)

> 品牌:对外展示名称统一为 **SG Hub**(带空格)。
> 注意区分:展示文案用 "SG Hub";代码标识符 / 包名 / bundle identifier(com.sghub.app)/
> 数据目录(sghub)/ 域名等技术标识符保持原样不变。

## 技术栈

| 层级 | 技术 |
|------|------|
| 应用框架 | Tauri 2 (Rust backend + WebView frontend) |
| 前端 | React 18 + TypeScript 5 + Vite + TailwindCSS 3 |
| 状态管理 | Zustand |
| 路由 | TanStack Router |
| 国际化 | react-i18next (简/繁/英/日/法) |
| 图标 | lucide-react (禁用 emoji 当图标) |
| Rust 异步 | tokio |
| 数据库 | SQLite 3 + FTS5 (via rusqlite + r2d2 连接池) |
| DB 迁移 | refinery |
| HTTP 客户端 | reqwest |
| 序列化 | serde + serde_json |
| 错误处理 | anyhow + thiserror |
| 密钥存储 | keyring-rs (Windows Credential Manager / macOS Keychain) |
| 定时任务 | tokio-cron-scheduler |
| IPC 类型生成 | specta |
| PDF 渲染 | pdf.js (前端) |
| PDF 文本提取 | pdf-extract / lopdf (Rust crate) |
| 日志 | tracing + tracing-appender |

## 仓库结构

```
D:\2-WORK\恒星\项目\学术文献管理系统\SG_Hub\
├── CLAUDE.md              # 本文件
├── README.md
├── CONTRIBUTING.md
├── LICENSE                 # MIT
├── package.json            # 前端依赖
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── src/                    # React 前端
│   ├── App.tsx
│   ├── main.tsx
│   ├── assets/             # Logo 等前端资源 (V2.2.2 新设计)
│   │   ├── logo.svg        # 主 Logo (矢量, 适配缩放)
│   │   ├── logo-dark.svg   # 暗色主题版
│   │   ├── logo-light.svg  # 亮色主题版
│   │   └── logo-mark.svg   # 折叠态侧栏用的小图标版
│   ├── components/         # UI 组件
│   ├── pages/              # 路由页面
│   │   ├── Search.tsx      # 文献检索
│   │   ├── Feed.tsx        # 今日推送
│   │   ├── Library.tsx     # 文献数据库 (原收藏夹)
│   │   ├── Parse.tsx       # AI 解析
│   │   ├── Chat.tsx        # Chat 自由对话
│   │   ├── Skills.tsx      # Skill 管理
│   │   ├── Models.tsx      # 模型配置
│   │   ├── store/          # AI Store (对接 SG AI Store)
│   │   │   ├── StoreHome.tsx
│   │   │   └── ProductDetail.tsx
│   │   └── Settings.tsx    # 偏好设置
│   ├── stores/             # Zustand stores
│   ├── hooks/              # 自定义 hooks
│   ├── lib/                # 工具函数
│   │   ├── tauri.ts        # Tauri invoke 封装
│   │   └── sgAiStoreApi.ts # SG AI Store API 封装
│   ├── i18n/               # i18n 配置
│   └── styles/             # 全局样式 + CSS 变量
├── src-tauri/              # Rust Core
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── icons/              # 应用图标 (V2.2.2 新 Logo, tauri icon 生成)
│   │   ├── 32x32.png
│   │   ├── 128x128.png
│   │   ├── 128x128@2x.png
│   │   ├── icon.icns       # macOS
│   │   └── icon.ico        # Windows
│   ├── capabilities/       # Tauri 2 权限声明
│   ├── src/
│   │   ├── main.rs         # 入口
│   │   ├── lib.rs          # 模块注册
│   │   ├── db/             # SQLite + FTS5 + migration
│   │   ├── search/         # 多源并发检索(8 源)
│   │   │   ├── mod.rs       # 并发聚合 / 去重归并 / DOI 直查 / 回退
│   │   │   ├── arxiv.rs
│   │   │   ├── pubmed.rs
│   │   │   ├── semantic_scholar.rs
│   │   │   ├── openalex.rs
│   │   │   ├── crossref.rs  # 正式期刊论文(V2.2.3)
│   │   │   ├── core_api.rs  # 机构库全文(V2.2.3)
│   │   │   ├── dblp.rs      # CS 专精(V2.2.3)
│   │   │   ├── doaj.rs      # 开放获取期刊(V2.2.3)
│   │   │   ├── matching.rs  # 标题归一化 / 模糊匹配(V2.2.3)
│   │   │   └── merge.rs     # 跨源去重归并 / 元数据补全(V2.2.3)
│   │   ├── library/        # 文献数据库 / 文件夹 / 标签
│   │   │   ├── mod.rs
│   │   │   ├── uploader.rs # 本地 PDF 上传
│   │   │   └── metadata_extractor.rs # PDF 元数据提取链
│   │   ├── ai_client/      # 统一 AI HTTP Client
│   │   │   ├── mod.rs
│   │   │   ├── openai.rs   # OpenAI 兼容 (GPT/DeepSeek/LM Studio)
│   │   │   ├── anthropic.rs # Claude Messages API
│   │   │   └── ollama.rs   # Ollama 本地
│   │   ├── chat/           # Chat 会话 / 消息 / 上下文
│   │   ├── skill_engine/   # Skill 加载 / 渲染 / 上传 / 生成
│   │   ├── ai_store/       # AI Store 商品同步 + 余额查询
│   │   ├── scheduler/      # tokio-cron 定时推送
│   │   ├── keychain/       # OS Keychain 读写
│   │   ├── notify/         # 系统托盘通知
│   │   ├── updater/        # 自动更新
│   │   ├── config/         # TOML 配置读写
│   │   └── pdf_extract/    # PDF 文本提取
│   └── migrations/         # refinery SQL 迁移文件
├── skills/                 # 内置 Skill YAML
├── locales/                # i18n JSON 语言包
│   ├── zh-CN.json
│   ├── zh-TW.json
│   ├── en-US.json
│   ├── ja-JP.json
│   └── fr-FR.json
├── docs/                   # 设计文档 (Markdown)
│   ├── SESSION_TASKS.md    # 开发 Session 任务清单 (权威)
│   ├── ui-design/          # UI 设计规范 (V2.2 SGHUB Capsule,权威源)
│   └── ui-design-requirements.md   # V2.1 历史基线 (SUPERSEDED)
└── .github/workflows/      # CI/CD
    ├── pr-check.yml
    └── release.yml
```

## 数据目录 (运行时, Windows)

```
%APPDATA%\sghub\                        # Windows: C:\Users\{用户名}\AppData\Roaming\sghub\
├── config.toml                          # 主配置 (含侧栏折叠状态等)
├── models.toml                          # 模型配置 (Key 存 Windows Credential Manager)
├── data\
│   ├── sghub.db                         # SQLite 主数据库
│   ├── pdfs\                            # PDF 文件
│   │   ├── uploaded\                    # 本地上传的 PDF (V2.2.2 集中管理)
│   │   └── _temp\                       # 临时下载的 PDF
│   └── cache\                           # 检索缓存
├── skills\                              # 用户自定义 Skill YAML
└── logs\                                # 应用日志 (保留 7 天)
```

注意: Tauri 2 在 Windows 下的 app data 路径通过 `app.path().app_data_dir()` 获取,
通常为 `C:\Users\{用户名}\AppData\Roaming\{bundleIdentifier}`,
我们的 bundleIdentifier 配置为 `com.sghub.app`。

## 编码规范

### Rust
- `cargo fmt` + `cargo clippy -- -D warnings`
- 错误处理: 库代码用 `thiserror` 定义错误类型,应用代码用 `anyhow`
- Tauri Command 签名: `#[tauri::command]`,返回 `Result<T, String>`
- 异步: 所有 I/O 操作用 `async fn`,在 tokio runtime 中执行
- 日志: `tracing::info!()` / `tracing::error!()`,不用 `println!()`
- 路径拼接: 使用 `std::path::PathBuf`,不要硬编码路径分隔符

### TypeScript / React
- ESLint + Prettier,strict mode
- 组件: 函数组件 + hooks,不用 class 组件
- 状态: 简单状态用 `useState`,跨组件用 Zustand store
- Tauri 调用: 统一封装在 `src/lib/tauri.ts`,不直接 `invoke`
- 样式: TailwindCSS utility class,不写自定义 CSS(除 CSS 变量)

### 通用
- commit message: Conventional Commits (feat: / fix: / docs: / chore:)
- 分支: main(生产) / develop(集成) / feature/*
- 每个 PR 必须有描述、影响范围、测试方式
- Windows 路径: 代码中始终使用 Path / PathBuf,不硬编码 `/` 或 `\`

## UI 设计规范(强约束)

新增任何 UI 功能(新页面 / 新组件 / 新对话框 / 新空状态),**必读**:

| # | 文件 | 何时查 |
|---|---|---|
| 1 | [`docs/ui-design/design-style-spec.md`](docs/ui-design/design-style-spec.md) | 任何 UI 改动开工前 — 5 大视觉支柱 / 12 条反模式 / token 表 |
| 2 | [`docs/ui-design/3-specs/component-specs.md`](docs/ui-design/3-specs/component-specs.md) | 复用 15 个已规范的组件时 — PropsAPI / states / a11y |
| 3 | [`docs/ui-design/3-specs/icon-map.md`](docs/ui-design/3-specs/icon-map.md) | 选 Lucide icon 时 — emoji → Lucide 映射 |
| 4 | [`docs/ui-design/3-specs/interaction-flows.md`](docs/ui-design/3-specs/interaction-flows.md) | 实现复杂交互时 — 4 个关键 FSM |

**运行时 token 权威源**(冲突时以下面这两个为准):
- [`src/styles/index.css`](src/styles/index.css) — CSS 变量(亮 + 暗双主题)
- [`tailwind.config.js`](tailwind.config.js) — Tailwind 映射

**硬规则(任一违反 = PR 阻塞)**:
1. **禁用 V2.1 旧 token**:`bg-primary` / `text-app-fg` / `bg-accent` 等(已被 V2.2 token 取代)
2. **禁用 emoji 当图标**:全部用 Lucide(`lucide-react`),例外是用户输入字段(如 Skill icon)
3. **禁用 `window.confirm/prompt/alert`**:用 `confirmAsync` / `promptAsync` / `useToast` 代替
4. **禁用 `transition-all`**:必须指定 property + motion token(`duration-fast/base/slow ease-khx`)
5. **禁止硬编码颜色**:`#XXXXXX` 仅允许在 `src/styles/index.css` 内出现
6. **必须双主题验证**:亮 / 暗模式都通过 WCAG AA(正文 4.5:1)
7. **不改基础设施**:不动 `src/lib/tauri.ts` invoke 签名 / `src/stores/*` shape / `router.tsx` 路由 / i18next key 命名空间(只增不改)

PR 自查 6 条(grep 必须全为 0):
```
grep -rE 'bg-primary[^-]|text-app-fg|bg-accent[^-]' src/  → 0
grep -rE 'transition-all' src/                           → 0
grep -rE 'window\.(confirm|prompt|alert)' src/           → 0
grep -rP '[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]' src/ → 0
grep -rE '#[0-9A-Fa-f]{6}' src/                          → 仅 src/styles/index.css
eslint src --max-warnings 0                              → clean
```

> [`docs/ui-design-requirements.md`](docs/ui-design-requirements.md) 是 V2.1.0 旧需求文档,**SUPERSEDED**,只用作 V2.1→V2.2 对照;不要作为新功能依据。

## Logo 资源(V2.2.2 更换为新设计)

- **应用图标**(窗口 / 任务栏 / 安装包):放在 `src-tauri/icons/`,用 `npm run tauri icon <1024源图>`
  自动生成全部规格(32x32 / 128 / icns / ico),不手动逐张制作
- **应用内 UI Logo**:放在 `src/assets/`,优先 SVG 矢量,适配亮 / 暗主题
- Logo 出现位置:侧栏顶部(展开态用 `logo.svg`,折叠态用 `logo-mark.svg`)、关于页、
  首次启动 / 引导页、登录页、AI Store 页头
- tauri.conf.json 的 `bundle.icon` 指向 `src-tauri/icons/` 下的图标
- 注意:图标在构建期嵌入,改完需重新完整构建(`cargo tauri build`),dev 模式可能看不到变化

## 侧边栏导航(V2.2.1 重构,V2.2.6 取消 AI Store 入口)

导航顺序(自上而下):Chat → 文献检索 → 今日推送 → AI 解析 → 文献数据库 → Skill 管理 → 模型配置 → 设置

- **V2.2.6 起取消独立的"AI Store"菜单项**,其内容并入"模型配置"页
- 支持折叠 / 伸缩:展开态约 220px(图标 + 文字),折叠态约 60px(仅图标 + hover tooltip)
- 折叠状态持久化到 config.toml,重启恢复
- 底部固定版权信息:`Copyright © Star Technology. All Rights Reserved`(折叠态简化为 `© Star Technology`)
- 所有导航图标用 Lucide,不用 emoji

## 文献数据库本地 PDF 管理(V2.2.2)

"文献数据库"(原"收藏夹",UI 已更名)支持本地 PDF 上传与集中管理。
后端能力在 V2.0.1 已建,V2.2.2 复用 + 增强,不重写。

关键 Tauri Command(`src-tauri/src/library/`):
- `upload_local_paper(file_path)` / `upload_local_papers_batch(file_paths)` — 上传本地 PDF
- `extract_pdf_metadata` — 提取标题 / 作者 / 摘要(置信度低时标记待完善)
- `update_paper_metadata` — 元数据补全 / 修正
- `search_local_papers(keyword)` — FTS5 全文检索

数据:
- papers 表:`source='local'` 标记本地上传文献,`uploaded_at` 记录上传时间
- 本地 PDF 存储:`{数据目录}/data/pdfs/uploaded/{uuid}.pdf`
- folder_papers:本地文献与文件夹的归类关联;papers_fts:上传后自动更新索引

集中管理能力:本地上传与在线检索 / 推送文献统一管理(文件夹归类、标签、阅读状态、FTS 检索、
批量操作);来源徽章区分(本地 / arXiv / PubMed / OpenAlex / Semantic Scholar);
上传方式支持文件选择器多选 + 拖拽。

## AI Store(V2.2.6 起并入模型配置页)

AI 中转服务是**完全独立的项目 SG AI Store**(域名 sgaistore.com),不在本项目范围。
SG Hub 客户端只作为消费方,通过其公开 API 同步商品、展示已购模型的用量与余额。

**V2.2.6 重要变更**:
- **取消侧栏独立的"AI Store"菜单入口**
- AI Store 同步的商品内容**并入"模型配置"页面**,位置在"前往 SG AI Store 购买"按钮的下方
  (展示同步的商品列表/套餐,供用户浏览与购买引导)
- 模型配置页因此成为统一入口:配置自有模型(BYOK)+ SG AI Store Key 配置 + 购买引导 + 商品展示

协作 API 契约(不变):
- `GET https://sgaistore.com/api/products.json` — 商品列表(带 ETag)
- `GET https://sgaistore.com/api/products/stream` — SSE 商品变更推送
- `GET https://sgaistore.com/api/billing/balance` — 余额 / 用量查询(API Key 鉴权)
- `https://sgaistore.com/v1` — OpenAI 兼容模型调用网关

客户端实现(`src-tauri/src/ai_store/`):商品同步(拉 + SSE 推双通道)、余额查询、
模型卡片余额徽章、余额不足拦截。开发阶段用 mock 数据,SG AI Store 上线后切真实 API。
前端展示位置从独立 /store 页迁移到模型配置页。

## 文献检索层目标架构(SG Hub Retrieval Layer)

检索层是 SG Hub 的核心,采用分层流水线架构:用户检索请求 → 多源接入 → 去重合并 → 引文增强 → 语义检索 → 应用输出。统一在 `src-tauri/src/search/` 实现。

```
用户检索请求
      ↓
① 多源数据接入(并行适配 · 字段归一化 · 限流重试)
   Crossref / OpenAlex / Semantic Scholar / CORE
   DOAJ / DBLP / arXiv / Unpaywall  (+ PubMed)
      ↓
② 去重合并
   DOI 精确匹配(主键去重) · 标题作者模糊(相似度阈值)
   版本聚类(预印·正式版) · 字段择优合并(来源溯源)
      ↓
③ 引文增强
   引文图谱补全(OpenAlex·S2) · 被引数聚合(多源取并)
   参考被引文献(双向链接) · 相关文献推荐(共被引计算)
      ↓
④ 语义检索
   Embedding 生成(标题·摘要·全文) · 向量库(本地索引)
   混合检索(BM25 + 向量) · 重排序(相关性融合)
      ↓
应用输出层:排序结果 · AI 摘要/问答 · 文献入库管理
```

### ① 多源数据接入(已实现 8 源 + 规划 Unpaywall)

| 源 | API | 鉴权 | 覆盖 | 状态 |
|---|---|---|---|---|
| arXiv | export.arxiv.org/api | 无 | 物理/数学/CS 预印本 | 已实现 |
| PubMed | E-utilities | 无 | 生物医学 | 已实现 |
| Semantic Scholar | api.semanticscholar.org | 无 | 跨学科(偏 CS/AI) | 已实现 |
| OpenAlex | api.openalex.org | 无 | 跨学科较广 | 已实现 |
| Crossref | api.crossref.org | 无(留 mailto) | 正式期刊论文(有 DOI) | V2.2.3 |
| CORE | api.core.ac.uk/v3 | 免费 API Key | 机构库/预印本全文 | V2.2.3 |
| DBLP | dblp.org/search/publ/api | 无 | 计算机科学专精 | V2.2.3 |
| DOAJ | doaj.org/api/v2 | 无 | 开放获取期刊 | V2.2.3 |
| Unpaywall | api.unpaywall.org | 无(留 email) | 开放获取全文链接补全 | 规划 |

并行适配:`search_all` 用 tokio::join! / FuturesUnordered 并发请求,每源独立超时(10s),
单源失败/超时降级不影响其他源。字段归一化为统一 Paper 结构。限流重试避免触发上游限流。
用户可在设置启用/禁用每个源(config 持久化)。

### ② 去重合并(V2.2.3 已实现核心)

- **DOI 精确匹配**(主键去重):归并键以 DOI 为主
- **标题作者模糊**(matching.rs):归一化(小写/去标点/去停用词)+ 相似度阈值判定同一篇
- **版本聚类**:预印本与正式版聚为一条
- **字段择优合并**(merge.rs):作者取最全、摘要取最长、全文链接优先 CORE downloadUrl;
  sources 字段记录命中的源(来源溯源)
- **DOI 直查**:输入被识别为 DOI(`^10\.\d{4,}/`)时走 Crossref DOI 精确端点 + 并发查其他源
- **检索回退**:默认源结果过少时自动追加 Crossref + CORE 扩大召回

### ③ 引文增强(规划)

- 引文图谱补全(OpenAlex / Semantic Scholar)· 被引数聚合(多源取并)
- 参考文献与被引文献双向链接 · 相关文献推荐(共被引计算)

### ④ 语义检索(规划)

- Embedding 生成(标题/摘要/全文)· 本地向量库索引
- 混合检索(BM25 + 向量)· 重排序(相关性融合)

### 应用输出层

排序结果展示 · AI 摘要/问答 · 文献入库管理(文献数据库)

配置:search.crossref_mailto / search.core_api_key(keychain)/ search.unpaywall_email / search.enabled_sources

> 注意:DBLP 的 authors 字段单作者是对象、多作者是数组,解析需兼容两种。
> Google Scholar 无官方 API,本期不纳入(留作后续可选高级源)。
> 引文增强(③)与语义检索(④)为目标架构的后续阶段,当前已落地 ① 多源接入与 ② 去重合并。

## PDF 阅读与翻译(V2.2.6)

### 内置 PDF 阅读器
- 软件内打开 PDF(不再依赖系统外部程序),融合 PDF 阅读器
- 技术:前端 pdf.js 渲染,支持翻页/缩放/目录/搜索;在应用内独立视图或标签页打开
- 入口:文献检索结果"全文 PDF"、文献数据库"下载 PDF"/打开、本地上传的 PDF

### 全文翻译
- 借助已配置大模型 + 成熟翻译工程方法,翻译 PDF/文献全文
- 要求:保持文档结构不错乱、内容布局协调、语句专业(学术翻译质量)
- 实现要点:按文档结构(标题/段落/图表标注/公式占位)分块翻译,保留版式;
  专业术语一致性(术语表/上下文);中英(及其他语言)对照或整篇替换两种模式
- 入口:
  * 文献检索结果卡:在"全文 PDF"按钮之后新增"翻译"
  * 文献数据库卡:在"原文"与"下载 PDF"之间新增"翻译"


## 设置与计费约定(V2.2.5 简化)

更新设置:
- "隐私与更新"卡片已简化,**无自动更新总开关**,只保留右上角「立即检查」按钮 + 当前版本号
- updater 后台采用固定策略(如每次启动检查一次),检查到更新弹通知让用户决定
- 不再有检查频率/检查时间/检查行为等细粒度配置(V2.1.0 Session 21 的复杂调度已废弃)
- 隐私协议并入"隐私与更新"卡片,用分隔线分隔

计费/成本:
- **已彻底移除成本估算功能**(V2.2.5 方案 B):
  * model_configs 不再有价格字段(input_price_per_1m_tokens / output_price_per_1m_tokens)
  * usage_stats 不再计算/写入成本(cost_est)
  * 模型配置页顶部统计无"近 7 天成本"卡,只保留 已配置模型 / 近 7 天调用 / 近 7 天 Token
- 用量统计仍保留:调用次数、token 数(不涉及金额)
- **后续不要再实现"成本估算/价格字段",该功能已主动移除**

模型配置页入口结构(V2.2.5):
- 上方两个等权并列卡:「添加自有模型」(BYOK)/ 「添加 SG AI Store API Key」(去套餐下拉框)
- 下方一整行:SG AI Store 购买引导链接(无 Key 用户)

## 首次启动与隐私协议(V2.2.6)

首次启动引导流程(在 V2.2.4 引导基础上,V2.2.6 新增强制阅读隐私协议作为第一步):
1. **强制阅读隐私协议**(新增,必经):安装后首次启动,先展示隐私协议(中英文),
   用户必须阅读并同意后,方可进入后续配置。未同意不能进入应用。
   - 实现:协议页提供"我已阅读并同意"按钮(可要求滚动到底部才能点击);
     记录同意状态与同意时的协议版本号到 bootstrap 配置
2. Step 1:数据目录配置(可跳过)
3. Step 2:模型配置(可跳过)

隐私协议:
- 中英文两份完整协议,内置资源文件,react-markdown 渲染
- 协议中包含版本号 / 生效日期,**必须与应用版本号保持一致**(纳入版本号统一更新检查)
- 设置页"隐私与更新"卡片内可随时查看(V2.2.5 已归位)
- 协议内容若有实质性更新,应提示老用户重新确认



统一 trait:
```rust
#[async_trait]
pub trait AiProvider: Send + Sync {
    async fn chat_stream(
        &self,
        messages: Vec<Message>,
        config: &ModelConfig,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<String>> + Send>>>;
}
```

实现:
- `OpenAiCompatible`: POST /chat/completions (覆盖 OpenAI / DeepSeek / LM Studio / Azure / SG AI Store 网关)
- `AnthropicProvider`: POST /messages (Claude 专属 API)
- `OllamaProvider`: POST /api/chat (本地,无需 Key)

流式输出通过 Tauri Event 推送到前端:
```rust
app.emit("ai:token", TokenPayload { text, done: false })?;
```

> 注意:模型路由根据 `ModelConfig.provider` 分发,务必正确传递 `model_config_id`,
> 不要 hardcode 默认模型路径(参考 V2.2.1 Session 25 的非默认模型解析修复)。

## 关键约束

1. API Key 只存 Windows Credential Manager,永远不写明文文件,不写日志
2. 除用户主动触发的 AI API / 文献检索 API / AI Store 网关,不向任何第三方发数据
   - BYOK 模式:数据直连模型提供商,不经任何 SG Hub 服务器
   - AI Store 模式:请求经 sgaistore.com 网关,网关仅记录用量元数据,不存论文内容
3. 安装包 < 100MB,内存 < 200MB,冷启动 < 3 秒
4. 所有依赖许可证必须兼容 MIT(禁止 GPL 传染)
5. Windows 10 21H2+ 和 macOS 12+ 必须支持
6. 路径处理必须跨平台兼容(Path / PathBuf,不硬编码分隔符)
7. Logo 更换需重新完整构建;本地 PDF 单文件 < 100MB,重复上传需检测提示
8. **版本号同步(强制)**:每次更新版本号时,必须同步更新打包配置中的版本号,确保
   打包产物的版本与实际代码版本一致。需同步的位置:
   - `src-tauri/tauri.conf.json` 的 `version`
   - `src-tauri/Cargo.toml` 的 `[package] version`
   - `package.json` 的 `version`
   三处版本号必须完全一致;构建前核对,不一致则视为发布阻塞项。

## 版本号与打包一致性(强制流程)

**版本号统一更新检查清单**(每次发版,以下所有涉及版本号的位置必须同步更新为同一版本号):
1. `src-tauri/tauri.conf.json` 的 `version`
2. `src-tauri/Cargo.toml` 的 `[package] version`
3. `package.json` 的 `version`
4. **隐私协议中的版本号 / 生效日期**(中英文两份,见隐私协议资源文件)
5. README 中如有版本徽章/版本号
6. CLAUDE.md 顶部"当前版本"
7. 应用内"设置/关于"显示的版本号 —— 从 tauri.conf.json 读取,不硬编码

> 要求:写一个统一的版本号校验脚本(scripts/check-version),扫描以上所有位置,
> 任一不一致即报错并阻塞发布;推荐配套 bump-version 脚本一键同步全部位置。
> **隐私协议的版本号必须与设置中显示的版本号保持一致**(本条为强制项)。

每次发布新版本的操作顺序,确保"代码版本 = 打包版本 = 安装后显示版本 = 隐私协议版本"一致:
1. 运行 bump-version 同步全部版本号位置(含隐私协议)
2. 运行 check-version 校验全部一致
3. 完整构建:`npm run tauri build`(图标、版本号均在构建期嵌入)
4. 验证:安装后设置页版本号正确、隐私协议版本号一致、安装包/快捷方式图标为最新 Logo
> 历史教训:曾出现安装 2.2.4 但快捷方式被"修复"后指向开发目录的旧 dev 版(2.2.1),
> 以及 Logo 未随构建更新的问题。发布前务必清理 dev 构建残留(cargo clean)并完整重建。


## 开发环境

- 操作系统: Windows
- IDE: VS Code + Claude Code
- 项目路径: D:\2-WORK\恒星\项目\学术文献管理系统\SG_Hub
