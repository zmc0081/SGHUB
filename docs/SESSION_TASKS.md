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

## M2.1.0 · 体验打磨与设置完善(Week 22-25)

> V2.1.0 在 V2.0.1 已发布的基础上,聚焦设置体系完善、多语言基础设施、Token 统计启用、以及一个有产品价值的 Skill 自然语言生成器。
> 配套文档:PRD V2.1.0 / 架构方案 V2.1.0 / 实施方案 V2.1.0。

### 在开始 Session 19 之前

确认 V2.0.1 已发布且本地分支已同步:
```cmd
cd D:\2-WORK\恒星\项目\学术文献管理系统\SG_Hub
git checkout main
git pull
git checkout -b feature/v2.1.0
```

所有 V2.1.0 的 Session 都在 `feature/v2.1.0` 分支上做,完成后再合并到 main 发布。

---

### Session 19: 菜单顺序调整 + 移除自动备份

```
读取 CLAUDE.md。本次任务是 V2.1.0 的快赢任务,改两个地方:

任务一:左侧菜单顺序调整 + 新增 Skill 管理入口

打开 src/components/Sidebar.tsx,把"工作区"分组的菜单项按以下顺序重新排列:
1. 💬 Chat
2. 🔍 文献检索
3. 📰 今日推送
4. 🧠 AI 解析
5. ⭐ 收藏夹
6. ✨ Skill 管理   (这一项可能在 V2.0.1 已加,确认存在;若不存在则补上,路由 /skills)
7. 🤖 模型配置
8. ⚙️ 设置

要求:
- 把"工作区"和"设置"两个分组合并为一个统一的导航列表(原来的分组结构去掉)
- 保持原有的图标、徽章(NEW、未读计数)逻辑不变
- "Skill 管理"路由到 /skills 页面(V2.0.1 Session 14 已实现);若侧栏还没这一项,补上
- 当前选中项的高亮逻辑保持不变

任务二:移除"自动备份"设置项

打开 src/pages/Settings.tsx 的"💾 数据管理"卡片,删除以下两行设置:
- "自动备份" 开关
- "自动备份周期"(如有)

保留:数据目录(打开目录)、导出全部数据、从备份恢复、从 Zotero 导入。

任务三:同步更新文档

- 修改 docs/PRD V2.1.0 或 docs/changelog.md(如有)中关于"自动备份"的描述,删除相关条款
- 修改 CLAUDE.md 的"数据目录"章节,移除 backups/ 子目录(因为不再自动写入)

最后运行 npm run build 与 cargo clippy -- -D warnings 确保通过。
```

验证:
- `cargo tauri dev` 启动,左侧菜单顺序正确,Skill 管理可访问
- 设置页面"自动备份"选项已消失
- `git add . && git commit -m "feat: session 19 - menu reorder and remove auto-backup"`

---

### Session 20: 多语言基础设施 + 跟随系统语言

