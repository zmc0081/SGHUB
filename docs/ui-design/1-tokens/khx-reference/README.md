# KnowledgeHub X · 设计令牌（Design Tokens）

提取自 `knowledgehubtemplate.webflow.io` 实际页面截图，包含 4 种格式：

| 文件 | 用途 |
|---|---|
| `tokens.css` | **纯 CSS Variables**，零依赖，任何框架都能用（Vue / React / 原生 HTML / Vite / Next.js / Nuxt） |
| `tailwind.config.js` | **Tailwind v3 配置**，合并到现有 config 里 |
| `tailwind-v4.css` | **Tailwind v4 配置**（用 `@theme` 语法，无需 JS 配置文件） |
| `tokens.scss` | **SCSS 变量 + mixins**，传统 SCSS 项目使用 |

---

## 快速选择

```
是否用 Tailwind？
├─ 否 → 用 tokens.css 或 tokens.scss
└─ 是
   ├─ Tailwind v3 → tailwind.config.js
   └─ Tailwind v4 → tailwind-v4.css
```

---

## 一、Tailwind v3 使用

1. 把 `tailwind.config.js` 里的 `theme.extend` 和 `plugins` 合并到你项目的 config。
2. 在组件里直接用：

```html
<!-- 主按钮：深海军蓝胶囊 -->
<button class="bg-navy hover:bg-navy-hover text-white px-[22px] py-3
               rounded-khx-pill shadow-khx-btn font-medium text-[13px]
               transition-all duration-khx ease-khx hover:-translate-y-px">
  Submit ticket
</button>

<!-- 或直接用插件提供的复合类 -->
<button class="btn-khx-primary">Submit ticket</button>

<!-- 分类卡 -->
<div class="card-khx text-center">
  <div class="icon-box-khx mx-auto mb-4">
    <i class="ti ti-compass"></i>
  </div>
  <h4 class="text-khx-h3 text-khx-1 mb-2">Getting started</h4>
  <p class="text-khx-caption text-khx-2 mb-4">Donec sed euismod sit morbi.</p>
  <a href="#" class="btn-khx-link">Browse questions →</a>
</div>

<!-- 联系表单 -->
<form class="card-khx space-y-4">
  <div>
    <label class="block text-khx-caption font-bold text-khx-1 mb-2">Name</label>
    <input class="input-khx" placeholder="John Carter">
  </div>
  <button class="btn-khx-primary">Send Message</button>
</form>

<!-- Changelog 徽章 -->
<span class="badge-khx-update">Update</span>
<span class="badge-khx-improve">Improvement</span>
<span class="badge-khx-bug">Bug fix</span>
<span class="badge-khx-new">New</span>
```

---

## 二、Tailwind v4 使用

1. 把 `tailwind-v4.css` 放到项目里。
2. 在 `main.css` / `app.css` 顶部导入：

```css
@import "tailwindcss";
@import "./tailwind-v4.css";
```

3. 用法与 v3 相同，token 通过 `@theme` 自动注入。

---

## 三、纯 CSS Variables 使用

1. 在入口 HTML 引入 `tokens.css`：

```html
<link rel="stylesheet" href="/styles/tokens.css">
```

2. 在自己的 CSS / 内联样式里直接引用：

```css
.my-button {
  background: var(--khx-navy);
  color: var(--khx-text-inverse);
  padding: 12px 22px;
  border-radius: var(--khx-radius-pill);
  box-shadow: var(--khx-shadow-btn);
  font-family: var(--khx-font-family);
  transition: all var(--khx-duration-base) var(--khx-ease);
}
.my-button:hover {
  background: var(--khx-navy-hover);
}
```

3. 或直接用文件里已经写好的 `.khx-btn--primary` / `.khx-card` / `.khx-input` 等组件类。

---

## 四、SCSS 使用

```scss
@use 'khx-tokens' as khx;

.submit-button {
  @include khx.btn-primary;
}

.help-card {
  @include khx.card;

  h3 { color: khx.$text-1; }
  p  { color: khx.$text-2; }
}

.changelog-tag {
  @include khx.badge(update);  // 或 improve / bug / new
}
```

---

## 设计 token 速查

### 颜色（核心 7 个）
- `--khx-navy` `#1F2E4D` · 主按钮、主标题
- `--khx-navy-hover` `#2A3A5F` · 主按钮 hover
- `--khx-indigo` `#4F46E5` · 链接、图标、强调
- `--khx-indigo-soft` `#EEF0FF` · 图标盒底
- `--khx-text-2` `#5C6B88` · 正文
- `--khx-border` `#ECEEF5` · 默认边框
- `--khx-bg-soft` `#F8FAFF` · 页面次背景

### 圆角（4 档）
- `--khx-radius-pill` `999px` · 按钮 / 导航 / 输入 / 徽章
- `--khx-radius-card` `16px` · 主卡片
- `--khx-radius-card-sm` `14px` · 次级卡片 / textarea
- `--khx-radius-icon-box` `10px` · 图标盒

### 阴影（3 档）
- `--khx-shadow-card` · 卡片
- `--khx-shadow-nav` · 悬浮导航
- `--khx-shadow-btn` · 主按钮

### 字号（核心 5 档）
- Display 60px / H1 36px / H2 24px / H3 18px / Body 16px

---

## 注意事项

1. **CTA 必须是深海军蓝**：本设计语言的核心识别点。不要把主按钮换成 indigo 紫色——那是次级强调色。
2. **胶囊主义**：单行输入、按钮、导航、徽章统一 999px 圆角；多行 textarea 才用 14px。
3. **图标盒色搭**：底色 `#EEF0FF` + 图标色 `#4F46E5` 是固定搭配，不要混色。
4. **Changelog 徽章**：4 种颜色固定对应 4 种含义（Update / Improvement / Bug fix / New），不要再增加新色。
5. **中文 fallback**：默认字体已包含 `PingFang SC` 和 `Microsoft YaHei`，中英混排无需额外配置。
