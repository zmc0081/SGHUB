# SGHUB - AI 驱动的学术文献管理桌面应用

> 本文件是 Claude Code 的项目上下文,每次会话自动加载。
> 详细设计见 /docs 目录下的 PRD、架构方案与实施方案。
> 项目路径: D:\2-WORK\恒星\项目\学术文献管理系统\SG_Hub

## 产品定位

开源(MIT License)桌面客户端,面向科研工作者,提供:
1. 多源文献聚合检索(arXiv / PubMed / Semantic Scholar / OpenAlex)
2. 关键词订阅 + 定时本地推送(系统托盘通知)
3. 个人收藏夹(多级文件夹 + 标签 + 智能文件夹 + PDF 管理)
4. AI 文献解析(多 Skill 结构化精读,流式输出)
5. BYOK 多模型配置中心(Claude / GPT / DeepSeek / Ollama 本地)

## 技术栈

| 层级 | 技术 |
|------|------|
| 应用框架 | Tauri 2 (Rust backend + WebView frontend) |
| 前端 | React 18 + TypeScript 5 + Vite + TailwindCSS 3 |
| 状态管理 | Zustand |
| 路由 | TanStack Router |
| 国际化 | react-i18next |
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
| PDF 文本提取 | pdf-extract (Rust crate) |
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
│   ├── components/         # UI 组件
│   ├── pages/              # 路由页面
│   │   ├── Search.tsx      # 文献检索
│   │   ├── Feed.tsx        # 今日推送
│   │   ├── Library.tsx     # 收藏夹
│   │   ├── Parse.tsx       # AI 解析
│   │   ├── Models.tsx      # 模型配置
│   │   └── Settings.tsx    # 偏好设置
│   ├── stores/             # Zustand stores
│   ├── hooks/              # 自定义 hooks
│   ├── lib/                # 工具函数
│   │   └── tauri.ts        # Tauri invoke 封装
│   ├── i18n/               # i18n 配置
│   └── styles/             # 全局样式 + CSS 变量
├── src-tauri/              # Rust Core
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/       # Tauri 2 权限声明
│   ├── src/
│   │   ├── main.rs         # 入口
│   │   ├── lib.rs          # 模块注册
│   │   ├── db/             # SQLite + FTS5 + migration
│   │   ├── search/         # 多源并发检索
│   │   ├── library/        # 收藏夹 / 文件夹 / 标签
│   │   ├── ai_client/      # 统一 AI HTTP Client
│   │   │   ├── mod.rs
│   │   │   ├── openai.rs   # OpenAI 兼容 (GPT/DeepSeek/LM Studio)
│   │   │   ├── anthropic.rs # Claude Messages API
│   │   │   └── ollama.rs   # Ollama 本地
│   │   ├── skill_engine/   # Skill 模板加载与 Prompt 渲染
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
│   └── en-US.json
├── docs/                   # 设计文档 (Markdown)
└── .github/workflows/      # CI/CD
    ├── pr-check.yml
    └── release.yml
```

## 数据目录 (运行时, Windows)

```
%APPDATA%\sghub\                        # Windows: C:\Users\{用户名}\AppData\Roaming\sghub\
├── config.toml                          # 主配置
├── models.toml                          # 模型配置 (Key 存 Windows Credential Manager)
├── data\
│   ├── sghub.db                         # SQLite 主数据库
│   ├── pdfs\                            # 下载的 PDF
│   └── cache\                           # 检索缓存
├── skills\                              # 用户自定义 Skill YAML
├── backups\                             # 自动备份
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

## AI Client 设计要点

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
- `OpenAiCompatible`: POST /chat/completions (覆盖 OpenAI / DeepSeek / LM Studio / Azure)
- `AnthropicProvider`: POST /messages (Claude 专属 API)
- `OllamaProvider`: POST /api/chat (本地,无需 Key)

流式输出通过 Tauri Event 推送到前端:
```rust
app.emit("ai:token", TokenPayload { text, done: false })?;
```

## 关键约束

1. API Key 只存 Windows Credential Manager,永远不写明文文件,不写日志
2. 除用户主动触发的 AI API 和文献检索 API,不向任何第三方发数据
3. 安装包 < 100MB,内存 < 200MB,冷启动 < 3 秒
4. 所有依赖许可证必须兼容 MIT(禁止 GPL 传染)
5. Windows 10 21H2+ 和 macOS 12+ 必须支持
6. 路径处理必须跨平台兼容(Path / PathBuf,不硬编码分隔符)

## 开发环境

- 操作系统: Windows
- IDE: VS Code + Claude Code
- 项目路径: D:\2-WORK\恒星\项目\学术文献管理系统\SG_Hub
