# SGHUB V2.2 — Design Handoff Package

> 本目录是「交付给设计师 / Claude design / 重构工程师」的完整工作包。
> **风格已选定**:SGHUB Capsule(基于 KnowledgeHub X / KHX)。
> 当前状态:**Step 0 待启动**(token 权威源已就位 ✅,等待 Step 1-6 设计交付物填充)。

---

## 1. 这是什么

为 SGHUB **V2.2 UI 重设计**搭建的设计→实现交付管道:

```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│  你(PM/owner)  │ → │   Claude design      │ → │   Claude Code   │
│   填本目录的     │    │  (claude.ai Project) │    │  按交付物重构   │
│   3 份输入文档   │    │  按 6 步逐步交付     │    │  前端代码       │
└─────────────────┘    └──────────────────────┘    └─────────────────┘
```

## 2. 目录与状态

```
docs/design-handoff/
├── 0-README.md                          ✅ 本文件
├── briefing.md                          ✅ 给 Claude design 的项目简报(直接粘贴)
├── implementation-steps.md              ✅ 你的执行手册(7 步)
├── design-style-spec.md                 ✅ 新风格规范「SGHUB Capsule(基于 KHX)」
├── 1-tokens/
│   ├── khx-reference/                   ✅ KHX 实景 token 权威源
│   │   ├── README.md                        KHX 用法说明 + 速查表
│   │   ├── tokens.css                       纯 CSS Variables(亮色)
│   │   ├── tokens.scss                      SCSS + Mixins
│   │   ├── tailwind.config.js               Tailwind v3 配置 + 组件级类
│   │   └── tailwind-v4.css                  Tailwind v4 配置(参考,不采用)
│   ├── design-tokens.starter.json       ✅ SGHUB-shaped tokens 中间件(亮+暗)
│   └── design-tokens.json               ⬜ Step 1 最终输出
├── 2-mockups/                           ⬜ Step 3 产出
│   ├── pages/   (Search/Feed/Library/Parse/Chat/Models/Skills/SkillGenerator/Settings .draft.tsx)
│   └── components/  (Sidebar/Titlebar/PaperPicker/PaperActions/FavoriteButton/PaperMetadataEditor/SkillEditor/DataDirCard/UpdaterCard .draft.tsx
│                     + ToastProvider/BaseModal/ConfirmDialog/InputDialog/Skeleton/Icon .draft.tsx)
├── 3-specs/                             ⬜ Step 2 + 4 + 5 产出
│   ├── component-specs.md
│   ├── icon-map.md
│   └── interaction-flows.md
├── 4-assets/                            ⬜ Step 4 产出
│   ├── icons/         (替换全部 emoji 的 SVG 集,Lucide 风 1.5px stroke)
│   ├── illustrations/ (5 张空状态线稿)
│   └── logo/
└── 5-screenshots/                       ⬜ Step 6 产出(可选)
    └── (按 ui-screenshots-checklist.md 的占位填)
```

## 3. 立即开始

1. 打开 [briefing.md](./briefing.md),把内容粘到 claude.ai 新建 Project 的 Instructions
2. 上传以下文件到 Project Knowledge(优先级见 briefing.md 附表):
   - `../ui-design-requirements.md`(V2.1.0 现状基线)
   - `./design-style-spec.md`(新风格规范 SGHUB Capsule)
   - `./1-tokens/khx-reference/tokens.css`(KHX 权威 token 源)
   - `./1-tokens/khx-reference/README.md`(KHX 用法说明)
   - `./1-tokens/design-tokens.starter.json`(SGHUB-shaped 中间件)
3. 按 [implementation-steps.md](./implementation-steps.md) 的 7 步逐步推进
4. 全部交付到位后,把整个 `design-handoff/` 目录交给 Claude Code:

   ```
   读取 docs/design-handoff/0-README.md。
   按 implementation-steps.md 的 Step 7 提示,执行 V2.2 UI 重构。
   ```

## 4. 时间预算(单人执行)

| 阶段 | 估时 |
|---|---|
| Step 0 准备 | 15 min |
| Step 1 Tokens | 30 min |
| Step 2 组件规格 | 1 h |
| Step 3 9 个页面 draft(分 3 批) | 3-5 h |
| Step 4 图标 + 空状态 | 1 h |
| Step 5 交互流程图 | 45 min |
| Step 6 预览图(可选) | 1-2 h |
| Step 7 交给 Claude Code 重构 | 半天 ~ 1 天 |
| **合计** | **2-3 个工作日** |

## 5. 相关参考

- [`./design-style-spec.md`](./design-style-spec.md) — **SGHUB Capsule** 风格规范(必读)
- [`./1-tokens/khx-reference/README.md`](./1-tokens/khx-reference/README.md) — KHX 原始 token 用法
- [`../ui-design-requirements.md`](../ui-design-requirements.md) — V2.1.0 当前 UI 规格基线
- [`../ui-screenshots-checklist.md`](../ui-screenshots-checklist.md) — 全部画面截图占位
- [`../../CLAUDE.md`](../../CLAUDE.md) — 项目上下文 / 技术约束

---

> 维护者:UI 重构完成后,把 design-handoff/ 移到 `docs/archive/v2.2-design-handoff/`
> 作为历史归档,避免污染下一次重设计的工作目录。
