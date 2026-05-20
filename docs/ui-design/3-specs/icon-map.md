# SGHUB V2.2 — Icon Map

> Comprehensive mapping from V2.1's emoji-based iconography to V2.2's Lucide SVG icons.
>
> **Scope**:
> - Every emoji listed in `ui-design-requirements.md §8` (V2.1 global emoji inventory)
> - Plus every emoji-like Unicode symbol that appeared in V2.1 markup (`★ ✓ ✕ ▾ ●`)
> - Plus 3 SGHUB-specific provider logos that have no Lucide equivalent (handcrafted under `4-assets/icons/`)
>
> **Lucide import rule**: `import { IconName } from 'lucide-react';` — tree-shaken to <10KB final bundle.
>
> **Universal props** (every icon in V2.2):
> - `strokeWidth={1.5}`
> - Color via `currentColor` (no hardcoded `stroke="#..."`)
> - Sizes: 11 / 12 / 14 / 16 / 18 / 20 / 24 (per `icon.size.*` tokens, Step 1)
> - `aria-hidden` if decorative; `aria-label` if interactive (per component-specs §a11y)

---

## Table A — Global emoji inventory (V2.1 → V2.2)

The 32 emojis from `ui-design-requirements.md §8`, plus pseudo-emoji Unicode symbols
discovered in V2.1 markup (`★ ✓ ✕ ▾ ●`), mapped to their Lucide replacements.

