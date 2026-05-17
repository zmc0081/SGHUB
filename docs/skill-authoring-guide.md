# SGHUB Skill Authoring Guide

A **Skill** is a YAML file that turns one model invocation into a
structured deep-read of a paper. Built-in Skills (like `general_read`)
live in the bundle; your custom Skills live under `~/.sghub/skills/`
(or wherever your data directory points — see
[`data-management.md`](data-management.md)).

There are two ways to author a Skill:

| Method | When | Where |
| --- | --- | --- |
| ✨ **Create with AI** | You can describe what you want in plain language | Skills page → `+ 新建 Skill ▾` → "用 AI 创建" |
| 📝 **Create manually** | You want full control / are duplicating an existing Skill | Skills page → `+ 新建 Skill ▾` → "手动创建" — opens the Monaco YAML editor |

Both flows save the same `*.yaml` file, so you can start in one and
finish in the other (the generator's "Switch to advanced editor"
button hands the in-progress YAML to the manual editor).

## ✨ Create with AI

The AI generator is a Claude.ai-style conversation:

1. Open Skills → `+ 新建 Skill ▾` → **「用 AI 创建」**.
2. The page splits left/right. Pick the model you want to use in the
   top-right of the left pane (your default is selected by default).
3. Type one sentence describing the Skill you want. Examples below.
4. The model streams a full Skill YAML. The right pane shows three
   tabs: **Config** (friendly summary), **YAML** (the raw output),
   **Test run** (pick a paper + click Run to see the Skill actually
   parse a real paper).
5. Refine in the same chat: "Add an output dimension for ethics
   review", "Recommend `gpt-5` first", "Output in English".
6. Hit **💾 保存为 Skill** when you're happy. The file lands in
   `~/.sghub/skills/<name>.yaml`. The Skill is immediately available
   under AI 解析 and in Chat.

### Five good first-message examples

These are the kind of descriptions the meta-prompt is tuned for —
specific enough to make decisions for you, open enough to let the
model add reasonable defaults.

1. **Clinical trial review**

   > 我想要一个 Skill 用来分析临床试验文献,重点关注实验设计、样本量、
   > 统计方法、副作用、伦理审查。输出中文。

2. **Novelty + impact rating**

   > Build a Skill that scores a paper's novelty (1–5) and likely
   > impact (1–5), with rationale for each. Output English. Suitable
   > for grant review preparation.

3. **Survey / review paper digest**

   > 我需要一个专门读综述类论文的 Skill。输出维度:领域脉络、主要流派、
   > 关键里程碑、当前争议、未解问题、推荐入门读物。

4. **ML reproducibility audit**

   > A Skill for machine-learning papers focused on reproducibility:
   > dataset availability, code availability, hyperparameters reported,
   > seeds, hardware, statistical significance of reported gains.
   > English output. Recommend Claude Opus for best quality.

5. **Materials science synthesis route extraction**

   > 给我一个 Skill,从材料科学论文里抽取:合成路线、原料、温度/压力/
   > 时间、表征手段、性能数据、可放大性评估。输出中文表格风格(用
   > markdown 表格)。

### Tips for better generated Skills

- **One sentence per concern** — list 3–6 specific things you want in
  the output rather than a vague "comprehensive analysis".
- **Output language** — say it explicitly ("输出中文" / "English
  output"). The default is whatever the few-shot uses (Chinese).
- **Domain hints** — mentioning the discipline ("clinical trials",
  "materials science", "NLP") shapes the prompt body considerably.
- **Format hints** — "use markdown tables" / "include numeric
  scores" tend to be honoured.
- **Iterate** — the first generation is usually 80%. Use the chat to
  add one thing at a time: "Add a section on…" / "Replace the X
  dimension with Y" / "Rename to …".

### When generation fails

- **"AI 生成的 Skill 格式有问题"** — the auto-retry didn't recover.
  Rephrase the description (simpler / shorter) or switch to the
  advanced editor to fix the YAML directly.
- **"No model configured"** — first go to 模型配置 and add at least
  one model with an API key.
- **API rate limit / network** — the error bubble surfaces the
  underlying message. Wait + retry, or switch to a different model
  in the top-right picker.

## 📝 Create manually

For full control:

1. Skills → `+ 新建 Skill ▾` → **「手动创建」**.
2. The Monaco editor opens with an empty template. The right pane
   shows live validation errors as you type.
3. Edit either as raw YAML (left) or via the form fields (right).
4. Use the "Test run" tab to dry-run against a paper before saving.

Field reference is at the top of every preset YAML; the canonical
shape is documented inline in `src-tauri/templates/skill_generator_prompt.md`.

## File layout

```
~/.sghub/skills/
├── my-clinical-trial.yaml      ← your custom Skills
├── my-novelty-rater.yaml
└── … (anything you save lands here)
```

Built-in Skills (`general_read.yaml` etc.) live inside the app bundle
and can't be edited; clone them via "复制并编辑" on the Skills page if
you want to start from one.

## Sharing Skills

The YAML file is fully portable. To share with a colleague:

- **Single Skill**: send them the `.yaml` file. They drop it into
  `~/.sghub/skills/` or click **⬆ 上传 Skill** on the Skills page.
- **Bundle**: zip multiple `.yaml` files; the upload button also
  accepts `.zip` and `.skill` (Anthropic-flavoured package format).

There's no central registry yet; community Skills are welcome as
PRs against the `examples/` directory of the SGHUB GitHub repo (when
it's ready).
