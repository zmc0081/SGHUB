# SG Hub 开发 Session 任务清单

> 项目对外名称:SG Hub(带空格);技术标识符(包名 / bundleIdentifier com.sghub.app / 数据目录 sghub / 域名)保持不变。
> 项目路径: D:\2-WORK\恒星\项目\学术文献管理系统\SG_Hub
> 当前版本: V2.2.6

---

## 文档结构说明

本文档分三大部分:
1. **第一部分 · 项目基本介绍**:项目概述、准备阶段、使用方式、Session 完成后的验证步骤。
2. **第二部分 · 强制约束**:所有开发必须遵守的强制约束(UI、版本号、代码、安全等),CLAUDE.md 为权威源。
3. **第三部分 · Session 任务记录(倒序)**:按版本从新到旧排列(最新在最上),无需每次翻到底部。
   - <span style="color:#d00000">**红色标记 = 该版本尚未上线**</span>(规划中);未标红 = 已发布上线。

---

# 第一部分 · 项目基本介绍


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


## Claude Code 使用技巧

1. **首次使用**: 底部点 "Select folder..." 选 `D:\2-WORK\恒星\项目\学术文献管理系统\SG_Hub`
2. **给上下文**: 在 prompt 里提到 "读取 CLAUDE.md" 或 "参考 docs/data-model.sql"
3. **让它跑命令**: 说 "运行 cargo test 确认通过"
4. **出错时**: 把编译错误粘贴进去,说 "修复这些编译错误"
5. **迭代**: "搜索结果卡顿了,用虚拟列表优化 Search.tsx"
6. **模型选择**: 右下角可切换模型,复杂 Rust 代码建议用 Opus 或 High thinking

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



---

# 第二部分 · 强制约束(所有开发必须遵守)

> 以下为强制约束的汇总速查。**CLAUDE.md 是权威源**,每个 Session 开工前必须先读 CLAUDE.md。
> 任一违反 = PR 阻塞。

## 一、UI 设计规范(7 条硬规则,PR 阻塞级)

1. **禁用 V2.1 旧 token**:`bg-primary` / `text-app-fg` / `bg-accent` 等(已被 V2.2 token 取代)
2. **禁用 emoji 当图标**:全部用 Lucide(`lucide-react`),例外仅用户输入字段(如 Skill icon)
3. **禁用 `window.confirm/prompt/alert`**:用 `confirmAsync` / `promptAsync` / `useToast` 代替
4. **禁用 `transition-all`**:必须指定 property + motion token(`duration-fast/base/slow ease-khx`)
5. **禁止硬编码颜色**:`#XXXXXX` 仅允许在 `src/styles/index.css` 内出现
6. **必须双主题验证**:亮 / 暗模式都通过 WCAG AA(正文 4.5:1)
7. **不改基础设施**:不动 `src/lib/tauri.ts` invoke 签名 / `src/stores/*` shape / 路由 / i18next 命名空间(只增不改)

UI 改动开工前必读:`docs/ui-design/design-style-spec.md`、`component-specs.md`、`icon-map.md`、`interaction-flows.md`。
运行时 token 权威源:`src/styles/index.css` + `tailwind.config.js`。

PR 自查 6 条(grep 必须全为 0):
```
grep -rE 'bg-primary[^-]|text-app-fg|bg-accent[^-]' src/  → 0
grep -rE 'transition-all' src/                           → 0
grep -rE 'window\.(confirm|prompt|alert)' src/           → 0
grep -rP '[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]' src/ → 0
grep -rE '#[0-9A-Fa-f]{6}' src/                          → 仅 src/styles/index.css
eslint src --max-warnings 0                              → clean
```

## 二、版本号统一更新检查(强制)

每次发版,以下所有涉及版本号的位置必须同步更新为同一版本号,任一不一致 = 发布阻塞:
1. `src-tauri/tauri.conf.json` 的 `version`
2. `src-tauri/Cargo.toml` 的 `[package] version`
3. `package.json` 的 `version`
4. **隐私协议中的版本号 / 生效日期**(中英文两份)
5. README 中的版本号 / 徽章(如有)
6. CLAUDE.md 顶部"当前版本"
7. 应用内"设置/关于"显示的版本号(从 tauri.conf.json 读取,不硬编码)

- 用 `scripts/check-version` 扫描全部位置并校验一致,接入 CI(pr-check)作为发布阻塞项
- 配套 `bump-version` 一键同步全部位置(含隐私协议中英文)
- **隐私协议的版本号必须与设置中显示的版本号保持一致**

## 三、代码规范(强制)

**Rust**:`cargo fmt` + `cargo clippy -- -D warnings`;库代码用 thiserror、应用代码用 anyhow;
Tauri Command 返回 `Result<T, String>`;I/O 用 async;日志用 tracing,不用 println!;路径用 PathBuf。

**TS/React**:ESLint + Prettier,strict;函数组件 + hooks;跨组件状态用 Zustand;
Tauri 调用统一封装在 `src/lib/tauri.ts`;样式用 Tailwind utility,不写自定义 CSS(除 CSS 变量)。

