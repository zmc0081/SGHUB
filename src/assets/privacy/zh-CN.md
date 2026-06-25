# SG Hub 隐私协议

**协议版本**:v2.2.7 · **生效日期**:2026-06-25

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
- Chat 中上传的附件按类型进入请求:文本 / PDF 提取为文字注入上下文;图片以多模态(base64)发送给支持视觉的模型
- 响应直接流回你的电脑,逐 token 渲染

你可以在「设置 → 模型配置」每个模型卡片上看到完整的请求目的地(`endpoint` 字段)。

---

## 四、PDF 阅读与全文翻译

SG Hub V2.2.6 起内置 PDF 阅读器与全文翻译功能:

- **内置 PDF 阅读**:在应用内用 pdf.js 渲染 PDF(翻页 / 缩放 / 目录 / 页内搜索 / 文本选择),
  **全程在本地完成,不上传任何文件**。
- **全文翻译**:翻译会把 PDF / 文献的**文本内容**发送给你**已配置的大模型**(BYOK 模式下直连
  你的模型提供商;若使用 SG AI Store 模型则经其网关),以获得学术质量的译文。
  - 翻译按文档结构分段发送,请求体包含被翻译的正文文本 + 翻译指令 prompt + 模型参数
  - 译文逐段流式返回,在本地渲染 / 重组,**不经过任何 SG Hub 服务器**
  - 是否翻译、用哪个模型完全由你决定;不主动触发翻译时不发送任何内容

> 与 AI 解析 / Chat 一致,翻译会把选定文档的文本交给你配置的模型方处理。涉及敏感或未公开内容时,请自行评估后再使用。

---

## 五、SG AI Store(可选服务,规划中)

如果将来你选择使用 SG AI Store(`https://sgaistore.com`)的预付费模型:

- 请求会经过 SG AI Store 网关代理,转发到底层模型提供商
- 网关**仅记录用量元数据**:token 数、调用时间、用户标识(用于计费对账)
- 网关**不保存**请求体(论文内容、prompt、待翻译文本)或响应体
- 你不配置 SG AI Store Key 时,SG Hub 与 sgaistore.com 之间没有任何数据流

SG AI Store 是**独立产品**,有自己的服务条款,完全可选。

---

## 六、文献检索

文献检索功能直接调用以下**开放学术数据库**的公开 API(均不需要你的个人信息):

| 数据源 | 域名 | 用途 |
|---|---|---|
| arXiv | `export.arxiv.org` | 预印本检索 |
| Semantic Scholar | `api.semanticscholar.org` | 跨学科文献 + 引用关系 |
| PubMed | `eutils.ncbi.nlm.nih.gov` | 医学文献(NCBI E-utilities) |
| OpenAlex | `api.openalex.org` | 开放学术图谱 |
| Crossref | `api.crossref.org` | 正式期刊论文(DOI) |
| CORE | `api.core.ac.uk` | 机构库 / 开放获取全文 |
| DBLP | `dblp.org` | 计算机科学文献 |
| DOAJ | `doaj.org` | 开放获取期刊 |

请求仅包含你输入的关键词(Crossref 可选携带你在设置中填写的联系邮箱以进入其 polite pool)。结果在本地落库后,后续浏览不再触发外网请求。

---

## 七、自动更新

SG Hub 在每次启动时向 `https://github.com/zmc0081/SGHUB/releases` 查询一次新版本元数据:

- 请求仅包含当前版本号
- 不发送任何个人信息、文献数据、使用统计
- 检查到新版本时弹出通知,由你决定是否更新

---

## 八、日志

应用日志写到本地的 `logs/` 目录,滚动保留 7 天后自动删除。日志内容包括:

- 模块名 + 时间戳 + 日志级别
- 调用链上下文(provider / endpoint / model_id —— **不含 API Key,不含论文正文**)
- 错误堆栈

日志**不会**上传到任何地方。如果你需要排查问题并愿意分享日志,请手动打开 logs 目录并核对内容后再分享。

---

## 九、第三方数据流总览

| 流向 | 触发 | 数据 |
|---|---|---|
| → 模型提供商(Anthropic / OpenAI / DeepSeek / Ollama 等) | AI 解析 / Chat / Skill 测试 / 全文翻译 | 你选定的论文 / PDF 文本 + prompt + 模型参数 |
| → arXiv / Semantic Scholar / PubMed / OpenAlex / Crossref / CORE / DBLP / DOAJ | 文献检索 / 订阅 | 关键词 |
| → GitHub Releases | 自动更新 | 当前版本号 |
| → sgaistore.com(可选) | 使用 SG AI Store 模型 | 同模型提供商 + 用量元数据 |

除以上明确目的地外,SG Hub **不向任何其他服务器发送数据**。

---

## 十、你的权利

你拥有数据的完全所有权:

- **导出**:Library 中的文献可一键导出为 BibTeX;Chat 历史可直接读取 SQLite;译文可复制 / 导出
- **删除**:删除某条文献 / Skill / 对话 / 模型时,关联的 Key 与文件即时清理
- **迁移**:「设置 → 数据存储位置」可把整个数据目录搬到任意位置
- **离线**:除上述明确触发点外,SG Hub 在无网络环境下完全可用

---

## 十一、更新与联系

- 本协议随版本演进,**重大变更**会在升级日志中明确标注,并要求你重新阅读并同意
- 本协议的版本号与生效日期见**文首**,且始终与应用版本号保持一致
- 项目地址:`https://github.com/zmc0081/SGHUB`
- 反馈:GitHub Issues

---

> 本协议为社区版默认条款。如你在企业 / 受监管环境部署 SG Hub,建议由所在组织的法务/合规审阅本文。
