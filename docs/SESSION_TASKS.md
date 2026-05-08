# SGHUB 开发 Session 任务清单

> 项目路径: D:\2-WORK\恒星\项目\学术文献管理系统\SG_Hub
> 使用方式: 每个 Session 对应一次 Claude Code 会话。
> 在 Claude Desktop App 的 Code 模式下,底部点击 "Select folder..." 选择项目目录,
> 然后将 Session 的 Prompt 粘贴到输入框执行。
> 每个 Session 完成后在 VS Code 终端里 `git add . && git commit && git push`,再进入下一个。

> Session 1-12: V2.0.0 工程骨架 + 核心功能 + AI 解析(基线版本,17 周)
> Session 13-18: V2.0.1 增量迭代(Chat / Skill 编辑 / 跨模块跳转 / 文献上传,4 周)

---

## 准备阶段 (在开始 Session 之前)

### 前置条件
- [ ] Claude Desktop App 已安装,Code 模式可用
- [ ] Node.js 已安装 (≥ 18.x): 打开 cmd 运行 `node --version` 确认
- [ ] Rust 已安装: `rustc --version` 确认 (若未安装访问 https://rustup.rs)
- [ ] VS Code 已安装 (用于查看和编辑代码)
- [ ] Git 已安装: `git --version` 确认
- [ ] 项目目录已创建: D:\2-WORK\恒星\项目\学术文献管理系统\SG_Hub
- [ ] CLAUDE.md 已放到项目根目录
- [ ] docs\ 和 skills\ 目录及文件已放到项目根目录
- [ ] 在项目目录下执行 `git init`

### Claude Desktop Code 模式使用方式
1. 打开 Claude Desktop App → 顶部切换到 "Code" 标签
2. 底部点击 "Select folder..." → 选择 D:\2-WORK\恒星\项目\学术文献管理系统\SG_Hub
3. 在输入框粘贴 Session 的 Prompt → 回车
4. Claude 会读取 CLAUDE.md 了解项目背景,然后生成代码
5. 文件修改会自动应用,底部 "Accept edits" 可以确认
6. 完成后在 VS Code 终端里验证和提交

---

## M1 · 工程骨架 (Week 1-2)

### Session 1: Tauri 2 项目初始化

粘贴以下内容到 Claude Code 输入框:

```
读取 CLAUDE.md 了解项目背景。然后帮我在当前目录初始化一个 Tauri 2 项目。要求:

1. 前端: React 18 + TypeScript 5 + Vite + TailwindCSS 3
2. 安装前端依赖: zustand, @tanstack/react-router, react-i18next, i18next
3. Rust 侧 Cargo.toml 添加依赖: 
   - tauri 2.x (features: tray-icon, devtools)
   - tauri-plugin-notification
   - tauri-plugin-shell
   - tauri-plugin-fs
   - tauri-plugin-dialog
   - tokio (features: full)
   - serde, serde_json (features: derive)
   - rusqlite (features: bundled)
   - r2d2, r2d2_sqlite
   - anyhow, thiserror
   - reqwest (features: json, stream, rustls-tls)
   - keyring = "3"
   - tracing, tracing-subscriber
   - toml (for config parsing)
   - uuid (features: v7)
   - chrono
4. tauri.conf.json 配置:
   - identifier: "com.sghub.app"
   - productName: "SGHUB"
   - 窗口: 1200x800, 最小 900x600, 标题 "SGHUB"
   - 启用 tray icon
5. 确保 `cargo tauri dev` 能成功启动并显示 React 页面

参考 CLAUDE.md 中的仓库结构组织文件。这是 Windows 开发环境。
```

Session 1 完成后验证:
```cmd
cd D:\2-WORK\恒星\项目\学术文献管理系统\SG_Hub
cargo tauri dev
```
看到窗口弹出即成功。然后:
```cmd
git add .
git commit -m "feat: session 1 - tauri 2 project initialization"
git push
```

---

### Session 2: SQLite 数据库模块

```
读取 CLAUDE.md 和 docs/data-model.sql,然后实现 Rust 侧的 db 模块。要求:

1. 用 refinery crate 管理 migration,把 docs/data-model.sql 中的内容作为 V001__initial_schema.sql 放到 src-tauri/migrations/ 目录
2. 实现 src-tauri/src/db/mod.rs:
   - init() 函数: 创建数据库目录和文件,开启 WAL 模式,创建 r2d2 连接池(pool_size=4),自动执行 migration
   - 数据库路径通过 Tauri 的 app.path().app_data_dir() 获取,拼接 data/sghub.db
3. 在 Tauri setup hook 中调用 db::init(),把连接池存入 Tauri State
4. 创建一个测试用的 Tauri Command: get_db_status() 返回表数量和记录数
5. 写单元测试: 验证表创建成功、FTS5 全文搜索可用
6. 运行 cargo test 确保全部通过

这是 Windows 环境,路径用 PathBuf 拼接,不要硬编码分隔符。
```

验证: `cargo test` 全部通过 → `git commit -m "feat: session 2 - sqlite database module"`

---

### Session 3: 基础 UI 布局

```
读取 CLAUDE.md,然后创建 SGHUB 的桌面应用基础布局。要求:

1. 自定义标题栏组件 (src/components/Titlebar.tsx):
   - 左侧: 应用图标区域 (预留)
   - 中间: "SGHUB" 文字
   - 右侧: 最小化/最大化/关闭按钮 (调用 Tauri window API)
   - 整个标题栏支持 data-tauri-drag-region 拖拽

2. 侧边栏组件 (src/components/Sidebar.tsx):
   - 顶部 Logo: "SGHUB" 品牌文字 + 版本号 v2.0.0
   - 导航菜单项 (带图标):
     🔍 文献检索
     📰 今日推送 (带未读计数徽章)
     ⭐ 收藏夹
     🧠 AI 解析
     🤖 模型配置
     ⚙️ 设置
   - 高亮当前选中项 (金色左边框 + 背景)

3. 主布局 (src/App.tsx):
   - 标题栏(固定顶部 36px)
   - 侧栏(220px, 深色背景 #1A1F2E) + 主内容区(flex-1, 浅色背景 #F8F6F1)

4. TanStack Router 配置 6 个路由,每个页面先用占位文字

5. TailwindCSS 主题配置:
   - CSS 变量: --primary: #1F3864, --accent: #D4A017, --bg: #F8F6F1
   - 侧栏: 深色(#1A1F2E),文字浅色(#C8C8D0),选中项金色高亮
   - 支持亮色/暗色主题切换 (先实现亮色)

6. 确保 cargo tauri dev 能看到完整的桌面应用布局
```

验证: `cargo tauri dev` 看到漂亮的桌面布局 → `git commit -m "feat: session 3 - desktop ui layout"`

---

### Session 4: Tauri IPC 骨架

```
读取 CLAUDE.md,搭建前后端 IPC 通信骨架。要求:

Rust 侧 (src-tauri/src/):
1. 在各模块目录下创建以下 Tauri Command (先返回 mock 数据):
   - config/: get_app_config() -> AppConfig, save_app_config(config) -> ()
   - search/: search_papers(query, source, limit) -> Vec<Paper>
   - library/: get_folders() -> Vec<Folder>, get_papers_by_folder(folder_id) -> Vec<Paper>
   - ai_client/: get_model_configs() -> Vec<ModelConfig>, test_model_connection(model_id) -> TestResult
2. 定义对应的 struct (Paper, Folder, ModelConfig, AppConfig, TestResult),全部 derive Serialize + Deserialize
3. Paper struct 字段参考 docs/data-model.sql 中 papers 表
4. mock 数据要看起来真实 (用真实的论文标题和作者)
5. 在 main.rs 中注册所有 Command

前端侧 (src/):
6. 创建 src/lib/tauri.ts:
   - 封装每个 invoke 调用为 async 函数,带 TypeScript 类型
   - 类型定义与 Rust struct 保持一致
7. 每个页面调用对应 API 并展示 mock 数据:
   - Search.tsx: 调用 search_papers 展示论文列表
   - Library.tsx: 调用 get_folders 展示文件夹树
   - Models.tsx: 调用 get_model_configs 展示模型列表
   - Settings.tsx: 调用 get_app_config 展示设置

8. 确保 cargo tauri dev 启动后,所有页面能显示 mock 数据
```

验证: 点击侧栏各页面都能看到数据 → `git commit -m "feat: session 4 - tauri ipc scaffolding"`

---

### Session 5: GitHub Actions CI

```
为项目创建 GitHub Actions 工作流和开源基础文件。

1. .github/workflows/pr-check.yml (每次 PR 触发):
   - Lint: cargo clippy -- -D warnings + npx eslint src/
   - Build: cargo build + npm run build
   - Test: cargo test
   - 矩阵: ubuntu-latest + windows-latest + macos-latest

2. .github/workflows/release.yml (push tag v*.*.* 触发):
   - 使用 tauri-apps/tauri-action@v0
   - 构建: Windows x64 NSIS + macOS Universal DMG
   - 自动创建 GitHub Release 并上传安装包

3. 创建基础文件:
   - LICENSE (MIT License, 年份 2026)
   - README.md: 项目简介 + 功能截图占位 + 安装说明 + 从源码构建 + 模型配置教程 + 贡献指南链接
   - CONTRIBUTING.md: 开发环境搭建(Windows 优先) + 代码规范 + PR 流程 + Commit 规范
   - .gitignore: Node + Rust + Tauri + IDE 文件

4. 确保所有文件语法正确
```

验证: 文件都创建好 → `git commit -m "chore: session 5 - ci/cd and open source files"`

---

## M2 · 核心功能 Alpha (Week 3-8)

### Session 6: arXiv + Semantic Scholar 检索

```
读取 CLAUDE.md,实现 search 模块的前两个数据源。

Rust 侧 (src-tauri/src/search/):
1. 创建 arxiv.rs:
   - 通过 Atom RSS API 检索: GET http://export.arxiv.org/api/query?search_query={query}&max_results={limit}
   - 用 quick-xml 或 roxmltree 解析 XML 响应
   - 提取: title, authors(多个), abstract(summary), arxiv_id, published, pdf链接
   - 返回 Vec<Paper>
2. 创建 semantic_scholar.rs:
   - Academic Graph API: GET https://api.semanticscholar.org/graph/v1/paper/search?query={query}&limit={limit}&fields=title,authors,abstract,externalIds,url,year
   - JSON 响应,用 serde 解析
3. 创建 mod.rs:
   - search_all(query, sources, limit) 函数
   - tokio::join! 并发请求两个源,每源超时 10 秒,超时单源降级不影响其他
   - DOI 精确去重 + 标题 lowercase 去重
   - 结果写入 SQLite papers 表 + 触发 FTS5 索引更新
4. 更新 search_papers Tauri Command 为真实实现

前端侧 (src/pages/Search.tsx):
5. 完整的检索页面:
   - 顶部: 搜索框(支持回车) + 数据源下拉(全部/arXiv/Semantic Scholar) + 搜索按钮
   - 过滤栏: 时间范围(7天/30天/1年/不限) + 排序(相关性/最新/引用)
   - 结果: 论文卡片列表
     - 来源标签(arXiv红色/Semantic Scholar蓝色)
     - 标题(可点击) + 作者 + 摘要(3行截断)
     - 按钮: ⭐收藏 / 🧠AI精读 / 📄原文 / 📥下载PDF
   - 状态: loading动画 / 结果计数 / 搜索耗时
6. 搜索结果使用虚拟列表 (如果结果多于100条)

运行 cargo test 验证检索 + 入库 + FTS5 查询。
```

---

### Session 7: PubMed + OpenAlex 检索

```
为 search 模块补充 PubMed 和 OpenAlex 两个数据源。

Rust 侧:
1. 创建 pubmed.rs:
   - E-utilities: 先 esearch.fcgi 获取 ID 列表,再 efetch.fcgi 获取详情
   - 解析 XML,提取 title, authors, abstract, doi, pubmed_id
2. 创建 openalex.rs:
   - REST API: GET https://api.openalex.org/works?search={query}&per_page={limit}
   - JSON 响应,注意 abstract_inverted_index 需要反转重建
3. 更新 mod.rs:
   - 4 源 tokio::join! 并发
   - 去重逻辑扩展覆盖所有源
4. 前端: 数据源下拉新增 PubMed / OpenAlex 选项,来源标签新增颜色

cargo test 验证 4 源检索均正常。
```

---

### Session 8: 模型配置中心

```
读取 CLAUDE.md,实现模型配置中心 (F5)。

Rust 侧:
1. 实现 model_configs 的完整 CRUD Tauri Commands:
   - add_model_config, update_model_config, delete_model_config
   - get_model_configs, set_default_model
2. keychain 模块 (src-tauri/src/keychain/):
   - set_api_key(model_id, key): 存入 Windows Credential Manager
   - get_api_key(model_id): 读取
   - delete_api_key(model_id): 删除
   - 使用 keyring crate, service name: "sghub"
3. test_model_connection Command:
   - OpenAI 兼容: POST /chat/completions {"model":"...", "messages":[{"role":"user","content":"Hi"}], "max_tokens":5}
   - Anthropic: POST /messages {"model":"...", "messages":[{"role":"user","content":"Hi"}], "max_tokens":5}
   - Ollama: GET /api/tags 检查服务运行
   - 返回: 状态(ok/error) + 延迟(ms) + 错误信息
4. 内置 4 个预设模板 (Claude Opus/GPT-5/DeepSeek V3/Ollama Llama3)

前端 (src/pages/Models.tsx):
5. 完整页面:
   - 用量统计: 4格卡片(已配置模型数/本月调用/Token消耗/预估成本)
   - 模型列表: 每个模型一行(图标+名称+endpoint+状态+默认标记+操作按钮)
   - 操作: 编辑/测试连接(显示延迟)/设为默认/删除
   - 添加新模型: 展开表单(名称/Provider下拉/Endpoint/Model ID/API Key/Max Token)
   - Key 输入: type="password", 显示 "🔒 Windows Credential Manager 加密存储"
   - 测试按钮: 点击后显示 loading → 成功(绿色✅+延迟) / 失败(红色❌+错误)
```

---

### Session 9: 收藏夹系统

```
读取 CLAUDE.md 和 docs/data-model.sql,实现收藏夹系统。

Rust 侧 (src-tauri/src/library/):
1. folders CRUD: create_folder, rename_folder, move_folder, delete_folder, reorder_folders
2. 收藏操作: add_to_folder, remove_from_folder, move_paper_to_folder
3. 标签: create_tag, delete_tag, add_tag_to_paper, remove_tag_from_paper
4. 查询: get_folder_tree (递归构建完整树), get_papers_by_folder (分页), get_papers_by_tag
5. 批量操作: batch_add_to_folder, batch_tag
6. 更新 paper 阅读状态: set_read_status(paper_id, status)

前端 (src/pages/Library.tsx):
7. 左侧面板:
   - 文件夹树(缩进,计数徽章,📁图标)
   - 底部: 标签云(彩色小标签)
   - 新建文件夹按钮
8. 右侧:
   - 顶部: 文件夹名 + 文献计数 + 搜索框 + 状态过滤 + 导出BibTeX按钮
   - 文献列表: 阅读状态颜色条(未读灰/在读黄/已读绿) + 标题 + 作者 + 来源 + 操作按钮
   - 操作: 移动到.../AI精读/打开PDF/标签
9. 安装 @dnd-kit/core,支持将文献卡片拖入左侧文件夹
```

---

## M3 · AI 解析与推送 (Week 9-12)

### Session 10: AI Client 统一层

```
读取 CLAUDE.md 中的 AI Client 设计要点,实现 ai_client 模块。

1. 定义 trait AiProvider (参考 CLAUDE.md)
2. 实现 OpenAiCompatible (src-tauri/src/ai_client/openai.rs):
   - POST /chat/completions, stream: true
   - SSE 解析: 逐行读 "data: " 前缀, 解析 JSON 取 choices[0].delta.content
   - 覆盖: OpenAI / DeepSeek / LM Studio / Azure / 任意兼容 API
3. 实现 AnthropicProvider (anthropic.rs):
   - POST /messages, stream: true
   - SSE: event: content_block_delta → data.delta.text
   - 注意 Anthropic 需要 anthropic-version header
4. 实现 OllamaProvider (ollama.rs):
   - POST /api/chat, stream: true
   - NDJSON: 每行一个 JSON {"message":{"content":"..."}, "done": false}
5. mod.rs 路由: 根据 ModelConfig.provider 分发
6. 流式输出: app.emit("ai:token", TokenPayload { text, done })
7. 每次调用前从 keychain 取 Key,用完释放
8. 错误处理: 超时(30s)/401未授权/429限流/网络错误,各给明确提示
9. Token 计数写入 usage_stats 表

写单元测试 mock HTTP 验证三种 Provider 的 SSE/NDJSON 解析。
```

---

### Session 11: Skill 引擎 + AI 解析页

```
读取 CLAUDE.md 和 skills/general_read.yaml,实现 Skill 引擎和 AI 解析页面。

Rust 侧:
1. skill_engine 模块:
   - 加载内置 Skill: 编译时用 include_str! 嵌入 skills/*.yaml
   - 加载自定义 Skill: 运行时扫描 {app_data_dir}/skills/*.yaml
   - Prompt 渲染: 替换 {{title}}, {{authors}}, {{abstract}}, {{full_text}}, {{language}}
   - get_skills() Command 返回所有可用 Skill
2. pdf_extract 模块: pdf-extract crate 从本地 PDF 提取纯文本
3. start_parse Command:
   - 参数: paper_id, skill_name, model_config_id
   - 流程: 读 PDF → 提取文本 → 加载 Skill → 渲染 Prompt → 调 ai_client → 逐 token emit → 存结果
4. get_parse_history(paper_id) 返回历史解析

前端 (src/pages/Parse.tsx):
5. 配置区: 选择文献(下拉) + Skill(卡片选择) + 模型(下拉,显示默认) → 开始解析按钮
6. 结果区: 双栏,按 Skill 定义的 output_dimensions 分块显示
7. 流式渲染: 监听 Tauri event "ai:token",逐字追加,打字机效果
8. 底部状态栏: Token in/out · 耗时 · 预估成本
9. 侧栏: 解析历史列表
```

---

### Session 12: 定时订阅推送

```
实现关键词订阅与定时推送。

Rust 侧:
1. subscriptions CRUD Commands: create/update/delete/toggle_active
2. scheduler 模块:
   - tokio-cron-scheduler 定时任务
   - 读 config.toml 中的推送时间配置
   - 逻辑: 遍历活跃订阅 → 调 search → 与已推送去重 → 写 notifications
3. notify 模块:
   - tauri-plugin-notification 发送系统通知
   - 标题: "SGHUB: 发现 N 篇新文献"
   - 点击通知打开应用跳转到推送页
4. 离线: 无网络跳过,下次联网补查
5. Commands: get_notifications, mark_read, get_subscription_results

前端:
6. Feed.tsx: 今日推送列表 (按订阅分组) + 每篇可收藏/精读
7. 侧栏: 订阅列表 + 创建/编辑订阅弹窗
8. 未读徽章实时更新
```

---

## M2.0.1 · 增量迭代:Chat / Skill 编辑 / 跨模块 (Week 18-21)

> V2.0.1 在 V2.0.0 已发布、用户可用的基础上做增量。
> 配套文档:PRD V2.0.1 / 架构方案 V2.0.1 / 架构图 V2.0.1 / 实施方案 V2.0.1。
> 推荐放到 docs/ 目录:让 Claude Code 在执行 Session 时能 @ 引用。

### 在开始 Session 13 之前

把 V2.0.1 的设计文档放到 docs/ 目录:
```
docs/
├── PRD_V2.0.1.md          (从 PRD V2.0.1 docx 转 markdown,可选)
├── architecture-v201.md   (从架构方案 V2.0.1 转 markdown,可选)
└── data-model-v201.sql    (V002 migration 内容,详见下方 Session 13)
```

**重要**: 在 Session 13 开始前,新建 feature 分支:
```cmd
cd D:\2-WORK\恒星\项目\学术文献管理系统\SG_Hub
git checkout -b feature/v2.0.1
```
所有 V2.0.1 的 Session 都在这个分支上做,M2.0.1 完成后再合并到 main 发布。

---

### Session 13: V002 数据库迁移

```
读取 CLAUDE.md。本次任务为 V2.0.1 数据库迁移,新增 Chat 相关表并扩展 papers 表。

Rust 侧:
1. 创建 src-tauri/migrations/V002__chat_and_local_papers.sql,包含:
   
   -- Chat 会话表
   CREATE TABLE IF NOT EXISTS chat_sessions (
     id TEXT PRIMARY KEY,
     title TEXT NOT NULL DEFAULT '新对话',
     model_config_id TEXT,                     -- 当前会话默认模型
     system_prompt TEXT,                        -- Skill 注入的系统提示
     skill_name TEXT,                           -- 引用的 Skill (可空)
     pinned INTEGER NOT NULL DEFAULT 0,         -- 置顶标记
     created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
     updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
     deleted_at TEXT,
     FOREIGN KEY (model_config_id) REFERENCES model_configs(id) ON DELETE SET NULL
   );
   CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at DESC);
   CREATE INDEX IF NOT EXISTS idx_chat_sessions_pinned ON chat_sessions(pinned, updated_at DESC);
   
   -- Chat 消息表
   CREATE TABLE IF NOT EXISTS chat_messages (
     id TEXT PRIMARY KEY,
     session_id TEXT NOT NULL,
     role TEXT NOT NULL,                        -- 'user' | 'assistant' | 'system'
     content TEXT NOT NULL,
     attachments_json TEXT,                     -- JSON 数组,引用 chat_attachments
     tokens_in INTEGER NOT NULL DEFAULT 0,
     tokens_out INTEGER NOT NULL DEFAULT 0,
     model_name TEXT,                           -- 该消息实际使用的模型
     created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
     FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
   );
   CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);
   
   -- Chat 附件表
   CREATE TABLE IF NOT EXISTS chat_attachments (
     id TEXT PRIMARY KEY,
     session_id TEXT NOT NULL,
     message_id TEXT,                           -- 可空,允许预上传
     type TEXT NOT NULL,                        -- 'pdf' | 'docx' | 'md' | 'txt' | 'image' | 'url'
     file_name TEXT NOT NULL,
     file_path TEXT,                            -- 本地存储路径
     file_size INTEGER,
     extracted_text TEXT,                       -- 提取的文本内容
     paper_id TEXT,                             -- 若引用自收藏文献
     created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
     FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
     FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
     FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE SET NULL
   );
   CREATE INDEX IF NOT EXISTS idx_chat_attach_session ON chat_attachments(session_id);
   
   -- 扩展 papers 表
   ALTER TABLE papers ADD COLUMN uploaded_at TEXT;
   
   -- 扩展 ai_parse_results.skill_name 长度(SQLite 不支持直接修改列长度,
   -- 但 SQLite 的 TEXT 没有长度限制,实际无需修改;通过文档约定即可)

2. 修改 src-tauri/src/db/mod.rs:
   - 在 init() 之前先备份当前数据库到 sghub.db.bak.{timestamp},仅当检测到 V001 → V002 升级时
   - 确保 refinery 自动检测并执行 V002

3. 写迁移测试:
   - 测试用例 1: 从空库 → V001 → V002,验证所有表创建成功
   - 测试用例 2: 模拟 V001 数据(papers 表插入 10 条),升级到 V002 后数据完整保留 + uploaded_at 列存在
   - 测试用例 3: chat 三表的外键级联删除正确生效

4. 同步把这份 SQL 复制到 docs/data-model-v201.sql,便于后续 Session 引用

确保 cargo test 全部通过。
```

验证: 
```cmd
cargo test db::
```
全部通过 → `git commit -m "feat: session 13 - v002 migration with chat tables"`

---

### Session 14: Skill 上传与校验

```
读取 CLAUDE.md 和 skills/general_read.yaml。本次任务实现 Skill 上传与校验功能。

Rust 侧 (src-tauri/src/skill_engine/):
1. 在已有的 mod.rs 基础上新增 uploader.rs:
   - 定义 SkillSpec struct(对应 YAML 结构),含 name / display_name / description / 
     prompt_template / output_dimensions / recommended_models / author / version
   - validate_skill(spec: &SkillSpec) -> Result<(), Vec<String>>:校验所有必填字段
     * name 不为空且为合法标识符 (r"^[a-z][a-z0-9_-]*$")
     * prompt_template 必须包含至少一个变量占位符
     * 用 Tera 或 minijinja 渲染一次假数据测试模板有效性(假数据: title="Test", full_text="Lorem ipsum", language="zh-CN")
     * output_dimensions 至少 1 个,每个 dimension 必须有 key + title;key 在同一 Skill 内唯一
     * 校验失败时返回详细的错误列表(每条含字段名 + 错误描述)

2. 添加 dependencies:
   - serde_yaml = "0.9"
   - zip = "0.6"
   - tera = "1" (或 minijinja)

3. 新增 Tauri Commands:
   - upload_skill_file(content: String, filename: String) -> Result<SkillSpec, Vec<String>>:
     * 解析 YAML
     * 调用 validate_skill
     * 检查 name 不与已有内置/自定义 Skill 重名
     * 通过后写入 {app_data_dir}/skills/{name}.yaml
     * emit Tauri event "skills:updated"
     * 返回解析后的 SkillSpec
   - upload_skill_zip(zip_bytes: Vec<u8>) -> Result<Vec<SkillUploadResult>, String>:
     * 解压 zip,逐个 yaml 文件调用 upload_skill_file 逻辑
     * 返回每个文件的上传结果(成功/失败 + 错误信息)
   - delete_custom_skill(name: String) -> Result<(), String>:
     * 仅允许删除自定义 Skill(is_builtin = false)
     * 删除文件并 emit event

4. 修改 get_skills() Command:
   - 返回 Vec<SkillSummary> { name, display_name, description, is_builtin, recommended_models }
   - 自定义 Skill 与内置 Skill 通过文件位置区分(skills/ 是内置,{app_data_dir}/skills/ 是自定义)

前端 (src/pages/Skills.tsx 新建):
5. Skill 列表页:
   - 顶部:面包屑 + "上传 Skill" 按钮 + "新建 Skill" 按钮(Session 15 实现)
   - 内置 Skill 分组展示(灰色背景,标记"内置")
   - 自定义 Skill 分组展示(白色背景,有"编辑"/"删除"按钮)
   - 每个 Skill 卡片:icon + name + description + 推荐模型徽章

6. 上传交互:
   - 点击"上传 Skill"按钮 → tauri-plugin-dialog 打开文件选择(.yaml 或 .zip)
   - 读取文件 → 调用 invoke('upload_skill_file', { content, filename })
   - 校验失败:Toast 显示具体错误信息(每条单独一行,带行号)
   - 成功:Toast "Skill {display_name} 已上传",列表自动刷新

7. 在侧边栏添加 Skill 入口:
   - 在 "AI 解析" 下方添加 "✨ Skill 管理" 菜单项,路由到 /skills

8. 写测试:
   - upload_skill_file 各种校验场景(缺字段 / 语法错误 / name 重复 / prompt 渲染失败)
   - upload_skill_zip 多文件混合(成功 + 失败)
   - delete_custom_skill 不能删除内置

确保 cargo test 与 npm test (如有) 全部通过。
```

验证: 
- 自己写一个测试 yaml(参考 skills/general_read.yaml,改 name 即可) 上传 → 出现在自定义列表
- AI 解析页的 Skill 下拉中能看到刚上传的 Skill
- `git commit -m "feat: session 14 - skill upload and validation"`

---

### Session 15: Skill 在线编辑器

```
读取 CLAUDE.md。本次任务实现基于 Monaco Editor 的 Skill 在线编辑器。

前端依赖:
1. npm install @monaco-editor/react js-yaml
2. npm install --save-dev @types/js-yaml

Rust 侧补充 (src-tauri/src/skill_engine/):
3. 新增 Tauri Commands:
   - save_skill(yaml_content: String, original_name: Option<String>) -> Result<SkillSpec, Vec<String>>:
     * 解析 + 校验 YAML
     * 若 original_name 非空且为内置 Skill,自动给新 Skill 的 name 追加 -custom 后缀
     * 写入 {app_data_dir}/skills/{name}.yaml
     * emit "skills:updated"
   - test_skill_with_paper(yaml_content: String, paper_id: String, model_config_id: String) -> Result<TestResult, String>:
     * 不写入文件,直接用临时 Skill 对一篇文献执行解析
     * max_tokens 限制为 1500,避免过度消耗
     * 流式输出通过 emit "skill_test:token" 推送
     * 返回完整结果
   - export_skill(name: String) -> Result<String, String>:
     * 读取 yaml 文件原始内容返回(让前端触发下载)
   - get_skill_yaml(name: String) -> Result<String, String>:
     * 读取并返回 yaml 文本(给编辑器加载用)

前端 (src/components/SkillEditor.tsx 新建):
4. 三栏布局:
   - 左侧 280px: 表单(name / display_name / description / icon / category / 推荐模型多选)
   - 中间 flex-1: Monaco YAML 编辑器(最小 600px 宽)
   - 右侧 360px: 实时预览面板(切换 Tab: "渲染后的 Prompt" / "测试运行结果")

5. Monaco 编辑器配置:
   - language: "yaml"
   - theme: 跟随应用主题(亮色用 "vs",暗色用 "vs-dark")
   - 字体: JetBrains Mono 13px
   - 关键功能:
     * 输入 {{ 时自动弹出变量补全列表(title, authors, abstract, full_text, language)
     * YAML 语法错误实时高亮(用 js-yaml 解析,失败时显示行号)
     * 保存快捷键 Ctrl+S(Win) / Cmd+S(Mac)
     * 自动格式化按钮

6. 表单与 YAML 双向同步:
   - 表单字段修改 → 用 js-yaml 解析当前 YAML,修改对应字段,再 dump 回去
   - YAML 编辑 → 解析成功时,把字段值同步回表单
   - 同步采用防抖(300ms)避免频繁解析

7. 实时预览面板:
   - "渲染后的 Prompt" Tab:
     * 顶部:示例文献下拉(从 papers 表选,默认选第一个)
     * 下方:渲染后的完整 Prompt 文本(Markdown 渲染)
     * Token 计数预估
   - "测试运行结果" Tab:
     * 顶部:模型下拉 + "运行测试" 按钮
     * 下方:流式输出的解析结果,按 output_dimensions 分块显示

8. 入口与路由:
   - /skills/new:新建 Skill(空 YAML 模板)
   - /skills/:name/edit:编辑现有 Skill(自定义)
   - /skills/:name/copy:基于内置 Skill 复制后编辑(自动追加 -custom 后缀)
   - 在 Session 14 的 Skills.tsx 中,内置 Skill 卡片显示"复制并编辑"按钮,自定义 Skill 显示"编辑"按钮

9. 保存逻辑:
   - 顶部固定栏:返回按钮 + Skill 名称 + "测试 Skill" + "另存为新 Skill" + "保存" 按钮
   - 保存时再次校验,失败给出明确错误
   - 保存成功后 Toast 提示并跳转回 Skills 列表

10. 防丢失:
    - 编辑过程中每 30 秒自动保存到 localStorage(key: skill-draft-{name})
    - 离开页面前若有未保存修改,弹确认对话框

确保 cargo build + npm run build 都通过。手动测试核心流程。
```

验证:
- 复制内置 Skill "通用精读" → 编辑 prompt 模板 → 保存为新 Skill → AI 解析中可选择
- 测试运行能流式看到结果
- `git commit -m "feat: session 15 - skill online editor with monaco"`

---

### Session 16: Chat 模块 Alpha

```
读取 CLAUDE.md 和 docs/architecture-v201.md(若已转 markdown,否则参考第二章 Chat 模块设计)。
本次任务实现 Chat 模块端到端 MVP,这是 V2.0.1 最大的新功能。

前端依赖:
1. npm install react-markdown remark-gfm rehype-highlight react-syntax-highlighter
2. npm install --save-dev @types/react-syntax-highlighter

Rust 侧 (src-tauri/src/chat/ 新建模块目录):
3. 模块文件结构:
   chat/
   ├── mod.rs          # 入口与 Tauri Command 注册
   ├── session.rs      # 会话 CRUD
   ├── message.rs      # 消息持久化
   ├── context.rs      # 上下文构建与 token 截断
   ├── attachment.rs   # 附件处理
   └── streaming.rs    # 流式输出协调

4. session.rs - 会话管理 Tauri Commands:
   - create_chat_session(title: Option<String>, model_config_id: Option<String>) -> ChatSession
   - list_chat_sessions(limit: Option<i64>) -> Vec<ChatSessionSummary>
     * 返回字段:id, title, last_message_preview, message_count, pinned, updated_at
     * 默认按 (pinned DESC, updated_at DESC) 排序
   - delete_chat_session(id: String) -> ()
   - rename_chat_session(id: String, title: String) -> ()
   - pin_chat_session(id: String, pinned: bool) -> ()
   - get_session_detail(id: String) -> ChatSessionDetail (含全部消息)

5. message.rs:
   - append_message(session_id, role, content, attachments_json, tokens_in, tokens_out, model_name) -> ChatMessage
   - get_messages_by_session(session_id, limit, before_id) -> Vec<ChatMessage>
   - update_message_content(message_id, content) -> () (用于流式输出最终保存)

6. context.rs:
   - build_messages_for_api(session_id: &str, skill_name: Option<&str>, current_input: &str, attachments: Vec<Attachment>) -> Vec<ApiMessage>:
     a. 加载历史消息(按 created_at 升序)
     b. 若有 skill_name,加载 Skill 的 prompt_template 作为 system prompt
     c. 处理附件:每个附件的 extracted_text 拼接到 current_input 前面,以 markdown 引用块形式
     d. Token 截断:用 tiktoken-rs 估算总 token,超过 model.max_tokens * 0.8 时,从最早的非 system 消息开始 LRU 删除
     e. 返回 Vec<ApiMessage> { role, content }

7. attachment.rs:
   - upload_chat_attachment(session_id: String, file_path: String) -> ChatAttachment:
     * 复制文件到 {app_data_dir}/data/chat_attachments/{session_id}/{uuid}.{ext}
     * 根据扩展名分发到不同提取逻辑:
       - .pdf → pdf_extract::extract_text
       - .md / .txt → 直接读取
       - .docx → mammoth-rs(可选,缺失则提示用户先转 PDF)
       - .png / .jpg → base64 编码(留给 vision 模型用)
     * 写入 chat_attachments 表,返回结构体
   - reference_paper_as_attachment(session_id, paper_id) -> ChatAttachment:
     * 从 papers 表读取标题/作者/摘要,可选读取 PDF 全文(基于偏好设置)
     * 创建 chat_attachments 记录,paper_id 字段非空,type = 'paper_ref'

8. streaming.rs:
   - send_chat_message Command(核心):
     参数: { session_id: String, content: String, attachments: Vec<String>, skill_name: Option<String>, model_config_id: Option<String> }
     流程:
     a. 若 session_id 为空,先 create_chat_session
     b. append_message(role='user', content, attachments_json)
     c. 调用 context::build_messages_for_api 构建上下文
     d. 调用 ai_client::chat_stream 启动流式请求
     e. 创建一个空的 assistant message(append_message(role='assistant', content=''))
     f. 逐 token 通过 emit "chat:token" { session_id, message_id, text, done: false } 推送
     g. 累积完整 content,同时累计 tokens_out
     h. 流结束:update_message_content + emit "chat:token" { done: true, tokens_in, tokens_out, model_name }
     i. 更新 chat_sessions.updated_at
     j. 若是会话第一条 AI 消息且 title 仍为默认,异步调用一次 ai_client 用前 2 条消息生成会话标题
   - cancel_chat_stream(session_id: String) -> ():
     * 通过 tokio::CancellationToken 取消正在进行的流
     * 已生成的部分内容保留并标记为 [Cancelled]

9. mod.rs - 注册所有 Command 到 Tauri builder

前端 (src/pages/Chat.tsx 新建):
10. 整体布局(参考原型 Screen 07):
    - 左侧 240px: 会话列表(带"新建对话"按钮 + 置顶分组 + 最近分组)
    - 右侧主区:
      * 顶部 chat-header: 当前会话标题 + 操作按钮("导出 MD" / "清空")
      * 中间 chat-messages: 消息列表(虚拟滚动用 react-window)
      * 底部 chat-input-area: 附件芯片 + 输入框 + 工具栏(左 + 号 + 右模型选择 + 发送)

11. src/stores/chatStore.ts (Zustand):
    - sessions: ChatSessionSummary[]
    - currentSessionId: string | null
    - messages: Record<sessionId, ChatMessage[]>
    - currentInput: string
    - currentAttachments: ChatAttachment[]
    - currentSkill: string | null
    - currentModel: string | null
    - streamingMessageId: string | null
    - actions: loadSessions / selectSession / sendMessage / appendStreamToken / cancelStream

12. src/components/chat/Message.tsx:
    - 用户消息:右侧对齐,头像在右,蓝色背景
    - AI 消息:左侧对齐,头像在左,白色背景
    - 内容用 react-markdown 渲染,代码块语法高亮
    - 流式中的消息末尾显示闪烁光标
    - 操作按钮:复制 / 重新生成 / 👍 / 👎(对 AI 消息)

13. src/components/chat/InputArea.tsx:
    - textarea 自适应高度(min 44px max 200px)
    - Enter 发送,Shift+Enter 换行,IME 输入中不触发发送
    - 左下"+" 按钮展开菜单:
      * 上传附件(tauri-plugin-dialog 多选)
      * 引用收藏夹文献(弹出 cmdk 搜索)
      * 选择 Skill(下拉列表)
      * 粘贴 URL(输入框,后端抓取)
    - 已添加的附件以 chip 形式展示,可单独 X 移除
    - 右下角模型选择器:
      * 显示当前模型图标 + 名称 + ▾
      * 点击展开下拉,从 model_configs 加载已配置模型
      * 不可用模型(测试连接失败的)灰色禁用态
    - 发送按钮:右侧圆形,流式中变为"停止"

14. src/components/chat/SessionList.tsx:
    - 顶部"新建对话"按钮(主色)
    - 置顶 / 最近 分组
    - 每个 session item:标题 + 时间 + 消息数
    - 右键菜单:置顶 / 重命名 / 导出 / 删除

15. 路由与侧边栏:
    - 侧边栏新增 "💬 Chat" 入口(在 AI 解析下方,带 NEW 徽章)
    - 路由 /chat → 默认显示空状态或最近会话
    - /chat/:sessionId → 直接打开指定会话

16. 流式渲染优化:
    - 用 useTransition 包裹 token 追加,避免阻塞输入
    - 滚动到底部:仅当用户已经在底部时才自动滚动(避免阅读历史时被打断)
    - 渲染节流:每 50ms 批量追加一次,而不是每个 token 触发渲染

17. 端到端测试场景:
    - 创建会话 → 发送 "Hello" → 收到流式回复 → 重新加载页面后历史保留
    - 中途切换模型 → 下条消息使用新模型,历史保留
    - 上传 PDF 附件 → AI 能基于附件内容回答
    - 引用收藏文献 → AI 能识别文献信息

确保:
- cargo test chat:: 全部通过
- 性能:首 Token < 3s(本地连 Claude API);流式渲染流畅(无明显掉帧)
- 内存:发送 50 轮长消息后内存增量 < 100MB
```

验证:
- 完整跑一遍 17 中的 4 个场景,均通过
- `git commit -m "feat: session 16 - chat module alpha with streaming"`

---

### Session 17: 跨模块跳转 + 收藏组件统一

```
读取 CLAUDE.md。本次任务打通各模块的跳转,并统一收藏组件。

第一部分:统一收藏组件
1. 创建 src/components/FavoriteButton.tsx:
   - props: { paperId: string, variant?: 'compact' | 'full', onChange?: (folderId: string|null) => void }
   - 内部状态:isFavorited, currentFolders[]
   - 渲染:
     * 未收藏:☆ 收藏 ▾ (展开下拉)
     * 已收藏:⭐ 已收藏 (悬停显示当前文件夹)
   - 下拉内容:
     * 顶部:"快速收藏到未分类"(主操作)
     * 中部:文件夹树(可滚动,缩进显示层级,显示当前所在的高亮)
     * 底部:"+ 新建文件夹"(展开输入框输入名称)
     * 已收藏时:多一个"取消收藏"项(红色)
   - 操作完成后右下角 Toast 提示

2. 创建 src/stores/libraryStore.ts (Zustand):
   - paperFolders: Record<paperId, folderId[]>
   - folders: Folder[](文件夹树,扁平结构)
   - actions: addToFolder / removeFromFolder / moveToFolder / createQuickFolder / loadPaperFolders
   - 监听 Tauri event "library:paper_folder_changed",自动刷新

3. Rust 侧补充 (src-tauri/src/library/):
   - get_paper_folders(paper_id) -> Vec<String>(文件夹 ID 列表)
   - create_quick_folder(name: String, parent_id: Option<String>) -> Folder
   - 在 add_to_folder / remove_from_folder / move_paper_to_folder 完成时,emit "library:paper_folder_changed"

4. 替换现有用法:
   - src/pages/Search.tsx:每篇文献的 ⭐ 收藏按钮替换为 <FavoriteButton paperId={paper.id} variant="compact" />
   - src/pages/Feed.tsx:同上
   - src/pages/Library.tsx:已收藏的文献用 <FavoriteButton variant="compact" />,展示当前文件夹

第二部分:跨模块跳转
5. 路由参数协议:
   - 修改 TanStack Router /parse 路由,支持 search params:
     * paper_id?: string  (预选文献)
     * skill?: string     (预选 Skill,可选)
   - 修改 src/pages/Parse.tsx:
     * 从 useSearch hook 读取 paper_id 与 skill
     * 挂载时若 paper_id 存在,invoke('get_paper_by_id') 加载并填入"选择文献"输入框
     * 自动滚动到"开始解析"按钮但不自动触发(让用户最终确认)

6. 创建 src/hooks/useAppNavigation.ts:
   ```typescript
   export function useAppNavigation() {
     const navigate = useNavigate();
     return {
       openParseWithPaper: (paperId: string, opts?: { skill?: string }) =>
         navigate({ to: '/parse', search: { paper_id: paperId, ...(opts?.skill && { skill: opts.skill }) } }),
       openExternal: async (url: string) => 
         await invoke('open_external_url', { url }),
       downloadPaperPdf: async (paperId: string) => 
         await invoke('download_paper_pdf', { paperId }),
     };
   }
   ```

7. Rust 侧 (src-tauri/src/library/):
   - resolve_paper_url(paper_id) -> Result<Option<String>, String>:
     * 优先级:doi → source_url → arxiv_id 构造 abs URL → pubmed_id 构造详情 URL
     * 全部为空时返回 None
   - open_external_url(url: String) Tauri Command:
     * 调用 tauri-plugin-shell::open
     * 失败时返回错误
   - download_paper_pdf(paper_id: String) Tauri Command:
     * 检查 papers.pdf_path 已存在 → 直接 open 本地文件
     * 不存在 → 检查 OA(基于 source 字段)
     * 非 OA → 返回错误 "该文献不是开放获取,无法下载"
     * OA → 从 source_url 或构造的 PDF URL 下载到 {app_data_dir}/data/pdfs/_temp/{uuid}.pdf
       (若已收藏,下载到对应 folder 目录)
     * 流式下载,通过 emit "download:progress" { paper_id, percent } 推送进度
     * 完成后更新 papers.pdf_path
   - cancel_download(paper_id: String) Tauri Command

第三部分:三个按钮的实际接入
8. 在 Search.tsx / Feed.tsx 的每张文献卡片:
   - 🧠 AI 精读 按钮:onClick = () => navigation.openParseWithPaper(paper.id)
   - 📄 原文 按钮:onClick = async () => {
       const url = await invoke('resolve_paper_url', { paperId: paper.id });
       if (url) navigation.openExternal(url);
       else toast.error('该文献无可用的原文链接');
     }
     无 URL 时按钮禁用 + tooltip 提示
   - 📥 下载 PDF 按钮:
     * 若 papers.pdf_path 已存在 → 显示 "📂 打开 PDF"
     * 否则 → "📥 下载",点击后变为进度条
     * 监听 "download:progress" event 更新进度
     * 完成后变为 "📂 打开 PDF"
     * 非 OA 文献按钮置灰 + tooltip "非开放获取"

9. UI 微调:
   - 这三个按钮统一为 src/components/PaperActions.tsx,接受 paper 对象
   - 在 Search / Feed / Library / 详情页 全部使用此组件,保证一致

10. 测试场景:
    - Search.tsx 点击某篇 AI 精读 → 跳转 /parse,文献已选中
    - 在 Library 收藏一篇,Search 中刷新可见已收藏状态
    - 取消收藏后,Library 中该文献消失
    - 下载一篇 OA 文献,中途取消,再次点击重新下载

确保:
- cargo test 通过
- 三个模块(Search/Feed/Library)的收藏交互完全一致
- 跨模块跳转 < 200ms
```

验证:
- 完整跑一遍 10 中的 4 个场景
- `git commit -m "feat: session 17 - cross-module navigation and unified favorite"`

---

### Session 18: 本地文献上传 + 名称检索

```
读取 CLAUDE.md。本次任务实现本地 PDF 上传与基于 FTS5 的文献名称检索。

Rust 侧 (src-tauri/src/library/uploader.rs 新建):
1. 元数据提取链(src-tauri/src/library/metadata_extractor.rs):
   - extract_pdf_metadata(file_path: &Path) -> Result<PartialMetadata>
     * 第一步:尝试读取 PDF metadata(/Title /Author /Subject)。库:lopdf
     * 第二步:若 metadata 缺失,提取首页文本,启发式识别:
       - 标题:首页前 1/3 区域中,最大字号且独占一行的文本(用 pdf_extract 但配合字号信息)
       - 作者:标题下方的连续行,匹配作者格式(逗号分隔的 First Last 模式)
       - 摘要:查找 "Abstract" 关键词后的段落
     * 第三步:都失败时,文件名作为标题,作者/摘要为空
   - 返回 PartialMetadata { title, authors, abstract, doi (可选), confidence: f32 }
   - confidence < 0.5 时,前端弹出确认表单

2. upload_local_paper(file_path: String) Tauri Command:
   - 校验:文件存在,扩展名为 pdf,大小 < 100MB
   - 复制到 {app_data_dir}/data/pdfs/uploaded/{uuid}.pdf
   - 调用 extract_pdf_metadata 获取元数据
   - 写入 papers 表:
     * source = 'local'
     * source_id = uuid
     * uploaded_at = now()
     * pdf_path = 相对路径
     * title / authors / abstract 来自提取
   - 触发 papers_fts 索引更新(由 trigger 自动)
   - 返回 { paper_id, partial_metadata, needs_user_review: bool }

3. upload_local_papers_batch(file_paths: Vec<String>) Tauri Command:
   - 顺序调用 upload_local_paper
   - 通过 emit "upload:progress" { current, total, current_file } 推送进度
   - 返回每个文件的结果(成功 + paper_id / 失败 + error)

4. update_paper_metadata(paper_id: String, title: String, authors: Vec<String>, abstract_text: String) Tauri Command:
   - 用户手动补全或修正元数据时调用
   - 自动重建 FTS 索引

5. search_local_papers(keyword: String, limit: i64) Tauri Command:
   - SQL: SELECT * FROM papers WHERE rowid IN (
       SELECT rowid FROM papers_fts WHERE papers_fts MATCH ?
     ) ORDER BY rank LIMIT ?
   - keyword 处理:转换为 FTS5 语法(空格转 AND,加 NEAR/5 提升相关性)
   - 返回 Vec<PaperSearchResult> { id, title (with highlight), authors, source, current_folder_path }
   - 性能:对 10K 文献库,确保 P95 < 200ms

6. dependencies:
   - lopdf = "0.32"

前端 (src/pages/Parse.tsx 修改):
7. 替换"选择文献"组件:
   - 安装 cmdk: npm install cmdk
   - 用 cmdk 实现可搜索下拉:
     * 输入框:占位符 "🔍 搜索本地文献(标题/作者/DOI)..."
     * 输入触发(防抖 200ms)调用 invoke('search_local_papers')
     * 下拉列表展示:每条结果含标题(高亮) + 作者 + 来源徽章 + 当前文件夹
     * 选中后填入文献 ID 到表单状态
   - 旁边新增"📤 上传文献"按钮:
     * tauri-plugin-dialog 多选 PDF
     * 调用 upload_local_papers_batch
     * 显示进度条(监听 "upload:progress")
     * 完成后,如果只有 1 个文件,自动选中作为当前解析文献
     * 多个文件,Toast 提示并展示批量结果

8. 元数据补全弹窗 (src/components/PaperMetadataEditor.tsx):
   - 当 upload_local_paper 返回 needs_user_review = true 时弹出
   - 表单字段:标题(必填) / 作者(列表,可增删) / 摘要(textarea) / DOI(可选)
   - 顶部展示提取置信度与原始 PDF 链接,方便用户对照
   - 保存调用 update_paper_metadata
   - 跳过按钮:保留当前提取结果,后续可在 Library 中编辑

9. 在 Library.tsx 中,本地上传的文献:
   - 来源徽章为 "Local"(灰色)
   - 卡片右上角有"重新提取元数据"按钮(用于元数据有问题的旧记录)

10. 性能验证:
    - 准备一个 10K 假文献的脚本(在 dev 模式下 seed)
    - 测量 search_local_papers 的 P95 延迟
    - 用 EXPLAIN QUERY PLAN 确认走 FTS5 索引

11. 测试场景:
    - 上传单个 PDF,元数据成功提取,自动入库 → 在 AI 解析中可搜到 → 解析正常
    - 上传一个扫描版 PDF(无文本)→ 弹出元数据补全弹窗 → 用户填写 → 入库
    - 批量上传 10 个 PDF → 进度条正确显示
    - 在 10K 文献库中输入关键词搜索,响应 < 200ms

确保 cargo test 与手动测试场景全部通过。
```

验证:
- 找几篇真实 PDF 论文测试上传流程
- 在 AI 解析页面用搜索找到刚上传的文献,执行解析
- `git commit -m "feat: session 18 - local paper upload and fts5 search"`

---

### V2.0.1 收尾:Beta + 发布

完成 Session 18 后,进入 Beta 测试与发布阶段。这部分不属于 Claude Code Session,需要手动操作:

1. 合并 feature/v2.0.1 到 main:
```cmd
git checkout main
git merge --no-ff feature/v2.0.1
git push
```

2. 打 Beta tag:
```cmd
git tag v2.0.1-beta.1
git push --tags
```
GitHub Actions 自动构建 Win + macOS 安装包。

3. 在 GitHub Releases 创建 prerelease,贴出 v2.0.1-beta.1 的 changelog,邀请 50 位 V2.0.0 活跃用户测试。

4. Beta 期(1 周):收集 GitHub Issues / Discord 反馈,P0/P1 问题修复后递增 beta 编号(beta.2 / beta.3)。

5. 正式发布:
```cmd
git tag v2.0.1
git push --tags
```
应用内 updater 自动检测并提示用户更新。

6. 公告:Discord + 知乎 + V2EX,主推 Chat 与 Skill 编辑两大新功能。

---

## 每个 Session 完成后的验证步骤

在 VS Code 终端 (路径: D:\2-WORK\恒星\项目\学术文献管理系统\SG_Hub) 执行:

```cmd
:: 1. 编译检查
cargo tauri dev

:: 2. 运行测试
cargo test

:: 3. 代码质量
cargo clippy -- -D warnings
npx eslint src/

:: 4. 提交
git add .
git commit -m "feat: session N - 功能描述"
git push
```

---

## Claude Code 使用技巧

1. **首次使用**: 底部点 "Select folder..." 选 `D:\2-WORK\恒星\项目\学术文献管理系统\SG_Hub`
2. **给上下文**: 在 prompt 里提到 "读取 CLAUDE.md" 或 "参考 docs/data-model.sql"
3. **让它跑命令**: 说 "运行 cargo test 确认通过"
4. **出错时**: 把编译错误粘贴进去,说 "修复这些编译错误"
5. **迭代**: "搜索结果卡顿了,用虚拟列表优化 Search.tsx"
6. **模型选择**: 右下角可切换模型,复杂 Rust 代码建议用 Opus 或 High thinking

---

## V2.0.1 Session 速查

| Session | 主题 | 对应 PRD 变更 | 预估时长 |
|---------|------|---------------|---------|
| 13 | V002 数据库迁移 | 数据基础(CHG-01/02/03) | 0.5 周 |
| 14 | Skill 上传与校验 | CHG-02 | 0.5 周 |
| 15 | Skill 在线编辑器(Monaco) | CHG-02 | 1 周 |
| 16 | Chat 模块 Alpha | CHG-01 (核心) | 1 周 |
| 17 | 跨模块跳转 + 收藏统一 | CHG-04/05/06 | 0.5 周 |
| 18 | 本地文献上传 + 名称检索 | CHG-03 | 0.5 周 |

**总计**: ~4 周 (与实施方案 V2.0.1 一致)
