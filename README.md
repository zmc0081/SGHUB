# SGHUB

> AI 驱动的学术文献管理桌面应用 — 多源聚合检索 / 关键词订阅 / AI 结构化精读 / BYOK 多模型
>
> **AI-powered academic literature manager for researchers.** Open source, local-first, BYOK.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Tauri 2](https://img.shields.io/badge/Tauri-2-24C8DB)
![React 18](https://img.shields.io/badge/React-18-61DAFB)
![Rust](https://img.shields.io/badge/Rust-stable-DE6233)

---

## 截图

> _截图占位 — 待 v0.2 出 release 后补上_

| 文献检索 | 收藏夹 | AI 解析 |
|---|---|---|
| ![search](docs/img/screenshot-search.png) | ![library](docs/img/screenshot-library.png) | ![parse](docs/img/screenshot-parse.png) |

## 功能

- 🔍 **多源聚合检索** — arXiv / PubMed / Semantic Scholar / OpenAlex 一次查全
- 📰 **关键词订阅** — 定时本地推送,系统托盘通知,无需后端服务器
- ⭐ **个人收藏夹** — 多级文件夹 + 标签 + 智能文件夹 + 本地 PDF 管理
- 🧠 **AI 结构化精读** — 多 Skill 模板,流式输出,方法论 / 创新点 / 引用网络
- 🤖 **BYOK 多模型** — Claude / GPT / DeepSeek / Ollama 本地,Key 存系统 Keychain
- 🔒 **完全本地** — SQLite + FTS5 全文索引,除你主动调的 AI / 检索 API 外不向第三方发数据

## 安装

### 下载预编译版本(推荐)

前往 [Releases](https://github.com/zmc0081/SGHUB/releases/latest):

- **Windows 10/11**: 下载 `SGHUB_x.y.z_x64-setup.exe`(NSIS 安装器)
- **macOS 12+**: 下载 `SGHUB_x.y.z_universal.dmg`(Intel & Apple Silicon 通用)

> macOS 首次运行可能提示"无法验证开发者",右键打开 → 允许即可。

### 从源码构建

见下文 [从源码构建](#从源码构建)。

## 模型配置(BYOK)

SGHUB 不内置任何 AI 服务,需要自带 Key。配置入口:**🤖 模型配置 → 添加模型**。

| 提供商 | Endpoint | 获取 Key |
|---|---|---|
| **Anthropic** | `https://api.anthropic.com` | <https://console.anthropic.com/> |
| **OpenAI** | `https://api.openai.com/v1` | <https://platform.openai.com/api-keys> |
| **DeepSeek** | `https://api.deepseek.com/v1` | <https://platform.deepseek.com/> |
| **Ollama (本地)** | `http://localhost:11434` | 无需 Key,先 `ollama pull llama3:8b` |
| **自定义 (OpenAI 兼容)** | 任意兼容 endpoint | LM Studio / Azure OpenAI / 自建网关均可 |

API Key **只存系统 Keychain**(Windows Credential Manager / macOS Keychain),
不写 toml、不写日志、不上传任何第三方。

## 从源码构建

### 前置依赖

| 依赖 | 版本 | Windows 安装 |
|---|---|---|
| Node.js | ≥ 18 | `winget install OpenJS.NodeJS.LTS` |
| Rust | stable | `winget install Rustlang.Rustup` 后 `rustup default stable` |
| MSVC Build Tools | 2022 | `winget install Microsoft.VisualStudio.2022.BuildTools` (勾选 Desktop development with C++) |
| Tauri CLI | 2.x | `cargo install tauri-cli --version "^2.0"` |

macOS 需要 Xcode Command Line Tools (`xcode-select --install`)。
Linux 需要 `libwebkit2gtk-4.1-dev` 等(详见 [CONTRIBUTING.md](CONTRIBUTING.md))。

### 构建步骤

```bash
git clone https://github.com/zmc0081/SGHUB.git
cd SGHUB

# 安装前端依赖
npm install

# 开发模式(热更新)
cargo tauri dev

# 生产构建
cargo tauri build
# 产物: src-tauri/target/release/bundle/{nsis,dmg,...}
```

## 数据目录

应用运行时数据存放位置:

- **Windows**: `%APPDATA%\com.sghub.app\` (= `C:\Users\<你>\AppData\Roaming\com.sghub.app\`)
- **macOS**: `~/Library/Application Support/com.sghub.app/`

```
com.sghub.app/
├── config.toml         # 主配置
├── models.toml         # 模型配置(API Key 存 Keychain,文件里只有引用)
├── data/
│   ├── sghub.db        # SQLite 主数据库
│   ├── pdfs/           # 下载的 PDF
│   └── cache/          # 检索缓存
├── skills/             # 用户自定义 Skill YAML
├── backups/            # 自动备份(保留 7 天)
└── logs/               # 应用日志
```

## 隐私与安全

- API Key 通过 [keyring-rs](https://github.com/hwchen/keyring-rs) 存入系统 Keychain,从不写明文文件。
- 除用户主动触发的 AI / 检索 API 调用外,应用不向任何第三方发送数据。
- SQLite 数据库本地存储,可随时备份或导出。

## 贡献

欢迎提 Issue / PR。开发环境搭建、代码规范、PR 流程详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## License

[MIT](LICENSE) © 2026 SGHUB Contributors