| # | V2.1 emoji | Lucide name | Used in (page · component) | SGHUB-specific notes |
|---|---|---|---|---|
| 1 | 💬 | `MessageSquare` | Sidebar (A.2) | Chat nav item icon. Also used inside ChatPage SessionListItem |
| 2 | 🔍 | `Search` | Sidebar (A.2) · Library Toolbar · PaperPicker (A.3) · Skills built-in skill icon | All literature search affordances. `size=14` in PaperPicker placeholder, `size=18` in sidebar |
| 3 | 📰 | `Newspaper` | Sidebar (A.2) · FeedPage `<Newspaper />` empty-state hero | Feed/Today nav item icon |
| 4 | 🧠 | `Brain` | Sidebar (A.2) · PaperActions (A.4) · SkillEditor (A.7) · ParsePage hero · Skills built-in icon | `size=14` in PaperActions ghost button, `size=22` in SkillIcon box (`icon-box-khx` style) |
| 5 | ⭐ | `Star` | Sidebar (A.2) · FavoriteButton (A.5) · PaperActions · LibraryPage hero | Star is filled when already-favorited (use `fill="currentColor"`); outline otherwise |
| 6 | ✨ | `Sparkles` | Sidebar (A.2) · Skills "+ 新建 ▾" dropdown · SkillGenerator hero · CustomSection empty-state | Replaces "用 AI 创建" emoji and SkillGenerator wordmark |
| 7 | 🤖 | `Bot` | Sidebar (A.2) · Chat AI avatar · ModelPicker / inline model select · Models ProviderIcon fallback | Avatar version uses `bg-indigo-soft text-indigo` round container; sidebar nav uses inherited color |
| 8 | ⚙️ | `Settings` | Sidebar (A.2) · SkillGenerator "切换到高级编辑器" link | Imported as `Settings as SettingsIcon` in Settings.draft to avoid name clash with page component |
| 9 | 📁 | `Folder` (closed) / `FolderClosed` (alias) | Library FolderTreeItem (leaf) · PaperPicker dropdown meta line · FeedSubscriptionList unread indicator | Lucide has both `Folder` and `FolderClosed`; SGHUB uses `Folder` |
| 10 | 📁 (open variant) | `FolderOpen` | Library FolderTreeItem (has children) · DataDirCard "打开目录" button · PaperActions "打开 PDF" · SkillGenerator config block | Distinguishes expanded folder from leaf |
| 11 | 🏷️ | `Tag` | Library tag cloud chip | `size=11` inside tag chip; `strokeWidth=2` (slightly heavier for chip readability) |
| 12 | 📎 | `Paperclip` | Chat InputArea PlusMenu (附件 上传) · ChatPage uploading attachment chip | Pure attachment affordance, never used for "drag-handle" |
| 13 | 📄 | `FileText` | PaperActions "原文" button · PaperMetadataEditor "对照原文" button · ChatPage attachment chip · Skills built-in skill icon | Plain document icon, distinct from `FileCode` |
| 14 | 📂 | `FolderOpen` | (same as #10) | V2.1 used both 📁 and 📂; V2.2 collapses 📁 leaf=`Folder`, 📂 / 📁-open=`FolderOpen` |
| 15 | 📥 | `Download` | PaperActions "下载 PDF" button · Library "导出 BibTeX" · Models stats / UpdaterCard "立即安装" | Used for both download-action and import-from-source |
| 16 | 📤 | `Upload` | ParsePage "上传 PDF" button · Skills "上传 Skill" primary button | |
| 17 | 🅰️ | (SGHUB SVG) `provider-anthropic.svg` | Models ProviderIcon for Anthropic | **Not in Lucide** — custom logomark. See §B |
| 18 | 🟢 | (SGHUB SVG) `provider-openai.svg` | Models ProviderIcon for OpenAI | **Not in Lucide** — custom logomark |
| 19 | 🦙 | (SGHUB SVG) `provider-ollama.svg` | Models ProviderIcon for Ollama (local) | **Not in Lucide** — custom logomark |
| 20 | 🔧 | `Wrench` | Models ProviderIcon for "custom" provider | Decision: use Lucide's `Wrench`; not worth hand-crafting |
| 21 | ★ | `Star` (with `fill="currentColor"`) | FavoriteButton "已收藏" state · Models "default model" badge | Solid star = active/selected variant; outline = `Star` without fill |
| 22 | ✓ | `Check` | Generic confirm · FavoriteButton in-folder marker · Skills mark-read · Settings success indicator | `strokeWidth=2` recommended for `Check` (it's a thin glyph) |
| 23 | ✓ (in CheckCircle) | `CheckCircle2` | Toast success variant · Upload done banner · DataDir validation success | `CheckCircle2` has cleaner geometry than older `CheckCircle` |
| 24 | ✕ | `X` | Close (Modal / Toast / banner / dialog) · Cancel upload · Remove author from list · Failed attachment indicator | Universal dismiss/cancel symbol |
| 25 | ✕ (in XCircle) | `XCircle` | Toast danger variant · DataDir validation error · UploadBanner failed state | |
| 26 | ⚠ | `AlertTriangle` | All error banners (Search / Feed / Models / Parse / Chat / Skills) · UpdaterCard warning · MigrationWizard danger note · ParsePage skipped-metadata warning | `text-warning-fg-strong` for in-content warning, `text-danger-fg` for error |
| 27 | 🔒 | `Lock` | Skills built-in section "只读" badge | Small (size=10) inline with chip text |
| 28 | 🔄 | `RefreshCw` | FeedPage "立即刷新" · Models "重建统计" · DataDirCard "修改路径" · ParsePage retry · UpdaterCard "立即检查" · Library "重新提取" · Settings UpdaterCard pending badge | The most-reused icon in the app. `animate-spin` when in-flight |
| 29 | ↩️ | `Undo2` | DataDirCard "恢复默认" button | `Undo2` is the curved-arrow variant; `Undo` is the straighter one |
| 30 | 💾 | `Save` | SkillGenerator "保存为 Skill" primary | |
| 31 | ✏️ | `Pencil` | Edit affordances (folder rename · session rename · model edit · subscription edit · skill edit) | |
| 32 | 🗑️ | `Trash2` | Delete affordances (folder · session · model · subscription · custom skill) | `Trash2` has a lid line; `Trash` doesn't — V2.2 picks `Trash2` for visual weight match with other 1.5px icons |
| 33 | 🆕 | `badge-update` (CSS class, not icon) | NEW Skill badge · NEW Chat badge (Sidebar) | Not an icon — handled by `badge-khx-update` color combo per Step 1 §2.5 |
| 34 | ▾ | `ChevronDown` | Every dropdown / select / popover trigger · Collapsible details | `size=12` for inline triggers, `size=16` for full-width select |
| 35 | ● | `<div class="w-2 h-2 rounded-full bg-...">` | Streaming indicator (Parse / Chat) · Unread dot (Feed / Sidebar nav badge dot) · Subscription active/paused dot | Not an icon — plain DOM circle. Color via Tailwind token (`bg-indigo` / `bg-success-fg` / `bg-border-strong`) |

### Additional Lucide icons introduced by V2.2 page drafts (not from V2.1 emoji set)

These don't replace existing emoji — they fill new affordances:

| Lucide name | Used in | Why introduced |
|---|---|---|
| `User` | Chat user avatar bubble | V2.1 used "我" / "U" text glyph in 28px round avatar; V2.2 prefers SVG for consistency with Bot avatar |
| `MessageSquarePlus` | ChatPage "新建对话" primary button · empty-state hero | Composite glyph (chat + plus); more semantic than `Plus` alone |
| `Plus` | "+ 新建" affordances (sidebar / dropdown / model picker) · ChatPage InputArea + button | Generic add |
| `Minus` | Titlebar minimize button (A.1) | |
| `Square` | Titlebar maximize button (A.1) | |
| `Copy` | Titlebar restore (from maximized state) · DataDirCard path-copy · Chat message copy · Skills "复制并编辑" | `Copy` works as both "restore window" (two squares offset) and "copy to clipboard" — context disambiguates |
| `ArrowUp` | Chat / SkillGenerator send button | Inside circular navy button; not paper-plane (Lucide doesn't have a clean paper-plane) |
| `Loader2` | Every in-flight spinner | `Loader2` is the universal "circle of dots" — pair with `animate-spin` |
| `Pause` / `Play` | Feed subscription pause/resume · Parse Run button | |
| `Pin` / `PinOff` | Chat session pin/unpin in hover affordance | |
| `ChevronRight` | Pagination "下一页" · Sidebar inline breadcrumb arrow | For "上一页" use `<ChevronRight className="rotate-180" />` not `ChevronLeft` (consistency) |
| `Info` | Models "API Key 本地加密保存" inline hint · ParsePage skipped-metadata hint · Toast info variant | |
| `KeyRound` | Models "Key 缺失" indicator | Distinct from `Key` — the rounded variant matches our pill aesthetic |
| `TestTube2` | Models "测试连接" button · SkillGenerator "测试运行" Tab | |
| `Bot` | Chat AI avatar · Sidebar nav · ModelPicker triggers (multiple contexts) | (Already in V2.1 mapping as 🤖 #7) |
| `Sun` / `Moon` / `Monitor` | Settings theme switch radio chips | V2.2 NEW (theme switch didn't exist in V2.1) |
| `Globe` | Settings language section icon | V2.2 NEW |
| `ScrollText` | Settings log-level section icon | V2.2 NEW |
| `Lightbulb` | SkillGenerator TipsCard `<EmptyTipsBubble>` · auto-retry annotation | |
| `RotateCcw` | SkillGenerator "重新开始" danger link | Counter-clockwise arrow vs `RefreshCw`'s clockwise — distinguishes "reset" from "refresh" |
| `FileCode` | SkillGenerator YAML Tab | Pairs visually with `FileText` (plain doc) |
| `FilePenLine` | Skills "+ 新建 ▾" → "手动创建" option | Distinct from generic Pencil — implies "edit a file" |
| `Clock` | ParsePage UploadBanner "pending file" state | Pre-upload queue indicator |
| `Pencil` / `PinOff` | (already covered above) | |
| `ExternalLink` | SkillGenerator NoModelBanner "前往模型配置" link | Hints that link leaves current context |
| `MessageSquare` | (already covered as 💬 #1) | |

---

## Table B — Lucide-缺位清单 (custom SVG required)

Lucide has 1000+ icons, but **brand logos are never included** on principle. These 3 are
hand-crafted under `4-assets/icons/`:

| File | Emoji it replaces | Why custom | Visual spec |
|---|---|---|---|
| `provider-anthropic.svg` | 🅰️ | Anthropic logomark — geometric "A" with the inner triangle inverted | Stylized triangular "A" with internal cutout, viewBox 24×24, stroke 1.5px |
| `provider-openai.svg` | 🟢 | OpenAI "knot" logomark — the interlinked rounded square mark | Recognizable knot/rosette, viewBox 24×24, stroke 1.5px |
| `provider-ollama.svg` | 🦙 | Llama silhouette — simplified profile head | Profile of llama with one visible ear and eye, viewBox 24×24, stroke 1.5px |

> **Note**: 🔧 (custom provider) intentionally uses Lucide `Wrench` — no hand-crafted icon needed.
> Rationale: "custom" is a category, not a brand, and `Wrench` is universally read as
> "configure / tinker / build your own".

> **Trademark note**: These hand-crafted glyphs are **stylized representations**, not exact
> reproductions of registered logos. They follow stroke / viewBox conventions matching the
> rest of the SGHUB icon system, so the visual weight harmonizes with Lucide. If Anthropic /
> OpenAI / Ollama provide official open-source SVG packs, those should be preferred and
> these placeholders deleted.

---

## Table C — Spec for hand-crafted SVGs

All 3 custom SVGs follow these constraints:

| Property | Value | Reason |
|---|---|---|
| `viewBox` | `0 0 24 24` | Matches Lucide convention |
| `width` / `height` | absent (set by consumer via CSS / `size` prop) | Allows scaling |
| `fill` | `none` on the root `<svg>` | All shapes drawn with stroke only |
| `stroke` | `currentColor` | Theme-aware via parent `text-*` token |
| `stroke-width` | `1.5` | Matches Lucide default |
| `stroke-linecap` | `round` | Soft endpoints |
| `stroke-linejoin` | `round` | Soft corners |
| `aria-hidden` | `true` if decorative; consumer overrides for accessible roles | |

**Import pattern in React** (since these are static SVGs, not Lucide components):

```tsx
import AnthropicIcon from '@/assets/icons/provider-anthropic.svg?react';
// or:
import anthropicUrl from '@/assets/icons/provider-anthropic.svg';

<AnthropicIcon width={20} height={20} aria-hidden />
```

(Vite's `?react` query string transforms SVG into a React component; the consuming
file inherits `currentColor` from CSS context.)

---

## Table D — Spec for empty-state illustrations

5 line-art illustrations under `4-assets/illustrations/`:

| File | Used in (page · empty-state export) | Subject |
|---|---|---|
| `empty-library.svg` | Library (LibraryPageEmptyAll) | Open empty book on a tilted bookshelf, with two floating dots overhead |
| `empty-feed.svg` | Feed (FeedPageEmptyNoSubs) | Mail/inbox tray with paper sliding in, antenna lines for radio waves |
| `empty-models.svg` | Models (ModelsPageEmpty) | Disconnected plug-and-socket with a small spark gap between |
| `empty-chat.svg` | Chat (ChatPageEmptyNoSession) | Open speech bubble with a typing cursor inside, no tail |
| `empty-skillgen.svg` | SkillGenerator (SkillGeneratorPageEmptyTipsCard) | Seed sprouting two leaves from soil, with floating sparkles |

All 5 share these constraints:

| Property | Value |
|---|---|
| `viewBox` | `0 0 200 160` (matches Stage component empty-area aspect) |
| `fill` | `none` (root) |
| `stroke` | `currentColor` |
| `stroke-width` | `1.5` |
| `stroke-linecap` | `round` |
| `stroke-linejoin` | `round` |
| Total path count | ≤ 15 elements (paths + circles + rects) | Visual clarity over arbitrary minimalism — see actual counts below |
| Use in code | `<EmptyLibraryIllustration className="w-40 h-32 text-indigo opacity-60" />` |

**Actual element counts** (PNG-verified at design time, all visually clean):

| File | Elements | Notes |
|---|---|---|
| empty-chat.svg | 6 | bubble + 3 dots + small sparkle |
| empty-feed.svg | 7 | tray + envelope + flap + 2 signal waves |
| empty-library.svg | 12 | bookshelf base + supports + open book (spine + 2 pages + 4 page lines) + 2 floating dots |
| empty-models.svg | 14 | plug body + cable + 2 prongs + spark zigzag + 2 spark dots + socket body + 4 slot lines + 2 wall lines |
| empty-skillgen.svg | 11 | stem + 2 leaves + soil line + 2 tick marks + 2 sparkles (4 lines) + dot |

---

## Lucide bundle impact estimate

With per-name imports (`import { Brain, Search } from 'lucide-react'`) and Vite's tree-shaking:

- Total unique Lucide icons used across V2.2 = **~52** (28 from V2.1 emoji set + 24 new for V2.2 affordances)
- Average Lucide icon size = ~250 bytes (SVG path data + React wrapper)
- Estimated final bundle add = **~13 KB minified, ~5 KB gzipped**
- 3 hand-crafted SVGs (provider logos) = ~1.5 KB total raw

**Well within budget** — Step 1 allowed up to 50 KB gzipped for any new dependency.

---

## Quick lookup index for Claude Code refactor

If you're auto-replacing emoji in source code, use this exact mapping table for
sed-style search-and-replace:

```
💬 → MessageSquare       🔧 → Wrench              ★ → Star (filled)
🔍 → Search              🅰️ → AnthropicIcon       ✓ → Check
📰 → Newspaper           🟢 → OpenAIIcon          ✕ → X
🧠 → Brain               🦙 → OllamaIcon          ⚠ → AlertTriangle
⭐ → Star                🔒 → Lock                ▾ → ChevronDown
✨ → Sparkles            🔄 → RefreshCw           ● → <div ... rounded-full>
🤖 → Bot                 ↩️ → Undo2
⚙️ → Settings            💾 → Save
📁 → Folder              ✏️ → Pencil
📁(open) → FolderOpen    🗑️ → Trash2
🏷️ → Tag                 🆕 → (use badge-update CSS class)
📎 → Paperclip
📄 → FileText
📂 → FolderOpen
📥 → Download
📤 → Upload
```

End of icon-map.