```
读取 CLAUDE.md。本次任务实现多语言支持:简体中文、繁体中文、英语、日语、法语,默认跟随系统语言,可手动切换。

任务范围:

1. i18n 配置完善 (src/i18n/):
   - 安装(若未安装): npm install react-i18next i18next i18next-browser-languagedetector
   - 创建 src/i18n/index.ts,导出已配置的 i18n 实例
   - 支持的语言代码:zh-CN(简体中文)/ zh-TW(繁体中文)/ en-US(英语)/ ja-JP(日语)/ fr-FR(法语)
   - 默认语言:跟随系统(通过 Tauri API 获取),失败时回退到 en-US
   - 语言变更后立即生效,不需要重启(react-i18next 原生支持)

2. 语言包文件 (locales/):
   - 创建 5 个 JSON 文件:zh-CN.json / zh-TW.json / en-US.json / ja-JP.json / fr-FR.json
   - 完整翻译范围:
     * common(常用按钮、状态文字)
     * sidebar(侧栏导航项)
     * search / feed / library / parse / chat / models / skills / settings(7 个主页面)
     * errors(常见错误提示)
     * notifications(系统通知文案)
   - **本次只把 zh-CN 和 en-US 翻译完整**,其他三种语言:
     * zh-TW:暂用简繁转换工具(opencc-js)批量从 zh-CN 转换,人工抽查关键术语
     * ja-JP / fr-FR:先用 en-US 的 key 占位,value 也填 en-US 文本,加 [NEEDS_TRANSLATION] 前缀标记,后续社区贡献完善
   - 在 locales/README.md 中说明贡献翻译的流程

3. Rust 侧 (src-tauri/src/config/):
   - 新增 Tauri Command get_system_locale() -> String:
     * 通过 tauri::api::os::locale() 或标准库 sys-locale crate 获取
     * 匹配到 5 种支持语言之一,否则回退 en-US
     * 匹配规则:zh-CN / zh-Hans → zh-CN;zh-TW / zh-Hant / zh-HK → zh-TW;en-* → en-US;ja-* → ja-JP;fr-* → fr-FR
   - 修改 AppConfig 结构体:
     * 新增字段 language: Option<String>(None 表示跟随系统)

4. 前端集成:
   - 应用启动时(src/main.tsx):
     1. 调用 invoke('get_app_config') 读取用户配置
     2. 如果 language 为 null/undefined → 调用 invoke('get_system_locale') 获取系统语言
     3. 调用 i18next.changeLanguage() 设置当前语言
   - 创建 src/hooks/useT.ts,封装 react-i18next 的 useTranslation,提供更短的语法
   - 替换所有页面中的硬编码中文文本为 t('key') 调用
   - **优先级处理**:
     * P0:Sidebar / Settings / Chat / 通用按钮(确认、取消、保存、删除等)
     * P1:其他页面在后续 Session 渐进替换
   - 在大型组件顶部加注释 // i18n: 本组件文案已国际化 标记进度

5. 设置页面 - 语言切换 (src/pages/Settings.tsx):
   - 在"🌐 通用"卡片中,语言选项改为下拉:
     * 跟随系统(默认)
     * 简体中文
     * 繁體中文
     * English
     * 日本語
     * Français
   - 选择"跟随系统"时,language 字段设为 null,保存到配置
   - 选择具体语言时,设为对应代码
   - 切换后立即调用 i18next.changeLanguage(),界面实时更新
   - 当前显示语言来源标记:若是跟随系统,在下拉旁标注"(跟随系统:简体中文)"

6. 测试:
   - 写一个简单的语言切换 E2E:启动 → 默认中文 → 切换到英文 → UI 立即变化 → 切换到"跟随系统"恢复
   - 修改系统语言为日文(macOS / Windows 系统设置),启动应用观察是否自动切到 [NEEDS_TRANSLATION] 占位的日文版

7. 文档:
   - 在 README.md 末尾新增"Localization"小节,说明:支持的语言、翻译完成度、贡献翻译的方式
   - 创建 docs/i18n-guide.md,详细描述给社区贡献者的翻译流程(fork → 改 JSON → PR)

确保 cargo clippy 通过,npm run build 通过。
```

验证:
- 启动应用,默认显示当前系统语言对应的版本
- 在设置中切换 5 种语言,UI 实时变化
- 切回"跟随系统",显示系统语言
- `git commit -m "feat: session 20 - i18n with 5 languages and system locale"`

---

### Session 21: 自动更新调度配置

