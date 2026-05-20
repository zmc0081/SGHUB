# SGHUB UI 设计规范 — SGHUB Capsule (V2.2)

> 本目录是 SGHUB 当前生效的 **UI 设计规范权威源**。
> 风格名:**SGHUB Capsule**(基于 KnowledgeHub X / KHX,V2.2.0 起生效)。
> 状态:**已实施并合并到 main**(PR #17, 2026-05-20)。
>
> 新增任何 UI 功能前,**先读 [`design-style-spec.md`](./design-style-spec.md)**,
> 实现时对照 [`3-specs/component-specs.md`](./3-specs/component-specs.md)
> 与 [`3-specs/icon-map.md`](./3-specs/icon-map.md)。

---

## 1. 权威文件清单(按使用场景排序)

| # | 文件 | 何时查 |
|---|---|---|
| 1 | [`design-style-spec.md`](./design-style-spec.md) | 任何新功能开工前 — 5 大视觉支柱 / 反模式 / token 表 / V2.1→V2.2 偏离 |
| 2 | [`3-specs/component-specs.md`](./3-specs/component-specs.md) | 复用现有 9 个业务组件 + 6 个基础设施时 — PropsAPI / states / dimensions / a11y |
| 3 | [`3-specs/icon-map.md`](./3-specs/icon-map.md) | 选 Lucide icon 时 — emoji → Lucide 映射 + V2.2 新引入图标清单 |
| 4 | [`3-specs/interaction-flows.md`](./3-specs/interaction-flows.md) | 实现复杂交互时 — 4 个关键 FSM(收藏 / 文件夹 / Skill 编辑 / 数据迁移) |
| 5 | [`1-tokens/design-tokens.json`](./1-tokens/design-tokens.json) | 查 token 来源 + a11y 注释 — 但**运行时事实**以下两个为准 |

**运行时 token 权威**(下面这两个文件冲突时以它们为准):
- [`../../src/styles/index.css`](../../src/styles/index.css) — CSS 变量(亮 + 暗双主题)
- [`../../tailwind.config.js`](../../tailwind.config.js) — Tailwind 映射

---

## 2. 新增功能时怎么用本目录

1. 阅读 [`design-style-spec.md`](./design-style-spec.md) **§1 5 大视觉支柱** + **§7 反模式**(明确禁止项)
2. 看新功能是否能复用 [`3-specs/component-specs.md`](./3-specs/component-specs.md) 已有组件:
   - 能复用 → 直接调用,不要重新发明
   - 不能复用 → 在 design-style-spec.md §2-3 的 token 范围内自建
3. 选 icon → [`3-specs/icon-map.md`](./3-specs/icon-map.md);避免 emoji(Skill icon 用户字段除外)
4. 写交互前看 [`3-specs/interaction-flows.md`](./3-specs/interaction-flows.md) 是否已有 FSM 模板
5. PR 自查 6 条(同 V2.2 落地时的 sanity check):
   ```
   grep -rE 'bg-primary[^-]|text-app-fg|bg-accent[^-]' src/  → 0
   grep -rE 'transition-all' src/                           → 0
   grep -rE 'window\.(confirm|prompt|alert)' src/           → 0
   grep -rP '[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]' src/ → 0
     (SkillEditor 内 EMPTY_TEMPLATE 与 icon placeholder 除外)
   grep -rE '#[0-9A-Fa-f]{6}' src/                          → 仅 src/styles/index.css
   eslint src --max-warnings 0                              → clean
   ```

---

## 3. 目录结构

```
docs/ui-design/
├── 0-README.md                          ← 本文件
├── design-style-spec.md                 ★ 主规范(必读)
├── briefing.md                          (历史:V2.2 重设计阶段简报)
├── implementation-steps.md              (历史:V2.2 7 步实施手册)
├── 1-tokens/
│   ├── design-tokens.json               ★ 含 a11y 注释的 token JSON
│   ├── design-tokens.starter.json       (历史:Step 1 前的中间件)
│   ├── tailwind.config.diff.js          (历史:V2.2 落地用的 Tailwind diff)
│   └── khx-reference/                   (历史:KHX 实景 token 提取源)
├── 2-mockups/                           (历史:V2.2 落地用的页面 draft)
│   ├── pages/                              9 个页面静态 JSX,58 个状态变体
│   └── components/                         组件 draft(空,落地时直接写真组件)
├── 3-specs/
│   ├── component-specs.md               ★ 15 个组件规格(必读)
│   ├── icon-map.md                      ★ emoji → Lucide 映射
│   └── interaction-flows.md             ★ 4 个交互 FSM
├── 4-assets/                            ★ V2.2 落地用的资源(已复制到 src/assets/)
│   ├── icons/                              3 个 provider SVG(Anthropic / OpenAI / Ollama)
│   ├── illustrations/                      5 张空状态插画
│   └── logo/
└── 5-screenshots/                       (历史:V2.2 上线截图占位,可选)
```

★ = 长期生效的设计规范,(历史) = V2.2 落地过程产物,保留作设计决策追溯。

---

## 4. 维护规则

1. **token 改动**:`design-tokens.json` + `src/styles/index.css` + `tailwind.config.js` 三处必须同步
2. **新组件**:在 `3-specs/component-specs.md` 加一节(沿用 PropsAPI/states/dimensions/a11y 结构)
3. **新 icon**:在 `3-specs/icon-map.md` 「Additional Lucide icons」表加一行
4. **下次重设计**:不要原地改本目录,新建 `docs/ui-design-v3/`,然后把本目录归档到
   `docs/archive/v2.2-ui-design/`(保留作历史对照)

---

## 5. 相关参考

- [`../ui-design-requirements.md`](../ui-design-requirements.md) — **V2.1.0 历史需求清单**(SUPERSEDED,仅作 V2.1→V2.2 对照)
- [`../ui-screenshots-checklist.md`](../ui-screenshots-checklist.md) — 截图占位清单
- [`../../CLAUDE.md`](../../CLAUDE.md) — 项目上下文(顶部「UI 设计规范」一节指向本目录)
