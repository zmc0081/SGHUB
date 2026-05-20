# V2.2 UI 重设计 — 7 步实施手册

> ⏳ **历史归档** — 本手册用于 V2.2 重设计阶段(2026-05-18 ~ 2026-05-20),已完成。
> Step 0-6 设计交付与 Step 7 Claude Code 落地全部完成,合并到 main(PR #17, commit `9c56cd6`)。
> 当前 UI 规范权威源是 [`design-style-spec.md`](./design-style-spec.md) + [`3-specs/`](./3-specs/)。
> 保留本文件作流程追溯材料。
>
> ---
>
> 这是「你」(项目 owner)的执行手册,不是给 Claude design 看的。
> 与 `briefing.md` 配套使用。

---

## Step 0 — 准备(15 分钟)

| # | 操作 | 输出 |
|---|---|---|
| 0.1 | 在 claude.ai 创建 Project,命名 `SGHUB V2.2 UI Redesign` | Project ID |
| 0.2 | 把 `briefing.md` 的 ``` 代码块`` 内容粘到「Project Instructions」 | 保存 |
| 0.3 | 上传 3 个文件到「Project Knowledge」:`ui-design-requirements.md` / `ui-screenshots-checklist.md` / `design-style-spec.md` | 3 个 attachment |
| 0.4 | 本地切重构分支:`git checkout -b feature/ui-redesign` | 准备落地分支 |

---

## Step 1 — Tokens(约 30 分钟)

### 你的操作
在 Project 内新开会话,发送:
```
Ready for Step 1. 开始 Tokens 步骤。
```

### 期望产出
- `design-tokens.json`(亮+暗双套,JSON 嵌套结构)
- `tailwind.config.diff.js`(与现有 config 的 diff 片段)
- 1-2 段「设计决策」总结

### 你的检查
| 检查项 | 标准 |
|---|---|
| 现有 CSS 变量名是否覆盖 | `--primary / --accent / --bg / --fg / --sidebar-bg / --sidebar-fg / --sidebar-fg-active / --titlebar-bg / --border` 9 个变量必须存在 |
| 是否新增了非约定的变量名 | 如有新增,要求 Claude 列出来跟你说明用途 |
| 亮 / 暗对比度 | 抽 3 组用 contrast-ratio 工具核对 ≥ AA |
| 颜色硬编码 | 在 tokens 文件内是 OK 的;在 draft 里若出现要 Claude 改 token |

### 落地
保存到 `docs/ui-design/1-tokens/`,回复 Claude「✅ 通过,进入 Step 2」。

---

## Step 2 — 共享组件规格(约 1 小时)

### 你的操作
```
开始 Step 2。覆盖 ui-design-requirements.md §5 列出的全部
共享组件,产出 component-specs.md。
```

### 期望产出
单一 `component-specs.md`,目录:
- 5.1 Sidebar / 5.2 Titlebar / 5.3 PaperPicker / 5.4 PaperActions /
  5.5 FavoriteButton / 5.6 PaperMetadataEditor / 5.7 SkillEditor /
  5.8 DataDirCard / 5.9 UpdaterCard

每节包含:
- **PropsAPI**(TS interface)
- **Variants**(`size: sm | md`、`mode: edit | view` 等)
- **States**(default / hover / disabled / loading / error / focus)
- **Dimensions**(min/max 宽高 + padding/margin)
- **A11y**(role / aria-* / 键盘交互)
- **示例 JSX**(覆盖 3 个代表 state)

### 你的检查
| 检查项 | 标准 |
|---|---|
| 4 态齐全 | 每个交互组件至少有 hover / disabled / loading / error |
| PropsAPI 与现状兼容 | 不修改现有组件的 props 名(可加新可选 prop) |
| A11y 行 | 不能空 |

### 落地
保存到 `docs/ui-design/3-specs/component-specs.md`。

---

## Step 3 — 9 个页面的 draft TSX(分 3 批,约 3-5 小时)

### 重要:必须分批

一次性让 Claude 输出 9 个页面 = 100% 被截断 + 质量下降。**严格分 3 批**。

| 批次 | 页面 | 你发的消息 |
|---|---|---|
| A | Search / Feed / Models | `Step 3 - 批次 A:Search / Feed / Models 三个页面的 *.draft.tsx` |
| B | Library / Parse / Chat | `Step 3 - 批次 B:Library / Parse / Chat 三个页面的 *.draft.tsx` |
| C | Skills / SkillGenerator / Settings | `Step 3 - 批次 C:Skills / SkillGenerator / Settings 三个页面的 *.draft.tsx` |

每批之间 review + 落地后再进下一批。

### 期望产出(每个 draft.tsx)
```tsx
// pages/Search.draft.tsx
// V2.2 静态结构 draft,无业务逻辑

import React from "react";

export function SearchDraft_MainFlow() {
  // TODO: from useSearchStore() — papers, isLoading
  return (
    <main className="…">…</main>
  );
}

export function SearchDraft_Empty() { return <…/>; }
export function SearchDraft_Loading() { return <…/>; }
export function SearchDraft_Error() { return <…/>; }
```

### 你的检查
| 检查项 | 标准 |
|---|---|
| 是否含业务逻辑 | 不应有 `useState` `useEffect` `invoke()` `useXxxStore` 实际调用 |
| 占位数据是否清晰标注 | `// TODO: from xxx` 注释 |
| 状态覆盖 | 至少 `_MainFlow` + `_Empty` + `_Loading` + `_Error` |
| 是否用 token | 不应出现 `#1F3864` 等硬编码 |
| 是否含 SVG 占位 | emoji 应替换为 `<Icon name="…" />`(等 Step 4 真实 SVG)|

### 落地
保存到 `docs/ui-design/2-mockups/pages/`。

---

## Step 4 — 图标 + 空状态插画(约 1 小时)

### 你的操作
```
Step 4 - 第一部分:基于 ui-design-requirements.md §8 列出的 emoji 清单,
为每一个 emoji 产出对应的 SVG 图标(viewBox 24×24,无 fill 仅 stroke,
描边 1.5px,继承 currentColor,Lucide 风格)。
按 icon-map.md 给出 emoji → SVG 名称对照表。
```

接着:
```
Step 4 - 第二部分:产出 5 张空状态线稿(viewBox 200×160,极简线条,
继承 currentColor):
empty-library / empty-feed / empty-models / empty-chat / empty-skillgen
```

### 期望产出
- 一系列 `icons/<name>.svg`
- `icon-map.md`(emoji 对照表)
- `illustrations/empty-*.svg` × 5

### 你的检查
| 检查项 | 标准 |
|---|---|
| 描边粗细 | 全部 1.5px,无例外 |
| viewBox | 图标 24×24,插画 200×160 |
| 颜色 | 仅 `stroke="currentColor"`,不要 fill |
| 命名 | kebab-case,与 emoji 对照清晰 |

### 落地
保存到 `docs/ui-design/4-assets/icons/` 与 `4-assets/illustrations/`。
对照表 `icon-map.md` 放到 `3-specs/`。

---

## Step 5 — 交互流程图(约 45 分钟)

### 你的操作
```
Step 5:为下面 4 个复杂流程产出 interaction-flows.md,
用 Mermaid stateDiagram-v2:
1. DataDir 迁移向导 3 步(Step1 选目录 → Step2 选模式 → Step3 确认 → 执行中 → 完成)
2. Chat 附件 chip 三态(uploading / done / failed)
3. SkillGenerator refine + auto-retry(首发 → refine → 验证失败 → auto-retry → 成功)
4. PaperActions PDF 下载三态(未下载 → 下载中 → 已下载 + 取消分支)
```

### 期望产出
单一 `interaction-flows.md`,4 节,每节一个 Mermaid 图 + 文字说明。

### 落地
保存到 `docs/ui-design/3-specs/interaction-flows.md`。

---

## Step 6 — 最终预览图(可选,推荐)

### 你的操作
```
Step 6:把 Step 3 的 draft.tsx 转成可直接打开的 HTML
(用 Tailwind CDN + 内联 SVG icons),我会用浏览器打开后截图。
按 ui-screenshots-checklist.md 的优先级,先给我:
- 9 个页面各 1 张亮色 (MainFlow)
- 5 个代表页面的暗色 (Search/Library/Parse/Chat/Settings)
- 5 张英文版 (Search/Sidebar/Settings/SkillGenerator/Library)
```

### 期望产出
一组独立 HTML 文件 + 渲染说明。

### 落地
你自己截图,保存到 `docs/ui-design/5-screenshots/`。

---

## Step 7 — 交付给 Claude Code(15 分钟,落地代码)

### 你的操作
本地把整个 `docs/ui-design/` 提交 + 推送:

```bash
git add docs/ui-design/
git commit -m "design: V2.2 redesign handoff package (tokens + mockups + specs + assets)"
git push -u origin feature/ui-redesign
```

然后在本目录开新的 Claude Code 会话,发送:

```
读取 docs/ui-design/0-README.md 和 design-style-spec.md。
按下面顺序执行 V2.2 UI 重构:

阶段 1:同步 tokens
  - 根据 docs/ui-design/1-tokens/design-tokens.json
    更新 src/styles/index.css 的全部 CSS 变量
  - 根据 tailwind.config.diff.js 更新 tailwind.config.js
  - cargo tauri dev 验证启动正常,提一个 commit

阶段 2:重构共享组件
  - 按 docs/ui-design/2-mockups/components/*.draft.tsx
    逐个改造 src/components/ 下的对应组件
  - 保留所有现有 props 与逻辑,仅替换 markup + Tailwind 类
  - 引入 SVG 图标(从 docs/ui-design/4-assets/icons/ 复制到 src/assets/icons/)
  - 每个组件改完 cargo tauri dev 自检,各提一个 commit

阶段 3:重构 9 个页面(每页一个 commit)
  - 按 docs/ui-design/2-mockups/pages/*.draft.tsx
    逐页改造 src/pages/
  - 占位数据用现有 store 调用替换 // TODO 注释
  - 每页改完 cargo tauri dev 自检 + 截图对照 5-screenshots/

阶段 4:引入新基础设施
  - 全局 ToastProvider(替换 3 套 toast)
  - BaseModal / ConfirmDialog / InputDialog 三件套
    (替换 window.confirm / prompt / alert)
  - skeleton loading 组件

最后开 PR 到 main:feat(ui): V2.2 redesign,标题写覆盖范围。

硬约束:
- 不改 src/lib/tauri.ts 的 invoke 调用
- 不改 src/stores/ 的 store shape
- 不改 router.tsx 的 13 条路由
- 不改 i18next key 命名空间
- 不引入 >50KB gzip 的新依赖
- 全程亮 + 暗双主题验证
```

预计重构 1-2 个工作日。完成后:
- 把 `docs/ui-design/` 移到 `docs/archive/v2.2-ui-design/` 归档
- 更新 `docs/ui-design-requirements.md` 重新对齐 V2.2(可让 Claude Code 顺手做)

---

## 常见问题

### Q1:Claude design 输出被截断怎么办?
- 让它继续:`继续`
- 或拆得更细:把批次 A 再拆成「Search」「Feed」「Models」三次

### Q2:它的输出和 design-style-spec.md 冲突怎么办?
- 引用具体条目:「你的输出 X 违反了 design-style-spec.md §3.2 第 4 点,请修正」

### Q3:它给的 token 值我觉得不好看怎么办?
- 在 Step 1 当场让它出 2-3 个候选方案,你选;不要进入 Step 2 后才回头改

### Q4:Step 3 之后想再调整 token 怎么办?
- 可以,但要同步让它把 Step 3 的 draft 重新输出一遍(不然 token 和 markup 不一致)

### Q5:截图实在拍不齐怎么办?
- Step 6 是可选的;只要 draft.tsx 完整,Claude Code 完全可以基于 draft 做重构,
  截图只是给人工 review 用
