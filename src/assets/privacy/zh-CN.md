# SG Hub 隐私协议

**协议版本**:V2.2.1 · **最后更新**:2026-05-21

SG Hub 是一款开源的桌面学术文献管理工具(MIT License),完全本地化运行。本协议描述 SG Hub 如何处理你的数据。

> **简短承诺**:SG Hub **不运营任何后端服务器**。你的所有文献、Skill、Chat 历史、PDF、API Key 都只在你的电脑本地存在。下文展开各项细节。

---

## 一、本地数据存储

所有数据存放在系统应用数据目录:

- **Windows**:`%APPDATA%\com.sghub.app\`
- **macOS**:`~/Library/Application Support/com.sghub.app/`

包括:

- `data/sghub.db` — SQLite 数据库(文献元数据、Chat 历史、解析结果、订阅设置)
- `data/pdfs/` — 你下载或上传的 PDF 文件
- `data/cache/` — 检索结果缓存
- `data/chat_attachments/` — Chat 上传的附件
- `skills/` — 自定义 Skill 模板
- `logs/` — 应用日志(滚动 7 天后自动删除)

你可以在「设置 → 数据存储位置」修改数据目录,把上述全部数据迁移到你指定的任意位置(支持 OneDrive / iCloud Drive 同步)。

---

## 二、API Key 安全

模型提供商的 API Key 全部存储在操作系统的密钥链中:

- **Windows**:Windows Credential Manager
- **macOS**:Keychain

底层使用 `keyring-rs` 开源库。Key **永远不会**:

- 写入任何明文配置文件(包括 `config.toml` / `models.toml`)
- 写入应用日志
- 发送到任何 SG Hub 控制的服务器(我们也没有这种服务器)

每个 Key 与对应模型配置的 UUID 绑定。删除模型时,关联的 Key 同时从密钥链中清除。

---

## 三、AI 模型调用(BYOK 模式)

当你配置 Anthropic / OpenAI / DeepSeek / Ollama / 其他 OpenAI 兼容服务的 API Key 时:

- 请求**直接**(HTTPS)从你的电脑发往你配置的 `endpoint`
- **不经过任何 SG Hub 服务器**
- 请求体包含:你选定的论文标题/摘要/PDF 全文 + Skill 模板渲染后的 prompt + 模型参数
- 响应直接流回你的电脑,逐 token 渲染

你可以在「设置 → 模型配置」每个模型卡片上看到完整的请求目的地(`endpoint` 字段)。

---

## 四、SG AI Store(可选服务,规划中)

如果将来你选择使用 SG AI Store(`https://sgaistore.com`)的预付费模型:

- 请求会经过 SG AI Store 网关代理,转发到底层模型提供商
- 网关**仅记录用量元数据**:token 数、调用时间、用户标识(用于计费对账)
- 网关**不保存**请求体(论文内容、prompt)或响应体
- 你可以在「设置 → 隐私 → Chat/AI 解析中禁用 SG AI Store 模型」一键关闭此通路

SG AI Store 是**独立产品**,有自己的服务条款,完全可选。你不使用它时,SG Hub 与 sgaistore.com 之间没有任何数据流。

---

## 五、文献检索

文献检索功能直接调用以下**开放学术数据库**的公开 API(均不需要 Key,也不会发送你的个人信息):

| 数据源 | 域名 | 用途 |
|---|---|---|
| arXiv | `export.arxiv.org` | arXiv 预印本检索 |
| Semantic Scholar | `api.semanticscholar.org` | 跨学科文献 + 引用关系 |
| PubMed | `eutils.ncbi.nlm.nih.gov` | 医学文献(NCBI E-utilities) |
| OpenAlex | `api.openalex.org` | 开放学术图谱 |

请求仅包含你输入的关键词。结果在本地落库后,后续浏览不再触发外网请求。

---

## 六、自动更新

启用「设置 → 自动更新」时,SG Hub 按你设置的频率向 `https://github.com/zmc0081/SGHUB/releases` 查询新版本元数据。

- 请求仅包含当前版本号
- 不发送任何个人信息、文献数据、使用统计
- 你可以在「设置 → 自动更新」一键关闭

---

## 七、日志

应用日志写到本地的 `logs/` 目录,滚动保留 7 天后自动删除。日志内容包括:

- 模块名 + 时间戳 + 日志级别
- 调用链上下文(provider / endpoint / model_id —— **不含 API Key,不含论文正文**)
- 错误堆栈

日志**不会**上传到任何地方。如果你需要排查问题并愿意分享日志,请手动打开 logs 目录并核对内容后再分享。

---

## 八、第三方数据流总览

| 流向 | 触发 | 数据 |
|---|---|---|
| → 模型提供商(Anthropic / OpenAI / DeepSeek / Ollama 等) | AI 解析 / Chat / Skill 测试 | 你选定的论文 + prompt + 模型参数 |
| → arXiv / Semantic Scholar / PubMed / OpenAlex | 文献检索 / 订阅 | 关键词 |
| → GitHub Releases | 自动更新 | 当前版本号 |
| → sgaistore.com(可选) | 使用 SG AI Store 模型 | 同模型提供商 + 用量元数据 |

除以上 4 个明确目的地外,SG Hub **不向任何其他服务器发送数据**。

---

## 九、你的权利

你拥有数据的完全所有权:

- **导出**:Library 中的文献可一键导出为 BibTeX;Chat 历史可直接读取 SQLite
- **删除**:删除某条文献 / Skill / 对话 / 模型时,关联的 Key 与文件即时清理
- **迁移**:「设置 → 数据存储位置」可把整个数据目录搬到任意位置
- **离线**:除上述明确触发点外,SG Hub 在无网络环境下完全可用

---

## 十、更新与联系

- 本协议随版本演进,**重大变更**会在升级日志中明确标注
- 项目地址:`https://github.com/zmc0081/SGHUB`
- 反馈:GitHub Issues
- 协议版本:**V2.2.1** · 最后更新:**2026-05-21**

---

> 本协议为社区版默认条款。如你在企业 / 受监管环境部署 SG Hub,建议由所在组织的法务/合规审阅本文。
