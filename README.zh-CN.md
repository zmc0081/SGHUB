<div align="center">

# SG Hub

**AI 驱动的学术文献管理桌面应用**

开源 · 本地优先 · 隐私可控

[English](./README.md) · 简体中文

[![Release](https://img.shields.io/github/v/release/zmc0081/SGHUB?color=4f46e5)](https://github.com/zmc0081/SGHUB/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey)](https://github.com/zmc0081/SGHUB/releases)

`Tauri 2` · `React 18` · `TypeScript` · `Rust` · `SQLite(FTS5)` · MIT License

</div>

---

## 简介

SG Hub 是一款开源(MIT)桌面客户端,面向科研工作者,把"找文献、管文献、读文献、译文献"整合到一个本地优先、隐私可控的工作台中。支持多源聚合检索、关键词订阅推送、文献数据库管理、内置 PDF 阅读与全文翻译、AI 文献解析、Chat 自由对话,以及 BYOK 多模型配置。

## 核心功能

- **多源聚合检索** — 8 源并发(arXiv / PubMed / Semantic Scholar / OpenAlex / Crossref / CORE / DBLP / DOAJ),DOI 直查、标题模糊匹配、跨源去重归并
- **统一数据源** — 设置中一处全局开关;文献检索与今日推送都查询同一启用集合,三处保持一致
- **订阅与推送** — 关键词订阅 + 定时本地推送(系统托盘通知)
- **文献数据库** — 多级文件夹 + 标签 + 本地 PDF 上传与集中管理;文献卡操作:查看(内置阅读器)/ AI 精读 / 翻译 / 文件(打开文件夹并定位)/ 来源 / 移动 / 删除
- **内置 PDF 阅读器** — 软件内打开 PDF(pdf.js),翻页 / 缩放 / 适应宽度 / 目录 / 页内搜索 / 文本选择
- **全文翻译** — 借助大模型,保持结构与排版的学术级翻译(整篇替换或中外对照)
- **其它应用打开** — 把本地 PDF 交给 WPS / Adobe 等已装应用,或把全文链接交给默认浏览器
- **AI 文献解析** — Skill 精读 + 流式输出;解析任务后台运行,切换页面不中断;历史按文献分组持久保存;HTML 报告一键下载并在文件管理器中定位
- **内置科研精读 Skill** — 随软件内置 `research-scientific-literature`:教授视角深度研读,产出 Tab 导航的交互式 HTML 报告
- **Claude 风格 Chat** — 输入框内模型下拉(按 provider 分组、余额徽章),复制 / 重新生成(可换模型)/ 编辑后重发 / 停止流式,附件(PDF / 文本 / 图片多模态),"/" 唤起 Skill 面板
- **模型配置(BYOK)** — Claude / GPT / DeepSeek / **Google Vertex (Gemini)** / Ollama 本地;API Key 仅存系统密钥链
- **Google ADC 免密** — 本地 Application Default Credentials 直连 Vertex Gemini:不存任何 Key、令牌自动刷新、支持企业代理(逐模型或系统代理)
- **最新模型预设 + 自定义输入** — 各 provider 预设清单保持最新(如 Gemini 3.5 Flash),另有"自定义…"手动输入,新模型永不受阻
- **AI Store** — 对接独立的 SG AI Store,购买配额即买即用,内容并入模型配置页
- **隐私优先** — 首次启动强制阅读并同意隐私协议;数据默认仅存本地

## 检索层架构

SG Hub 的检索层采用分层流水线:多源接入 → 去重合并 → 引文增强 → 语义检索 → 应用输出。

<div align="center">

![SG Hub 检索层目标架构](./sghub_retrieval_layer_architecture.svg)

</div>

| 层 | 能力 | 状态 |
|---|---|---|
| ① 多源数据接入 | 并行适配 · 字段归一化 · 限流重试(8 源 + 规划 Unpaywall) | 已实现 |
| ② 去重合并 | DOI 精确匹配 · 标题作者模糊 · 版本聚类 · 字段择优合并 | 已实现 |
| ③ 引文增强 | 引文图谱补全 · 被引数聚合 · 双向链接 · 相关文献推荐 | 规划中 |
| ④ 语义检索 | Embedding · 向量库 · 混合检索(BM25+向量) · 重排序 | 规划中 |

## 技术栈

| 层级 | 技术 |
|------|------|
| 应用框架 | Tauri 2(Rust backend + WebView frontend) |
| 前端 | React 18 + TypeScript 5 + Vite + TailwindCSS 3 + Zustand + TanStack Router |
| 国际化 | react-i18next(zh-CN / en-US) |
| 后端 | Rust + tokio + rusqlite(SQLite + FTS5)+ reqwest + keyring |
| PDF | pdf.js(渲染 + 文本层)+ pdf-extract / lopdf(文本提取) |

## 安装

从 [Releases](https://github.com/zmc0081/SGHUB/releases) 下载对应平台安装包:
- **Windows**:`SG.Hub_x.x.x_x64-setup.exe`(NSIS 安装程序)
- **macOS**:`SG.Hub_x.x.x_universal.dmg`(Universal — Intel 与 Apple Silicon)

> Windows 首次运行如提示 SmartScreen,点击"更多信息 → 仍要运行"。
> macOS 安装包当前未签名,首次打开请右键 → 打开。
> 支持 Windows 10 21H2+ 与 macOS 12+。

## 从源码构建

```bash
# 前置:Node.js ≥ 18、Rust、平台构建依赖
git clone https://github.com/zmc0081/SGHUB.git
cd SGHUB
npm install
npm run tauri dev      # 开发模式
npm run tauri build    # 构建安装包
```

## 隐私

- 数据默认存储在本地,文献 / PDF / Chat 历史不上传
- BYOK 模式请求直连模型提供商,不经任何 SG Hub 服务器
- 全文翻译只把所选文档的文本发送给你配置的模型
- AI Store 模式请求经 sgaistore.com 网关,仅记录用量元数据,不存内容
- API Key 存储在操作系统密钥链(Credential Manager / Keychain)

## 许可证

[MIT](./LICENSE) © Star Technology

---

<div align="center">

Copyright © Star Technology. All Rights Reserved.

</div>