**通用**:Conventional Commits(feat:/fix:/docs:/chore:);分支 main / develop / feature/*;
每个 PR 有描述 / 影响范围 / 测试方式;路径跨平台兼容。

## 四、打包与发布(强制)

- Logo 更换需重新完整构建(`cargo tauri build`),图标构建期嵌入,dev 模式看不到
- 发布前 `cargo clean` 清理 dev 残留,避免快捷方式被"修复"指向开发目录的旧版
- Windows 代码签名(消除 SmartScreen)/ macOS 签名 + 公证(消除 Gatekeeper)
- NSIS:装前清旧版、卸载程序完整性(避免幽灵卸载项)、快捷方式指向正式安装目录
- 严格执行版本号统一更新检查

## 五、安全与隐私(强制)

- API Key 只存 Windows Credential Manager,永不写明文 / 日志
- BYOK 模式数据直连模型提供商,不经任何 SG Hub 服务器
- AI Store 模式请求经 sgaistore.com 网关,网关仅记录用量元数据,不存论文内容
- 翻译会把文本发送给已配置的大模型/翻译服务,隐私协议须如实告知
- 安装后强制阅读隐私协议方可进入应用;协议版本号纳入统一更新检查
- 成本估算功能已彻底移除(V2.2.5),后续不要再实现价格字段 / 成本计算

## 六、产品级硬约束

- 安装包 < 100MB,内存 < 200MB,冷启动 < 3 秒
- 依赖许可证兼容 MIT(禁止 GPL 传染)
- Windows 10 21H2+ 与 macOS 12+ 必须支持
- 本地 PDF 单文件 < 100MB,重复上传需检测提示


---

# 第三部分 · Session 任务记录(倒序排列)

> 最新版本在最上方。<span style="color:#d00000">**红色版本标题 = 尚未上线(规划中)**</span>。
> 已发布:V2.0.0 ~ V2.2.8(Session 1-43),全部已上线。
> 规划中(未上线):V2.2.9(Session 44-46)。

## <span style="color:#d00000">●</span> M2.2.9 · 解析任务后台化修复 + UI 微调 + 文献库按钮重排(Week 44-46) <span style="color:#d00000">[未上线]</span>

> V2.2.9 基于已发布的 V2.2.8 继续迭代,包含 7 条需求:
> ① AI 解析进行中输出区动效;② 侧栏版本号左对齐;③ 已连接模型展示区位置调整
> (从 V2.2.8 的位置移至"两添加卡与购买引导行之间");
> ④ 解析任务后台化(切菜单不中断、记录不丢失);⑤ Skill 解析无结果排查修复;
> ⑥ 文献数据库"编辑"→"文件"(打开文件夹并定位);⑦ 文献库按钮重排与改名。
>
> 开工前必读 CLAUDE.md。遵守 7 条硬规则,提交前过 PR 自查 6 条。

### 本次需求清单

| 编号 | 需求 | 所属 Session |
|------|------|-------------|
| R1 | AI 解析进行中,输出区显示动效(音符跳动类简单效果) | Session 44 |
| R2 | 侧栏底部版本号改为**左对齐**(当前为居中) | Session 44 |
| R3 | 已连接大模型展示区位置调整:置于"添加自有模型 / SG AI Store Key"两并列卡 与 "前往 SG AI Store 购买"引导行**之间** | Session 44 |
| R4 | 解析任务后台化:切换菜单解析继续不中断;解析记录切换后不消失 | Session 45 |
| R5 | 排查修复:应用 Skill 解析任务中断、无生成结果(输出显示"尚未生成此维度") | Session 45 |
| R6 | 文献数据库"编辑"按钮替换为"文件":点击打开本地文件夹并定位到该文件 | Session 46 |
| R7 | 文献数据库按钮重排与改名(中英文同步):原文→来源(倒数第二)、打开PDF→查看(星标后) | Session 46 |

> ⚠️ R7 排布说明:用户需求 7c 列出的最终排布未含"来源",但 7a 明确保留并置于删除之前。
> 按 7a+7c 融合执行:**收藏、查看、AI精读、翻译、文件、移动、来源、删除**。
> 若"来源"需移除,以用户后续确认为准。

### 在开始 Session 44 之前

确认 V2.2.8 已发布并稳定,本地分支已同步:
```cmd
cd D:\2-WORK\恒星\项目\学术文献管理系统\SG_Hub
git checkout main
git pull
git checkout -b feature/v2.2.9
```

---

### Session 44: 解析动效 + 侧栏版本号左对齐 + 已连接模型位置调整

```
读取 CLAUDE.md。本次任务三项 UI 调整(均为对 V2.2.8 已上线效果的微调/新增)。

== R1:AI 解析进行中输出区动效 ==

1. AI 解析页,解析进行中时,输出区(结果卡区域)显示轻量动效:
   - 效果参考:音符跳动 / 律动条(equalizer bars)类的简单跳动效果
     —— 3-5 根小竖条循环起伏,或圆点依次跳动
   - 纯 CSS 动画实现(@keyframes),轻量无依赖
   - 严格遵守硬规则:禁用 transition-all;循环动画用 CSS animation,
     时长/缓动用设计系统 motion token;颜色用 token,不硬编码
2. 动效状态机:
   - 解析开始 → 显示动效 + "解析中…"文案
   - 流式输出到达 → 动效保留在区块头部或随内容渐隐(以视觉协调为准)
   - 解析完成/失败 → 动效停止移除
   - 双主题下动效颜色都清晰

== R2:侧栏版本号左对齐 ==

3. 侧栏底部版本号(V2.2.8 已实现,当前居中显示):
   - 改为**左对齐**,与版权信息文字左对齐一致
   - 其余保持:从 tauri.conf.json 读取、小字号 text-tertiary、折叠态不显示

== R3:已连接大模型展示区位置调整 ==

4. 位置调整(V2.2.8 已实现该展示区,本次移动位置):
   模型配置页中,移至"添加自有模型 / 已在 SG AI Store 购买?"两张并列卡 与
   "还没有 SG AI Store 配额?…前往 SG AI Store 购买"引导整行 **之间**
5. 展示形式保持/完善:
   - 模型名胶囊列表:provider 图标(Lucide)+ 显示名;默认模型星标;ADC 型 "ADC" 小徽章
   - 点击胶囊定位/滚动到下方对应模型卡片
   - 无已连接模型时:空态引导文案或整区隐藏(以布局协调为准)

== 测试 ==
- 解析中动效流畅(无卡顿),完成后停止;双主题正常
- 版本号左对齐,与设置一致,折叠隐藏
- 已连接模型区位于两添加卡与购买行之间;胶囊点击定位;星标/ADC 徽章正常
- PR 自查 6 条全过(尤其无 transition-all、无硬编码色);npm run build + eslint 0 warning
```

验证:
- 三项 UI 调整落地
- `git commit -m "feat: session 44 - parse animation, version align-left, connected models placement"`

---

### Session 45: 解析任务后台化(切页不中断)+ Skill 解析无结果排查修复

```
读取 CLAUDE.md。本次任务修复 AI 解析任务生命周期的两个严重问题(高优):
问题 A(R4):解析进行中切换到其它菜单,任务中断;已完成的解析,切换菜单后记录也消失。
问题 B(R5):应用 Skill 进行文献解析,任务中断、无生成结果——
  界面输出区显示"(尚未生成此维度)",但 token 已消耗(如 out≈13k-26k)、耗时 200+ 秒。

== R4:解析任务后台化与状态保持 ==

1. 根因方向(先读代码确认):
   - 解析的流式事件监听器(ai:token 等)很可能注册在 Parse 页面组件内,
     组件卸载(切换菜单)时监听器销毁,甚至触发了取消逻辑
   - 解析历史/当前结果可能只存在组件局部 state,卸载即丢
2. 修复方案:
   - 解析任务状态提升到全局 Zustand store(parseStore):
     任务 id、状态(running/done/failed)、进度、流式缓冲、结果、历史列表
   - 流式事件监听注册在 App 级(应用启动时注册一次),写入 parseStore;
     Parse 页面只做展示与订阅——组件卸载不影响任务
   - Rust 侧解析任务本就独立于前端页面运行,确认后端没有因前端断开而 abort;
     若存在"页面卸载即调用取消 command"的逻辑,移除(取消只由用户点击停止触发)
   - 切回 AI 解析页:恢复进行中任务的实时进度,或展示已完成结果
   - 解析进行中切换菜单时,侧栏"AI 解析"项可加进行中指示(小动效点,复用 Session 44 R1 的动效元素)
3. 解析记录持久化:
   - 解析历史与结果写入 SQLite(ai_parse_results 表应已存在,确认落库时机),
     历史列表从数据库读,不依赖组件内存
   - 应用重启后历史仍在

== R5:Skill 解析中断无结果排查 ==

4. 现象复盘(用户实测):
   - Skill: research-scientific-literature,模型 Google Vertex (Gemini)
   - token 已消耗(in≈4952 / out≈13161-26324),耗时 219-267s,
     但输出区显示"(尚未生成此维度)",解析历史里也无可查看的结果
5. 排查步骤(按可能性排序):
   a. 与 R4 同因:用户中途切过页面 → 监听器销毁,流式内容丢失、结果未写库
      → R4 修复后回归验证此场景
   b. 流式完成回调未触发/未落库:检查 stream done 事件 → 保存 ai_parse_results 的链路;
      Vertex streamGenerateContent 的结束标志解析是否正确(与 OpenAI [DONE] 不同,
      是 JSON 数组流结束/finishReason)
   c. 超长输出:out≈26k tokens 属超长输出,检查:
      * Vertex maxOutputTokens 配置是否导致截断(finishReason=MAX_TOKENS)
      * 截断后 HTML 报告不完整 → 维度/Tab 切分解析失败 → 显示"尚未生成此维度"
      → 对策:完成回调里无论 HTML 是否完整都保存原始输出;维度切分失败时
        降级展示原始内容 + "报告可能不完整"提示,而不是显示空
   d. 前端维度渲染逻辑:检查"输出"卡的维度切分/匹配规则,对 Skill 生成的
      HTML/Markdown 结构变化是否过于严格
   e. 超时:确认前端/后端是否存在固定超时(如 120s/300s)把长任务掐断
6. 修复与兜底:
   - 修根因(按排查结论)
   - 兜底原则:**只要模型有输出,必须可见可查**——原始输出始终落库,
     维度化展示失败时降级为原文展示,绝不显示空结果
   - 失败时错误信息明确(截断/超时/解析失败分类),日志记录 finishReason 与原始响应片段
7. 回归测试矩阵:
   - 长输出 Skill(>10k tokens 输出)× 解析全程停留页面 / 中途切页再回
   - Vertex ADC 与 api_key 型模型各跑一遍
   - 解析中断电/杀进程后重启:历史不丢(已完成部分)

== 测试 ==
- 解析进行中切换任意菜单再切回:任务继续、进度/结果恢复;完成后记录仍在
- 应用重启后解析历史可查
- 长输出 Skill 解析:结果完整可见;若被截断,降级展示 + 明确提示,不再出现空的"尚未生成此维度"
- 侧栏进行中指示正常
- PR 自查 6 条全过;cargo test + npm run build + eslint 0 warning
```

验证:
- 解析任务切页不中断、记录持久;Skill 解析无结果问题根因修复 + 兜底生效
- `git commit -m "fix: session 45 - background parse tasks, skill parse result loss"`

---

### Session 46: 文献数据库按钮重排与改名(文件/来源/查看)

```
读取 CLAUDE.md。本次任务调整文献数据库文献卡片的操作按钮:功能替换、重排与改名,
中英文语言包同步(五语言包都更新,以中英为主对照)。

== 现状(改前)==
收藏星标、AI 精读、原文、翻译、打开 PDF、移动、编辑、删除

== 目标(改后,最终排布)==
**收藏、查看、AI 精读、翻译、文件、移动、来源、删除**

| 按钮 | 变更 | 说明 |
|------|------|------|
| 收藏(星标) | 位置不变(第 1) | 不变 |
| 查看 | "打开 PDF"改名 + 移位 | 移到收藏星标之后(第 2);英文 Open PDF → View |
| AI 精读 | 顺延 | 不变,第 3 |
| 翻译 | 顺延 | 不变,第 4 |
| 文件 | "编辑"按钮替换(R6) | 第 5;功能改为:打开本地文件夹并定位到该文件;英文 Edit → File |
| 移动 | 顺延 | 第 6 |
| 来源 | "原文"改名 + 移位 | 倒数第 2(第 7);英文 Original → Source |
| 删除 | 位置不变(最后) | 不变 |

== R6:"文件"按钮实现 ==

1. 功能:点击后在系统文件管理器中打开该文献 PDF 所在文件夹,并**选中/定位**该文件
   - Windows:explorer /select,"{pdf_path}"
   - macOS:open -R "{pdf_path}"
   - 实现:Tauri command(如 reveal_in_folder(path)),或 tauri-plugin-opener 的 reveal 能力
2. 可用性判断:
   - 文献有本地 PDF(pdf_path 存在且文件在磁盘上)→ 按钮可用
   - 无本地 PDF → 按钮禁用(灰态)+ tooltip 说明"暂无本地文件"
   - 文件已被移动/删除 → 点击时 useToast 提示"文件不存在",并提供清理/重新下载引导
3. 原"编辑"(元数据编辑)功能去向:
   - 元数据编辑不删除,入口收纳:移入卡片"更多"菜单(若有)或双击标题进入编辑,
     读现有交互结构选最协调方案 —— 确保编辑元数据能力仍可达
4. 图标:Lucide(如 FolderOpen),不用 emoji

== R7:重排与改名 ==

5. 按上表调整按钮顺序与文案;
   i18n 五语言包同步(zh-CN/zh-TW/en-US/ja-JP/fr-FR),英文对照:
   - 查看 → View;来源 → Source;文件 → File
6. 一致性:文献检索结果卡的"原文/全文 PDF/翻译"语义与文献库不完全相同,
   本期只改文献数据库,检索页保持不变(避免语义混淆);验证时与用户确认

== 测试 ==
- 按钮排布 = 收藏、查看、AI精读、翻译、文件、移动、来源、删除
- "文件":有本地 PDF 时打开资源管理器并选中文件(Windows/macOS 都验);无文件禁用;文件丢失提示
- "查看"打开内置 PDF 阅读器;"来源"打开文献来源链接(原"原文"行为)
- 元数据编辑入口仍可达
- 中英文文案正确;五语言包同步
- PR 自查 6 条全过;npm run build + eslint 0 warning
```

验证:
- 文献数据库按钮按最终排布落地,"文件"定位本地文件功能可用,中英文同步
- `git commit -m "feat: session 46 - library card buttons rearrange and rename"`

---

### V2.2.9 收尾:Beta + 发布

1. 合并 feature/v2.2.9 → Beta tag → prerelease → 测试
2. Beta 重点:解析任务切页不中断与长输出 Skill 结果完整性(核心)、
   动效与两处 UI 微调、文献库按钮新排布与"文件"定位(双平台)
3. 发布前跑 check-version(版本号统一检查)
4. 正式发布:`git tag v2.2.9 && git push --tags`

---

## V2.2.9 Session 速查 <span style="color:#d00000">[未上线]</span>

| Session | 主题 | 对应需求 | 预估时长 |
|---------|------|---------|---------|
| 44 | 解析动效 + 侧栏版本号左对齐 + 已连接模型位置调整 | R1/R2/R3 | 0.5 周 |
| 45 | 解析任务后台化 + Skill 解析无结果排查修复 | R4/R5 | 1 周 |
| 46 | 文献数据库按钮重排与改名(文件/来源/查看) | R6/R7 | 0.5 周 |

**总计**: 约 2 周

**核心改进**:
- 解析任务后台化:切菜单不中断、记录持久化;"模型有输出必须可见可查"兜底(维度化失败降级原文)
- AI 解析进行中律动动效(纯 CSS,遵守 motion token 规范)
- 侧栏版本号左对齐;已连接模型区移至"两添加卡与购买行之间"
- 文献库按钮最终排布:收藏、查看、AI精读、翻译、文件、移动、来源、删除;
  "文件"= 打开文件夹并定位(explorer /select · open -R)

**关键提醒**:
- R7 排布按 7a+7c 融合(来源保留在倒数第二),如需移除以用户确认为准
- 元数据"编辑"能力不删除,入口收纳到更多菜单/双击,保持可达
- Session 45 为高优修复,不依赖 44,可优先执行
- 严格遵守 CLAUDE.md UI 设计规范(动效禁 transition-all),提交前过 PR 自查 6 条

---

## M2.2.8 · Vertex(ADC 免密)接入 + 模型显示与版本号 UI 调整(Week 42-43)【已发布】

> V2.2.8 包含:① Google Vertex(Gemini)以 ADC 免密方式接入,模型配置新增"认证方式"维度;
> ② 已连接大模型的显示位置调整(移至 Token 消耗图标上方,更醒目);
> ③ 侧栏底部版权信息下方新增版本号行(与设置一致,折叠态隐藏)。
>
> 开工前必读 CLAUDE.md(AI Client 设计要点 / 认证方式维度 / 版本号统一更新检查)。
> 遵守 7 条硬规则,提交前过 PR 自查 6 条。

### 本次需求清单

| 编号 | 需求 | 所属 Session |
|------|------|-------------|
| R1 | 模型配置新增"认证方式"维度:ADC 免密 与 API Key 并存,老配置默认 API Key 不受影响 | Session 42 |
| R2 | ADC 免密调用:不填不存 Key,后端自动获取并刷新访问令牌 | Session 42 |
| R3 | ADC 配置字段:项目 ID、区域(默认 global)、代理地址;隐藏 API Key 输入框 | Session 42 |
| R4 | 预设模板 "Google Vertex (Gemini)":一键填端点、模型清单与区域 | Session 42 |
| R5 | 测试连接:ADC 型真实发起最小请求验证;凭证缺失提示先完成本地登录授权 | Session 42 |
| R6 | 兼容企业代理转发 | Session 42 |
| R7 | 已连接大模型显示位置调整至 Token 消耗图标上方 | Session 43 |
| R8 | 侧栏底部版权下新增版本号行(与设置一致,折叠态隐藏) | Session 43 |

### 在开始 Session 42 之前

```cmd
cd D:\2-WORK\恒星\项目\学术文献管理系统\SG_Hub
git checkout main
git pull
git checkout -b feature/v2.2.8
```

---

### Session 42: Google Vertex(Gemini)ADC 免密接入

```
读取 CLAUDE.md(AI Client 设计要点)。本次任务为模型配置引入"认证方式"维度,
新增 ADC(Application Default Credentials)免密类型,并实现 Google Vertex (Gemini) 接入。

== R1:认证方式维度(数据模型)==

1. migration(V0XX__auth_type.sql):
   ALTER TABLE model_configs ADD COLUMN auth_type TEXT NOT NULL DEFAULT 'api_key';
   ALTER TABLE model_configs ADD COLUMN gcp_project_id TEXT;
   ALTER TABLE model_configs ADD COLUMN gcp_region TEXT DEFAULT 'global';
   ALTER TABLE model_configs ADD COLUMN proxy_url TEXT;
   - auth_type:'api_key'(默认)| 'adc'
   - 老配置自动归为 api_key 型,行为完全不变(向后兼容,回归测试确认)
2. ADC 型约束:不写 keychain、不校验 Key 存在;api_key 型逻辑保持原样

== R2:ADC 免密调用(Rust 后端)==

3. 新建 src-tauri/src/ai_client/vertex.rs(实现 AiProvider trait):
   - ADC 凭证链(按序探测):
     a. 环境变量 GOOGLE_APPLICATION_CREDENTIALS 指向的服务账号 JSON
     b. 用户 ADC 文件:Windows %APPDATA%\gcloud\application_default_credentials.json
        (macOS/Linux: ~/.config/gcloud/application_default_credentials.json)
   - 令牌获取与自动刷新:
     * authorized_user 凭证:用 refresh_token POST https://oauth2.googleapis.com/token 换 access_token
     * service_account 凭证:JWT 签名换 token(scope: https://www.googleapis.com/auth/cloud-platform)
     * 可选用 gcp_auth crate 简化(纯 Rust,覆盖上述凭证链);若引入需确认许可证兼容 MIT
   - token 内存缓存,过期前 5 分钟自动刷新;刷新失败自动重试一次后报错
   - 过期无需人工干预(R2 核心验收点)
4. Vertex 请求:
   - endpoint 规则:
     * region=global:https://aiplatform.googleapis.com/v1/projects/{project}/locations/global/publishers/google/models/{model}:streamGenerateContent
     * 区域化:https://{region}-aiplatform.googleapis.com/v1/projects/{project}/locations/{region}/...
   - Header:Authorization: Bearer {access_token}
   - 流式解析 streamGenerateContent 响应,对齐现有 chat_stream 的 token 流接口
   - 路由:ai_client/mod.rs 按 auth_type + provider 分发到 VertexProvider

== R6:企业代理兼容 ==

5. reqwest ClientBuilder 支持 proxy:
   - 模型配置的 proxy_url 非空时:Proxy::all(proxy_url)(支持 http/https/socks5)
   - 为空时走系统代理/直连
   - 令牌获取(oauth2.googleapis.com)与模型调用(aiplatform)都要走该代理
   - 参考环境:Sangfor VPN + 本地代理(如 http://127.0.0.1:10809)

== R3 + R4:前端配置表单与预设 ==

6. 添加/编辑模型表单(src/pages/Models.tsx):
   - 新增"认证方式"选择:API Key(默认)/ ADC 免密
   - 选 ADC 时:隐藏 API Key 输入框;显示 项目 ID(必填)、区域(默认 global,可改)、
     代理地址(选填,占位提示 http://127.0.0.1:10809)
   - 选 API Key 时:表单与现状完全一致
7. 预设模板新增 "Google Vertex (Gemini)":
   - 一键预填:auth_type=adc、endpoint 规则、区域 global、
     模型清单(gemini-2.5-pro / gemini-2.5-flash 等,以当前实际型号为准,可下拉选)
   - 用户只需填项目 ID(与可选代理)即可保存
8. 模型卡片(参考现有卡片样式):
   - ADC 型徽章显示 "ADC 免密"(替代 api_key 型的 "Key 已存 Windows Credential Manager")
   - 徽章用 Lucide 图标 + token 颜色,无 emoji

== R5:测试连接(ADC 真实验证)==

9. test_model_connection 按 auth_type 分流:
   - api_key 型:保持现有逻辑
   - adc 型:真实发起一次最小请求(generateContent, maxOutputTokens=1 或 countTokens),
     走完整链路(凭证→令牌→代理→endpoint),返回延迟与结果
   - 错误分类与提示:
     * 凭证缺失/无效 → 提示"未找到本地 ADC 凭证,请先运行:
       gcloud auth application-default login 完成本地登录授权"
     * 项目/权限错误 → 提示检查项目 ID 与 Vertex AI API 启用状态
     * 网络/代理错误 → 提示检查代理地址
   - 提示用 useToast/对话框组件,禁用 window.*

== 测试 ==
- 老配置(api_key 型)回归:行为不变
- ADC 型:不存 Key;令牌自动获取/过期自动刷新(可临时改短缓存验证)
- 预设一键创建 Vertex 模型,填项目 ID 即可用;Chat/AI 解析中流式正常
- 测试连接:ADC 真实请求;三类错误提示正确(删凭证文件模拟缺失)
- 代理:配置 proxy_url 后令牌与调用均经代理(抓包/日志验证)
- PR 自查 6 条全过;cargo test + npm run build + eslint 0 warning
```

验证:
- Vertex(Gemini)以 ADC 免密接入可用,认证方式维度落地,老配置零影响
- `git commit -m "feat: session 42 - vertex adc auth support"`

---

### Session 43: 已连接模型显示位置调整 + 侧栏版本号

```
读取 CLAUDE.md。本次任务两项 UI 调整。

== R7:已连接大模型显示位置调整 ==

1. 现状与目标:
   - 先读代码定位"Token 消耗"图标/统计的实际位置(模型配置页顶部统计区:
     已配置模型 / 近 7 天调用 / 近 7 天 Token 三卡)
   - 目标:把"已连接的大模型"从仅显示数量,升级为**显示具体模型名**(徽章/胶囊列表),
     位置调整到 Token 消耗图标/统计的**上方**,一眼可见已连接哪些模型
2. 实现建议(按实际结构适配):
   - 统计区上方新增一行"已连接模型":模型名胶囊(provider 图标 + 名称,默认模型加星标),
     ADC 型带 "ADC" 小徽章
   - 点击胶囊可快速定位到下方对应模型卡片
   - 原"已配置模型"数量卡可保留或合并入该行(以布局协调为准)
3. 遵守设计系统:Lucide 图标、token 颜色、无 emoji、双主题

== R8:侧栏底部版本号 ==

4. 在侧栏底部版权信息(Copyright © Star Technology. All Rights Reserved)**下方**
   新增一行版本号(如 "V2.2.8"):
   - 版本号从 tauri.conf.json 读取(app.getVersion() / tauri api),**不硬编码**,
     与设置中"当前版本"同源,天然一致(满足版本号统一更新检查)
   - 样式:小字号(10-11px)、text-tertiary、居中,与版权行视觉统一
5. 折叠态处理:
   - 侧栏折叠时**不显示版本号**(与版权简化逻辑一致:折叠态版权简化为 © Star Technology
     或隐藏,版本号直接隐藏)
   - 展开/折叠切换时无布局跳动

== 测试 ==
- 模型配置页:已连接模型名在 Token 统计上方清晰展示;点击定位;默认模型星标;ADC 徽章
- 侧栏展开:版权下方显示版本号,与设置页版本一致;折叠:版本号隐藏,布局稳定
- 双主题正常;PR 自查 6 条全过;npm run build + eslint 0 warning
```

验证:
- 已连接模型醒目展示于 Token 统计上方;侧栏底部版本号与设置一致且折叠隐藏
- `git commit -m "feat: session 43 - connected models placement + sidebar version"`

---

### V2.2.8 收尾:Beta + 发布

1. 合并 feature/v2.2.8 → Beta tag → prerelease → 测试
2. Beta 重点:ADC 令牌自动刷新稳定性、代理环境(Sangfor VPN)真实验证、老配置回归、
   两项 UI 在双主题与折叠态的表现
3. 发布前跑 check-version(版本号统一检查,含侧栏新增显示位)
4. 正式发布:`git tag v2.2.8 && git push --tags`

---

## V2.2.8 Session 速查(已发布)

| Session | 主题 | 对应需求 | 预估时长 |
|---------|------|---------|---------|
| 42 | Google Vertex(Gemini)ADC 免密接入 | R1-R6 | 1-1.5 周 |
| 43 | 已连接模型显示位置调整 + 侧栏版本号 | R7/R8 | 0.5 周 |

**总计**: 约 1.5-2 周

**核心改进**:
- 模型配置新增"认证方式"维度(API Key / ADC 免密),老配置零影响
- ADC:不填不存 Key,令牌自动获取与刷新;项目 ID / 区域(默认 global)/ 代理地址三字段
- "Google Vertex (Gemini)" 预设一键接入;测试连接对 ADC 真实发起最小请求
- 企业代理全链路兼容(令牌 + 调用)
- 已连接大模型名移至 Token 消耗上方醒目展示
- 侧栏底部版权下新增版本号(同源 tauri.conf.json,折叠隐藏)

**关键提醒**:
- ADC 凭证缺失时引导:gcloud auth application-default login
- 若引入 gcp_auth crate 需确认许可证兼容 MIT
- 版本号显示不硬编码,纳入既有 check-version 统一检查
- 严格遵守 CLAUDE.md UI 设计规范,提交前过 PR 自查 6 条

---


## M2.2.7 · Chat 模块交互与功能增强(参考 Claude 网页)(Week 40-41)【已发布】

> V2.2.7 把 Chat 模块对标 Claude 网页版,全面增强交互与功能:附件上传、Skill 调用、
> 消息复制 / 重新生成 / 编辑后重发、输入框旁的模型与版本下拉选择。
>
> 开工前必读 CLAUDE.md。遵守 7 条硬规则,提交前过 PR 自查 6 条。
> 复用基础:Chat 模块在 V2.0.1 Session 16 已建基础版(基本对话 + 流式),本次为交互与功能增强,
> 复用现有 chat 后端、ai_client、skill_engine、PDF 文本提取(V2.2.x),不重写底层。

### 本次需求清单

| 编号 | 需求 | 所属 Session |
|------|------|-------------|
| R1 | 整体交互重构,参考 Claude 网页布局 | Session 40 |
| R2 | 输入框旁下拉选择模型及模型版本(贴近 Claude 网页,切换即时生效) | Session 40 |
| R3 | 消息操作:复制、重新生成、编辑后重发 | Session 40 |
| R4 | Chat 中上传附件(PDF / 文本 / 图片,图片走多模态) | Session 41 |
| R5 | Chat 中调用 Skill(/ 唤起或按钮附加) | Session 41 |

### 在开始 Session 40 之前

```cmd
cd D:\2-WORK\恒星\项目\学术文献管理系统\SG_Hub
git checkout main
git pull
git checkout -b feature/v2.2.7
```

### 目标布局(参考 Claude 网页)

```
┌────────────────────────────────────────────────┐
│ 会话侧栏  │   对话主区                          │
│ + 新对话  │  ┌────────────────────────────────┐ │
│ 会话1     │  │ 用户消息          [复制][编辑]   │ │
│ 会话2     │  │ AI 回复(流式)                    │ │
│           │  │   [复制] [重新生成]              │ │
│           │  └────────────────────────────────┘ │
│           │  ┌────────────────────────────────┐ │
│           │  │ [附件缩略片]                     │ │
│           │  │ [+附件][/Skill]  输入…           │ │
│           │  │ [模型▼ Claude Opus 4.x]  [发送]  │ │
│           │  └────────────────────────────────┘ │
└────────────────────────────────────────────────┘
模型/版本下拉位于输入框内(底部),贴近 Claude 网页风格
```

---

### Session 40: Chat 交互重构 + 输入框模型下拉 + 复制/重新生成/编辑后重发

```
读取 CLAUDE.md。本次任务重构 Chat 交互(参考 Claude 网页),实现输入框旁模型/版本下拉,
以及消息复制 / 重新生成 / 编辑后重发。复用 V2.0.1 Session 16 的 chat 基础与 ai_client。

== 界面规格(按此线框与元素清单实现,严格遵循 docs/ui-design 设计系统)==

整体线框:
┌──────────────────────────────────────────────────────────┐
│ [会话侧栏 ~150px] │ [对话主区 flex-1]                       │
│                  │                                         │
│  会话(标题)      │   ┌─────────────────────────────[右对齐]│
│  [+ 新对话]按钮   │   │ 用户消息气泡(info 底色)             │
│  · 会话1(选中)   │   │            [复制] [编辑后重发]       │
│  · 会话2         │   └─────────────────────────────────────│
│  · 会话3         │   ┌[左对齐]─────────────────────────────│
│                  │   │ AI 回复气泡(白底+0.5px边)           │
│  (底部)          │   │   含代码块(mono,右上角单独复制按钮) │
│  © Star Tech     │   │ [复制] [重新生成]                   │
│                  │   └─────────────────────────────────────│
│                  │   ┌─────────────────────────────────────│
│                  │   │ [附件缩略片] [Skill 标签]            │
│                  │   │ 输入框(多行自适应)…                 │
│                  │   │ [📎附件][/Skill][模型▼]    [↑发送]   │
│                  │   └─────────────────────────────────────│
└──────────────────────────────────────────────────────────┘

元素清单与样式(全部用 Lucide 图标 + token 颜色,无 emoji、无硬编码色):
A. 会话侧栏(白底卡,0.5px 边,radius-md):
   - 顶部小标题"会话"(text-tertiary, 11px)
   - "新对话"按钮:ti-plus 图标 + 文字,描边按钮,text-info
   - 会话项:选中态用 background-info + text-info;未选 text-secondary
   - 底部 sticky 版权"© Star Technology"(text-tertiary, 10px, 顶部 0.5px 分隔线)
B. 对话主区(flex 列):
   - 消息流 flex:1,可滚动,自动滚到底
   - 用户消息:右对齐,气泡 background-info + text-info,radius-lg,max-width ~78%
     悬浮操作行(右对齐):ti-copy"复制" + ti-edit"编辑后重发"(text-tertiary, 11px)
   - AI 消息:左对齐,气泡 background-primary + 0.5px 边,radius-lg,max-width ~82%
     内含代码块:background-secondary, font-mono, 11px, 右上角 ti-copy 单独复制
     操作行:ti-copy"复制" + ti-refresh"重新生成"(text-tertiary, 11px)
C. 输入框(白底卡,0.5px border-secondary,radius-lg):
   - 上方:附件缩略片(background-secondary 小药丸,ti-file-type-pdf + 文件名 + ti-x 删除)
     + Skill 标签(background-info,ti-sparkles + "Skill: xxx" + ti-x)
   - 中部:多行自适应输入框(占位"继续提问…",text-tertiary)
   - 底部工具条 flex space-between:
     左:[ti-paperclip 附件按钮 28×28 描边] [ti-command Skill 按钮 28×28 描边]
        [模型下拉:ti-cpu + "Claude Opus 4.x" + ti-chevron-down,描边药丸]
     右:[发送按钮 32×32,主色填充 #534AB7(用 purple-600 token 等价),ti-arrow-up,白图标]
D. 模型下拉展开态(点击模型按钮弹出):
   - 按 provider 分组卡(background-secondary,radius):Claude(Opus/Sonnet 版本)/
     GPT·DeepSeek / SG AI Store(显示余额徽章 ¥xx.xx)
   - 每组可二级选具体版本(model_id)

交互细节:
- 发送中:发送按钮变停止(ti-player-stop),可中断流式
- Enter 发送 / Shift+Enter 换行(设置可切换)
- 复制成功 useToast"已复制";编辑后重发前 confirmAsync"将清除该消息之后的回复"
- 双主题(亮/暗)均需 WCAG AA;主色发送按钮在两主题下都清晰

== R1:整体交互重构(参考 Claude 网页)==

1. Chat 页面(src/pages/Chat.tsx)布局:
   - 左:会话列表(新建对话 / 历史切换 / 重命名 / 删除,复用现有 chat 会话存储)
   - 主区:消息流 + 底部输入区(无右侧面板,模型选择放输入框内)
2. 消息流:
   - 用户/AI 消息区分样式;AI 流式逐字渲染(复用 ai:token 事件)
   - Markdown 渲染(代码块高亮、表格、列表),代码块带复制按钮
   - 长对话虚拟滚动,自动滚到底(用户上滑时暂停自动滚动)
3. 输入区(参考 Claude 网页):
   - 多行自适应输入框,Enter 发送 / Shift+Enter 换行(设置可切换)
   - 底部一行工具条:左 [+附件] [/Skill](Session 41 实现,本次占位)+
     [模型下拉];右 [发送/停止]
   - 发送中显示停止按钮(中断流式)
4. 遵守设计系统:Lucide 图标、token 颜色、无 emoji、无 window.*、双主题

== R2:输入框旁模型/版本下拉(贴近 Claude 网页)==

5. 模型下拉(位于输入框底部工具条):
   - 下拉展开:列出"模型配置"中已配置的模型(复用 model_configs)
   - 按 provider 分组(Claude / GPT / DeepSeek / Ollama / SG AI Store)
   - 每个模型可展开/二级选具体模型版本(model_id)
   - SG AI Store 模型显示余额徽章
   - 下拉按钮上显示当前模型名(如 "Claude Opus 4.x ▼")
6. 切换即时生效,影响下一条消息;当前会话选用的模型记录到 chat 会话(切会话恢复)
7. 无模型时:下拉内引导"去模型配置添加"(跳转)

== R3:消息复制 / 重新生成 / 编辑后重发 ==

8. 复制:
   - 每条消息悬浮显示"复制"按钮,复制纯文本/Markdown;useToast 提示"已复制"
   - 代码块单独复制按钮(只复制代码)
9. 重新生成(AI 回复):
   - AI 回复下方"重新生成"按钮,用相同上文重新请求
   - 支持"换个模型重新生成"(结合模型下拉)
   - 结果替换原回复,可回看上一版(保留最近一版)
10. 编辑后重发(用户消息):
   - 用户消息悬浮"编辑"按钮,点击进入可编辑状态
   - 编辑后"重新发送":该消息之后的对话被截断,以编辑后的内容重新生成后续
   - confirmAsync 提示"这将清除该消息之后的回复"

== 复用与约束 ==
- 后端复用 chat 模块会话/消息存储与 ai_client::chat_stream
- 不改基础设施(tauri.ts 签名 / stores shape / 路由 / i18next 命名空间只增不改)
- 新增文案进 i18n 五语言包

== 测试 ==
- 布局正常;会话新建/切换/重命名/删除正常
- 输入框模型下拉:分组展示、选版本、即时生效、换会话恢复、余额徽章
- 每条消息可复制;代码块可单独复制
- AI 回复可重新生成、可换模型重新生成
- 用户消息可编辑后重发,后续对话正确截断重生成
- PR 自查 6 条全过;cargo test + npm run build + eslint 0 warning
```

验证:
- Chat 交互(参考 Claude 网页)、输入框模型/版本下拉、复制/重新生成/编辑后重发均可用
- `git commit -m "feat: session 40 - chat ui refactor, model dropdown, copy/regenerate/edit"`

---

### Session 41: Chat 附件上传 + Skill 调用

```
读取 CLAUDE.md。本次任务在 Chat 中实现附件上传与 Skill 调用。
复用 V2.2.x 的 PDF 文本提取与现有 skill_engine。

== R4:附件上传(PDF / 文本 / 图片)==

1. 输入框底部工具条 [+附件] 按钮,支持:
   - PDF:复用 pdf 文本提取(V2.2.x),提取文本注入对话上下文
   - 文本文件(.txt/.md):直接读入上下文
   - 图片(.png/.jpg):走多模态(base64 传给支持视觉的模型)
     * 当前选中模型不支持多模态时,禁用图片或给出提示
2. 附件展示:
   - 输入框上方以缩略片展示已添加附件(文件名/类型图标/可删除),支持多个
3. 附件作为上下文:
   - 本轮(或本会话)对话携带附件内容
   - 大文件做合理截断/分块,避免超上下文并提示用户
4. 后端:
   - chat 消息结构支持 attachments(类型/路径/提取文本/base64)
   - 多模态消息按 ai_client 各 provider 格式组装(OpenAI vision / Anthropic image 等)
   - 复用 pdf 提取 command

== R5:Skill 调用 ==

5. Skill 入口:
   - 输入 "/" 唤起 Skill 快捷选择面板(模糊搜索 Skill 名)
   - 或 [/Skill] 按钮打开 Skill 选择
6. 选中 Skill 后:
   - 本轮以该 Skill 的 prompt 模板处理(复用 skill_engine 模板渲染)
   - 输入框上方显示已选 Skill 标签(可移除)
   - Skill + 附件可组合(如用某 Skill 解读上传的 PDF)
7. 复用现有 skill_engine,不重写 Skill 加载/渲染逻辑

== 遵守 UI 硬规则 ==
- Lucide 图标(查 icon-map.md)、token 颜色、无 emoji、confirmAsync/useToast、双主题
- 文案进 i18n 五语言包;不改基础设施

== 测试 ==
- 上传 PDF/文本/图片各一,内容正确进入上下文;图片在不支持模型上给提示
- "/" 唤起 Skill 选择,选中后本轮按 Skill 处理
- Skill + 附件组合(用 Skill 解读上传 PDF)正常
- PR 自查 6 条全过;cargo test + npm run build + eslint 0 warning
```

验证:
- Chat 支持附件(PDF/文本/图片多模态)与 Skill 调用,可组合使用
- `git commit -m "feat: session 41 - chat attachments and skill invocation"`

---

### V2.2.7 收尾:Beta + 发布

1. 合并 feature/v2.2.7 到 main → 打 Beta tag → prerelease → 邀请测试
2. Beta 重点:交互流畅度、输入框模型下拉、复制/重新生成/编辑后重发、附件(各类型+多模态)、Skill 调用与组合
3. 正式发布:`git tag v2.2.7 && git push --tags`
4. 公告:Chat 模块全面升级(参考 Claude 网页),支持附件、Skill、模型版本下拉、消息复制/重生成/编辑重发

---

## V2.2.7 Session 速查(已发布)

| Session | 主题 | 对应需求 | 预估时长 |
|---------|------|---------|---------|
| 40 | Chat 交互重构 + 输入框模型下拉 + 复制/重新生成/编辑后重发 | R1/R2/R3 | 1.5 周 |
| 41 | Chat 附件上传 + Skill 调用 | R4/R5 | 1 周 |

**总计**: 约 2.5 周

**核心改进**:
- Chat 交互对标 Claude 网页:会话侧栏 + 对话主区,模型选择放输入框内
- 输入框旁模型/版本下拉,分组展示,切换即时生效
- 消息复制(含代码块单独复制)、重新生成(可换模型)、编辑后重发(截断后续重生成)
- 附件上传:PDF / 文本 / 图片(多模态)
- Skill 调用:/ 唤起或按钮附加,可与附件组合

**关键提醒**:
- 复用 V2.0.1 Session 16 的 chat 基础、ai_client、skill_engine、V2.2.x 的 PDF 提取,不重写底层
- 图片附件需模型支持多模态,不支持时禁用或提示
- 附件大文件做截断/分块,避免超上下文
- 编辑后重发会截断该消息之后的对话,需 confirmAsync 确认
- 严格遵守 CLAUDE.md UI 设计规范,提交前过 PR 自查 6 条

---

## M2.2.6 · 内置 PDF 阅读器 + 全文翻译 + 检索体验优化(Week 37-39)【已发布】

> V2.2.6 包含:软件内 PDF 阅读器、全文翻译(检索页 + 文献库)、检索状态保持、
> AI Store 内容并入模型配置页并取消菜单入口、安装后强制阅读隐私协议。
>
> 开工前必读 CLAUDE.md(检索层目标架构、PDF 阅读与翻译、AI Store 并入说明、
> 首次启动与隐私协议、版本号统一更新检查)。遵守 7 条硬规则,提交前过 PR 自查 6 条。

### 本次需求清单

| 编号 | 需求 | 所属 Session |
|------|------|-------------|
| R1 | 检索层目标架构写入文档(已在 CLAUDE.md / 本文档落地) | 文档 |
| R2 | 软件内打开 PDF,融合 PDF 阅读器 | Session 37 |
| R3 | 检索结果"全文 PDF"后新增"翻译"(大模型 + 成熟翻译架构,保结构/布局/专业) | Session 37 |
| R4 | 文献数据库"原文"与"下载 PDF"之间新增"翻译" | Session 37 |
| R5 | 检索状态保持:切换目录后返回仍保留搜索内容 | Session 38 |
| R6 | AI Store 内容并入"模型配置"页(购买按钮下方),取消侧栏 AI Store 菜单 | Session 38 |
| R7 | 安装后强制阅读隐私协议(同意后方可进入 Step 1) | Session 39 |
| R8 | 隐私协议更新(中英文)+ 版本号纳入统一更新检查 | Session 39 |

### 在开始 Session 37 之前

```cmd
cd D:\2-WORK\恒星\项目\学术文献管理系统\SG_Hub
git checkout main
git pull
git checkout -b feature/v2.2.6
```

---

### Session 37: 内置 PDF 阅读器 + 全文翻译

```
读取 CLAUDE.md,重点看"PDF 阅读与翻译(V2.2.6)"。本次任务实现软件内 PDF 阅读器,
并在检索结果与文献数据库新增"翻译"功能。

== 第一部分:内置 PDF 阅读器(R2)==

1. 前端 PDF 阅读器组件(基于 pdf.js):
   - npm 引入 pdfjs-dist(或复用项目已有 pdf.js)
   - 组件 src/components/pdf/PdfViewer.tsx:
     * 翻页 / 连续滚动 / 缩放 / 适应宽度 / 目录(outline)/ 页内搜索 / 跳页
     * 加载本地文件(data/pdfs/ 下)与已下载的 PDF
     * 工具栏用 Lucide 图标,遵循设计系统 token
   - 打开方式:应用内独立视图 或 标签页(不再调用系统外部程序)
2. 接入入口(都改为应用内打开):
   - 文献检索结果"全文 PDF" / "下载 PDF"
   - 文献数据库的打开 PDF / 本地上传的 PDF
   - Tauri 侧提供读取本地 PDF 字节流的 command(供前端 pdf.js 渲染)
3. 性能:大 PDF 懒加载分页渲染,避免一次性加载

== 第二部分:全文翻译(R3 + R4)==

4. 翻译后端(src-tauri/src/translate/ 新建):
   - 借助已配置大模型 + 成熟翻译工程方法
   - 流程:PDF/全文文本提取 → 结构化分块(标题/段落/列表/图表标注/公式占位)
     → 分块送大模型翻译(带上下文 + 术语一致性)→ 按原结构重组
   - 要求:保持文档结构不错乱、内容布局协调、语句专业(学术质量)
   - 术语一致性:维护术语表 / 传递上下文,确保同一术语全文统一
   - 两种模式:整篇替换 / 中外对照(左右或上下)
   - 长文档:分段流式翻译,展示进度;失败可重试单段
   - Tauri command:translate_document(paper_id 或 file_path, target_lang, mode)
     流式 emit "translate:progress" / "translate:token"
5. 翻译入口(按钮位置严格按需求):
   - 文献检索结果卡:在"全文 PDF"按钮**之后**新增"翻译"
   - 文献数据库卡:在"原文"与"下载 PDF"**之间**新增"翻译"
   - 图标用 Lucide(如 ti-language / Languages),不用 emoji
6. 翻译结果展示:
   - 在内置 PDF 阅读器旁/下以可读排版展示译文(Markdown 渲染)
   - 对照模式下原文与译文段落对齐
   - 可复制 / 导出译文

== 遵守 UI 硬规则 ==
- Lucide 图标、token 颜色、无 emoji、无 window.*、无 transition-all、双主题
- 文案进 i18n 五语言包

== 测试 ==
- 软件内打开 PDF:翻页/缩放/目录/搜索正常,不调用外部程序
- 检索结果"翻译"在"全文 PDF"之后;文献库"翻译"在"原文"与"下载 PDF"之间
- 翻译一篇真实论文:结构不错乱、术语一致、语句专业;长文档进度正常
- PR 自查 6 条全过;cargo test + npm run build + eslint 0 warning
```

验证:
- 内置 PDF 阅读器可用;两处"翻译"按钮位置正确;翻译质量达标
- `git commit -m "feat: session 37 - built-in pdf viewer and full-text translation"`

---

### Session 38: 检索状态保持 + AI Store 并入模型配置页

```
读取 CLAUDE.md(AI Store 并入模型配置页、侧边栏取消 AI Store)。本次任务两项。

== 第一部分:检索状态保持(R5)==

1. 问题:文献检索处于搜索状态时,切换到其它菜单再切回,检索内容全部归零
2. 修复:
   - 检索状态(查询词、过滤条件、数据源选择、结果列表、滚动位置)提升到持久的
     Zustand store(src/stores/searchStore.ts),而非组件局部 state
   - 切换路由/菜单时,Search 页组件卸载但 store 保留状态
   - 返回文献检索时,从 store 恢复:查询词、结果、过滤、滚动位置
   - 注意不破坏基础设施(stores shape 只增不改)
3. 边界:
   - 结果缓存合理上限(避免内存膨胀);用户主动清空/新检索时重置
   - "新检索"与"恢复上次"区分清楚

== 第二部分:AI Store 并入模型配置页 + 取消菜单(R6)==

4. 取消侧栏 AI Store 菜单项:
   - 修改 Sidebar,移除"AI Store"导航项
   - 导航顺序变为:Chat → 文献检索 → 今日推送 → AI 解析 → 文献数据库 → Skill 管理 → 模型配置 → 设置
   - 移除 /store 独立路由(或重定向到 /models)
5. AI Store 内容并入模型配置页:
   - 在"模型配置"页,"前往 SG AI Store 购买"按钮的**下方**,展示从 sgaistore.com
     同步的商品内容(商品列表/套餐卡片,供浏览与购买引导)
   - 复用 V2.2.x 的 ai_store 商品同步逻辑(拉 + SSE 推),只是展示位置从独立页迁到模型配置页
   - 保持余额查询、Key 配置、购买跳转等已有能力
   - 布局:模型配置页结构 = 已配置模型列表 + 添加入口(自有模型 / SG AI Store Key)
     + 购买引导按钮 + 其下方的 AI Store 商品展示区
6. 遵守 UI 硬规则;文案进 i18n 五语言包

== 测试 ==
- 搜索后切到别的菜单再切回:查询词、结果、过滤、滚动位置都恢复
- 侧栏无 AI Store 菜单;模型配置页购买按钮下方展示同步的商品内容
- 商品同步(SSE 推送)仍正常
- PR 自查 6 条全过;cargo test + npm run build + eslint 0 warning
```

验证:
- 检索状态切换菜单后保持;AI Store 并入模型配置页、菜单入口已取消
- `git commit -m "feat: session 38 - persist search state, merge ai store into models page"`

---

### Session 39: 安装后强制阅读隐私协议 + 隐私协议更新(中英文)

```
读取 CLAUDE.md(首次启动与隐私协议、版本号统一更新检查)。本次任务两项。

== 第一部分:安装后强制阅读隐私协议(R7)==

1. 在首次启动引导(V2.2.4)最前面新增"强制阅读隐私协议"步骤:
   - 安装后首次启动 → 先展示隐私协议(中英文,跟随系统语言,可切换)
   - 要求阅读:协议内容可滚动,滚动到底部后"我已阅读并同意"按钮才可点击
   - 同意后:记录同意状态 + 同意时的协议版本号到 bootstrap 配置,进入 Step 1(数据目录)
   - 未同意:不能进入应用(可提供"退出")
2. 协议版本变更:
   - 若协议版本号比用户上次同意的版本号更新,再次提示阅读并重新同意
3. bootstrap 配置扩展:privacy_agreed: bool / privacy_agreed_version: string

== 第二部分:隐私协议更新(中英文)+ 版本号纳入统一更新检查(R8)==

4. 更新隐私协议内容(src/assets/privacy/zh-CN.md 与 en-US.md):
   - 涵盖:本地存储、BYOK 直连不经服务器、AI Store 网关仅记录用量元数据不存内容、
     PDF 与翻译(翻译会把文本发送给已配置的大模型/翻译服务,需告知)、
     检索 API 数据流向、API Key 存 Keychain、用户数据权利、联系方式
   - 协议顶部标注版本号与生效日期,**与应用版本号一致**
5. 版本号统一更新检查(强制):
   - 实现/完善 scripts/check-version,扫描所有版本号位置并校验一致:
     tauri.conf.json / Cargo.toml / package.json / 隐私协议(中英文)/ README / CLAUDE.md /
     应用内显示
   - 任一不一致即报错,接入 CI(pr-check)作为发布阻塞项
   - 配套 bump-version 一键同步全部版本号(含隐私协议中英文)
6. 遵守 UI 硬规则;协议渲染用 react-markdown

== 测试 ==
- 全新安装首次启动:先强制阅读隐私协议,滚动到底才能同意,同意后进入数据目录步
- 未同意无法进入应用;协议版本更新后老用户被要求重新同意
- 隐私协议中英文完整、版本号与设置中一致
- check-version 能检出任一版本号不一致并阻塞;bump-version 一键同步
- PR 自查 6 条全过;cargo test + npm run build + eslint 0 warning
```

验证:
- 安装后强制阅读隐私协议流程正常;隐私协议中英文更新、版本号统一校验生效
- `git commit -m "feat: session 39 - mandatory privacy policy + unified version check"`

---

### V2.2.6 收尾:Beta + 发布

1. 合并 feature/v2.2.6 到 main → 打 Beta tag → prerelease → 邀请测试
2. Beta 重点:PDF 阅读器稳定性、翻译质量(结构/术语/专业)、检索状态保持、
   AI Store 并入后的体验、强制阅读隐私协议流程、版本号一致性
3. 正式发布:`git tag v2.2.6 && git push --tags`
4. 公告:内置 PDF 阅读器、全文翻译、检索体验优化、隐私协议合规

---


## V2.2.6 Session 速查（已发布）

| Session | 主题 | 对应需求 | 预估时长 |
|---------|------|---------|---------|
| 37 | 内置 PDF 阅读器 + 全文翻译 | R2/R3/R4 | 1.5 周 |
| 38 | 检索状态保持 + AI Store 并入模型配置页 | R5/R6 | 1 周 |
| 39 | 强制阅读隐私协议 + 隐私协议更新 + 版本号统一检查 | R7/R8 | 0.5-1 周 |

**总计**: 约 3 周

**核心改进**:
- 内置 PDF 阅读器(pdf.js),软件内打开,不依赖外部程序
- 全文翻译:大模型 + 成熟翻译工程,保结构/布局/专业;检索结果"全文 PDF"后、文献库"原文"与"下载 PDF"之间各加入口
- 检索状态保持:切换菜单返回不归零(状态提升到 store)
- AI Store 内容并入模型配置页(购买按钮下方),取消侧栏 AI Store 菜单
- 安装后强制阅读隐私协议方可进入;隐私协议中英文更新,版本号纳入统一更新检查
- 检索层目标架构(4 层流水线)写入 CLAUDE.md 与本文档

**关键提醒**:
- 翻译会把文本发送给已配置的大模型/翻译服务,隐私协议须如实告知
- 所有版本号位置(含隐私协议中英文)纳入 check-version 统一校验,发布阻塞
- 严格遵守 CLAUDE.md UI 设计规范,提交前过 PR 自查 6 条


---


---

## M2.2.5 · 打包发布完善 + 设置/模型配置 UI 优化(Week 35-36)【已发布】

> V2.2.5 解决一批在真实安装/使用中暴露的问题:打包发布的健壮性(Logo 生效、代码签名、
> 安装/卸载/快捷方式、跨平台一致性),以及版本号同步、设置简化、隐私协议归位、
> 模型配置 UI 优化。
>
> **开工前必读 CLAUDE.md**:特别注意新增的"版本号与打包一致性(强制流程)";
> UI 改动遵守 7 条硬规则,提交前过 PR 自查 6 条。

### 问题来源(真实安装中暴露)

| 问题 | 现象 | 所属 Session |
|------|------|-------------|
| Logo 未生效到产物 | 安装包/快捷方式仍是旧图标 | Session 35 |
| SmartScreen 安全提示 | "发布者未知",拦截运行 | Session 35 |
| 安装失败 / 幽灵卸载项 | 自定义目录安装失败;uninstall.exe 找不到无法卸载 | Session 35 |
| 快捷方式指向开发目录 | "修复"后打开旧 dev 版(2.2.1) | Session 35 |
| macOS 同类问题 | 待验证(DMG 图标/公证/Gatekeeper/自定义目录) | Session 35 |
| 版本号不一致 | 打包版本与代码版本可能不一致 | Session 35(+ CLAUDE.md 强制命令) |
| 设置"检查更新"过于复杂 | 频率/时间/行为配置太重 | Session 36 |
| 隐私协议位置 | 需归入隐私与更新区并合理分隔 | Session 36 |
| "添加模型"按钮太弱 | 底部按钮不明显 | Session 36 |

### 在开始 Session 35 之前

确认 V2.2.4 已发布并稳定,本地分支已同步:
```cmd
cd D:\2-WORK\恒星\项目\学术文献管理系统\SG_Hub
git checkout main
git pull
git checkout -b feature/v2.2.5
```

---

### Session 35: 打包发布完善(Logo / 签名 / 安装卸载 / 版本一致 / 跨平台)

```
读取 CLAUDE.md,特别注意"版本号与打包一致性(强制流程)"。本次任务系统性解决
打包发布的健壮性问题,覆盖 Windows 与 macOS。

== 第一部分:版本号同步(强制)==

1. 建立版本号单一来源 + 同步机制:
   - 确认三处版本号一致:tauri.conf.json / Cargo.toml / package.json
   - 写一个发布前校验脚本(scripts/check-version.js 或 .sh):
     * 读取三处版本号,不一致则报错退出(可接入 pr-check CI)
   - 应用内"设置/关于"显示的版本号从 tauri.conf.json 读取(Tauri app.package_info().version),
     不硬编码
   - 可选:写一个 bump-version 脚本,一条命令同步更新三处版本号

== 第二部分:Logo 生效验证 ==

2. 确保 Logo 正确嵌入构建产物:
   - 用新 Logo 源图(1024x1024 PNG)运行 npm run tauri icon <源图>,生成 src-tauri/icons/ 全规格
   - 确认 tauri.conf.json bundle.icon 指向正确
   - 完整构建 npm run tauri build,验证:
     * Windows:安装包 exe 图标、安装后程序图标、快捷方式图标均为新 Logo
     * macOS:.app 图标、DMG 图标均为新 Logo
   - 发布前清理 dev 残留:cargo clean,避免旧 dev 构建产物干扰

== 第三部分:代码签名(解决 SmartScreen / Gatekeeper)==

3. Windows 代码签名:
   - 评估签名方案:OV 证书 / EV 证书 / Azure Trusted Signing
   - 在 tauri.conf.json bundle.windows 配置 certificateThumbprint(或 signCommand)
   - 构建时自动签名,签名后 SmartScreen "发布者未知"提示消除
   - 若暂无证书:在 README / 下载页提供"更多信息→仍要运行"的引导说明(过渡方案)

4. macOS 签名与公证(notarization):
   - 配置 Apple Developer 证书(Developer ID Application)
   - tauri.conf.json bundle.macOS 配置 signingIdentity
   - 集成 notarize 流程(apple-id / team-id / app-specific password)
   - 公证后通过 Gatekeeper,用户无需"右键打开"绕过

== 第四部分:安装/卸载/快捷方式健壮性 ==

5. Windows NSIS 安装器加固:
   - 装前清理旧版本:安装前检测已安装的旧版本并先卸载(NSIS 的 uninstall-before-install)
   - 自定义安装目录健壮性:
     * 路径校验(可写、非系统关键目录)
     * 权限不足时提示以管理员运行或换目录
     * 安装失败回滚,不留半成品注册项
   - 卸载程序完整性:确保 uninstall.exe 一定生成,且注册表卸载项与实际文件路径一致
     (避免"幽灵卸载项":注册表有记录但文件不存在)
   - 快捷方式:安装器生成的快捷方式必须指向正式安装目录的 exe,
     绝不指向开发目录(D:\...\SG_Hub\... 的 dev 产物)
   - 升级安装:同目录覆盖升级时正确替换文件、更新版本号、保留用户数据

6. macOS DMG / 安装健壮性:
   - 标准 DMG 拖拽到 Applications 的安装体验
   - 升级覆盖时正确替换 .app
   - 验证自定义位置安装(若支持)不出错

== 第五部分:跨平台一致性验证 ==

7. 发布前 checklist(写入 docs/release-checklist.md):
   - [ ] 三处版本号一致(运行校验脚本)
   - [ ] cargo clean 后完整重建
   - [ ] Windows:安装包/程序/快捷方式图标为新 Logo
   - [ ] Windows:已签名,SmartScreen 无"发布者未知"(或有过渡说明)
   - [ ] Windows:自定义目录安装成功;旧版本被正确清理;可正常卸载(uninstall.exe 存在)
   - [ ] Windows:快捷方式指向正式安装目录,非开发目录
   - [ ] macOS:.app/DMG 图标为新 Logo
   - [ ] macOS:已签名 + 公证,Gatekeeper 通过
   - [ ] macOS:拖拽安装、升级覆盖正常
   - [ ] 安装后设置页版本号显示正确(= 打包版本)

== 验收用例(用历史踩坑场景)==
- 装过旧版(2.2.x)的机器上安装新版:旧版被清理,不产生幽灵卸载项
- 自定义安装目录:安装成功,快捷方式指向该目录,可正常打开与卸载
- 安装后版本号 = 打包版本(不会出现打开旧 dev 版的情况)
- 图标在 Windows + macOS 各处均为新 Logo

== 验证 ==
- 版本号校验脚本可用并接入 CI
- Windows + macOS 安装包图标、签名、安装/卸载/快捷方式全部正常
- 发布 checklist 全过
```

验证:
- 三处版本号一致校验生效;Logo 在双平台各处正确
- 代码签名消除 SmartScreen/Gatekeeper 提示(或有过渡说明)
- 安装/卸载/快捷方式健壮,无幽灵卸载项,不指向开发目录
- `git commit -m "feat: session 35 - packaging hardening (logo/sign/installer/version)"`

---

### Session 36: 设置简化 + 隐私协议归位 + 模型配置 UI 优化(四项)

```
读取 CLAUDE.md。本次任务做四项 UI/设置优化,均受 UI 设计规范硬规则约束。

== 优化 ①:简化「隐私与更新」设置 ==

- 当前"隐私与更新"卡片包含:检查频率(每日/每周 + 每 N 天)、检查时间、
  检查到更新后的行为(弹通知/静默下载/只标记)、当前版本/最近检查/下次计划检查、
  右上角开关、底部立即检查按钮
- 简化为:
  * **去掉右上角的总开关**(不再保留)
  * 保留:右上角「立即检查」按钮(从底部移到右上角)
  * 保留:当前版本号显示(从 tauri.conf.json 读取)
  * 移除:检查频率、检查时间、检查到更新后的行为、最近检查/下次计划检查等全部复杂配置
- 后端:大幅简化 updater 逻辑(去掉细粒度频率/时间/行为配置与总开关持久化),
  保留一个固定合理的后台检查策略(如每次启动检查一次)+ 手动「立即检查」命令。
  检查到更新统一弹通知让用户决定(去掉多行为选项)
- 这是对 V2.1.0 Session 21 复杂调度的大幅简化,降低用户认知负担

== 优化 ②:隐私协议归位 ==

- 将 V2.2.1 Session 27 实现的"隐私协议"整合进"隐私与更新"卡片区域
- 合理分隔:用分隔线区分"更新设置"与"隐私协议"两部分
- 隐私协议入口(查看完整中英文协议)保持原有能力(中英文切换、react-markdown 渲染)
- 卡片结构建议:
  * 顶部:标题"隐私与更新" + 右上角「立即检查」按钮(无开关)
  * 上半:当前版本号
  * 分隔线
  * 下半:隐私协议(查看/展开入口)

== 优化 ③:模型配置 — SG AI Store 配置卡简化 + 「添加模型」升级为等权并列卡 ==

最终布局(上下两层结构):

上方一行:两个**等权并列卡**(已有 Key 的两种配置入口)
- 卡 A「添加自有模型」:BYOK,Claude / GPT / DeepSeek / Ollama,点击进入填写 Endpoint + API Key
- 卡 B「添加 SG AI Store API Key」:已购买?粘贴 Key 即用
  * 卡内含 API Key 输入框 + 「添加」按钮(primary 样式)
  * **去掉原来的「选择已购买的套餐」下拉框**(多余)
  * 文案精简:标题"已在 SG AI Store 购买?"、说明"粘贴 API Key 即可使用"(原文案过长,缩短)

下方一整行:SG AI Store **购买引导链接**(没有 Key 的用户)
- 文案:"还没有 SG AI Store 配额?无需自己申请 API Key,购买即用"
- 按钮:「前往 SG AI Store 购买」→ tauri-plugin-shell 打开 https://sgaistore.com/buy?utm_source=sghub_client

要点:
- 信息架构:上方=已有 Key 的配置入口(两卡等权);下方=没 Key 的购买引导(整行)
- 「添加自有模型」从原来的底部弱按钮,升级为与 SG AI Store 配置卡等权的并列卡
- 两个上方卡视觉权重一致(同尺寸、同层级)
- 空状态与有模型时都遵循此结构;有模型时这组入口可收纳到顶部工具栏或"添加模型"区

== 优化 ④:去掉模型配置页顶部「近 7 天成本」统计卡(含后端成本估算)==

前端:
- 当前顶部统计为 4 张卡:已配置模型 / 近 7 天调用 / 近 7 天 Token / 近 7 天成本(USD)
- **去掉最右侧「近 7 天成本 (USD)」卡**,保留前 3 张(已配置模型 / 近 7 天调用 / 近 7 天 Token)
- 统计区从 4 列改为 3 列布局

后端(方案 B:彻底移除成本估算):
- 回改 V2.1.0 Session 23 的成本相关产物:
  * 去掉 usage_stats 的成本聚合字段(cost_est_total)或停止写入
  * 去掉 model_configs 的价格字段(input_price_per_1m_tokens / output_price_per_1m_tokens)
    —— 用一个新的 migration(V00X__drop_pricing.sql)删除这两列(SQLite 用重建表方式删列)
  * get_usage_stats_7days() 返回结构去掉 total_cost_est / 各项 cost
  * record_usage 不再计算与写入成本
  * 模型配置新增/编辑表单去掉"输入价格/输出价格"两个字段
- 保留:调用次数、token 统计(这些不涉及成本)
- 注意:这是对 Session 23 的回退性调整,需确保删列 migration 在已有数据库上安全执行
  (备份 → 重建表 → 迁移数据 → 删旧表)

== 遵守 UI 硬规则 ==
- 图标全用 Lucide,禁用 emoji
- 确认/提示用 confirmAsync/useToast,禁用 window.*
- 颜色只用 token,动画用 motion token,不用 transition-all
- 双主题 WCAG AA;不改基础设施;文案补充到 i18n 五语言包

== 测试 ==
- 优化①:卡片只剩「立即检查」(右上角,无开关)+ 版本号 + 隐私协议,立即检查可触发
- 优化②:隐私协议在卡片内合理分隔,中英文切换正常
- 优化③:上方两等权并列卡(添加自有模型 / SG AI Store API Key,后者无套餐下拉框),
  下方一整行购买链接;点击购买打开浏览器;粘贴 Key 添加成功
- 优化④:顶部 3 张卡(无成本卡);删价格列 migration 在有数据的库上安全执行;
  统计接口与表单无成本相关字段
- PR 自查 6 条全过;cargo test + npm run build + eslint 0 warning

== 验证 ==
- 四项 UI 优化均符合最终设计意图与设计系统规范
```

验证:
- 隐私与更新简化(无开关,仅立即检查 + 版本)、隐私协议归位分隔
- 模型配置:上方两等权并列卡 + 下方购买链接整行,SG AI Store 卡去套餐下拉框
- 顶部成本卡移除,后端成本估算与价格字段彻底删除(方案 B)
- `git commit -m "feat: session 36 - settings simplify, privacy policy, model config ui, remove cost"`

---

### V2.2.5 收尾:Beta + 发布

完成 Session 35-36 后:

1. 合并 feature/v2.2.5 到 main:
```cmd
git checkout main
git merge --no-ff feature/v2.2.5
git push
```

2. 严格按 docs/release-checklist.md 走发布前验证(双平台)

3. 打 Beta tag → 邀请用户(含装过旧版的机器)测试安装/卸载/升级

4. Beta 期重点:
   - Windows:Logo 生效、签名、自定义目录安装、旧版清理、卸载、快捷方式正确
   - macOS:Logo、签名公证、Gatekeeper、安装升级
   - 版本号一致性
   - 设置简化与模型配置 UI 的体验

5. 正式发布:
```cmd
git tag v2.2.5
git push --tags
```

5. 公告:更换全新图标、修复安装/卸载问题、应用签名、简化更新设置、优化模型配置入口

---


## V2.2.5 Session 速查（已发布）

| Session | 主题 | 对应需求 | 预估时长 |
|---------|------|---------|---------|
| 35 | 打包发布完善(Logo/签名/安装卸载/版本一致/跨平台) | 打包发布健壮性 | 1-1.5 周 |
| 36 | 设置简化 + 隐私协议归位 + 模型配置 UI + 去成本卡(含后端) | UI/设置优化 4 项 | 0.5-1 周 |

**总计**: 约 2 周

**核心改进**:
- 打包发布:版本号三处同步(强制)、Logo 生效验证、Windows+macOS 代码签名、
  NSIS 装前清旧版/卸载完整性/快捷方式指向正确、发布 checklist
- 设置简化:去除复杂的检查频率/时间/行为配置,只留开关 + 立即检查(移右上角)+ 版本号
- 隐私协议:归入"隐私与更新"卡片并合理分隔
- 模型配置:上方两等权并列卡(添加自有模型 / SG AI Store API Key,去套餐下拉框)+ 下方购买链接整行
- 去成本卡:移除顶部「近 7 天成本」统计卡,后端成本估算与价格字段一并删除(方案 B,回改 Session 23)

**关键提醒**:
- CLAUDE.md 已新增"版本号与打包一致性(强制流程)",每次发版必须同步三处版本号
- macOS 需验证与 Windows 同类的安装/图标/签名问题(本期一并覆盖)
- 历史踩坑(幽灵卸载项、快捷方式指向 dev 目录、Logo 未生效)作为验收用例
- 严格遵守 CLAUDE.md UI 设计规范,提交前过 PR 自查 6 条



---

## M2.2.4 · 首次启动引导(Onboarding)(Week 34)【已发布】

> V2.2.4 新增首次启动引导,把"数据目录"与"模型配置"两件越早配置越好的事前置到
> 新用户首次打开应用时,降低上手门槛。引导是**帮助而非强制**:每一步可跳过,
> 事后也能在设置中配置。
>
> **开工前必读 CLAUDE.md**:引导页是新 UI,受 7 条硬规则约束(Lucide 图标、token 颜色、
> 双主题 WCAG AA、无 emoji、无 window.confirm/prompt/alert、无 transition-all、不改基础设施)。
> 提交前过 PR 自查 6 条。

### 需求要点

- 首次启动引导分两个可配置步骤:**数据目录**(1/2)+ **模型配置**(2/2)
- 两步都可**跳过**,也可在安装后(设置页)随时配置
- 模型配置步默认 **快速预设**,可 Tab 切换到 **本地 Ollama** / **AI Store**
- AI Store Tab 放购买链接 + 完整购买配置流程引导

### 关键设计约束

- **触发条件**:仅全新安装首次启动触发;已完成/已跳过后不再触发;版本升级的老用户不触发
- **完成标记存储位置**:`onboarding_completed` 标记与数据目录路径存在 **bootstrap 配置**
  (OS 配置目录,如 %APPDATA%\sghub-bootstrap\),**不能存在数据目录内**——
  因为引导第一步可能就是改数据目录,存里面会有循环依赖
- **引导期 vs 设置期的数据目录差异**:
  * 引导期:全新、无数据 → 只设定初始位置,不涉及迁移(简单)
  * 设置期:已有数据 → 改路径走迁移逻辑(复制/校验/回滚,见 V2.1.0 数据目录迁移)
  * 两者复用同一目录选择 + 校验组件,但后续动作不同

### 在开始 Session 34 之前

确认 V2.2.3 已发布并稳定,本地分支已同步:
```cmd
cd D:\2-WORK\恒星\项目\学术文献管理系统\SG_Hub
git checkout main
git pull
git checkout -b feature/v2.2.4
```

---

### Session 34: 首次启动引导(数据目录 + 模型配置,可跳过)

```
读取 CLAUDE.md。本次任务新增首次启动引导(Onboarding):全新安装首次打开时,
用一个 3 屏轻量向导引导用户配置数据目录与 AI 模型,两步均可跳过。

== 引导流程(3 屏 + 完成页)==

Step 0 欢迎页:
- SG Hub Logo(用 src/assets/logo) + 一句话简介
- 文案:"只需两步即可开始,也可以稍后在设置中配置"
- 按钮:[开始设置] / [跳过,直接进入]

Step 1 数据存储位置(1/2):
- 说明:SG Hub 会把文献、PDF、Chat 历史等存储在此位置
- 默认路径(系统默认目录,标注"推荐",默认选中)
- [选择其他位置...] → tauri-plugin-dialog 目录选择器
- 选中后校验:可写 / 空间足够 / 非系统关键目录(复用设置页的校验逻辑)
- 进度指示 ●○
- 按钮:[上一步] / [跳过此步] / [下一步]
- 注意:全新安装无数据,这一步只设定初始位置,不涉及数据迁移

Step 2 配置 AI 模型(2/2):
- 说明:配置一个模型即可使用 Chat / AI 解析
- 三种方式,Tab 切换,默认选中"快速预设":
  Tab A. 快速预设(默认):
    - 模型下拉:Claude / GPT / DeepSeek
    - API Key 输入(password 类型)
    - [测试连接] → 显示成功(绿,带延迟)/ 失败(红,带原因)
  Tab B. 本地 Ollama:
    - 自动检测 localhost:11434 是否运行
    - 运行 → 列出已安装模型供选择
    - 未运行 → 提示如何启动 Ollama
    - 无需 API Key
  Tab C. AI Store:
    - 说明:在 SG AI Store 购买配额,无需自己申请 API Key,即买即用
    - 热门商品精简预览(从已同步的商品数据取 2-3 个 popular 商品 + 价格)
    - [前往 SG AI Store 购买] → tauri-plugin-shell 打开
      https://sgaistore.com/buy?utm_source=sghub_onboarding
    - 购买配置流程引导文案(展示完整 7 步):
      1. 点击上方按钮前往 SG AI Store
      2. 在网站注册 / 登录
      3. 选择合适的配额包(按模型 + 月度/年度)
      4. 完成支付(支付宝 / 微信 / Stripe)
      5. 在个人中心复制生成的 API Key
      6. 回到此处,粘贴 Key 到下方输入框
      7. 点"验证并添加",完成配置
    - [API Key 输入框] + [验证并添加]
      * 验证:调 GET https://sgaistore.com/api/billing/balance(Bearer Key)
      * 成功:显示余额,自动创建 SG AI Store 模型配置(endpoint=sgaistore.com/v1)
    - 不强制等待购买完成:用户去浏览器购买期间,本步保持"等待回填 Key"状态,
      买完回来粘贴即可;也可直接跳过
- 配置成功的模型自动设为默认模型
- 进度指示 ○●
- 按钮:[上一步] / [跳过此步] / [完成]

Step 3 完成页:
- 根据跳过情况差异化提示:
  * 都配置了 → "全部就绪,开始探索吧"
  * 跳过了模型 → "记得在'模型配置'添加模型后即可使用 AI 功能"(附"现在去配置"快捷入口)
- 按钮:[进入 SG Hub]

== 触发与状态管理 ==

1. bootstrap 配置扩展(src-tauri/src/config/ 的 bootstrap 部分):
   - 新增 onboarding_completed: bool(默认 false)
   - 存在 OS 配置目录的 bootstrap 配置中(不在数据目录内)
   - 与数据目录路径同处一个 bootstrap 配置

2. 触发逻辑:
   - 应用启动时读 bootstrap,onboarding_completed=false → 显示引导
   - 引导完成或全程跳过 → 置 onboarding_completed=true,后续不再弹
   - 版本升级的老用户:首次升级到 V2.2.4 时,若检测到已有数据目录/已有模型配置,
     自动视为已完成(置 true),不打扰老用户

3. Tauri Commands:
   - get_onboarding_status() -> { completed: bool }
   - complete_onboarding() -> () (置 completed=true)
   - onboarding_set_data_dir(path) -> Result (设定初始数据目录,无迁移)
   - 模型配置复用现有 add_model_config / test_model_connection
   - AI Store 验证复用 V2.2.1 的 ai_store_get_balance(若已实现)

== 前端实现 ==

4. 引导组件(src/pages/onboarding/ 或 components/onboarding/):
   - OnboardingFlow.tsx:向导容器,管理当前步骤、进度、跳过逻辑
   - WelcomeStep.tsx / DataDirStep.tsx / ModelStep.tsx / DoneStep.tsx
   - 模态全屏或居中卡片 + 遮罩,弱化主界面,营造首次见面感
   - 进度指示器组件(●○ 点)

5. 路由 / 挂载:
   - App 启动时根据 get_onboarding_status 决定是否在主界面之上叠加引导层
   - 引导期间主界面不可交互(遮罩)

6. 复用而非重写:
   - 数据目录选择 + 校验:复用设置页已有的校验逻辑(V2.1.0)
   - 模型快速预设 + 测试连接:复用模型配置页的预设模板与 test_model_connection
   - Ollama 检测:复用模型配置页的 Ollama 逻辑
   - AI Store 商品/余额:复用 V2.2.1 的 ai_store 模块

== 设置页入口(事后配置 + 重跑引导)==

7. 设置页:
   - 模型配置、数据目录的事后配置入口本就存在(保持不变)
   - 可选:在设置-关于 或 通用 中新增"重新运行引导"入口(再次触发引导)
     * 注意:重跑时数据目录步若已有数据,切换为"迁移"逻辑或提示去设置页迁移

== 遵守 UI 硬规则 ==
- 图标全用 Lucide(查 icon-map.md),禁用 emoji
- 进度/确认/提示用规范组件 + useToast,禁用 window.*
- 颜色只用 token,不硬编码;动画用 motion token,不用 transition-all
- 双主题(亮/暗)WCAG AA
- 不改基础设施(router 路由 / stores shape / tauri.ts 签名 / i18next 命名空间只增不改)
- 引导全部文案补充到 i18n 五语言包(zh-CN/zh-TW/en-US/ja-JP/fr-FR)
- 引导语言在 Step 0 之前已按系统语言确定

== 测试 ==
8. 测试场景:
   a. 全新安装首次启动 → 弹出引导;走完两步配置 → 进入应用,模型可用,数据目录正确
   b. Step 0 直接"跳过,直接进入" → 用默认数据目录,无模型,标记 completed
   c. 单步"跳过此步" → 该步用默认/不配置,继续
   d. 模型步三个 Tab 各测一遍:预设填 Key 测试连接 / Ollama 检测 / AI Store 验证 Key
   e. AI Store Tab:点购买打开浏览器 → 粘贴 Key 验证 → 自动创建模型
   f. 完成后重启应用 → 不再弹引导
   g. 模拟老用户(已有数据目录+模型)升级到 V2.2.4 → 不弹引导
   h. 设置里"重新运行引导" → 再次触发
   - bootstrap 的 onboarding_completed 读写单元测试

== 验证 ==
- 全新安装首次启动引导正常,两步可配置可跳过
- 模型步三种方式都能配置成功,AI Store 购买回填闭环可用
- 完成/跳过后标记正确,重启不再弹;老用户升级不打扰
- PR 自查 6 条 grep 全过
- cargo test + npm run build + eslint 0 warning
```

验证:
- 首次启动引导完整可用,数据目录 + 模型两步可配可跳
- AI Store 购买配置流程闭环正常(跳转购买 → 回填 Key → 验证 → 创建模型)
- 老用户升级不被打扰,事后可在设置重跑引导
- `git commit -m "feat: session 34 - first-launch onboarding (data dir + model config)"`

---

### V2.2.4 收尾:Beta + 发布

完成 Session 34 后:

1. 合并 feature/v2.2.4 到 main:
```cmd
git checkout main
git merge --no-ff feature/v2.2.4
git push
```

2. 打 Beta tag → GitHub Releases prerelease → 邀请新用户(全新安装)测试引导体验

3. Beta 期重点:
   - 全新安装首次启动引导是否顺畅
   - 三种模型配置方式(预设/Ollama/AI Store)在引导中的可用性
   - AI Store 购买回填闭环
   - 老用户升级是否被误触发引导(应不触发)
   - 跳过路径是否都能正常进入应用

4. 正式发布:
```cmd
git tag v2.2.4
git push --tags
```

5. 公告:新增首次启动引导,新用户开箱即可快速配置数据目录与 AI 模型

---


## V2.2.4 Session 速查（已发布）

| Session | 主题 | 对应需求 | 预估时长 |
|---------|------|---------|---------|
| 34 | 首次启动引导(数据目录 + 模型配置,可跳过) | Onboarding | 0.5-1 周 |

**总计**: 约 0.5-1 周

**核心设计**:
- 3 屏轻量向导:欢迎 → 数据目录(1/2)→ 模型配置(2/2)→ 完成
- 两个配置步均可跳过,事后也能在设置中配置(帮助而非强制)
- 模型配置默认"快速预设",Tab 切换"本地 Ollama" / "AI Store"
- AI Store Tab 含购买链接 + 完整 7 步购买配置流程引导 + Key 验证回填闭环

**关键提醒**:
- onboarding_completed 标记存 bootstrap 配置(OS 配置目录),不存数据目录内(避免循环依赖)
- 引导期数据目录只设初始位置不迁移;设置期改路径才走迁移逻辑
- 老用户升级到 V2.2.4 不触发引导(检测到已有数据/模型则视为已完成)
- 大量复用现有能力:数据目录校验、模型预设/测试、Ollama 检测、AI Store 余额验证
- 严格遵守 CLAUDE.md UI 设计规范,提交前过 PR 自查 6 条


---


---

## M2.2.3 · 文献检索源扩充 + 匹配增强(Week 32-33)【已发布】

> V2.2.3 解决一个实际问题:部分文献(尤其是统计学等专业期刊论文、机构库全文)
> 在 SG Hub 检索不到,但在 Google 学术能找到。
>
> **根因分析(两层)**:
> 1. **信息源覆盖盲区**:现有四源(arXiv / PubMed / Semantic Scholar / OpenAlex)对正式期刊论文
>    (如 REVSTAT 等区域性/专业期刊)与机构库全文覆盖不全。
> 2. **检索匹配能力弱**:部分文献某些源其实有记录(如 Semantic Scholar 有 CorpusID),
>    但因查询构造、标题模糊匹配、大小写/标点处理不足而未命中,且单源元数据残缺
>    (如缺第二作者)无法跨源补全。
>
> 因此 V2.2.3 分两块:**扩充信息源**(Session 32)+ **增强匹配与归并能力**(Session 33)。
>
> **开工前必读 CLAUDE.md**:遵守 UI 设计规范 7 条硬规则(本版本前端改动少,但仍受约束);
> 后端遵守"AI Client 设计要点"同款的 provider 模式与编码规范。

### 验收用例(贯穿两个 Session)

以下两篇极值理论(EVT)文献作为标准验收用例,当前检索不到,V2.2.3 完成后必须能命中:
- **"A Review of Extreme Value Threshold Estimation and Uncertainty Quantification"**
  (Scarrott & MacDonald, 2012, REVSTAT-Statistical Journal, 10(1):33-60)
- **"Models for Exceedances over High Thresholds"**
  (Davison & Smith, 1990, J. R. Stat. Soc. Series B)

### 信息源扩充清单(本次全部新增)

| 源 | API | 鉴权 | 解决的盲区 |
|-----|-----|------|-----------|
| Crossref | api.crossref.org | 无(留邮箱进 polite pool) | 正式期刊论文(几乎所有有 DOI 的文献)|
| CORE | api.core.ac.uk/v3 | 免费 API Key | 机构库 / 预印本库的开放获取全文 |
| DBLP | dblp.org/search/publ/api | 无 | 计算机科学专精,元数据质量高 |
| DOAJ | doaj.org/api/v2 | 无 | 开放获取期刊目录 |

> 扩充后,SG Hub 检索源从 4 个增至 8 个:
> arXiv / PubMed / Semantic Scholar / OpenAlex / Crossref / CORE / DBLP / DOAJ。
>
> Google Scholar 因无官方 API(SerpAPI 付费 / scholarly 易限流),本期不纳入,留作后续可选高级源。

### 在开始 Session 32 之前

确认 V2.2.2 已发布并稳定,本地分支已同步:
```cmd
cd D:\2-WORK\恒星\项目\学术文献管理系统\SG_Hub
git checkout main
git pull
git checkout -b feature/v2.2.3
```

⚠️ 每个 Session 开始前先读 CLAUDE.md,确认 search/ 模块现有结构与"AI Client 设计要点"的 provider 模式。
新增源遵循现有 arxiv.rs / semantic_scholar.rs / pubmed.rs / openalex.rs 的同款实现风格。

---

### Session 32: 检索源扩充 - Crossref + CORE + DBLP + DOAJ

```
读取 CLAUDE.md,重点看 search/ 模块现有结构(Session 6-7 已实现 arxiv/semantic_scholar/
pubmed/openalex 四源)。本次任务新增 Crossref、CORE、DBLP、DOAJ 四个源,把检索源从 4 个
扩充到 8 个,补足正式期刊论文、机构库全文、CS 专精、开放获取期刊的覆盖盲区。

== 源 1:Crossref(正式期刊论文,最关键)==

1. 创建 src-tauri/src/search/crossref.rs:
   - API:GET https://api.crossref.org/works?query={query}&rows={limit}
   - polite pool:带上联系邮箱(从 config 读)提升速率与稳定性
     例:?query=...&rows=20&mailto=contact@sghub.app
   - 解析 message.items[]:
     * title(数组取第一个)
     * author(数组,拼接 given + family)
     * DOI / container-title(期刊名)
     * published 年份(published.date-parts)
     * abstract(部分有,JATS 格式需清洗 XML 标签)
     * URL / resource.primary.URL
   - 返回 Vec<Paper>,source='crossref'
   - Crossref 覆盖几乎所有有 DOI 的正式发表文献,是补正式期刊论文的关键源

2. DOI 精确查询通道(Crossref 专属):
   - crossref_by_doi(doi: &str):GET https://api.crossref.org/works/{doi}
   - 检索词被识别为 DOI 格式时(正则 ^10\.\d{4,}/),直接走此精确通道
   - 这是 Session 33 "DOI 直查"能力的后端基础

== 源 2:CORE(机构库全文)==

3. 创建 src-tauri/src/search/core_api.rs(文件名避免与 Rust core 冲突):
   - API:POST https://api.core.ac.uk/v3/search/works
     Header: Authorization: Bearer {CORE_API_KEY}
     Body: { "q": "{query}", "limit": {limit} }
   - CORE_API_KEY:免费注册获取,存 keychain(不写明文日志)
   - 解析 results[]:title / authors / abstract / doi / yearPublished /
     downloadUrl(全文 PDF 链接,CORE 的核心价值)/ publisher
   - 返回 Vec<Paper>,source='core'
   - CORE 聚合全球机构库与预印本库的开放获取全文,补"机构库全文"盲区

== 源 3:DBLP(CS 专精)==

4. 创建 src-tauri/src/search/dblp.rs:
   - API:GET https://dblp.org/search/publ/api?q={query}&format=json&h={limit}
   - 无需鉴权;CS 领域元数据质量极高
   - 解析 result.hits.hit[].info:
     * title / authors(authors.author,可能是单对象或数组,需兼容处理)
     * year / venue(期刊/会议)/ doi / ee(电子版链接)/ url
   - 返回 Vec<Paper>,source='dblp'
   - 注意:DBLP 的 authors 字段单作者时是对象、多作者时是数组,解析需兼容两种

== 源 4:DOAJ(开放获取期刊)==

5. 创建 src-tauri/src/search/doaj.rs:
   - API:GET https://doaj.org/api/v2/search/articles/{query}?pageSize={limit}
     (query 需 URL 编码)
   - 无需鉴权;开放获取期刊
   - 解析 results[].bibjson:
     * title / author(数组,取 name)/ abstract
     * year(bibjson.year)/ DOI(identifier 中 type=doi)
     * link(数组,取 fulltext 类型的 url)/ journal.title
   - 返回 Vec<Paper>,source='doaj'

== 并发聚合接入 ==

6. 修改 src-tauri/src/search/mod.rs:
   - 把 4 个新源纳入 search_all 的并发请求(tokio::join! 或 FuturesUnordered)
   - 每源独立超时(10s),单源失败/超时降级不影响其他源
   - 数据源开关:用户可在设置启用/禁用每个源(config 持久化)
   - 默认启用:arXiv / Semantic Scholar / OpenAlex / Crossref / CORE / DBLP / DOAJ
     (PubMed 保持原有默认策略)
   - 8 源并发时注意总体响应时间,可对慢源设更短超时

7. 前端数据源选择(src/pages/Search.tsx):
   - 数据源下拉/多选新增:Crossref / CORE / DBLP / DOAJ
   - 来源徽章新增对应颜色(查 docs/ui-design 配色 token,不硬编码颜色)
   - 图标用 Lucide,不用 emoji
   - 文案补充到 i18n 五语言包(zh-CN/zh-TW/en-US/ja-JP/fr-FR)
   - 考虑数据源分组展示(如"综合/CS/开放获取"),避免下拉过长

== 配置 ==

8. config 扩展:
   - search.crossref_mailto:Crossref polite pool 邮箱(可选,默认空)
   - search.core_api_key:CORE API Key(存 keychain,config 只存引用)
   - search.enabled_sources:启用的源列表(8 源)

== 测试 ==

9. 集成测试 src-tauri/tests/search_new_sources.rs:
   - 用 wiremock 模拟 Crossref / CORE / DBLP / DOAJ 的响应,验证各自解析正确
   - 特别测试 DBLP authors 单对象/数组两种情况
   - 验收用例(真实 API,可标记 #[ignore] 手动跑):
     * Crossref 检索 "Review of Extreme Value Threshold Estimation Scarrott" → 命中
     * Crossref DOI 直查 → 命中
     * CORE 检索同样关键词 → 命中(含全文 downloadUrl)
   - 验证多源去重:同一 DOI 在多个源出现时只保留一条

== 验证 ==
- 4 个新源全部接入成功,检索源达到 8 个
- 验收用例两篇 EVT 文献能检索到
- 数据源开关正常,单源失败降级不影响整体
- 8 源并发响应时间可接受(慢源超时降级)
- PR 自查 6 条 grep 全过(无硬编码颜色、无 emoji)
- cargo test + npm run build + eslint 0 warning
```

验证:
- 新增 Crossref + CORE + DBLP + DOAJ 四源,两篇 EVT 验收文献可检索到
- 数据源可开关,失败降级正常
- `git commit -m "feat: session 32 - add crossref/core/dblp/doaj search sources"`

---

### Session 33: 检索匹配增强 + 跨源去重归并

```
读取 CLAUDE.md。本次任务解决"某些源其实有记录却不命中"以及"单源元数据残缺"的问题,
提升召回率与结果质量。这是让 SG Hub 检索体验接近 Google 学术的关键一环。

== 第一部分:DOI 直查通道 ==

1. 检索入口智能识别(src-tauri/src/search/mod.rs):
   - 检测用户输入是否为 DOI(正则 ^10\.\d{4,9}/[-._;()/:a-zA-Z0-9]+$)
   - 是 DOI → 直接走 Crossref DOI 精确端点(Session 32 已建 crossref_by_doi)+
     并发查其他源的 DOI 端点(OpenAlex / Semantic Scholar 都支持 DOI 查询)
   - 命中后合并各源元数据,返回单条高质量结果
   - 也支持用户粘贴完整引用串时,先尝试抽取其中的 DOI

== 第二部分:标题模糊匹配增强 ==

2. 标题归一化(src-tauri/src/search/matching.rs 新建):
   - normalize_title(title):转小写 / 去标点 / 折叠空白 / 去常见停用词(a/an/the/of/for...)
   - 用于跨源判定"是否同一篇":两个标题归一化后相似度(Levenshtein 或 Jaccard)超阈值即视为同一篇
   - 解决大小写、标点差异(如 "Models for Exceedances over High Thresholds" 在不同源的
     大小写/标点不一致导致漏匹配)

3. 查询构造优化:
   - 长标题查询时,部分源对完整长句匹配差 → 提取标题核心关键词(去停用词后的实词)再查
   - 对引号包裹的精确短语查询,保留原样传给支持精确匹配的源

== 第三部分:跨源 DOI 归并与元数据补全 ==

4. 结果归并逻辑(src-tauri/src/search/merge.rs 新建或并入 mod.rs):
   - 归并键优先级:DOI(精确)> 归一化标题 + 年份(模糊)
   - 同一篇文献跨多源出现时,合并为一条 Paper,并做元数据补全:
     * 作者:取最完整的作者列表(如 Semantic Scholar 缺第二作者,用 Crossref 的补全)
     * 摘要:取最长/最完整的
     * DOI / 期刊 / 年份:择优填充空缺字段
     * 全文链接:优先 CORE 的 downloadUrl,其次各源的 OA 链接
     * sources 字段:记录该文献命中了哪些源(供前端展示"来自 N 个源")
   - 解决 Semantic Scholar 有记录但元数据残缺(只挂一个作者)的问题
   - 8 源并发后归并尤为重要:同一篇可能在 4-5 个源都出现,需正确合并为一条

== 第四部分:检索结果回退机制 ==

5. 自动回退(src-tauri/src/search/mod.rs):
   - 默认源(arXiv/Semantic Scholar/OpenAlex)无结果或结果过少(< N 条)时,
     自动追加查询 Crossref + CORE,扩大召回
   - 前端提示:"已自动扩展检索源以获得更多结果"(useToast,不用 alert)

== 第五部分:前端结果展示增强 ==

6. Search.tsx 结果卡片:
   - 显示该文献命中的源(如"arXiv · Crossref · CORE"小标签)
   - 有全文链接时显示"全文 PDF"按钮(来自 CORE 或 OA 源)
   - 归并后元数据更完整(作者、摘要不再残缺)
   - 遵守 UI 硬规则:Lucide 图标 / token 颜色 / 无 emoji / 无 window.*

== 测试 ==

7. 集成测试 src-tauri/tests/search_matching.rs:
   - DOI 直查:输入两篇 EVT 文献的 DOI → 各命中单条完整结果
   - 标题模糊匹配:输入不同大小写/标点的标题变体 → 都能命中
   - 跨源归并:模拟同一 DOI 在 Crossref(全作者)+ Semantic Scholar(缺作者)出现 →
     归并后作者完整,sources 记录多个源
   - 回退机制:模拟默认源空结果 → 验证自动追加 Crossref/CORE

== 验证 ==
- 两篇 EVT 验收文献:无论用标题还是 DOI 都能稳定检索到,元数据完整
- 跨源去重归并正确,元数据互补补全生效
- 命中多源的文献正确展示来源与全文链接
- PR 自查 6 条 grep 全过
- cargo test + npm run build + eslint 0 warning
```

验证:
- 标题/DOI 检索两篇 EVT 文献稳定命中,元数据完整,体验接近 Google 学术
- 跨源归并与回退机制正常
- `git commit -m "feat: session 33 - search matching and cross-source merging"`

---

### V2.2.3 收尾:Beta + 发布

完成 Session 32-33 后:

1. 合并 feature/v2.2.3 到 main:
```cmd
git checkout main
git merge --no-ff feature/v2.2.3
git push
```

2. 打 Beta tag → GitHub Releases prerelease → 邀请 V2.2.2 用户测试

3. Beta 期重点:
   - 两篇 EVT 验收文献必须能稳定检索到
   - 8 源并发的稳定性与速度(超时降级)
   - 跨源去重归并的准确性(无误并/漏并)
   - CORE API Key 配置与全文链接可用性
   - DBLP authors 单对象/数组解析的健壮性

4. 正式发布:
```cmd
git tag v2.2.3
git push --tags
```

5. 公告:检索源从 4 个扩充到 8 个(新增 Crossref/CORE/DBLP/DOAJ),
   大幅提升期刊论文与机构库全文的检索覆盖,检索体验向 Google 学术看齐

---


## V2.2.3 Session 速查（已发布）

| Session | 主题 | 对应需求 | 预估时长 |
|---------|------|---------|---------|
| 32 | 检索源扩充 - Crossref + CORE + DBLP + DOAJ | 信息源扩充(4→8 源) | 1 周 |
| 33 | 检索匹配增强 + 跨源去重归并 | 匹配能力增强 | 1 周 |

**总计**: 约 2 周

**核心改进**:
- 信息源:检索源从 4 个扩充到 8 个,新增 Crossref(正式期刊)、CORE(机构库全文)、
  DBLP(CS)、DOAJ(OA 期刊)
- 匹配能力:DOI 直查 + 标题模糊匹配 + 跨源去重归并(元数据互补)+ 检索回退
- 验收标准:两篇极值理论文献(REVSTAT 综述 + Davison-Smith 1990)从检索不到 → 稳定命中且元数据完整

**关键提醒**:
- Crossref / DBLP / DOAJ 无需 Key;CORE 需免费 API Key(存 keychain)
- DBLP authors 单作者是对象、多作者是数组,解析需兼容
- 新源遵循现有 search/ provider 模式;8 源并发,单源失败降级
- 跨源归并以 DOI 为主键、归一化标题+年份为辅,做元数据互补补全
- 严格遵守 CLAUDE.md UI 设计规范,提交前过 PR 自查 6 条


---


---

## M2.2.2 · Logo 更换 + 文献数据库本地 PDF 管理(Week 30-31)【已发布】

> V2.2.2 是基于 V2.2.1 的小迭代,包含两项:更换为新设计的 Logo,
> 以及在"文献数据库"模块支持本地 PDF 上传与集中管理。
>
> **开工前必读 CLAUDE.md 的"UI 设计规范(强约束)"**:本版本任何 UI 改动都受 7 条硬规则约束
> (禁用 V2.1 旧 token、禁用 emoji 当图标全用 Lucide、禁用 window.confirm/prompt/alert、
> 禁用 transition-all、禁止硬编码颜色、双主题 WCAG AA、不改基础设施)。
> 提交前必须通过 PR 自查 6 条 grep。
>
> **复用提示**:本地 PDF 上传的后端能力(元数据提取、批量上传、FTS 索引)在 V2.0.1 的 Session 18
> 已经实现(upload_local_papers_batch / extract_pdf_metadata / search_local_papers)。
> 本次主要是在"文献数据库"(Library.tsx)模块新增**管理导向的上传入口**,复用已有后端,不要重写。

### 本次需求清单

| 编号 | 需求 | 所属 Session |
|------|------|-------------|
| R1 | 更换 Logo 为新设计版本 | Session 30 |
| R2 | 文献数据库支持本地 PDF 上传与集中管理 | Session 31 |

### 在开始 Session 30 之前

确认 V2.2.1 已发布并稳定,本地分支已同步:
```cmd
cd D:\2-WORK\恒星\项目\学术文献管理系统\SG_Hub
git checkout main
git pull
git checkout -b feature/v2.2.2
```

⚠️ **每个 Session 开始时,Claude Code 必须先读取 CLAUDE.md**,重点确认:
- "UI 设计规范(强约束)"章节的 7 条硬规则与 PR 自查 6 条
- "Logo 资源(V2.2.2)"章节(资源路径与生成方式)
- "文献数据库本地 PDF 管理(V2.2.2)"章节(后端 Command 与数据约定)
- "侧边栏导航(V2.2.1)"章节(Logo 在折叠态/展开态的用法)

⚠️ **新 Logo 文件需由你提供**:把设计好的 Logo 文件准备好(建议 1024x1024 透明 PNG 作为源图)。

---

### Session 30: 更换 Logo 为新设计版本

```
读取 CLAUDE.md,重点看"Logo 资源(V2.2.2)"与"侧边栏导航(V2.2.1)"两节,
以及 UI 设计规范的硬规则。本次任务把应用 Logo 替换为新设计的版本。

== 准备:新 Logo 文件 ==
开始前把新设计的 Logo 准备好。需要两类资源:

1. 应用图标源图:1024x1024 PNG(透明背景),用于自动生成全部规格
2. 应用内 UI Logo(SVG 优先,适配亮/暗主题):
   - logo.svg          主 Logo(展开态侧栏、关于页等)
   - logo-dark.svg     暗色主题版(若 Logo 单色)
   - logo-light.svg    亮色主题版
   - logo-mark.svg     折叠态侧栏用的小图标/标记版

== 任务步骤 ==

1. 替换应用图标(src-tauri/icons/):
   - 把 1024x1024 源图放到临时位置
   - 运行 `npm run tauri icon <源图路径>` 自动生成全部规格:
     32x32.png / 128x128.png / 128x128@2x.png / icon.icns / icon.ico 等
   - 确认 tauri.conf.json 的 bundle.icon 指向 src-tauri/icons/ 下的图标
   - 不要手动逐张制作图标

2. 替换应用内 UI Logo(src/assets/):
   - 用新的 logo.svg / logo-dark.svg / logo-light.svg / logo-mark.svg 替换旧资源
   - 按 CLAUDE.md"侧边栏导航"约定:
     * 侧栏展开态用 logo.svg
     * 侧栏折叠态用 logo-mark.svg(小图标版)
   - 检查所有 Logo 出现位置并替换:
     * 侧栏顶部(展开态 + 折叠态)
     * 关于页 / 设置-关于
     * 首次启动 / 引导页(如有)
     * 登录页(如有)
     * AI Store 页头(如有)

3. 主题适配:
   - 亮色主题用深色 Logo,暗色主题用浅色 Logo(若 Logo 为单色)
   - 主题切换时 Logo 同步切换
   - 适配尺寸,确保不变形、不模糊

4. 遵守 UI 硬规则:
   - 不引入硬编码颜色(#XXXXXX 仅允许在 src/styles/index.css)
   - 若 Logo 容器有过渡动画,用 motion token(duration-fast/base/slow ease-khx),
     不用 transition-all
   - 不动基础设施(router 路由 / stores shape / tauri.ts 签名)

5. 清理:
   - 删除旧 Logo 资源文件,确认无任何地方仍引用旧 Logo
   - grep 全局确认旧 Logo 文件名已无引用

== 验证 ==
- 构建后:窗口图标、任务栏、安装包图标均为新 Logo
- 应用内所有 Logo 位置已更新,亮/暗主题下都清晰
- 折叠态侧栏 logo-mark 正常显示
- PR 自查 6 条 grep 全过(尤其无硬编码颜色、无 transition-all)
- cargo tauri build 成功,安装包图标正确
- npm run build + eslint 0 warning

== 注意 ==
- Logo 文件由用户提供;用 tauri icon 命令自动生成规格
- 图标在构建期嵌入,改完必须重新完整构建(cargo tauri build),dev 模式可能看不到变化
```

验证:
- 窗口/任务栏/安装包图标 = 新 Logo
- 应用内所有 Logo 位置已更新,主题适配正常,折叠态正常
- PR 自查 6 条全过
- `git commit -m "feat: session 30 - replace logo with new design"`

---

### Session 31: 文献数据库支持本地 PDF 上传与集中管理

```
读取 CLAUDE.md,重点看"文献数据库本地 PDF 管理(V2.2.2)"节(后端 Command 与数据约定)
以及 UI 设计规范硬规则。本次任务在文献数据库(Library.tsx)新增本地 PDF 上传入口,
实现本地文件的集中管理。

== 复用提示(CLAUDE.md 已列明)==
后端能力 V2.0.1 Session 18 已实现,本次复用,不要重写:
- upload_local_paper(file_path) / upload_local_papers_batch(file_paths)
- extract_pdf_metadata(元数据提取链,lopdf + 启发式)
- update_paper_metadata(元数据补全)
- search_local_papers(FTS5 检索)
- papers 表 source='local' / uploaded_at 字段已存在
- 本地 PDF 存储:{数据目录}/data/pdfs/uploaded/{uuid}.pdf
若上述能力缺失或不完整,先补齐后端,再做前端入口。

== 任务范围 ==

1. 文献数据库页面新增上传入口(src/pages/Library.tsx):
   - 顶部工具栏新增"上传 PDF"按钮:
     * 图标用 Lucide(查 docs/ui-design/3-specs/icon-map.md 选合适的图标,如 Upload / FilePlus)
     * 不用 emoji
   - 支持两种上传方式:
     a. 点击按钮 → tauri-plugin-dialog 打开文件选择器,多选 PDF
     b. 拖拽上传:文献列表区域作为拖放区,拖入 PDF 触发上传
       (用 Tauri 的 file-drop 事件,适配 Tauri 2 capabilities 权限声明)

2. 上传到指定文件夹:
   - 默认上传到当前选中的文件夹(用户正在某文件夹视图下时)
   - 或弹出文件夹选择(用 promptAsync/已规范的对话框组件,不用 window.prompt)
   - 上传后文献自动加入该文件夹(folder_papers 关联)
   - 未选文件夹默认进"未分类"

3. 上传流程与进度:
   - 调用 upload_local_papers_batch(已有后端)
   - 进度反馈用已规范的进度组件 + useToast,监听 "upload:progress" 事件:
     * 当前文件名 / 进度百分比 / 总数(N/M)
   - 完成 Toast:"成功导入 N 篇文献"(失败的单独列出)
   - 禁止用 window.alert,统一用 useToast

4. 元数据处理:
   - 复用 extract_pdf_metadata;置信度低(needs_user_review)的文献上传后标记"待完善"角标
   - 提供批量补全入口:筛选"待完善",逐个或批量编辑(复用 PaperMetadataEditor 组件,若已建)

5. 本地文献的展示(遵循设计系统):
   - source='local' 的文献来源徽章显示"本地"(Lucide 图标 + 文字,非 emoji)
   - 卡片操作:打开 PDF / AI 精读 / 移动文件夹 / 编辑元数据 / 删除
   - "打开 PDF":tauri-plugin-shell 打开本地 PDF(pdf_path)
   - 删除:用 confirmAsync 二次确认,询问是否同时删除本地 PDF 副本(data/pdfs/uploaded/ 下)

6. 集中管理能力:
   - 本地上传与在线检索/推送文献统一在文献数据库管理
   - 支持:文件夹归类、标签、阅读状态、FTS 全文检索(复用已有能力)
   - 批量操作:批量移动、批量打标签、批量删除
   - 筛选:按来源(全部 / 本地 / arXiv / PubMed / OpenAlex / Semantic Scholar)

7. 存储管理:
   - 在设置-数据管理 或 文献数据库页,显示本地 PDF 占用空间
   - 提供"清理未关联的 PDF 文件"(孤儿文件清理),操作前 confirmAsync 确认

8. 边界处理:
   - 重复上传检测:同一 PDF(文件 hash 或 标题+大小)已存在时,提示"该文献可能已存在",
     用 confirmAsync 让用户选"仍然导入"或"跳过"
   - 非 PDF 文件:拒绝并 useToast 提示
   - 损坏的 PDF:提取失败仍允许导入(标题用文件名),标记待完善
   - 超大文件(>100MB):提示并拒绝

== 遵守 UI 硬规则 ==
- 图标全用 Lucide(查 icon-map.md),禁用 emoji
- 对话框/确认/提示用 confirmAsync / promptAsync / useToast,禁用 window.*
- 颜色只用 token,不硬编码;动画用 motion token,不用 transition-all
- 不改 router 路由 / stores shape / tauri.ts 签名 / i18next 命名空间(只增不改)
- 新增文案补充到 i18n 五语言包(zh-CN/zh-TW/en-US/ja-JP/fr-FR)

== 验证 ==
- 文献数据库可通过按钮和拖拽上传 PDF,上传到指定文件夹,进度清晰
- 本地与在线文献统一管理(归类/标签/检索/批量)
- 打开 PDF、删除(含本地文件)、重复检测、孤儿清理均正常
- PR 自查 6 条 grep 全过
- cargo test + npm run build + eslint 0 warning

== 注意 ==
- 后端能力优先复用 Session 18;本次重点是文献数据库的管理入口与集中管理体验
- 严格遵守 CLAUDE.md 的 UI 设计规范硬规则,提交前跑 PR 自查 6 条
```

验证:
- 文献数据库支持 PDF 上传(按钮 + 拖拽),集中管理体验完整
- 严格符合 UI 设计规范(无 emoji、无 window.*、无硬编码色、无 transition-all)
- `git commit -m "feat: session 31 - local pdf upload in literature database"`

---

### V2.2.2 收尾:Beta + 发布

完成 Session 30-31 后:

1. 合并 feature/v2.2.2 到 main:
```cmd
git checkout main
git merge --no-ff feature/v2.2.2
git push
```

2. 打 Beta tag → GitHub Releases prerelease → 邀请 V2.2.1 用户测试

3. Beta 期重点:
   - 新 Logo 在各平台(Windows/macOS)、各位置(窗口/任务栏/应用内/折叠态)、亮暗主题的显示
   - 本地 PDF 上传的稳定性(大文件、多文件、拖拽、重复检测)
   - 元数据提取质量与待完善流程
   - UI 设计规范合规(PR 自查 6 条)

4. 正式发布:
```cmd
git tag v2.2.2
git push --tags
```

5. 公告:全新 Logo + 文献数据库支持本地 PDF 上传与集中管理

---


## V2.2.2 Session 速查（已发布）

| Session | 主题 | 对应需求 | 预估时长 |
|---------|------|---------|---------|
| 30 | 更换 Logo 为新设计版本 | R1 | 0.5 周 |
| 31 | 文献数据库支持本地 PDF 上传与集中管理 | R2 | 1 周 |

**总计**: 约 1.5 周

**关键提醒**:
- 新 Logo 文件由用户提供,用 `npm run tauri icon` 自动生成全部规格;改完需重新完整构建
- 本地 PDF 上传后端能力复用 V2.0.1 Session 18,本次只做文献数据库模块的管理入口
- 严格遵守 CLAUDE.md 的 UI 设计规范 7 条硬规则,提交前必过 PR 自查 6 条 grep
- 每个 Session 开始前先读 CLAUDE.md 确认最新结构与约束


---


---

## M2.2.1 · UI 重构后的优化 + AI Store 模块(Week 26-29)【已发布】

> 【版本说明】V2.1.0(原 V2.0.2,Session 19-24)已开发完成上线。
> V2.2.1 是基于 **UI 已重构** 的基础上的优化迭代,包含:
> 全局品牌与文案调整、侧边栏折叠、隐私协议、版权信息、Bug 修复,以及 AI Store 模块对接。
>
> **重要前提**:本版本开发前,UI 已经过重构,Claude Code 执行任务前必须先读取最新的 CLAUDE.md
> 了解重构后的组件结构、目录组织与设计系统,再动手修改。

> **关键边界**:AI 中转服务是独立项目 **SG AI Store**(域名 sgaistore.com,版本 V1.0.0 起独立演进),
> **不在 SGHUB 项目范围内**。SGHUB 客户端只作为消费方,通过 SG AI Store 的公开 API 同步商品、
> 展示已购买模型的用量与余额。开发阶段先用 mock 数据。

### 本次需求清单

| 编号 | 需求 | 所属 Session |
|------|------|-------------|
| R1 | 产品名称统一调整为 "SG Hub" | Session 25 |
| R2 | 去除"添加模型"按钮前的加号、"订阅+新建"按钮前的加号 | Session 25 |
| R3 | "收藏夹"更名为"文献数据库" | Session 25 |
| R4 | 全部 emoji 图标去除/隐藏,改用图标库或纯文字 | Session 25 |
| R5 | Bug 修复:非默认模型解析失败 | Session 25 |
| R6 | 左侧导航栏支持折叠/伸缩 | Session 26 |
| R7 | 左侧导航栏底部新增版权信息 | Session 26 |
| R8 | 设置-数据管理下新增"隐私协议"(内置中英文说明) | Session 27 |
| R9 | AI Store 模块 - 商品展示 + 同步(模拟数据) | Session 28 |
| R10 | SG AI Store 模型接入 + 余额展示 | Session 29 |

### 在开始 Session 25 之前

确认 V2.1.0 已发布并稳定,本地分支已同步:
```cmd
cd D:\2-WORK\恒星\项目\学术文献管理系统\SG_Hub
git checkout main
git pull
git checkout -b feature/v2.2.1
```

⚠️ **每个 Session 开始时,Claude Code 必须先读取 CLAUDE.md**,确认 UI 重构后的最新结构
(组件路径、设计系统、命名约定可能已变化),再进行修改,避免基于过时的目录结构操作。

---

### Session 25: Bug 修复 + 全局品牌与文案调整

```
读取 CLAUDE.md 了解 UI 重构后的最新项目结构。本次任务包含一个高优 Bug 修复
和一组全局品牌/文案调整。

== 第一部分:Bug 修复(优先,可先单独发热修复) ==

问题:AI 解析只在使用"默认模型"时成功,切换到非默认模型(GPT-5/DeepSeek/Ollama)
时解析失败或无输出。

排查与修复:
1. 复现:配置 2+ 模型(Claude 默认,GPT-5 非默认),AI 解析切换到非默认模型,观察现象
2. 代码审计(按可能性):
   - skill_engine 的 start_parse:model_config_id 是否被覆盖为默认?
   - ai_client/mod.rs 路由:provider 是否正确分发到 openai/anthropic/ollama?是否 hardcode Anthropic?
   - ai_client/openai.rs 与 ollama.rs:SSE 解析、请求头是否正确?
   - 前端 Parse 页:invoke 时是否传对 model_config_id?
3. 测试矩阵(5 模型 × 3 场景 = AI解析/Chat/Skill测试):全部验证
4. 写集成测试 src-tauri/tests/parse_with_all_providers.rs(用 wiremock 模拟三种 Provider)
5. 错误信息改进:区分"Key 无效/超时/不支持流式/上下文过长",失败时显示模型名
6. 日志增强:chat_stream 入口记录 provider/endpoint/model_id

== 第二部分:全局品牌与文案调整 ==

R1 - 产品名称统一为 "SG Hub":
- 全局检索所有 "SGHUB" / "Sghub" / "sghub"(展示文案部分)替换为 "SG Hub"
- 注意区分:
  * 用户可见的展示文案 → 改为 "SG Hub"(带空格)
  * 代码标识符 / 包名 / bundle identifier(com.sghub.app)/ 数据目录 / 域名 → 保持不变(不要改坏构建)
  * 窗口标题、关于页、侧栏 Logo、README 标题 → "SG Hub"
- tauri.conf.json 的 productName 改为 "SG Hub"(确认不影响已安装用户的数据目录路径)

R3 - "收藏夹"更名为"文献数据库":
- 全局检索 UI 文案中的"收藏夹" → "文献数据库"
- 侧栏导航项、页面标题、相关提示文案、i18n 语言包(zh-CN/zh-TW/en-US/ja-JP/fr-FR)
- 英文:"Favorites" → "Literature Database"(或 "Library")
- 路由路径可保持 /library 不变(避免破坏跳转),仅改显示名

R4 - 去除/隐藏所有 emoji 图标:
- 重构后 UI 中的 emoji(如 🔍 📰 ⭐ 🧠 🤖 ⚙️ 💬 ✨ 🛒 等)全部移除
- 替换策略(读 CLAUDE.md 确认重构后用的图标方案):
  * 若已引入图标库(如 lucide-react / heroicons)→ 用对应的线性图标替换 emoji
  * 若无图标库 → 移除 emoji,仅保留文字;或引入 lucide-react 统一替换
- 涉及范围:侧栏导航、按钮、卡片标题、Toast、空状态插画、设置项
- 保持视觉一致:所有图标统一用一套图标库,粗细/尺寸一致

R2 - 去除按钮前的加号:
- 模型配置页:"添加模型"按钮去掉前面的加号(+),只保留文字"添加模型"
- 今日推送页:"订阅"/"新建"按钮去掉前面的加号
- 注意:这里是去掉视觉上的 "+" 符号或 plus 图标,按钮功能不变

== 验证 ==
- Bug 修复:5×3 测试矩阵全部通过
- 全局无 "SGHUB"(展示文案)、无"收藏夹"、无 emoji、无多余加号
- cargo test + npm run build 通过
- 五种语言包都已同步更新文案

== 注意 ==
本次涉及大量文案替换,务必区分"展示文案"与"代码标识符",
不要把 bundle id、包名、数据目录路径、域名等技术标识符也改了导致构建失败。
```

验证:
- AI 解析非默认模型修复,测试矩阵通过
- 全局品牌统一为 "SG Hub",收藏夹改文献数据库,emoji 清除,加号去除
- `git commit -m "feat: session 25 - bugfix + global rebrand to SG Hub, remove emoji/plus"`
- 可先就 Bug 修复部分单独打 tag 发 v2.2.1-alpha 热修复

---

### Session 26: 左侧导航栏折叠/伸缩 + 版权信息

```
读取 CLAUDE.md 了解 UI 重构后的侧边栏组件结构。本次任务让左侧导航栏支持折叠/伸缩,
并在底部新增版权信息。

R6 - 左侧导航栏折叠/伸缩:
1. 在侧边栏组件(读 CLAUDE.md 确认重构后的文件路径,可能是 src/components/Sidebar.tsx
   或重构后的新组件)实现两种状态:
   - 展开态(默认):宽度约 220px,显示图标 + 文字
   - 折叠态:宽度约 60px,只显示图标(文字隐藏),hover 时 tooltip 显示名称
2. 折叠/展开切换:
   - 在侧栏顶部或底部放一个折叠切换按钮(双箭头图标,用图标库,非 emoji)
   - 点击平滑动画切换宽度(CSS transition,约 200ms)
   - 折叠态下导航项居中显示图标
3. 状态持久化:
   - 折叠状态存入应用配置(AppConfig 新增 sidebar_collapsed: bool)
   - 或存入前端持久层(注意:artifact 环境禁用 localStorage,但 Tauri 应用可用 Tauri Store
     插件或写入 config.toml)→ 推荐写入 config.toml
   - 下次启动恢复上次的折叠状态
4. 响应式:
   - 窗口宽度过小时(< 900px)可自动折叠
   - 主内容区宽度随侧栏宽度自适应
5. 折叠态下的细节:
   - 用户菜单 / 版权信息在折叠态下的展示形态(可简化为图标或隐藏文字)
   - 当前选中项的高亮在折叠态下仍然清晰

R7 - 左侧导航栏底部版权信息:
1. 在侧边栏最底部(所有导航项下方)固定展示版权信息:
   - 文案:Copyright © Star Technology. All Rights Reserved
   - 样式:小字号(11-12px),低饱和度颜色(次要文字色),居中或左对齐
2. 折叠态下:
   - 可简化为 "© Star Technology" 或只显示 "©" 图标
   - 或在折叠态下隐藏,展开态才显示
3. 位置:用 flex 布局让版权信息 sticky 在侧栏底部,不随导航列表滚动

== 验证 ==
- 侧栏可平滑折叠/展开,状态持久化(重启恢复)
- 折叠态图标居中 + tooltip 正常
- 底部版权信息正确显示
- 主内容区随侧栏宽度自适应
- cargo build + npm run build 通过

== 注意 ==
先读 CLAUDE.md 确认 UI 重构后侧栏的实际组件名与样式方案(可能用了新的 CSS 方案或组件库),
基于最新结构修改,不要假设旧的目录结构。
```

验证:
- 侧栏折叠/伸缩流畅,状态持久化
- 版权信息正确展示
- `git commit -m "feat: session 26 - collapsible sidebar + copyright"`

---

### Session 27: 设置增强 - 隐私协议页(中英文)

```
读取 CLAUDE.md 了解 UI 重构后的设置页结构。本次任务在设置的"数据管理"下方
新增一项"隐私协议",内置中英文隐私协议说明。

R8 - 隐私协议:
1. 在设置页(读 CLAUDE.md 确认重构后的 Settings 组件路径)的"数据管理"卡片下方,
   新增一个"隐私协议"卡片/入口
2. 交互形式(二选一,推荐 b):
   a. 内联展开:点击"隐私协议"展开/折叠完整协议文本
   b. 弹窗/独立页:点击打开一个隐私协议页面或 Modal,展示完整协议
3. 中英文切换:
   - 协议正文跟随应用当前语言(i18n)显示对应语言版本
   - 至少提供中文(zh-CN)与英文(en-US)两个完整版本
   - 顶部提供语言切换(中文 / English)按钮,方便用户对照
4. 隐私协议内容(内置,需涵盖):
   - 数据存储:所有文献、Skill、Chat 历史、PDF 均存储在用户本地,SG Hub 不上传
   - BYOK 模式:用户配置自己的 API Key 时,请求直连模型提供商,不经过任何 SG Hub 服务器
   - AI Store 模式:使用 SG AI Store 模型时,请求经 sgaistore.com 网关代理,
     网关仅记录用量元数据(token 数/时间),不存储论文内容
   - API Key 安全:存储在操作系统密钥链(Keychain/Credential Manager),不写明文
   - 第三方服务:文献检索 API、AI 模型 API 的数据流向说明
   - 用户权利:数据导出、删除、数据目录迁移
   - 联系方式 / 更新日期
5. 文案存储:
   - 协议正文可以作为独立的 markdown/json 资源文件内置(如 src/assets/privacy/zh-CN.md、en-US.md)
   - 也可放入 i18n 语言包(但协议较长,建议独立文件 + 渲染为富文本)
   - 用 react-markdown 渲染,支持标题、列表、加粗

== 验证 ==
- 设置-数据管理下出现"隐私协议"入口
- 点击可查看完整协议,中英文切换正常
- 协议内容涵盖本地存储、BYOK、AI Store、Keychain 等关键点
- npm run build 通过

== 注意 ==
隐私协议内容应与 SG Hub 实际的数据处理方式一致,不要写不实承诺。
正式发布前建议由法务审阅协议文本。
```

验证:
- 隐私协议入口与内容正确,中英文可切换
- `git commit -m "feat: session 27 - privacy policy page"`

---

### Session 28: AI Store 模块 - 商品展示 + 同步(模拟数据)

```
读取 CLAUDE.md 了解 UI 重构后的项目结构与导航方案。本次任务新增 AI Store 模块,
展示来自 SG AI Store(sgaistore.com)的商品并实现同步。开发阶段用模拟数据。

1. 侧栏新增 AI Store 入口(位置:模型配置与设置之间):
   读 CLAUDE.md 确认重构后的导航组件,在导航列表中插入"AI Store"(用图标库图标,非 emoji)
   位置在"模型配置"之后、"设置"之前。

2. 路由:
   - /store - AI Store 首页(商品列表)
   - /store/product/:id - 商品详情

3. API 契约(src/lib/sgAiStoreApi.ts)- 与 SG AI Store 的协作接口:
   interface SgStoreProduct {
     id: string;
     name: Record<string,string>;        // i18n
     description: Record<string,string>;
     icon_url: string;
     model_provider: string;
     model_id: string;
     billing_period: 'monthly' | 'yearly';
     price_cny: number; price_usd: number;
     token_quota: number;
     features: Record<string,string[]>;
     tags: string[]; popular: boolean;
     purchase_url: string;
   }
   interface SgStoreBalance {
     balance_cny: number; remaining_tokens: number;
     subscription: { product_name: string; expires_at: string; auto_renew: boolean } | null;
     usage_24h: { tokens_in: number; tokens_out: number; call_count: number };
   }
   - base URL 默认 https://sgaistore.com
   - USE_MOCK_DATA 开关,开发阶段返回 mock

4. 模拟数据(src/pages/store/mockData.ts):6 个商品
   - Claude Opus 月度包(50M / ¥199)、Claude Opus 年度包(700M / ¥1999)
   - Claude Sonnet 月度包(200M / ¥99)、GPT-5 月度包(100M / ¥159)
   - DeepSeek V3 月度包(500M / ¥49)、全模型混合包(¥299)

5. Rust 侧 - 商品同步(src-tauri/src/ai_store/):
   a) products.rs:V00X migration 新增表 ai_store_products(字段对应 SgStoreProduct + synced_at)
      - 本地缓存 + ETag,get_cached_products()/sync_products()
   b) sse_listener.rs:SSE 连接 sgaistore.com/api/products/stream
      - 监听 products-updated → sync_products();heartbeat 保活;断线指数退避重连
      - emit 'ai_store:products_updated';mock 模式用定时器模拟
   c) sync_strategy.rs:启动后 5 秒首同步 / 进入 /store 超 5 分钟再同步 / SSE 推送立即同步 / 离线降级

6. Tauri Commands:ai_store_get_products / ai_store_sync_now / ai_store_get_sync_status

7. AI Store 首页(src/pages/store/StoreHome.tsx):
   - 标题区"AI Store"(无 emoji),副标题"无需申请 API Key,购买即用"
   - 提示:"BYOK 用户继续可用 - AI Store 是可选服务"
   - 右上角同步状态指示器(已同步/同步中/离线)+ 手动同步按钮
   - 推荐区(popular 商品)+ 商品网格(按 provider 分组)
   - 商品卡片:图标 + 名称 + 价格 + 配额 + 卖点 + "查看详情"
   - 底部隐私 disclosure(使用 AI Store 模型时请求经 sgaistore.com 网关)
   - 视觉风格遵循 UI 重构后的设计系统(读 CLAUDE.md),不使用 emoji

8. 商品详情页(src/pages/store/ProductDetail.tsx):
   - 左:大图 + 描述 + 完整卖点 + 配额参考 + FAQ
   - 右 sticky:价格 + "立即购买"按钮 + 配额清单 + 条款链接

9. 购买跳转:
   - 点击"立即购买" → 确认对话框 → tauri-plugin-shell 打开 purchase_url
   - 主窗口顶部非阻塞横幅:"已打开购买页 → 购买后前往模型配置接入 Key"

10. 国际化:商品文案根据当前 i18n 语言读取

== 验证 ==
- AI Store 出现在侧栏(模型配置与设置之间),无 emoji
- mock 商品正常展示;同步状态指示器工作;模拟 SSE 触发刷新
- 购买跳转打开浏览器
- cargo test + npm run build 通过
```

验证:
- AI Store 模块完整,mock 数据展示正常
- `git commit -m "feat: session 28 - ai store module with product sync"`

---

### Session 29: SG AI Store 模型接入 + 余额展示

```
读取 CLAUDE.md。本次任务把 SG AI Store 接入模型配置中心,购买 Key 后可直接使用,
并展示实时余额/用量。开发阶段余额查询用 mock 数据。

1. 模型配置中心新增 "SG AI Store" Provider 预设:
   - 名称:SG AI Store(推荐:无需自己申请 API Key)(图标用图标库,非 emoji)
   - 预填:Provider=openai 兼容,Endpoint=https://sgaistore.com/v1
   - 用户填:Model ID(从已购商品下拉)+ API Key(从 sgaistore.com 复制)
   - 显示名自动生成:"{product} (SG AI Store)"

2. 数据模型扩展(V00X migration):
   ALTER TABLE model_configs ADD COLUMN is_sg_ai_store INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE model_configs ADD COLUMN balance_cny REAL;
   ALTER TABLE model_configs ADD COLUMN remaining_tokens INTEGER;
   ALTER TABLE model_configs ADD COLUMN subscription_expires_at TEXT;
   ALTER TABLE model_configs ADD COLUMN balance_synced_at TEXT;
   - endpoint 含 "sgaistore.com" 时自动标记 is_sg_ai_store=1

3. Rust 侧 - 余额查询(src-tauri/src/ai_store/billing.rs):
   - ai_store_get_balance(model_config_id):从 keychain 取 Key →
     GET https://sgaistore.com/api/billing/balance, Bearer xxx → 更新本地余额字段
     (开发阶段用 mock 返回)
   - ai_store_refresh_all_balances()
   - 自动刷新:启动后 10 秒 / 进入模型配置页 / AI 调用完成后 / 每小时

4. 模型卡片增强(读 CLAUDE.md 确认重构后的 Models 页结构):
   SG AI Store 模型卡片额外显示:
   - 顶部标签:SG AI Store(图标库图标,非 emoji)
   - 余额徽章(右上角):绿(充足)/橙(<20%)/红(<10%)/灰(耗尽)
   - 订阅到期时间
   - 24h 用量小条:"今日 ¥1.23 · 12 次调用"
   - 操作按钮:余额详情(打开 sgaistore.com/dashboard)/ 充值(sgaistore.com/topup)

5. 余额不足拦截(src-tauri/src/ai_client/mod.rs):
   - 若 is_sg_ai_store=1 且 balance_cny < 1.0 或 remaining_tokens < 1000:
     * 返回 InsufficientBalance 错误
     * 前端弹窗:"余额不足,前往充值后继续使用" [前往充值] [换个模型] [取消]
     * "前往充值" → 打开 sgaistore.com/topup?key=sk-xxx

6. 引导接入 Key:
   - 购买后回 SG Hub,点击横幅 → 模型配置页
   - 顶部引导卡片(若无 SG AI Store 模型):
     "刚在 SG AI Store 完成购买?粘贴 API Key 立即使用:[输入框] [添加并测试]"
   - 粘贴 Key 后:验证有效性 → 推断 model_provider/model_id → 创建 ModelConfig(Key 存 keychain)
     → Toast "模型已添加,余额 ¥{X}"

7. 隐私提示:
   - 首次使用 SG AI Store 模型前一次性弹窗:
     "你正在使用 SG AI Store 模型。请求会经 sgaistore.com 网关转发,
      网关不存储论文内容,仅记录用量元数据。[我已知晓] [取消]"
   - 设置页隐私区新增开关:"Chat/AI 解析中禁用 SG AI Store 模型"

8. 测试场景:
   a) 完整闭环:AI Store 浏览 → 跳转购买(浏览器)→ 回 SG Hub 接入 Key → Chat 使用
   b) 余额变化:聊天后余额徽章实时更新
   c) 余额耗尽:触发拦截,引导充值
   d) 隐私豁免:设置开启后 Chat 下拉隐藏 AI Store 模型
   e) 离线:展示缓存余额 + 离线提示

== 验证 ==
- 完整闭环可用(mock 数据)
- 余额徽章颜色阈值正确,余额不足引导流畅
- cargo test 通过
```

验证:
- 完整闭环可用,余额展示正确
- `git commit -m "feat: session 29 - sg ai store integration with balance"`

---

### V2.2.1 收尾:Beta + 发布

完成 Session 25-29 后:

1. 合并 feature/v2.2.1 到 main:
```cmd
git checkout main
git merge --no-ff feature/v2.2.1
git push
```

2. 打 Beta tag → GitHub Releases prerelease → 邀请 V2.1.0 用户测试

3. Beta 期重点:
   - Bug 修复回归(非默认模型解析)
   - 品牌文案是否全部统一(无遗漏的 SGHUB / 收藏夹 / emoji)
   - 侧栏折叠在不同窗口尺寸下的表现
   - 隐私协议中英文展示
   - AI Store 同步与余额(mock 数据下)

4. 等 SG AI Store(sgaistore.com)上线后,把 mock 切换为真实 API 联调,通过后发正式版:
```cmd
git tag v2.2.1
git push --tags
```

5. 公告:品牌升级 SG Hub + UI 优化(侧栏折叠等)+ Bug 修复 + 新增 AI Store 模块 + 隐私协议

---


## V2.2.1 Session 速查（已发布）

| Session | 主题 | 对应需求 | 预估时长 |
|---------|------|---------|---------|
| 25 | Bug 修复 + 全局品牌与文案调整 | R1/R2/R3/R4/R5 | 1 周 |
| 26 | 左侧导航栏折叠/伸缩 + 版权信息 | R6/R7 | 0.5 周 |
| 27 | 设置增强 - 隐私协议页(中英文) | R8 | 0.5 周 |
| 28 | AI Store 模块 - 商品展示 + 同步(模拟数据) | R9 | 1 周 |
| 29 | SG AI Store 模型接入 + 余额展示 | R10 | 0.5-1 周 |

**总计**: 约 3.5-4 周

**需求映射**:
| 编号 | 需求 |
|------|------|
| R1 | 产品名称统一为 "SG Hub" |
| R2 | 去除"添加模型"/"订阅·新建"按钮前的加号 |
| R3 | "收藏夹" 更名为 "文献数据库" |
| R4 | 去除/隐藏全部 emoji 图标(改用图标库或文字) |
| R5 | Bug 修复:非默认模型解析失败 |
| R6 | 左侧导航栏支持折叠/伸缩 |
| R7 | 导航栏底部版权:Copyright © Star Technology. All Rights Reserved |
| R8 | 设置-数据管理下新增"隐私协议"(中英文) |
| R9 | AI Store 模块 - 商品展示 + 同步 |
| R10 | SG AI Store 模型接入 + 余额展示 |

**核心边界与关键提醒**:
- **UI 已重构**:每个 Session 开始前,Claude Code 必须先读 CLAUDE.md 确认重构后的最新结构
- AI 中转服务是**完全独立项目 SG AI Store**(sgaistore.com,V1.0.0 起独立演进),不在 SGHUB 范围
- SGHUB 客户端只作为消费方对接 SG AI Store 公开 API,开发阶段用 mock 数据
- AI Store 模块位于侧栏"模型配置"与"设置"之间
- 品牌文案区分:展示文案改 "SG Hub";代码标识符/包名/bundle id/数据目录/域名保持不变

**两个项目的协作契约(API)**:
- `GET https://sgaistore.com/api/products.json` - 商品列表(带 ETag)
- `GET https://sgaistore.com/api/products/stream` - SSE 商品变更推送
- `GET https://sgaistore.com/api/billing/balance` - 余额/用量查询(API Key 鉴权)
- `https://sgaistore.com/v1` - OpenAI 兼容模型调用网关

---

---


---

## M2.1.0 · 体验打磨与设置完善(Week 22-25)【已完成】

> 【版本说明】此版本原编号 V2.0.2,现正式发布为 **V2.1.0**,已开发完成并上线。
> 内容:设置体系完善、多语言基础设施、Token 统计启用、Skill 自然语言生成器。
> 配套文档:PRD V2.1.0 / 架构方案 V2.1.0 / 实施方案 V2.1.0。

### 在开始 Session 19 之前

确认 V2.0.1 已发布且本地分支已同步:
```cmd
cd D:\2-WORK\恒星\项目\学术文献管理系统\SG_Hub
git checkout main
git pull
git checkout -b feature/v2.1.0
```

所有该版本的 Session 都在 `feature/v2.1.0` 分支上做,完成后再合并到 main 发布。

---

### Session 19: 菜单顺序调整 + 移除自动备份

```
读取 CLAUDE.md。本次任务是 V2.0.2 的快赢任务,改两个地方:

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

- 修改 docs/PRD V2.0.2 或 docs/changelog.md(如有)中关于"自动备份"的描述,删除相关条款
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
读取 CLAUDE.md。本次任务实现数据目录可配置功能,这是 V2.0.2 最复杂的一项。
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
读取 CLAUDE.md 与 skills/general_read.yaml。本次任务实现 V2.0.2 的核心新功能:
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

### V2.0.2 收尾:Beta + 发布

完成 Session 19-24 后,进入 Beta 与发布阶段:

1. 合并 feature/v2.0.2 到 main:
```cmd
git checkout main
git merge --no-ff feature/v2.0.2
git push
```

2. 打 Beta tag:
```cmd
git tag v2.0.2-beta.1
git push --tags
```

3. GitHub Releases 创建 prerelease,邀请 V2.0.1 活跃用户参与 Beta。

4. Beta 期 1 周,重点关注:
   - 数据迁移功能(高风险)的稳定性
   - 多语言显示在不同系统下的兼容性
   - Skill 生成器的产出质量

5. 正式发布:
```cmd
git tag v2.0.2
git push --tags
```

6. 公告:重点宣传"AI 自然语言创建 Skill"(差异化亮点)、多语言支持(国际化)、数据目录可配置(进阶用户福音)。

---


## V2.1.0 Session 速查（原 V2.0.2,已完成上线）

| Session | 主题 | 预估时长 |
|---------|------|---------|
| 19 | 菜单顺序调整 + 移除自动备份 | 0.5 天 |
| 20 | 多语言基础设施(5 语言 + 跟随系统) | 1 周 |
| 21 | 自动更新调度配置(开关 + 频率 + 时间) | 3 天 |
| 22 | 数据目录可配置 + 迁移逻辑 | 1 周 |
| 23 | Token 统计写入 + 近 7 天展示 | 0.5 周 |
| 24 | Skill 自然语言生成器 | 1 周 |

**总计**: ~4 周(已完成)

---


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


---

## 所有版本 Session 对照

| 版本 | Session 范围 | 主题 | 状态 |
|------|------------|------|------|
| V2.0.0 | 1-12 | 桌面客户端核心功能基线 | 已发布 |
| V2.0.1 | 13-18 | Chat + Skill 编辑 + 跨模块跳转 | 已发布 |
| V2.1.0 | 19-24 | 设置完善 + 国际化 + Skill 智能生成(原 V2.0.2) | 已发布 |
| V2.2.1 | 25-29 | UI 优化(改名 SG Hub/去 emoji/折叠侧栏/隐私协议)+ Bug 修复 + AI Store 模块 | 已发布 |
| V2.2.2 | 30-31 | 更换 Logo + 文献数据库本地 PDF 上传与集中管理 | 已发布 |
| V2.2.3 | 32-33 | 文献检索源扩充至 8 源(Crossref/CORE/DBLP/DOAJ)+ 匹配增强与跨源归并 | 已发布 |
| V2.2.4 | 34 | 首次启动引导(数据目录 + 模型配置,可跳过) | 已发布 |
| V2.2.5 | 35-36 | 打包发布完善(Logo/签名/安装卸载/版本一致)+ 设置简化 + 模型配置 UI 优化 | 已发布 |
| V2.2.6 | 37-39 | 内置 PDF 阅读器 + 全文翻译 + 检索状态保持 + AI Store 并入模型配置页 + 强制阅读隐私协议 | 已发布 |
| V2.2.7 | 40-41 | Chat 模块交互与功能增强(参考 Claude 网页):附件 / Skill / 模型版本下拉 / 复制 / 重新生成 / 编辑后重发 | 已发布 |
| V2.2.8 | 42-43 | Google Vertex(Gemini)ADC 免密接入 + 已连接模型显示调整 + 侧栏版本号 | 已发布 |
| V2.2.9 | 44-46 | 解析任务后台化修复 + 解析动效 + UI 微调 + 文献库按钮重排(文件/来源/查看) | 规划中 |