```
读取 CLAUDE.md。本次任务实现自动更新的精细化调度配置:开关、频率、时间。

任务范围:

1. 数据模型(配置文件,无需 DB 迁移):
   修改 src-tauri/src/config/mod.rs 的 AppConfig 结构,新增 updater 子结构:
   
   pub struct UpdaterConfig {
     pub enabled: bool,                    // 总开关,默认 true
     pub frequency_type: String,           // "daily" | "weekly"
     pub frequency_value: u32,             // daily: 每 N 天(1-30);weekly: 位掩码 0-127 表示哪几天(Mon=1, Tue=2, ..., Sun=64)
     pub check_time: String,               // "HH:MM" 24 小时制,默认 "09:00"
     pub action: String,                   // "notify" | "silent_download" | "check_only"
                                            // notify: 检查到新版本时弹通知让用户选择
                                            // silent_download: 检查到时静默下载,等用户主动重启
                                            // check_only: 只检查,不下载也不弹通知(在 UI 角标显示)
     pub last_check_at: Option<String>,    // 上次检查时间(ISO 8601)
   }
   
   pub struct AppConfig {
     // ... 已有字段
     pub updater: UpdaterConfig,
   }
   
   默认值:enabled=true, frequency_type="daily", frequency_value=7, check_time="09:00", action="notify"

2. Rust 侧调度逻辑 (src-tauri/src/updater/scheduler.rs 新建):
   - 使用 tokio-cron-scheduler(V2.0.0 已引入)
   - 启动时根据 UpdaterConfig 注册定时任务
   - 任务逻辑:
     a. 判断是否到达预设时间(根据 check_time)
     b. 调用 tauri-plugin-updater 检查更新
     c. 根据 action 字段决定后续行为
     d. 更新 last_check_at
   - 配置变更时(用户在设置页修改),重新调度
   - frequency_type="weekly" 时:cron 表达式根据位掩码生成(如 "Mon, Wed, Fri" = 1+4+16=21)

3. 配置变更监听 (src-tauri/src/config/):
   - save_app_config 完成后,emit "config:updater_changed" event
   - updater::scheduler 监听该 event,重新调度任务

4. Tauri Commands:
   - get_updater_status() -> UpdaterStatus
     * 返回:{ next_check_at, last_check_at, current_version, has_pending_update, pending_version }
   - check_update_now() -> CheckResult
     * 手动触发一次检查(忽略调度,但更新 last_check_at)
   - install_pending_update() -> ()
     * 触发下载并安装已检测到的更新

5. 前端 - 设置页面 (src/pages/Settings.tsx):
   修改原有的"🔒 隐私与更新"卡片,把"自动检查更新"开关扩展为详细设置区:
   
   - 总开关(自动检查更新)
     - 关闭后,以下子选项全部禁用(灰色)
   - 检查频率:
     - 单选:每日 / 每周
     - 每日模式:数字输入框(每 N 天,1-30,默认 7)
     - 每周模式:复选框(Mon/Tue/Wed/Thu/Fri/Sat/Sun),至少选一天
   - 检查时间(本地时区)
     - 时间选择器(HH:MM,15 分钟为步长)
   - 检查到更新后的行为:
     - 单选:弹出通知让我决定 / 后台静默下载 / 只标记不通知
   - 状态展示:
     - 当前版本 / 最近一次检查 / 下次计划检查 / (若有)待安装版本号
   - 操作按钮:
     - "立即检查"按钮:调用 check_update_now
     - 若有待安装更新:"立即安装"按钮:调用 install_pending_update

6. UI 细节:
   - 频率与时间的修改实时保存并立即重新调度,不需要"保存"按钮
   - 总开关关闭后,所有子项灰显但保留数值(用户重新开启时恢复)
   - 频率类型切换时,使用平滑动画切换显示区域
   - "下次检查时间"实时计算并展示(纯前端推算,不需要后端)

7. 测试:
   - 写 Rust 单元测试:验证 cron 表达式根据配置正确生成
     - 每日 7 天:"0 0 9 */7 * *"(根据具体 cron 库语法)
     - 每周 Mon/Wed/Fri:"0 0 9 * * MON,WED,FRI"
   - 手动测试:配置为每天 09:01 → 等到时间验证是否触发
   - 关闭自动更新 → 验证调度任务被取消

确保 cargo test updater:: 通过。
```

验证:
- 设置页面所有控件交互正常,实时保存
- 修改配置后,后台调度任务自动重建(看日志确认)
- 关闭总开关,所有子项灰显但状态保留
- `git commit -m "feat: session 21 - configurable auto-update scheduler"`

---

### Session 22: 数据目录可配置 + 迁移逻辑

