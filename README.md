# SGHUB

> AI 驱动的学术文献管理桌面应用 — 多源聚合检索 / 关键词订阅 / AI 结构化精读 / Skill 编排 / BYOK 多模型
>
> **AI-powered academic literature manager for researchers.** Open source, local-first, BYOK.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-v2.1.0-1F3864)](src-tauri/tauri.conf.json)
![Tauri 2](https://img.shields.io/badge/Tauri-2-24C8DB)
![React 18](https://img.shields.io/badge/React-18-61DAFB)
![Rust](https://img.shields.io/badge/Rust-stable-DE6233)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey)

---

## 截图

> 详细的全部画面占位清单见 [`docs/ui-screenshots-checklist.md`](docs/ui-screenshots-checklist.md);
> Figma / 重构参考见 [`docs/ui-design-requirements.md`](docs/ui-design-requirements.md)。

| 文献检索 | 收藏夹 | AI 解析 | AI 生成 Skill |
|---|---|---|---|
| ![search](docs/img/screenshot-search.png) | ![library](docs/img/screenshot-library.png) | ![parse](docs/img/screenshot-parse.png) | ![skillgen](docs/img/screenshot-skillgen.png) |

---

## ✨ 功能(V2.1.0)

### 文献工作流
- 🔍 **多源聚合检索** — arXiv / PubMed / Semantic Scholar / OpenAlex 并发查询,统一结果格式,>100 条自动启用虚拟滚动
- 📰 **关键词订阅 + 本地推送** — 按 cron 自动跑订阅,无后端依赖,Sidebar 未读 badge,可批量「标已读」
- ⭐ **个人收藏夹** — 多级文件夹 / 标签云 / 阅读状态(未读/在读/已读/已解析)/ 拖拽归档 / FTS5 全文搜索
- 📥 **本地 PDF 接入** — Search/Library/Parse 任意位置上传 PDF,自动用 `lopdf` + `pdf-extract` 提取元数据,低置信度弹补全 Modal

### AI 解析与对话
- 🧠 **结构化精读(Parse)** — 多 Skill 模板,流式输出,按 `output_dimensions` 自动拆分卡片,会话级历史可恢复
- 💬 **通用对话(Chat)** — 多会话,置顶/重命名,文件附件,可附带 Skill,Markdown + 高亮渲染,Claude 风格附件 chip
- ✨ **AI 生成 Skill(NEW)** — 自然语言描述 → 自动生成合法 YAML;支持 refine 多轮、auto-retry 校验、配置/YAML/测试 3 Tab 预览、localStorage 草稿
- 📝 **Skill 管理(NEW)** — 内置 + 自定义两组列表,上传 `.yaml/.yml/.skill/.zip`,Monaco 编辑器 + 实时预览 + 测试运行 + 复制内置二改

### 模型与成本
- 🤖 **BYOK 多模型** — Claude / GPT / DeepSeek / Ollama 本地 / 任意 OpenAI 兼容端点
- 🔑 **Key 入 Keychain** — Windows Credential Manager / macOS Keychain,**永不**落盘
- 💰 **成本追踪(NEW)** — 按模型记录 input/output token,自动计算 USD,Models 页 4 张统计卡 + 7 天柱状图(recharts)
- 🔄 **历史回填** — 「重建统计」按钮可根据 `chat_messages` / `ai_parse_results` 重算近 7 天用量

### 应用基础设施
- 🔄 **自动更新(NEW)** — 每日 / 每周(7 weekday bitmask)+ 15min 步进时间下拉,弹通知/静默下载/只标记 3 种行为,实时重排 cron
- 💾 **数据目录可配置(NEW)** — 3 步迁移向导:选目录 → 选模式(迁移 / 全新 / 接管已有数据)→ 摘要确认;SHA-256 校验 + 失败回滚 + 自动重启
- 🌐 **多语言** — 简体中文 / English,跟随系统,运行时切换无需重启
- 🔒 **完全本地** — SQLite + FTS5 本地索引;除你主动调的 AI / 检索 API 外不向任何第三方发数据

---

## 🚀 安装

### 下载预编译版本(推荐)

前往 [Releases](https://github.com/zmc0081/SGHUB/releases/latest):

- **Windows 10/11** — `SGHUB_2.1.0_x64-setup.exe`(NSIS 安装器)
- **macOS 12+** — `SGHUB_2.1.0_universal.dmg`(Intel & Apple Silicon 通用)

> macOS 首次运行如提示「无法验证开发者」,右键 → 打开 → 允许即可。

### 从源码构建

见下文 [从源码构建](#-从源码构建)。

---

## 🤖 模型配置(BYOK)

SGHUB 不内置任何 AI 服务,需自带 Key。入口:**🤖 模型配置 → 添加模型**。

| 提供商 | 默认 Endpoint | 获取 Key | 备注 |
|---|---|---|---|
| **Anthropic** | `https://api.anthropic.com` | <https://console.anthropic.com/> | Claude 3.5 / 4 / Opus / Sonnet |
| **OpenAI** | `https://api.openai.com/v1` | <https://platform.openai.com/api-keys> | GPT-4o / o1 / gpt-5 |
| **DeepSeek** | `https://api.deepseek.com/v1` | <https://platform.deepseek.com/> | deepseek-chat / reasoner |
| **Ollama (本地)** | `http://localhost:11434` | 无需 Key | 先 `ollama pull llama3:8b` |
| **自定义 (OpenAI 兼容)** | 任意 endpoint | — | LM Studio / Azure OpenAI / 自建网关 |

### 价格(成本估算)
模型卡可填「输入价格」「输出价格」(USD / 1M tokens),用于 Models 页的统计卡 + 柱状图成本列。
添加表单选「预设」后,价格自动按模型 id 前缀回填(claude-opus / gpt-5 / deepseek 等)。
> Key **只存系统 Keychain**,不写 toml、不写日志、不上传任何第三方。

---

## 🧠 Skill 系统

Skill 是把「文献 → 结构化输出」的可复用模板:用 YAML 定义 `name / description / prompt_template / output_dimensions / recommended_models / 等`,在 Parse 和 Chat 中按需挂载。

### 内置 Skill
- `general_read.yaml` — 通用精读模板(标题 / 关键问题 / 方法 / 结果 / 创新点 / 局限)。

### 用户 Skill 来源(3 种)
1. **AI 生成** — `Skill 管理 → + 新建 → ✨ 用 AI 创建`,自然语言一句话 + 多轮 refine,自动 YAML 校验 + retry
2. **手动编写** — `+ 新建 → 📝 手动创建`,Monaco YAML 编辑器 + 实时预览 + 测试运行
3. **上传 / 复制** — 上传 `.yaml/.yml/.skill/.zip`,或复制内置 Skill 二次编辑

### Skill YAML 字段(节选)
```yaml
name: my_method_finder       # 唯一 id (kebab/snake case)
display_name: 方法挖掘
description: 抽取实验方法、数据集与对比指标
icon: 🔬
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

入口:**⚙️ 设置 → 自动更新**。

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
│   ├── sghub.db        # SQLite 主数据库(V001-V004 migrations)
│   ├── pdfs/           # 下载/上传的 PDF
│   ├── cache/          # 检索缓存
│   └── chat_attachments/  # Chat 上传附件
├── skills/             # 用户自定义 Skill YAML
└── logs/               # 应用日志(rolling, 7 天)
```

### 自定义路径(NEW)

`⚙️ 设置 → 数据存储位置 → 🔄 修改路径` 触发 3 步向导:

1. **选目录** — 即时校验(空 / 已有 SGHUB 数据 / 禁用路径如系统根)
2. **选模式** —
   - 把现有数据迁移过去
   - 在新路径从零开始(旧数据保留)
   - 直接接管目标路径上已有的 SGHUB 数据
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
| Rust | stable | `winget install Rustlang.Rustup` 后 `rustup default stable` |
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
├── src/                    # React 前端
│   ├── pages/              # Search / Feed / Library / Parse / Chat
│   │   │                   # Models / Skills / SkillGenerator / Settings
│   ├── components/         # Sidebar / Titlebar / PaperPicker / PaperActions
│   │   │                   # FavoriteButton / PaperMetadataEditor / SkillEditor
│   │   │                   # DataDirCard / UpdaterCard / Chat/* 等
│   ├── stores/             # Zustand: chatStore / libraryStore / skillGeneratorStore
│   ├── lib/tauri.ts        # 集中封装 invoke() 调用
│   ├── i18n/               # i18next 配置
│   └── styles/             # Tailwind + CSS 变量(主题)
├── src-tauri/
│   ├── src/
│   │   ├── ai_client/      # OpenAI 兼容 / Anthropic / Ollama 三套实现
│   │   ├── chat/           # 会话 / 消息 / 附件
│   │   ├── config/         # bootstrap.toml + 路径 + 迁移
│   │   ├── db/             # SQLite + r2d2 + refinery
│   │   ├── library/        # 文件夹 / 标签 / 阅读状态
│   │   ├── notify/         # 系统托盘通知
│   │   ├── pdf_extract/    # lopdf + pdf-extract + catch_unwind
│   │   ├── scheduler/      # tokio-cron-scheduler(订阅 + updater)
│   │   ├── search/         # 多源并发检索
│   │   ├── skill_engine/   # Skill 加载 / 渲染 / generator
│   │   ├── subscription/   # 关键词订阅
│   │   └── updater/        # 自动更新 + 时间调度
│   └── migrations/         # V001 ~ V004 SQL 迁移
├── skills/                 # 内置 Skill (general_read.yaml)
├── locales/                # zh-CN.json / en-US.json
└── docs/                   # 设计 / UI / i18n / 实施方案
```

---

## 🔒 隐私与安全

- API Key 通过 [keyring-rs](https://github.com/hwchen/keyring-rs) 存入系统 Keychain,从不写明文文件、不进日志、不上传任何第三方。
- 除用户主动触发的 AI / 检索 API 调用外,应用不向任何第三方发送数据。
- SQLite 数据库本地存储,可随时备份或导出。
- PDF 文本提取在 `tokio::spawn_blocking` + `catch_unwind` 保护下运行,损坏 / 异常 PDF 不会拖垮主进程。

---

## 🌐 国际化(i18n)

SGHUB 默认跟随系统语言;也可在「设置 → 语言」手动切换,无需重启。

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
| [`docs/ui-design-requirements.md`](docs/ui-design-requirements.md) | UI 规格基线(Figma 还原 / 前端重构) |
| [`docs/ui-screenshots-checklist.md`](docs/ui-screenshots-checklist.md) | 全部画面截图任务清单 |
| [`docs/i18n-guide.md`](docs/i18n-guide.md) | 新增 / 维护语言指南 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 开发环境 / 代码规范 / PR 流程 |
| [CLAUDE.md](CLAUDE.md) | Claude Code 项目上下文(架构 / 约束 / 风格) |

更多 PRD / 实施方案见 `docs/` 目录。

---

## 🤝 贡献

欢迎提 Issue / PR。开发环境搭建、代码规范、PR 流程详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

提交 PR 前请确保:
- `cargo fmt` + `cargo clippy -- -D warnings` 通过
- `cargo test` 全部通过
- ESLint / TypeScript 严格模式无报错
- Commit message 遵循 Conventional Commits(`feat:` / `fix:` / `docs:` / `chore:` …)

---

## License

[MIT](LICENSE) © 2026 SGHUB Contributors
