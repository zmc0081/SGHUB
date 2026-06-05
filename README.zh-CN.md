# SG Hub

**简体中文** | [English](README.md)

> AI 驱动的学术文献管理桌面应用 — 多源聚合检索 / 关键词订阅 / AI 结构化精读 / Skill 编排 / BYOK 多模型 / AI Store 即买即用
>
> **面向科研工作者的 AI 学术文献管理器。** 开源、本地优先、BYOK + 可选预付费模型。
>
> 项目代号:`SGHUB`(GitHub 仓库名、包名、bundle id 等技术标识符保留),展示名统一为 **SG Hub**。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-v2.2.2-1F2E4D)](src-tauri/tauri.conf.json)
![Tauri 2](https://img.shields.io/badge/Tauri-2-24C8DB)
![React 18](https://img.shields.io/badge/React-18-61DAFB)
![Rust](https://img.shields.io/badge/Rust-1.80+-DE6233)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey)

---

## 界面与设计

应用界面遵循 **V2.2 SGHUB Capsule** 设计规范(token / 组件规范 / icon-map / 交互流程):

- 设计规范权威源:[`docs/ui-design/`](docs/ui-design/)
- 全部画面截图占位清单:[`docs/ui-screenshots-checklist.md`](docs/ui-screenshots-checklist.md)
- 空状态插画:[`docs/ui-design/4-assets/illustrations/`](docs/ui-design/4-assets/illustrations/)
- V2.1 历史 UI 基线(SUPERSEDED):[`docs/ui-design-requirements.md`](docs/ui-design-requirements.md)

> 应用商店级界面截图随每个 Release 发布;运行 `cargo tauri dev` 即可在本机预览全部画面。

---

## ✨ 功能(V2.2.2)

### 文献工作流
- **多源聚合检索** — arXiv / PubMed / Semantic Scholar / OpenAlex 并发查询,统一结果格式,>100 条自动启用虚拟滚动
- **关键词订阅 + 本地推送** — 按 cron 自动跑订阅,无后端依赖,Sidebar 未读 badge,可批量「标已读」,「新建规则」一键创建
- **文献数据库**(原「收藏夹」)— 多级文件夹 / 标签云 / 阅读状态(未读/在读/已读/已解析)/ 拖拽归档 / FTS5 全文搜索
- **本地 PDF 上传与集中管理(V2.2.2 NEW)** — 文献数据库工具栏「上传 PDF」按钮 + 整页文件拖拽上传;自动用 `lopdf` + `pdf-extract` 提取元数据,解析失败 / 低置信度标「待完善」徽章并可一键补全;本地与在线文献统一管理(文件夹 / 标签 / 状态 / FTS / 来源筛选 + 批量移动·打标签·删除);左栏本地 PDF 存储占用展示 + 孤儿文件清理;重复检测、非 PDF 拒绝、损坏文件降级、>100MB 拒绝等边界处理

### AI 解析与对话
- **结构化精读(Parse)** — 多 Skill 模板,流式输出,按 `output_dimensions` 自动拆分卡片,会话级历史可恢复
- **通用对话(Chat)** — 多会话,置顶/重命名,文件附件,可附带 Skill,Markdown + 高亮渲染,Claude 风格附件 chip,流式前显「正在思考…」三跳点动画
- **AI 生成 Skill** — 自然语言描述 → 自动生成合法 YAML;支持 refine 多轮、auto-retry 校验、配置/YAML/测试 3 Tab 预览、localStorage 草稿
- **Skill 管理** — 内置 + 自定义两组列表,上传 `.yaml/.yml/.skill/.zip`,Monaco 编辑器 + 实时预览 + 测试运行 + 复制内置二改

### 模型与成本
- **BYOK 多模型** — Claude / GPT / DeepSeek / Ollama 本地 / 任意 OpenAI 兼容端点 / **SG AI Store 预付费套餐**
- **Key 入 Keychain** — Windows Credential Manager / macOS Keychain,**永不**落盘
- **成本追踪 + 图表** — 按模型记录 input/output token,自动计算 USD;Models 页 4 张统计卡 + AreaChart 平滑曲线 + 7d/30d/自定义范围切换 + X 轴 tick 自适应
- **AI 解析诊断日志** — 每次 chat_stream 入口记录 provider / endpoint / model_id / model_name,失败信息带模型名,便于排查跨 provider 问题
- **历史回填** — 「重建统计」按钮可根据 `chat_messages` / `ai_parse_results` 重算近期用量

### AI Store
- **浏览预付费模型套餐** — 侧栏「AI Store」入口,6 SKU(Claude Opus / Sonnet / GPT-5 / DeepSeek / Multi-Bundle)+ 推荐区 + Provider 分组
- **商品详情 + 跳转购买** — 左右两栏布局,sticky 购买面板,点「立即购买」OS 浏览器打开 sgaistore.com
- **后端缓存 + 自动同步** — SQLite 缓存(V005)+ 5 分钟周期 + SSE 推送(预留)+ 离线降级
- **SG AI Store 接入** — 「Models」页 onboarding 横幅(paste-key 一键添加)+ SG AI Store chip + 4-tier 余额徽章(绿/橙/红/灰)+ 24h 用量 + 余额刷新/详情/充值 3 按钮
- **预飞行余额拦截** — 余额 < ¥1 或 < 1000 tokens 时,Chat / Parse 自动弹 InsufficientBalanceDialog(前往充值 / 换模型 / 取消)

### 应用基础设施
- **侧栏折叠/伸缩** — 220px ↔ 60px 平滑动画 + localStorage 持久 + 首次窗口 <900px 自动折叠 + tooltip 提示
- **自动更新** — 每日 N / 每周(7-weekday bitmask)+ 15min 步进时间下拉,弹通知/静默下载/只标记 3 种行为,实时重排 cron
- **数据目录可配置** — 3 步迁移向导:选目录 → 选模式(迁移 / 全新 / 接管已有数据)→ 摘要确认;SHA-256 校验 + 失败回滚 + 自动重启
- **隐私协议查看器** — 设置页内置中英双语 markdown 协议(覆盖本地存储 / API Key / BYOK / SG AI Store / Keychain / 第三方数据流 / 用户权利 / 联系方式)
- **多语言** — 简体中文 / English,跟随系统,运行时切换无需重启
- **完全本地** — SQLite + FTS5 本地索引;除你主动调的 AI / 检索 API / SG AI Store 网关外不向任何第三方发数据

---

## 🚀 安装

### 下载预编译版本(推荐)

前往 [Releases](https://github.com/zmc0081/SGHUB/releases/latest):

- **Windows 10/11** — `SG.Hub_2.2.2_x64-setup.exe`(NSIS 安装器)
- **macOS 12+** — `SG.Hub_2.2.2_universal.dmg`(Intel & Apple Silicon 通用)

> macOS 首次运行如提示「无法验证开发者」,右键 → 打开 → 允许即可。

### 从源码构建

见下文 [从源码构建](#-从源码构建)。

---

## 🤖 模型配置(BYOK + SG AI Store)

SG Hub 不内置任何 AI 服务,需自带 Key。入口:**模型配置 → 添加模型**。

| 提供商 | 默认 Endpoint | 获取 Key | 备注 |
|---|---|---|---|
| **Anthropic** | `https://api.anthropic.com` | <https://console.anthropic.com/> | Claude 3.5 / 4 / Opus / Sonnet |
| **OpenAI** | `https://api.openai.com/v1` | <https://platform.openai.com/api-keys> | GPT-4o / o1 / gpt-5 |
| **DeepSeek** | `https://api.deepseek.com/v1` | <https://platform.deepseek.com/> | deepseek-chat / reasoner |
| **Ollama(本地)** | `http://localhost:11434` | 无需 Key | 先 `ollama pull llama3:8b` |
| **SG AI Store** | `https://sgaistore.com/v1` | <https://sgaistore.com/> | 预付费,购买即用,内置余额徽章 + 拦截 |
| **自定义(OpenAI 兼容)** | 任意 endpoint | — | LM Studio / Azure OpenAI / 自建网关 |

### 价格(成本估算)
模型卡可填「输入价格」「输出价格」(USD / 1M tokens),用于 Models 页的统计卡 + 曲线图成本列。添加表单选「预设」后,价格自动按模型 id 前缀回填(claude-opus / gpt-5 / deepseek 等)。

> Key **只存系统 Keychain**,不写 toml、不写日志、不上传任何第三方。

---

## 🛒 AI Store(可选预付费服务)

与 BYOK 完全独立 — 你可以两种模式混用。

### 适合谁
- 不想申请 Anthropic / OpenAI 等账号
- 想要统一计费(一份订阅多模型可切换)
- 偶尔重度使用,按月预付比按次后付划算

### 使用流程
1. 侧栏点「AI Store」浏览 6 个套餐(Claude Opus 月/年 / Sonnet / GPT-5 / DeepSeek / 全模型混合包)
2. 点商品详情 →「立即购买」→ 浏览器打开 `sgaistore.com/buy/{id}` 完成支付
3. 回到 SG Hub →「模型配置」顶部 onboarding 横幅出现 → 粘贴 sgaistore.com 给的 API Key + 选购买的套餐 → 一键添加
4. 模型卡片上自动显示余额徽章(绿/橙/红/灰)+ 到期时间 + 24h 用量
5. 余额不足时 Chat / Parse 自动弹「前往充值」对话框

### 数据流
- 请求经 `sgaistore.com` 网关代理到底层模型提供商
- 网关**仅记录用量元数据**(token 数 / 调用时间 / 用户标识),**不存储**请求体(论文内容、prompt)或响应体
- 完全可选 — 不使用时,SG Hub 与 sgaistore.com 之间没有任何数据流

详细数据流向 + 用户权利见应用内 **设置 → 隐私协议**(中英双语)。

---

## 🧠 Skill 系统

Skill 是把「文献 → 结构化输出」的可复用模板:用 YAML 定义 `name / description / prompt_template / output_dimensions / recommended_models / 等`,在 Parse 和 Chat 中按需挂载。

### 内置 Skill
- `general_read.yaml` — 通用精读模板(标题 / 关键问题 / 方法 / 结果 / 创新点 / 局限)。

### 用户 Skill 来源(3 种)
1. **AI 生成** — `Skill 管理 → + 新建 → 用 AI 创建`,自然语言一句话 + 多轮 refine,自动 YAML 校验 + retry
2. **手动编写** — `+ 新建 → 手动创建`,Monaco YAML 编辑器 + 实时预览 + 测试运行
3. **上传 / 复制** — 上传 `.yaml/.yml/.skill/.zip`,或复制内置 Skill 二次编辑

### Skill YAML 字段(节选)
```yaml
name: my_method_finder       # 唯一 id (kebab/snake case)
display_name: 方法挖掘
description: 抽取实验方法、数据集与对比指标
icon: 🔬                      # 用户输入字段,emoji 豁免
version: 1.0.0
author: you@example.com
recommended_models: [claude-3-5-sonnet, gpt-4o]
output_dimensions:
  - key: dataset
    label: 数据集
  - key: baseline
    label: 对比方法
  - key: metric
    label: 评估指标
prompt_template: |
  阅读以下论文,严格按 JSON 输出 {dataset, baseline, metric}:
  标题:{{title}}
  摘要:{{abstract}}
  正文:{{full_text}}
```

详细模板变量与字段见 [`skills/general_read.yaml`](skills/general_read.yaml) 与 SkillEditor 的「渲染后 Prompt」预览。

---

## 🔄 自动更新

入口:**设置 → 自动更新**。

- **主开关** + **频率**(每日 N 天 / 每周 7-weekday 多选)+ **时间**(96 项 15min 步进)
- **检查到更新的行为**:弹通知 / 静默下载 / 只标记(图标徽章)
- 状态网格显示:当前版本 / 最近一次检查 / 下次计划检查 / 待安装版本
- 配置变更后 cron 自动重排,无需重启

> 仅 release 构建启用 `tauri-plugin-updater`;dev 构建跳过,以避免缺少签名密钥时崩溃。

---

## 💾 数据目录

### 默认位置
- **Windows**: `%APPDATA%\com.sghub.app\` (= `C:\Users\<你>\AppData\Roaming\com.sghub.app\`)
- **macOS**: `~/Library/Application Support/com.sghub.app/`

```
com.sghub.app/
├── config.toml         # 主配置
├── models.toml         # 模型配置(Key 引用,不含明文)
├── data/
│   ├── sghub.db        # SQLite 主数据库(V001-V006 migrations)
│   ├── pdfs/           # 下载/上传的 PDF(本地上传存于 pdfs/uploaded/)
│   ├── cache/          # 检索缓存
│   └── chat_attachments/  # Chat 上传附件
├── skills/             # 用户自定义 Skill YAML
└── logs/               # 应用日志(rolling, 7 天)
```

### 自定义路径

`设置 → 数据存储位置 → 修改路径` 触发 3 步向导:

1. **选目录** — 即时校验(空 / 已有 SG Hub 数据 / 禁用路径如系统根)
2. **选模式** —
   - 把现有数据迁移过去
   - 在新路径从零开始(旧数据保留)
   - 直接接管目标路径上已有的 SG Hub 数据
3. **摘要确认** — 显示旧→新+模式,警示「迁移期间请勿关闭」

迁移过程:
- 每个文件 SHA-256(db/yaml/toml)或字节长度(PDF)校验
- 失败任意一步即整体回滚,旧数据不会丢失
- 完成后可选「保留 / 删除旧目录」并自动重启应用
- 自定义路径写入 `%APPDATA%\sghub-bootstrap\bootstrap.toml`(独立于数据本身,避免「数据被搬走但找不到路径」的引导循环)

---

## 🔧 从源码构建

### 前置依赖

| 依赖 | 版本 | Windows 安装 |
|---|---|---|
| Node.js | ≥ 18 | `winget install OpenJS.NodeJS.LTS` |
| Rust | **≥ 1.80**(用了 `std::sync::LazyLock`)| `winget install Rustlang.Rustup` 后 `rustup default stable` |
| MSVC Build Tools | 2022 | `winget install Microsoft.VisualStudio.2022.BuildTools`(勾选 Desktop development with C++) |
| Tauri CLI | 2.x | `cargo install tauri-cli --version "^2.0"` |

macOS 需要 Xcode Command Line Tools (`xcode-select --install`)。
Linux 需要 `libwebkit2gtk-4.1-dev` 等(详见 [CONTRIBUTING.md](CONTRIBUTING.md))。

### 构建步骤

```bash
git clone https://github.com/zmc0081/SGHUB.git
cd SGHUB

# 1. 安装前端依赖
npm install

# 2. 开发模式(热更新, 跳过 updater)
cargo tauri dev

# 3. 生产构建
cargo tauri build
# 产物: src-tauri/target/release/bundle/{nsis,dmg,...}
```

### 仓库结构(概览)

```
SG_Hub/
├── src/                           # React 前端
│   ├── pages/                     # 路由页面
│   │   ├── Search / Feed / Library / Parse / Chat
│   │   ├── Models / Skills / SkillGenerator / Settings
│   │   └── store/                 # StoreHome / ProductDetail / mockData
│   ├── components/                # UI 组件
│   │   ├── Sidebar / Titlebar / PaperPicker / PaperActions
│   │   ├── FavoriteButton / PaperMetadataEditor / SkillEditor
│   │   ├── BrandLogo / DataDirCard / UpdaterCard
│   │   ├── PrivacyPolicyDialog
│   │   ├── InsufficientBalanceDialog
│   │   └── chat/*
│   ├── stores/                    # Zustand: chatStore / libraryStore / skillGeneratorStore
│   ├── lib/
│   │   ├── tauri.ts               # 集中封装 invoke() 调用
│   │   ├── sgAiStoreApi.ts        # AI Store 前端契约
│   │   └── version.ts             # APP_VERSION 单源(读 package.json)
│   ├── assets/privacy/            # zh-CN.md + en-US.md (bundled)
│   ├── i18n/                      # i18next 配置
│   └── styles/                    # Tailwind + CSS 变量(主题)
├── src-tauri/
│   ├── src/
│   │   ├── ai_client/             # OpenAI 兼容 / Anthropic / Ollama 三套实现 + usage 统计
│   │   ├── ai_store/              # products / sync_strategy / sse_listener / billing / commands
│   │   ├── chat/                  # 会话 / 消息 / 附件
│   │   ├── config/                # bootstrap.toml + 路径 + 迁移
│   │   ├── db/                    # SQLite + r2d2 + refinery
│   │   ├── library/               # 文件夹 / 标签 / 阅读状态 / 本地 PDF 上传
│   │   ├── notify/                # 系统托盘通知
│   │   ├── pdf_extract/           # lopdf + pdf-extract + catch_unwind
│   │   ├── scheduler/             # tokio-cron-scheduler(订阅 + updater)
│   │   ├── search/                # 多源并发检索
│   │   ├── skill_engine/          # Skill 加载 / 渲染 / generator
│   │   ├── subscription/          # 关键词订阅
│   │   └── updater/               # 自动更新 + 时间调度
│   ├── icons/                     # 桌面图标(母源 app-icon.svg)
│   ├── migrations/                # V001 → V006 SQL 迁移
│   └── tests/                     # 集成测试(parse_with_all_providers 等)
├── skills/                        # 内置 Skill (general_read.yaml)
├── locales/                       # zh-CN.json / en-US.json
└── docs/
    ├── ui-design/                 # V2.2 SGHUB Capsule 设计规范(权威源)
    ├── ui-design-requirements.md  # V2.1 历史 UI 基线(SUPERSEDED)
    ├── ui-screenshots-checklist.md
    ├── i18n-guide.md
    ├── skill-authoring-guide.md
    └── SESSION_TASKS.md           # 历史 Session 任务清单
```

---

## 🔒 隐私与安全

- API Key 通过 [keyring-rs](https://github.com/hwchen/keyring-rs) 存入系统 Keychain,从不写明文文件、不进日志、不上传任何第三方。
- 除用户主动触发的 AI / 检索 API 调用外,应用不向任何第三方发送数据。
- SG AI Store(可选)请求经 `sgaistore.com` 网关代理,网关仅记录用量元数据(token 数 / 时间),不存储请求体或响应体。
- SQLite 数据库本地存储,可随时备份或导出。
- PDF 文本提取在 `tokio::spawn_blocking` + `catch_unwind` 保护下运行,损坏 / 异常 PDF 不会拖垮主进程。
- 应用内 **设置 → 隐私协议** 提供完整中英双语条款(10 节),覆盖每一个第三方数据流。

---

## 🌐 国际化(i18n)

SG Hub 默认跟随系统语言;也可在「设置 → 语言」手动切换,无需重启。

| Code  | Language     | Status                              |
| ----- | ------------ | ----------------------------------- |
| zh-CN | 简体中文     | ✅ Complete (default)               |
| en-US | English      | ✅ Complete                         |

OS locale 如 `zh-TW` / `zh-HK` 解析为 zh-CN;其他语言解析为 en-US。
新增语言流程见 [`docs/i18n-guide.md`](docs/i18n-guide.md)。

---

## 📚 文档

| 文档 | 用途 |
|---|---|
| [`docs/ui-design/`](docs/ui-design/) | **V2.2 SGHUB Capsule 设计规范**(token / 组件规范 / icon-map / 交互流程) |
| [`docs/ui-design-requirements.md`](docs/ui-design-requirements.md) | V2.1 历史 UI 基线(SUPERSEDED;只作 V2.1→V2.2 对照)|
| [`docs/ui-screenshots-checklist.md`](docs/ui-screenshots-checklist.md) | 全部画面截图任务清单 |
| [`docs/i18n-guide.md`](docs/i18n-guide.md) | 新增 / 维护语言指南 |
| [`docs/skill-authoring-guide.md`](docs/skill-authoring-guide.md) | Skill YAML 编写规范 |
| [`docs/data-management.md`](docs/data-management.md) | 数据目录 / 迁移 / 备份策略 |
| [`docs/SESSION_TASKS.md`](docs/SESSION_TASKS.md) | 各版本 Session 任务清单(M2.1.0 / M2.2.1 历史 + 后续路线) |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 开发环境 / 代码规范 / PR 流程 |
| [CLAUDE.md](CLAUDE.md) | Claude Code 项目上下文(架构 / 约束 / 风格) |

---

## 🤝 贡献

欢迎提 Issue / PR。开发环境搭建、代码规范、PR 流程详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

提交 PR 前请确保:
- `cargo fmt` + `cargo clippy --all-targets -- -D warnings` 通过(MSRV 1.80)
- `cargo test` 全部通过
- `npm run build` + `npx eslint src/` 通过
- 6 项 PR-blocking grep 全 0(见 [CLAUDE.md](CLAUDE.md) §UI 设计规范):无 V2.1 stale token / 无 `transition-all` / 无 `window.confirm/prompt/alert` / 无 emoji(Skill icon 例外)/ 无硬编码色值(`src/styles/index.css` 例外)
- Commit message 遵循 Conventional Commits(`feat:` / `fix:` / `docs:` / `chore:` …)

---

## License

[MIT](LICENSE) © 2026 SG Hub Contributors