```
读取 CLAUDE.md。本次任务实现数据目录可配置功能,这是 V2.1.0 最复杂的一项。
关键设计:数据目录路径本身的配置不能存在数据目录里(否则循环依赖),必须存放在
OS 标准配置目录(Windows: %APPDATA%\sghub-config\;macOS: ~/Library/Preferences/sghub/)。

任务范围:

1. 引导路径设计(src-tauri/src/config/bootstrap.rs 新建):
   定义"引导配置"(只存放数据目录路径),独立于主配置:
   
   pub struct BootstrapConfig {
     pub data_dir: Option<PathBuf>,    // None = 使用默认 app_data_dir
   }
   
   - 路径(Windows): %APPDATA%\sghub-bootstrap\bootstrap.toml
   - 路径(macOS):  ~/Library/Preferences/sghub-bootstrap/bootstrap.toml
   - 读取函数 load_bootstrap() -> BootstrapConfig
   - 保存函数 save_bootstrap(config: BootstrapConfig) -> Result<()>
   - 解析数据目录:get_effective_data_dir(app: &AppHandle) -> PathBuf
     * 若 bootstrap 中指定了 data_dir 且路径存在 → 使用该路径
     * 否则 → 使用 app.path().app_data_dir() 默认路径
   
2. 修改所有数据访问点使用 get_effective_data_dir:
   - db::init():数据库路径
   - skill_engine:自定义 Skill 目录
   - chat::attachment:Chat 附件目录
   - library::uploader:PDF 上传目录
   - tracing 日志输出目录
   - 全局封装一个 paths.rs 模块,集中管理这些路径派生

3. Tauri Commands:
   - get_current_data_dir() -> { path: String, is_custom: bool, size_mb: f64 }
     * 返回当前实际使用的数据目录、是否自定义、占用空间
   - select_new_data_dir() -> Option<String>
     * 调用 tauri-plugin-dialog 打开目录选择对话框
     * 返回用户选择的路径(取消时返回 None)
   - migrate_data_dir(new_path: String, mode: String) -> MigrationResult
     * mode = "migrate":把当前数据目录的所有文件复制到新路径,验证完整性后更新 bootstrap.toml
     * mode = "fresh":只更新 bootstrap.toml,不迁移数据(用户希望新位置从零开始)
     * mode = "use_existing":只更新 bootstrap.toml,如果新路径已有 sghub 数据则直接使用(用于多端同步场景)
     * 返回:{ success: bool, migrated_files: u32, total_size_mb: f64, errors: Vec<String> }
     * 迁移过程通过 emit "data_migration:progress" { current_file, percent } 推送进度
   - validate_data_dir(path: String) -> ValidationResult
     * 检查路径合法性:存在、可读写、有足够空间(至少 1GB)
     * 检查路径是否已有 SGHUB 数据(sghub.db 是否存在)

4. 迁移逻辑细节(src-tauri/src/config/migration.rs):
   - 迁移开始前:关闭数据库连接池(让 SQLite 文件可以安全复制)
   - 复制文件:遍历源目录,逐个复制到目标(用 fs::copy 或 fs_extra crate 的递归复制)
   - 校验:复制后比对每个文件的字节数 / SHA256(关键文件:sghub.db、所有 .yaml)
   - 失败回滚:如果复制中途出错,删除已写入的目标文件,保留源目录不变
   - 成功:更新 bootstrap.toml,重启数据库连接池指向新路径
   - 询问用户:迁移成功后弹窗"是否删除旧目录数据?"(保留 vs 清空)

5. 前端 - 设置页面 (src/pages/Settings.tsx):
   修改"💾 数据管理"卡片的"数据目录"行:
   
   - 显示当前路径(monospace 字体,可点击复制完整路径)
   - 显示标签:"默认路径" / "自定义路径"
   - 显示占用空间:"占用 1.2 GB"
   - 三个操作按钮:
     a. "📂 打开目录"(原有功能,保留)
     b. "🔄 修改路径"(新增,触发路径修改流程)
     c. "↩️ 恢复默认"(仅当 is_custom=true 时显示)

6. 修改路径流程(三步弹窗):
   Step 1: 选择新路径
     - 提示用户:数据目录是 SGHUB 存储所有论文、Skill、Chat 历史、PDF 的位置
     - "选择新目录"按钮 → 调 select_new_data_dir
     - 选定后调用 validate_data_dir 显示验证结果
   
   Step 2: 选择数据处理方式(单选)
     - 选项 A:**迁移现有数据到新路径**(推荐)
       - 把当前所有数据复制到新路径,完成后切换
       - 适合换新电脑、整理目录结构
     - 选项 B:**新路径从零开始**
       - 不迁移当前数据,新路径作为全新的数据目录
       - 适合需要多个独立环境的高级用户
     - 选项 C:**使用新路径中已有的 SGHUB 数据**(仅当新路径已有 sghub.db 时可选)
       - 直接切换到该路径,使用其中的现有数据
       - 适合从备份恢复或在多设备共享数据(配合 OneDrive / Dropbox / iCloud Drive)
   
   Step 3: 确认与执行
     - 显示摘要:旧路径 → 新路径,处理方式,预估耗时
     - 大红色警告:"操作期间请勿关闭应用,完成后应用将自动重启"
     - "确认执行"按钮 → 调用 migrate_data_dir
     - 显示进度条 + 当前正在迁移的文件名
     - 完成后:弹窗询问"是否删除旧目录数据?",用户选择后应用自动重启

7. 安全考虑:
   - 路径校验:禁止选择系统关键目录(C:\, C:\Windows, /, /usr, /System 等),返回错误
   - 路径校验:禁止选择当前数据目录本身或其子目录(逻辑混乱)
   - 写权限校验:在目标路径创建一个 .sghub-writetest 文件并删除,验证可写
   - 大小校验:目标路径剩余空间必须 >= 源目录大小 × 1.5(留缓冲)
   - 用户数据安全:迁移成功且用户确认前,源目录数据始终保留

8. 测试:
   - 单元测试:bootstrap.toml 的读写
   - 集成测试:三种迁移模式各跑一次,验证数据完整性
   - 手动测试:
     a. 默认 → 自定义路径(迁移模式),验证数据保留
     b. 自定义 → 恢复默认
     c. 自定义 A → 自定义 B,选"使用已有数据"模式
     d. 选择无权限路径,验证错误提示

9. 文档:
   - 更新 docs/data-management.md(若无则新建)
   - 详细说明三种迁移模式的适用场景与注意事项

确保 cargo test 全部通过。
```

