# SGHUB 开发 Session 任务清单

> 使用方式: 每个 Session 对应一次 Claude Code 会话。
> 打开 VS Code → 点击侧栏 Spark 图标 → 粘贴 Session 的 Prompt → 开始。
> 每个 Session 完成后 `git add . && git commit`,再进入下一个。

---

## 准备阶段 (在开始 Session 之前)

### 前置条件
- [ ] VS Code 已安装 (≥ 1.98.0)
- [ ] Node.js 已安装 (≥ 18.x): `node --version` 确认
- [ ] Rust 已安装: `rustc --version` 确认 (若未安装: https://rustup.rs)
- [ ] Claude Code VS Code 插件已安装: 扩展商店搜 "Claude Code" → 安装 Anthropic 官方版
- [ ] 登录 Claude 账号 (点击侧栏 Spark 图标即可触发登录)
- [ ] 创建项目目录: `mkdir sghub && cd sghub && git init`
- [ ] 将 CLAUDE.md 放到项目根目录
- [ ] 将 docs/ 和 skills/ 目录放到项目根目录

### VS Code 插件使用方式
1. 点击左侧栏的 ✨ (Spark) 图标打开 Claude Code 面板
2. 在输入框粘贴 Session 的 Prompt
3. Claude 会自动读取 CLAUDE.md 了解项目背景
4. Claude 生成代码后,会以 inline diff 形式展示,点击 Accept 接受
5. 可以用 @文件名 引用项目中的文件提供额外上下文
6. 如果结果不满意,按 Esc 两次回退到上一个 checkpoint

---

## M1 · 工程骨架 (Week 1-2)

### Session 1: Tauri 2 项目初始化
```
帮我初始化一个 Tauri 2 项目。要求:

1. 前端: React 18 + TypeScript 5 + Vite + TailwindCSS 3
2. 安装前端依赖: zustand, @tanstack/react-router, react-i18next, i18next
3. Rust 侧 Cargo.toml 添加依赖: 
   - tauri 2.x (features: tray-icon, devtools)
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
   - productName: "SGHUB"
   - 窗口: 1200x800, 最小 900x600, 标题 "SGHUB"
   - 启用 tray icon
5. 确保 `cargo tauri dev` 能成功启动并显示 React 页面

项目名 sghub,参考 CLAUDE.md 中的仓库结构。
```

### Session 2: SQLite 数据库模块
```
实现 Rust 侧的 db 模块。要求:

1. 读取 @docs/data-model.sql 中的 schema
2. 用 refinery crate 管理 migration,把 data-model.sql 作为 V001
3. 实现 db::init() 函数:
   - 数据库路径: ~/.sghub/data/sghub.db (自动创建目录)
   - 开启 WAL 模式: PRAGMA journal_mode=WAL
   - 创建 r2d2 连接池 (pool_size=4)
   - 自动执行 migration
4. 在 Tauri setup hook 中调用 db::init()
5. 写单元测试: 验证表创建成功、FTS5 搜索可用
6. 确保 `cargo test` 全部通过
```

### Session 3: 基础 UI 布局
```
创建 SGHUB 的桌面应用基础布局。要求:

1. 自定义标题栏组件 (Titlebar.tsx):
   - macOS 风格红黄绿按钮区 (仅视觉,Tauri 处理实际行为)
   - 中间显示 "SGHUB"
   - data-tauri-drag-region 支持拖拽移动窗口
2. 侧边栏组件 (Sidebar.tsx):
   - Logo: "SGHUB" 品牌文字,版本号 v2.0.0
   - 导航菜单: 文献检索 / 今日推送 / 收藏夹 / AI 解析 / 模型配置 / 设置
   - 高亮当前选中项
3. 主内容区: 根据路由渲染不同页面 (先用占位文字)
4. TanStack Router 配置路由
5. TailwindCSS:
   - CSS 变量定义亮色/暗色主题 (参考原型的色板)
   - 侧栏深色背景 (#1A1F2E)
   - 主内容区浅色背景 (#F8F6F1)
6. 布局: 标题栏(固定顶部 36px) + 侧栏(220px) + 主内容区(flex-1)

参考 @CLAUDE.md 中的设计规范和配色。
```

### Session 4: Tauri IPC 骨架
```
搭建前后端 IPC 通信骨架。要求:

Rust 侧:
1. 创建以下 Tauri Command (先返回 mock 数据):
   - get_app_config() -> AppConfig
   - save_app_config(config: AppConfig) -> ()
   - search_papers(query: String, source: Option<String>) -> Vec<Paper>
   - get_folders() -> Vec<Folder>
   - get_model_configs() -> Vec<ModelConfig>
   - test_model_connection(model_id: String) -> TestResult
2. 定义对应的 struct (Paper, Folder, ModelConfig 等),derive Serialize/Deserialize
3. 在 main.rs 中注册所有 Command

前端侧:
4. 创建 src/lib/tauri.ts 封装所有 invoke 调用
5. 每个页面调用对应 Command 并展示返回数据
6. 类型定义与 Rust struct 保持一致

确保 cargo tauri dev 启动后,前端能成功调用后端 Command 并看到 mock 数据。
```

### Session 5: GitHub Actions CI
```
为项目创建 GitHub Actions 工作流。

1. .github/workflows/pr-check.yml (每次 PR 触发):
   - Lint: cargo clippy + eslint
   - Build: cargo build + npm run build
   - Test: cargo test + (npm test if exists)
   - 矩阵: ubuntu-latest + windows-latest + macos-latest

2. .github/workflows/release.yml (tag v*.*.* 触发):
   - 使用 tauri-apps/tauri-action
   - 构建: Windows x64 NSIS + macOS Universal DMG
   - 上传到 GitHub Release

3. 添加基础文件:
   - LICENSE (MIT)
   - README.md (简版,含项目描述 + 截图占位 + 安装说明 + 开发指南)
   - CONTRIBUTING.md (开发环境搭建 + 代码规范 + PR 流程)

参考 tauri-apps/tauri-action 的官方文档。
```

---

## M2 · 核心功能 Alpha (Week 3-8)

### Session 6: arXiv + Semantic Scholar 检索
```
实现 search 模块的前两个数据源。要求:

Rust 侧:
1. arXiv 检索: 通过 Atom RSS API (export.arxiv.org/api/query)
   - 解析 XML 响应 (用 quick-xml crate)
   - 提取: title, authors, abstract, arxiv_id, published, pdf_url
2. Semantic Scholar: 通过 Academic Graph API
   - GET /paper/search?query=xxx
   - 提取: title, authors, abstract, externalIds.DOI, url
3. 并发: tokio::join! 同时请求两个源,超时 10s 单源降级
4. 去重: DOI 精确匹配 + 标题相似度 (简单 lowercase 比较)
5. 结果写入 SQLite papers 表 + FTS5 索引
6. 更新 search_papers Command 为真实实现

前端侧:
7. Search.tsx 页面:
   - 搜索框 + 数据源下拉 + 时间过滤 + 排序
   - 结果列表: 来源标签(颜色区分) + 标题 + 作者 + 摘要
   - 操作按钮: 收藏 / AI 精读 / 查看原文 / 下载 PDF
8. 搜索状态: loading / 结果数 / 耗时

写集成测试验证检索 + 入库 + FTS5 查询全链路。
```

### Session 7: PubMed + OpenAlex 检索
```
为 search 模块补充 PubMed 和 OpenAlex 两个数据源。

1. PubMed: E-utilities API (eutils.ncbi.nlm.nih.gov)
   - esearch.fcgi 搜索 → efetch.fcgi 获取详情
   - 解析 XML 响应
2. OpenAlex: REST API (api.openalex.org/works)
   - JSON 响应,提取 title, authorships, abstract_inverted_index (需反转)
3. 更新 search 模块的并发逻辑: 4 源 tokio::join!
4. 前端检索页: 数据源下拉添加 PubMed / OpenAlex 选项
5. 更新去重逻辑以覆盖所有 4 源
```

### Session 8: 模型配置中心
```
实现模型配置中心 (F5)。这是 V2.0 的核心差异功能。

Rust 侧:
1. model_configs CRUD (Tauri Commands)
2. keychain 模块: 用 keyring crate 存/取/删 API Key
   - set_api_key(service: "sghub", username: model_id, password: key)
   - get_api_key(service: "sghub", username: model_id)
3. test_model_connection: 发一个简单请求验证 Key + Endpoint
   - OpenAI: POST /chat/completions with "Hello"
   - Anthropic: POST /messages with "Hello"
   - Ollama: GET /api/tags (检查服务是否运行)
4. 内置 4 个预设模板 (Claude/GPT/DeepSeek/Ollama)

前端侧:
5. Models.tsx 页面:
   - 用量统计卡片 (4 格: 模型数/调用次数/Token/成本)
   - 已配置模型列表 (图标 + 名称 + endpoint + 状态 + 默认标记)
   - 每个模型: 编辑/测试/设为默认/删除
   - 添加新模型表单 (名称/Provider/Endpoint/Model ID/Key/Max Token)
6. Key 输入框: type="password", 脱敏显示

参考 @skills/general_read.yaml 中的 recommended_models。
```

### Session 9: 收藏夹系统
```
实现收藏夹系统 (F3)。

Rust 侧:
1. library 模块:
   - folders CRUD (含树形操作: 创建/移动/删除/排序)
   - folder_papers 关联 (收藏/取消收藏/移动)
   - tags CRUD + tag_papers 关联
   - 批量操作: 批量收藏/批量移动/批量标签
2. get_folders() 返回完整树 (递归构建)
3. get_papers_by_folder(folder_id) 分页查询
4. PDF 自动下载: 检测 OA 文献 → 下载到 ~/.sghub/data/pdfs/

前端侧:
5. Library.tsx 页面:
   - 左侧: 文件夹树 (缩进显示层级,计数徽章)
   - 右侧: 文献列表 (阅读状态颜色条,操作按钮)
   - 顶部: 文件夹内搜索 + 状态过滤 + 导出按钮
6. 拖拽: 文献卡片可拖入文件夹 (用 @dnd-kit/core)
7. 标签: 侧栏底部显示标签云,点击过滤
```

---

## M3 · AI 解析与推送 (Week 9-12)

### Session 10: AI Client 统一层
```
实现 ai_client 模块。这是整个应用最核心的技术模块。

1. 定义 trait AiProvider (参考 CLAUDE.md 中的设计)
2. 实现 OpenAiCompatible:
   - POST /chat/completions, stream: true
   - SSE 解析: data: {"choices":[{"delta":{"content":"..."}}]}
   - 覆盖: OpenAI / DeepSeek / LM Studio / 任意兼容 API
3. 实现 AnthropicProvider:
   - POST /messages, stream: true
   - SSE 解析: event: content_block_delta, data: {"delta":{"text":"..."}}
4. 实现 OllamaProvider:
   - POST /api/chat, stream: true
   - NDJSON 解析: {"message":{"content":"..."}}
5. 路由: 根据 ModelConfig.provider 分发到对应实现
6. 流式输出: 每个 token 通过 app.emit("ai:token", payload) 推到前端
7. Key 获取: 每次调用从 Keychain 临时读取,用完释放
8. 错误处理: 超时 / 401 / 429 / 网络错误,分别给出明确提示
9. Token 计数: 累加 input/output tokens,写入 usage_stats 表

写单元测试 mock HTTP 响应验证三种 Provider 的解析逻辑。
```

### Session 11: Skill 引擎 + AI 解析页
```
实现 Skill 引擎和 AI 解析完整流程。

Rust 侧:
1. skill_engine 模块:
   - 加载内置 Skill: 从编译时嵌入的 skills/*.yaml 读取
   - 加载自定义 Skill: 从 ~/.sghub/skills/*.yaml 读取
   - Prompt 模板渲染: 替换 {{title}}, {{authors}}, {{full_text}} 等变量
2. pdf_extract 模块: 用 pdf-extract crate 从 PDF 提取文本
3. start_parse Command:
   - 读取文献 PDF → 提取文本
   - 加载 Skill → 渲染 Prompt
   - 调用 ai_client 流式请求
   - 逐 token emit 到前端
   - 完成后存入 ai_parse_results 表
4. get_parse_history(paper_id) → 历史解析记录

前端侧:
5. Parse.tsx 页面:
   - 配置区: 选择文献 + Skill + 模型 → 开始解析
   - 结果区: 双栏布局,按维度分块展示
   - 流式渲染: 监听 ai:token 事件,逐字追加
   - 底部状态栏: Token 消耗 / 耗时 / 预估成本
6. 解析历史: 侧栏列表,点击可查看历史解析

参考 @skills/general_read.yaml 的模板和维度定义。
```

### Session 12: 定时订阅推送
```
实现关键词订阅与定时推送功能。

Rust 侧:
1. scheduler 模块:
   - 使用 tokio-cron-scheduler 创建定时任务
   - 可配置时间 (默认 08:00),从 config.toml 读取
   - 任务逻辑: 遍历活跃 subscriptions → 调用 search → 去重 → 写入 notifications
2. notify 模块:
   - 使用 tauri-plugin-notification 发送系统通知
   - 通知内容: "SGHUB: 发现 N 篇新文献" + 关键词预览
3. 离线处理: 检测网络状态,无网络跳过本次,下次联网补查
4. Tauri Commands:
   - get_notifications() → 通知列表
   - mark_notification_read(id)
   - get_subscription_results(subscription_id) → 命中文献

前端侧:
5. Feed.tsx 页面:
   - 今日推送文献列表 (按订阅分组)
   - 侧栏显示订阅列表 + 创建/编辑订阅表单
6. 侧栏徽章: 未读通知计数实时更新
```

---

## 每个 Session 结束后的标准动作

```bash
# 1. 确认编译通过
cargo tauri dev       # 或 cargo build + npm run build

# 2. 运行测试
cargo test
npm test              # 如果有前端测试

# 3. 检查代码质量
cargo clippy -- -D warnings
npx eslint src/

# 4. 提交
git add .
git commit -m "feat: <本 session 完成的功能>"
git push
```

---

## 提示词技巧 (让 Claude Code 效果最好)

1. **用 @文件名 给上下文**: 
   `参考 @CLAUDE.md 和 @docs/data-model.sql 实现 db 模块`

2. **让它跑命令验证**:
   `实现完后运行 cargo test 和 cargo clippy 确保通过`

3. **一次做完整模块**:
   不要说 "写一个函数",而是 "实现整个 search 模块,包含 Rust 后端 + Tauri Command + 前端页面 + 测试"

4. **出错时给报错信息**:
   直接粘贴编译错误,说 "修复这个错误"

5. **迭代优化**:
   `现在检索结果列表没有虚拟滚动,10000 条会卡。用 @tanstack/react-virtual 优化`
