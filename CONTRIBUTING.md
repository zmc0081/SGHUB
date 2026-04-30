# 贡献指南 / Contributing

感谢有兴趣为 SGHUB 贡献代码 🎉。本指南覆盖开发环境搭建、代码规范、PR 流程与 Commit 约定。

## 目录

- [开发环境搭建(Windows 优先)](#开发环境搭建windows-优先)
- [仓库结构速览](#仓库结构速览)
- [代码规范](#代码规范)
- [PR 流程](#pr-流程)
- [Commit 规范](#commit-规范)

---

## 开发环境搭建(Windows 优先)

### Windows 10/11

```powershell
# 1. Node.js (≥ 18)
winget install OpenJS.NodeJS.LTS

# 2. Rust 工具链
winget install Rustlang.Rustup
rustup default stable

# 3. MSVC Build Tools (Tauri 链接器需要)
winget install Microsoft.VisualStudio.2022.BuildTools `
  --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"

# 4. Tauri CLI
cargo install tauri-cli --version "^2.0"

# 5. (可选) WebView2 Runtime — Windows 11 自带,Win10 装一下
winget install Microsoft.EdgeWebView2Runtime
```

**新开终端**(刷新 PATH),验证:

```powershell
node --version    # 应 ≥ 18
rustc --version   # 应是 stable
cargo tauri --version
```

### macOS 12+

```bash
xcode-select --install                    # Apple 链接器 + 头文件
brew install node rustup
rustup-init -y && rustup default stable
cargo install tauri-cli --version "^2.0"
```

### Linux (Ubuntu 22.04+)

```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf \
  libxdo-dev \
  libssl-dev \
  build-essential curl wget file

curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install tauri-cli --version "^2.0"
```

### 启动开发服务器

```bash
git clone https://github.com/zmc0081/SGHUB.git
cd SGHUB
npm install
cargo tauri dev   # 首次约 1-2 分钟,后续秒级 HMR
```

## 仓库结构速览

```
.
├── src/                # React 前端 (TS)
│   ├── components/     # UI 组件
│   ├── pages/          # 路由页面
│   ├── lib/tauri.ts    # 所有 invoke 调用统一封装
│   ├── stores/         # Zustand stores
│   └── styles/         # 全局 CSS + 主题变量
├── src-tauri/          # Rust 后端
│   ├── src/
│   │   ├── db/         # SQLite + FTS5 + refinery migration
│   │   ├── search/     # 多源检索
│   │   ├── library/    # 收藏夹
│   │   ├── ai_client/  # 统一 AI HTTP Client
│   │   ├── config/     # TOML 配置
│   │   └── ...
│   └── migrations/     # SQL 迁移文件
├── skills/             # 内置 Skill YAML 模板
├── locales/            # i18n 语言包
└── docs/               # 设计文档
```

## 代码规范

### Rust

- 提交前必须通过 `cargo fmt` 与 `cargo clippy --all-targets -- -D warnings`。
- 错误处理:库代码用 `thiserror`,应用代码用 `anyhow`。
- Tauri Command 签名:`#[tauri::command] pub async fn xxx(...) -> Result<T, String>`。
- 异步:所有 I/O(DB / HTTP / 文件)用 `async fn`,在 tokio runtime 中执行。
- 日志:`tracing::info!()` / `tracing::error!()`,不要 `println!`。
- 路径:用 `std::path::PathBuf`,不要硬编码 `\` 或 `/`。

### TypeScript / React

- ESLint + Prettier,strict mode。
- 函数组件 + hooks,不用 class 组件。
- 简单状态用 `useState`,跨组件用 Zustand store。
- **所有 Tauri 调用走 `src/lib/tauri.ts`**,不要在组件里直接 `invoke()`。
- 样式:Tailwind utility class,主题色用 CSS 变量(`bg-app-bg` / `text-primary` 等),不写自定义 CSS。

### 通用

- 禁止把 `.env`、API Key、token 等提交进仓库。
- 依赖许可证必须 MIT 兼容(禁止 GPL/AGPL/LGPL 传染)。
- 改 schema 时新增 `src-tauri/migrations/V<n>__<desc>.sql`,**不要改历史 migration**。

## PR 流程

1. **Fork** 仓库,从 `develop` 切出 `feature/<short-desc>` 或 `fix/<short-desc>` 分支。
2. 改完后**本地自测**:
   ```bash
   cargo clippy --all-targets -- -D warnings
   cargo test --lib
   npm run build
   ```
3. 提交 PR 至 `develop` 分支(不直接对 `main`)。
4. PR 标题用 Conventional Commits 格式(见下),正文必须包含:
   - **影响范围**:改动了哪些模块
   - **测试方式**:你怎么验证的(手测路径 / 单元测试 / 截图)
   - **Breaking change**(如有)
5. 等待 CI 全绿(`pr-check.yml` 在 ubuntu / windows / macos 三平台跑 lint+build+test)。
6. Review 通过后由维护者 squash merge。

### 不要做的事

- 不要在 PR 里同时混入"重构"和"加功能"——拆成独立 PR。
- 不要 force push 已经在 review 的分支(rebase 时用 `git push --force-with-lease`)。
- 不要提交大于 1MB 的二进制(图片走 `docs/img/`,超大文件用 Git LFS)。

## Commit 规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**type** 取值:

| type | 用途 |
|---|---|
| `feat` | 新功能 |
| `fix` | 修 bug |
| `docs` | 仅文档改动 |
| `refactor` | 不改外部行为的重构 |
| `perf` | 性能优化 |
| `test` | 加 / 改测试 |
| `build` | 构建系统 / 依赖更新 |
| `ci` | CI 配置改动 |
| `chore` | 杂项(发版、配置等) |

**scope** 可选,常用:`db` / `search` / `library` / `ai-client` / `ui` / `i18n` / `tauri`。

### 例子

```
feat(search): add arXiv adapter with rate limit

实现 arXiv Atom XML 解析器,接入 search_papers command。
- 1 request/3s 节流(arXiv 政策)
- 错误重试 3 次,指数退避
- 单元测试覆盖 4 种异常 response

Closes #42
```

```
fix(db): handle FTS5 trigger panic on empty abstract

旧版触发器在 abstract IS NULL 时插入空字符串,导致 FTS 索引污染。
改为先 COALESCE 再插入。
```

---

有问题先开 [Discussion](https://github.com/zmc0081/SGHUB/discussions) 而不是 Issue,
节奏稳一点 ☕。