验证:
- 完整跑一遍 8 中的 4 个测试场景
- 在 OneDrive / Dropbox 路径下使用"新路径"模式,验证多端可访问
- `git commit -m "feat: session 22 - configurable data directory with migration"`

---

### Session 23: Token 统计写入路径打通 + 7 天统计

```
读取 CLAUDE.md。本次任务把当前未启用的 usage_stats 表实际写入打通,
并改造模型配置页的统计展示为"近 7 天"模式。

任务范围:

1. 数据写入路径排查与修复 (src-tauri/src/ai_client/):
   - 检查 chat_stream / 现有的 ai_client 调用结束位置
   - 确认 token 计数是否正确:
     * OpenAI 兼容:从最后一个 chunk 的 usage 字段读取
     * Anthropic:从 stream 的 message_delta 事件中读取 usage.input_tokens / output_tokens
     * Ollama:从最后一个 chunk 的 prompt_eval_count / eval_count 读取
   - 如果上述字段未提供(部分 endpoint 不返回),用 tiktoken-rs 本地估算

2. 新建 usage_stats 写入逻辑(src-tauri/src/ai_client/usage.rs):
   - record_usage(model_config_id, tokens_in, tokens_out, cost_estimate_usd) Tauri 内部函数
   - 实现按日聚合的 UPSERT:
     INSERT INTO usage_stats (id, model_config_id, date, tokens_in_total, tokens_out_total, call_count, cost_est_total)
     VALUES (?, ?, date('now'), ?, ?, 1, ?)
     ON CONFLICT(model_config_id, date) DO UPDATE SET
       tokens_in_total = tokens_in_total + excluded.tokens_in_total,
       tokens_out_total = tokens_out_total + excluded.tokens_out_total,
       call_count = call_count + 1,
       cost_est_total = cost_est_total + excluded.cost_est_total;
   - 成本估算:基于 ModelConfig 中的价格元数据(input_price_per_1m_tokens / output_price_per_1m_tokens)
     * model_configs 表新增这两列(本 session 同时做 V004 migration)
     * 默认值:为内置模型预填(Claude Opus 输入 $15/1M、输出 $75/1M;GPT-5 输入 $5/1M、输出 $15/1M;DeepSeek V3 输入 $0.27/1M、输出 $1.10/1M;Ollama 本地为 $0)
   - 在三个调用路径上接入:
     * Chat 模块的 streaming.rs(send_chat_message 结束时)
     * AI 解析的 start_parse(完成时)
     * Skill 编辑器的 test_skill_with_paper(完成时)

3. V004 migration(src-tauri/migrations/V004__model_pricing.sql):
   ALTER TABLE model_configs ADD COLUMN input_price_per_1m_tokens REAL NOT NULL DEFAULT 0.0;
   ALTER TABLE model_configs ADD COLUMN output_price_per_1m_tokens REAL NOT NULL DEFAULT 0.0;
   
   -- 为预设模型回填价格(基于 model_id 匹配)
   UPDATE model_configs SET input_price_per_1m_tokens = 15.0, output_price_per_1m_tokens = 75.0 
     WHERE model_id LIKE 'claude-opus%';
   UPDATE model_configs SET input_price_per_1m_tokens = 3.0, output_price_per_1m_tokens = 15.0 
     WHERE model_id LIKE 'claude-sonnet%';
   UPDATE model_configs SET input_price_per_1m_tokens = 5.0, output_price_per_1m_tokens = 15.0 
     WHERE model_id LIKE 'gpt-5%';
   UPDATE model_configs SET input_price_per_1m_tokens = 0.27, output_price_per_1m_tokens = 1.10 
     WHERE model_id LIKE 'deepseek%';
   UPDATE model_configs SET input_price_per_1m_tokens = 0, output_price_per_1m_tokens = 0 
     WHERE provider = 'ollama';

4. 模型配置页价格字段:
   - 新增 / 编辑模型时,新增两个可选字段:"输入价格 ($/1M tokens)" / "输出价格 ($/1M tokens)"
   - 内置模型自动填充默认价格,用户可修改
   - 自定义模型默认 0(用户自行填写)
   - UI 上加 tooltip 说明"用于成本估算,可在模型提供商官网查询定价"

5. 统计查询 Tauri Command:
   - get_usage_stats_7days() -> UsageStats7Days
     * 查询近 7 天(包括今天)每个模型每天的统计
     * 返回数据结构:
       struct UsageStats7Days {
         total_tokens_in: i64,
         total_tokens_out: i64,
         total_call_count: i64,
         total_cost_est: f64,
         daily_breakdown: Vec<DailyUsage>,      // 7 天每日明细
         by_model: Vec<ModelUsage>,             // 按模型聚合
       }
     * SQL:WHERE date >= date('now', '-6 days') GROUP BY date, model_config_id

6. 前端 - 模型配置页改造(src/pages/Models.tsx):
   - 把原来的"4 格用量统计"卡片改为:
     * 第 1 格:已配置模型数(不变)
     * 第 2 格:近 7 天调用次数
     * 第 3 格:近 7 天 Token 消耗(输入 + 输出,缩写显示如 1.2M)
     * 第 4 格:近 7 天预估成本($)
     - 卡片标题统一加副标题"近 7 天"
   - 新增一个迷你柱状图区域(放在 4 格卡片下方):
     * 横轴:近 7 天的日期(MM/DD)
     * 纵轴:每日 Token 消耗
     * 用 recharts(若未安装:npm install recharts)
     * 高度约 120px,简洁风格
     * 鼠标 hover 显示当日详情:N 次调用、输入 X tokens、输出 Y tokens、成本 $Z
   - 数据加载:页面挂载时 invoke('get_usage_stats_7days')
   - 模型列表中每个模型的"近 30 天用量"小字保留,但改为"近 7 天用量",数据来自 by_model

7. 数据补全(可选):
   - 如果用户之前已经用过 Chat 或 AI 解析但 usage_stats 是空的(因为之前没接入),
     提供一个 Tauri Command:rebuild_usage_stats() 从 chat_messages + ai_parse_results 表反向构建历史数据
   - 在模型配置页加一个"重建统计"按钮(灰色文字,不显眼),供 V2.0.1 升级用户使用

8. 测试:
   - 写单元测试:模拟一次 chat_stream 完成,验证 usage_stats 表正确写入并聚合
   - 重复调用 3 次同一模型,验证 call_count = 3
   - 跨日测试:模拟昨天和今天各 2 次调用,验证近 7 天查询返回 2 行
   - 前端:打开 Chat,发送一条消息,刷新模型配置页,验证数据增加

确保 cargo test ai_client::usage:: 与前端手动测试都通过。
```

验证:
- 在 Chat 中和 AI 解析中各发起几次调用
- 打开模型配置页,看到近 7 天统计有数据,柱状图显示每日 token 消耗
- `git commit -m "feat: session 23 - usage stats 7-day with cost estimation"`

---

### Session 24: Skill 自然语言生成器 ⭐

```
读取 CLAUDE.md 与 skills/general_read.yaml。本次任务实现 V2.1.0 的核心新功能:
用自然语言描述需求,自动生成符合 SGHUB Skill 规范的 YAML。
参考 Claude.ai 的 Skills 构建体验(对话式 Skill 创建)。

任务范围:

1. 元提示词(Meta Prompt)设计 (src-tauri/src/skill_engine/generator.rs 新建):
   - 设计一个高质量的 meta prompt,引导任意配置好的大模型生成 SGHUB Skill YAML
   - meta prompt 关键内容:
     a. 角色定义:你是 SGHUB 的 Skill 设计专家,擅长把用户的自然语言需求转化为结构化的 Skill 配置
     b. SGHUB Skill YAML 规范说明(完整 schema)
     c. 已有 Skill 范例(从 skills/general_read.yaml 内联,作为 few-shot)
     d. 用户原始需求会插入在末尾
     e. 输出要求:严格输出有效的 YAML(用 ```yaml 包裹),不要任何额外文字解释
   - 把 meta prompt 模板存为 src-tauri/templates/skill_generator_prompt.md(用 include_str! 编译时嵌入)

2. Tauri Commands:
   - generate_skill_from_description(description: String, model_config_id: Option<String>) -> Result<String>
     * 输入:用户自然语言描述,如:"我想要一个 Skill 用来分析临床试验文献,重点关注实验设计、样本量、统计方法、副作用,输出中文"
     * 加载 meta prompt 模板,把用户描述插入
     * 调用 ai_client::chat_stream(使用指定模型或用户默认模型)
     * 提取响应中的 YAML 块(去掉 ```yaml 包裹)
     * 解析验证 YAML 合法性(用 skill_engine::validate_skill 校验)
     * 如果解析失败,把错误信息和原 YAML 一并传给模型,让其修正(最多重试 1 次)
     * 返回生成的 YAML 字符串
     * 流式输出:通过 emit "skill_gen:token" 推送进度
   - refine_skill_from_chat(current_yaml: String, refine_instruction: String, model_config_id: Option<String>) -> Result<String>
     * 用户对已生成的 Skill 提出修改意见,例如:"输出维度再加一项:作者机构信息"
     * 元提示词:基于当前 YAML 和用户的修改意见生成新版本
     * 同样流式输出
   
3. 前端 - 全新的"用 AI 创建 Skill"界面(src/pages/SkillGenerator.tsx 新建):
   设计为类 Claude.ai 的对话式构建体验:
   
   - 路由:/skills/generate
   - 入口:Skill 管理页顶部"+ 新建 Skill"按钮展开下拉,提供两个选项:
     a. ✨ 用 AI 创建(推荐)→ /skills/generate
     b. 📝 手动创建(高级)→ 跳转原有的 Skill 编辑器
   
   - 页面布局(类 Claude.ai 的对话风格):
     * 左侧 50%:对话式构建区
       - 标题:"✨ 用 AI 创建 Skill"
       - 副标题:"描述你想要的 Skill,AI 会帮你自动生成配置"
       - 顶部模型选择器(右上角,小型,允许切换用哪个模型生成)
       - 引导提示卡片(初次访问):
         "试试这样描述:
          - 我想分析临床试验文献,重点关注实验设计和统计方法
          - 帮我做一个 Skill 用来评估论文的新颖性和影响力
          - 我需要一个专门读综述的 Skill,输出领域脉络和未解问题"
       - 对话消息列表(类似 Chat 模块):
         * 用户消息:右侧蓝色气泡
         * AI 消息:左侧白色气泡,流式渲染
         * AI 第一次回复后,在消息下方显示一个折叠卡片:"✅ Skill 已生成,在右侧预览"
       - 底部输入框:
         * 多行 textarea
         * 占位符:"描述你想要的 Skill,或者对当前 Skill 提建议..."
         * 发送按钮
     
     * 右侧 50%:Skill 实时预览
       - 顶部 Tab 切换:配置 / YAML 源码 / 测试运行
       - 配置 Tab(默认):
         * 友好展示:名称、描述、推荐模型徽章、输出维度列表(图标 + 名称)
         * Prompt 模板:折叠展示,点击展开
       - YAML 源码 Tab:Monaco 只读模式,显示生成的完整 YAML
       - 测试运行 Tab:
         * 选择一篇示例文献 + 模型,点击"运行测试"
         * 实时展示解析结果(按 output_dimensions 渲染)
       - 底部操作栏:
         * "💾 保存为 Skill" 按钮(主色):保存后跳转到 Skill 管理页
         * "✏️ 切换到高级编辑器" 链接:把当前生成的 YAML 传入手动编辑器
         * "🗑️ 重新开始" 链接

4. 关键交互细节:
   - 用户首次输入需求 → 调用 generate_skill_from_description → 流式生成 → 右侧预览自动切换到"配置"Tab
   - 用户在对话中继续提改进意见 → 调用 refine_skill_from_chat → 替换右侧预览
   - 用户在右侧"配置"Tab 中直接修改字段(比如改名称、加输出维度),也会反映到 YAML
   - 保存前再做一次完整校验
   - 防丢失:对话内容与最新 YAML 自动暂存到 localStorage(key: skill-gen-draft)

5. UI 状态管理 (src/stores/skillGeneratorStore.ts):
   - messages: Message[](对话历史)
   - currentYaml: string(最新生成的 YAML)
   - currentSpec: SkillSpec | null(解析后的结构)
   - selectedModel: string
   - streamingMessageId: string | null
   - actions: sendMessage / refineSkill / saveSkill / reset / loadDraft

6. 失败处理:
   - 模型未配置:首次进入页面,如果用户还没配置任何模型,显示引导提示
     "✨ AI 创建 Skill 需要先配置一个 AI 模型 → [前往模型配置]"
   - 生成的 YAML 解析失败:自动重试 1 次;再失败时,给用户友好提示
     "AI 生成的 Skill 格式有问题,你可以重新描述,或切换到高级编辑器手动修改"
   - API 限流 / 网络错误:展示错误信息,允许用户重试

7. 性能与体验:
   - 流式渲染:用 useTransition 包裹 token 追加
   - 大段 YAML(>500 行)的预览解析采用 debounce 500ms
   - 保存按钮:在 YAML 校验通过前为灰色不可点

8. 文档与示例:
   - 在 docs/ 下新增 skill-authoring-guide.md
     - 说明 Skill 的两种创建方式(AI 自动 vs 手动)
     - 给出 5 个高质量的"自然语言描述"示例,方便用户参考
   - 在 Skill 管理页的 hero 区域,加一个"查看示例 Skills"链接,指向官方仓库的 examples 目录

9. 测试:
   - 单元测试(Rust):验证 meta prompt 渲染正确、YAML 提取正确、校验失败时重试逻辑正确
   - E2E:输入一个真实需求,验证生成的 YAML 能通过 validate_skill 校验
   - 手动测试:
     a. "我想要一个分析临床试验文献的 Skill" → 检查生成的 Skill 是否合理
     b. 继续说"加一个输出维度:伦理审查情况" → 验证 refine 工作
     c. "把推荐模型改为 GPT-5" → 验证 refine 工作
     d. 保存 → 在 AI 解析中能选择并使用

确保 cargo test skill_engine::generator:: 通过,手动测试 4 个场景都正常工作。
```

验证:
- 用 3-4 个不同的自然语言描述测试,生成的 Skill 都合理可用
- 在 AI 解析中使用生成的 Skill 对真实论文执行解析
- `git commit -m "feat: session 24 - AI-powered skill generator"`

---

### V2.1.0 收尾:Beta + 发布

完成 Session 19-24 后,进入 Beta 与发布阶段:

1. 合并 feature/v2.1.0 到 main:
```cmd
git checkout main
git merge --no-ff feature/v2.1.0
git push
```

2. 打 Beta tag:
```cmd
git tag v2.1.0-beta.1
git push --tags
```

3. GitHub Releases 创建 prerelease,邀请 V2.0.1 活跃用户参与 Beta。

4. Beta 期 1 周,重点关注:
   - 数据迁移功能(高风险)的稳定性
   - 多语言显示在不同系统下的兼容性
   - Skill 生成器的产出质量

5. 正式发布:
```cmd
git tag v2.1.0
git push --tags
```

6. 公告:重点宣传"AI 自然语言创建 Skill"(差异化亮点)、多语言支持(国际化)、数据目录可配置(进阶用户福音)。

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

---

## V2.1.0 Session 速查

| Session | 主题 | 对应需求 | 预估时长 |
|---------|------|---------|---------|
| 19 | 菜单顺序调整 + 移除自动备份 | R4 + R6(快赢) | 0.5 天 |
| 20 | 多语言基础设施(5 语言 + 跟随系统) | R3 | 1 周 |
| 21 | 自动更新调度配置(开关 + 频率 + 时间) | R2 | 3 天 |
| 22 | 数据目录可配置 + 迁移逻辑 | R1 | 1 周 |
| 23 | Token 统计写入 + 近 7 天展示 | R5 | 0.5 周 |
| 24 | Skill 自然语言生成器 ⭐ | R7 | 1 周 |

**总计**: ~4 周(与实施方案 V2.1.0 一致)

---

## 所有版本 Session 对照

| 版本 | Session 范围 | 主题 | 状态 |
|------|------------|------|------|
| V2.0.0 | 1-12 | 桌面客户端核心功能基线 | 已发布 |
| V2.0.1 | 13-18 | Chat + Skill 编辑 + 跨模块跳转 | 已发布 |
| V2.1.0 | 19-24 | 设置完善 + 国际化 + Skill 智能生成 | 开发中 |
