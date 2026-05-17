# SGHUB UI 截图清单 (V2.1.0)

> 配套文档:`docs/ui-design-requirements.md`(规格基线)。
> 用途:为设计师 / 重构工程师提供「逐画面截图任务清单」。每个 `![]()` 占位符替换为对应截图即可。
> 截图存放目录建议:`docs/screenshots/`(本仓库不入库,改 `.gitignore` 单独处理)。

---

## 采集约定

### 通用准则
- **应用版本**:`v2.1.0`(commit `a472a10` 或更新)。
- **窗口尺寸**:默认 `1280×800`。如标注「小窗口」则用 `960×600`。所有截图保持窗口尺寸一致以便后续 Figma 还原。
- **缩放比例**:Windows 100%,macOS 1×(避免 HiDPI 错位)。
- **截图工具**:
  - Windows:`Win + Shift + S` 自选区,或 ShareX「Active window」。
  - macOS:`Cmd + Shift + 4` + Space 选窗口。
- **格式**:PNG,无压缩。
- **遮蔽**:涉及 API Key、个人邮箱、本地路径等敏感信息时,用纯色矩形遮盖(不要模糊,以免泄漏轮廓)。

### 主题与语言
| 维度 | 设置位置 | 截图必须包含 |
|---|---|---|
| **亮色主题** | 默认 | 全部页面 |
| **暗色主题** | DevTools 中执行 `document.documentElement.dataset.theme='dark'`(或后续 Settings 暗色开关上线后) | 至少 Search / Library / Parse / Chat / Settings 各 1 张 |
| **简体中文** | Settings → 语言 → 简体中文 | 默认 |
| **English** | Settings → Language → English | 至少 Search / Library / Models / Settings / SkillGenerator 各 1 张 |

### 命名约定
```
{section}-{state}-{theme}[-{lang}].png
```
- `section`:页面或组件短名(`search` / `feed` / `library` / `parse` / `chat` / `models` / `skills` / `skillgen` / `settings` / `sidebar` / `titlebar` / `paperpicker`…)
- `state`:状态标签(`default` / `empty` / `loading` / `error` / `results` / `modal-x` / `dropdown-x` / `dragover` / …)
- `theme`:`light` 或 `dark`
- `lang`(可选):`zh` 或 `en`(仅当对照中英时加)

> 示例:`search-results-light.png`、`library-dnd-dragover-light.png`、`settings-updater-pending-dark.png`、`skillgen-empty-light-en.png`

---

## 0. 全局 Chrome

### 0.1 Titlebar(36px 高,深色)
| # | 状态 | 占位 |
|---|---|---|
| 0.1.1 | 默认(窗口未最大化) | ![titlebar-default](./screenshots/titlebar-default-light.png) |
| 0.1.2 | hover 最小化按钮 | ![titlebar-hover-min](./screenshots/titlebar-hover-min-light.png) |
| 0.1.3 | hover 关闭按钮(红底) | ![titlebar-hover-close](./screenshots/titlebar-hover-close-light.png) |
| 0.1.4 | 最大化后(图标变化) | ![titlebar-maximized](./screenshots/titlebar-maximized-light.png) |

### 0.2 Sidebar(220px,深色)
| # | 状态 | 占位 |
|---|---|---|
| 0.2.1 | 默认无选中(理论上不出现,可裁剪) | ![sidebar-default](./screenshots/sidebar-default-light.png) |
| 0.2.2 | `/search` 选中(默认入口) | ![sidebar-search-active](./screenshots/sidebar-search-active-light.png) |
| 0.2.3 | `/chat` 选中(显示 NEW 徽章) | ![sidebar-chat-active](./screenshots/sidebar-chat-active-light.png) |
| 0.2.4 | `/feed` 选中 + 未读 badge(N≤99) | ![sidebar-feed-badge](./screenshots/sidebar-feed-badge-light.png) |
| 0.2.5 | `/feed` 选中 + 未读 badge `99+` | ![sidebar-feed-badge-99plus](./screenshots/sidebar-feed-badge-99plus-light.png) |
| 0.2.6 | hover 未选中项(`bg-white/5`) | ![sidebar-hover](./screenshots/sidebar-hover-light.png) |
| 0.2.7 | 暗色主题对照 | ![sidebar-dark](./screenshots/sidebar-search-active-dark.png) |

---

## 1. Search `/search`

### 设置步骤
1. 进入 `/search`。
2. 取 3 张:① 未输入;② 输入「transformer」未点检索;③ 已检索且有结果。

### 1.1 主流程
| # | 状态 | 占位 |
|---|---|---|
| 1.1.1 | 默认空查询 | ![search-empty](./screenshots/search-empty-light.png) |
| 1.1.2 | 输入中(关键词 + 时间/排序未改) | ![search-typing](./screenshots/search-typing-light.png) |
| 1.1.3 | 加载中(弹跳 dot + 并发请求文案) | ![search-loading](./screenshots/search-loading-light.png) |
| 1.1.4 | 检索成功(>10 条结果,显示计数行) | ![search-results](./screenshots/search-results-light.png) |
| 1.1.5 | 单卡片细节(放大裁剪,展示 Source 徽章 + 标题 + 作者 + DOI + 摘要 + PaperActions) | ![search-card](./screenshots/search-card-light.png) |
| 1.1.6 | 虚拟滚动激活(>100 条,带 `已启用虚拟滚动` 标记) | ![search-virtual](./screenshots/search-virtual-light.png) |
| 1.1.7 | 无结果 | ![search-noresult](./screenshots/search-noresult-light.png) |
| 1.1.8 | 错误 banner(可断网模拟) | ![search-error](./screenshots/search-error-light.png) |

### 1.2 副筛选下拉(锚定截图)
| # | 状态 | 占位 |
|---|---|---|
| 1.2.1 | Source 下拉展开 | ![search-source-dropdown](./screenshots/search-source-dropdown-light.png) |
| 1.2.2 | 时间筛选下拉展开 | ![search-time-dropdown](./screenshots/search-time-dropdown-light.png) |
| 1.2.3 | 排序下拉展开 | ![search-sort-dropdown](./screenshots/search-sort-dropdown-light.png) |

### 1.3 主题/语言对照
| # | 状态 | 占位 |
|---|---|---|
| 1.3.1 | 结果页 - 暗色 | ![search-results-dark](./screenshots/search-results-dark.png) |
| 1.3.2 | 结果页 - English | ![search-results-en](./screenshots/search-results-light-en.png) |

---

## 2. Feed `/feed`(今日推送)

### 设置步骤
1. 至少创建 3 条订阅(2 active + 1 paused),分布在不同 sources/frequencies。
2. 让其中 1 条「立即刷新」获得结果。

### 2.1 主流程
| # | 状态 | 占位 |
|---|---|---|
| 2.1.1 | 无任何订阅(双空状态) | ![feed-empty](./screenshots/feed-empty-light.png) |
| 2.1.2 | 有订阅但无结果(右侧空状态) | ![feed-no-results](./screenshots/feed-no-results-light.png) |
| 2.1.3 | 有结果(左右双列正常态) | ![feed-results](./screenshots/feed-results-light.png) |
| 2.1.4 | 订阅项 hover 显示 暂停/编辑/删除 | ![feed-sub-hover](./screenshots/feed-sub-hover-light.png) |
| 2.1.5 | 暂停态订阅(灰色 dot) | ![feed-sub-paused](./screenshots/feed-sub-paused-light.png) |
| 2.1.6 | 未读 badge + 主区单卡片(未读 dot + 摘要 line-clamp-2) | ![feed-card](./screenshots/feed-card-light.png) |
| 2.1.7 | 「立即刷新」点击中(按钮 loading) | ![feed-refreshing](./screenshots/feed-refreshing-light.png) |

### 2.2 新建/编辑表单(内嵌卡片)
| # | 状态 | 占位 |
|---|---|---|
| 2.2.1 | 点「+ 新建」后表单展开 | ![feed-form-new](./screenshots/feed-form-new-light.png) |
| 2.2.2 | Sources chip 多选状态 | ![feed-form-sources](./screenshots/feed-form-sources-light.png) |
| 2.2.3 | 校验失败(至少选 1 个 source) | ![feed-form-error](./screenshots/feed-form-error-light.png) |
| 2.2.4 | 编辑现有订阅 | ![feed-form-edit](./screenshots/feed-form-edit-light.png) |

### 2.3 破坏性操作
| # | 状态 | 占位 |
|---|---|---|
| 2.3.1 | 原生 `confirm("删除订阅「…」?")` 弹窗(Windows 与 macOS 各一张) | ![feed-confirm-delete-win](./screenshots/feed-confirm-delete-win.png) / ![feed-confirm-delete-mac](./screenshots/feed-confirm-delete-mac.png) |

---

## 3. Library `/library`(收藏夹)

### 设置步骤
1. 创建至少 2 层文件夹结构(根/子)+ 2-3 个标签。
2. 收藏 5+ 篇文献到不同文件夹/状态。

### 3.1 主流程
| # | 状态 | 占位 |
|---|---|---|
| 3.1.1 | 默认进入(`收藏夹` 根 = 全部) | ![library-default](./screenshots/library-default-light.png) |
| 3.1.2 | 选中子文件夹后(H1 = 文件夹名) | ![library-subfolder](./screenshots/library-subfolder-light.png) |
| 3.1.3 | 空文件夹 | ![library-empty-folder](./screenshots/library-empty-folder-light.png) |
| 3.1.4 | 过滤后无匹配 | ![library-filter-empty](./screenshots/library-filter-empty-light.png) |
| 3.1.5 | 文件夹搜索 + 状态过滤 | ![library-filtered](./screenshots/library-filtered-light.png) |
| 3.1.6 | 单文献卡(色条 + 徽章 + PaperActions + 状态切换) | ![library-card](./screenshots/library-card-light.png) |
| 3.1.7 | 各阅读状态色条对比(unread/reading/read/parsed 横向 4 卡裁剪) | ![library-states](./screenshots/library-states-light.png) |
| 3.1.8 | 分页(total>50 时显示) | ![library-paged](./screenshots/library-paged-light.png) |

### 3.2 文件夹树
| # | 状态 | 占位 |
|---|---|---|
| 3.2.1 | 文件夹树多层展开 + hover ✏️/🗑 | ![library-folder-hover](./screenshots/library-folder-hover-light.png) |
| 3.2.2 | 「未分类」尝试删除时的提示 | ![library-uncategorized-protect](./screenshots/library-uncategorized-protect-light.png) |
| 3.2.3 | 新建/重命名 inline 输入框 | ![library-folder-rename](./screenshots/library-folder-rename-light.png) |

### 3.3 标签云
| # | 状态 | 占位 |
|---|---|---|
| 3.3.1 | 标签云默认 | ![library-tags](./screenshots/library-tags-light.png) |
| 3.3.2 | 标签 hover 显示删除 | ![library-tag-hover](./screenshots/library-tag-hover-light.png) |

### 3.4 拖拽(DnD)
| # | 状态 | 占位 |
|---|---|---|
| 3.4.1 | drag-over 目标文件夹(`ring-2 ring-accent`) | ![library-dragover](./screenshots/library-dragover-light.png) |
| 3.4.2 | ghost(拖拽中的浮影卡) | ![library-ghost](./screenshots/library-ghost-light.png) |

### 3.5 元数据补全 Modal(`PaperMetadataEditor`)
| # | 状态 | 占位 |
|---|---|---|
| 3.5.1 | 单文件上传后自动弹出 | ![library-meta-modal](./screenshots/library-meta-modal-light.png) |
| 3.5.2 | 高置信度(绿色徽章) | ![library-meta-high-conf](./screenshots/library-meta-high-conf-light.png) |
| 3.5.3 | 低置信度(红色徽章 + 提示) | ![library-meta-low-conf](./screenshots/library-meta-low-conf-light.png) |
| 3.5.4 | 添加作者 inline | ![library-meta-author-add](./screenshots/library-meta-author-add-light.png) |
| 3.5.5 | 保存中 loading | ![library-meta-saving](./screenshots/library-meta-saving-light.png) |

---

## 4. Parse `/parse`(AI 解析)

### 设置步骤
1. 至少一个已配置默认模型 + 内置 Skill。
2. 选好一篇文献,运行一次 Skill(用以截「输出区」与「历史」)。

### 4.1 主流程
| # | 状态 | 占位 |
|---|---|---|
| 4.1.1 | 默认空(未选文献) | ![parse-empty](./screenshots/parse-empty-light.png) |
| 4.1.2 | 选好文献 + Skill,未运行 | ![parse-ready](./screenshots/parse-ready-light.png) |
| 4.1.3 | 流式输出中(2 列 DimensionCard + 光标) | ![parse-streaming](./screenshots/parse-streaming-light.png) |
| 4.1.4 | RawOutput 模式(无 dimensions) | ![parse-rawoutput](./screenshots/parse-rawoutput-light.png) |
| 4.1.5 | 完成态(状态栏含 token/耗时/预估成本) | ![parse-done](./screenshots/parse-done-light.png) |
| 4.1.6 | 错误 banner | ![parse-error](./screenshots/parse-error-light.png) |

### 4.2 上传状态横幅
| # | 状态 | 占位 |
|---|---|---|
| 4.2.1 | 上传中(琥珀色 + 进度条) | ![parse-upload-progress](./screenshots/parse-upload-progress-light.png) |
| 4.2.2 | 全部成功(绿色 ✓) | ![parse-upload-ok](./screenshots/parse-upload-ok-light.png) |
| 4.2.3 | 部分失败(红色 + 单文件列表) | ![parse-upload-partial](./screenshots/parse-upload-partial-light.png) |
| 4.2.4 | 待补全元数据 chip | ![parse-upload-needsreview](./screenshots/parse-upload-needsreview-light.png) |

### 4.3 历史列表
| # | 状态 | 占位 |
|---|---|---|
| 4.3.1 | 历史项列表(多条不同 Skill) | ![parse-history](./screenshots/parse-history-light.png) |
| 4.3.2 | 历史项 hover | ![parse-history-hover](./screenshots/parse-history-hover-light.png) |

### 4.4 配置块控件
| # | 状态 | 占位 |
|---|---|---|
| 4.4.1 | PaperPicker 展开(见 §10) | — |
| 4.4.2 | 模型下拉展开 | ![parse-model-dropdown](./screenshots/parse-model-dropdown-light.png) |
| 4.4.3 | Skill 下拉展开 + 推荐模型说明 | ![parse-skill-dropdown](./screenshots/parse-skill-dropdown-light.png) |

---

## 5. Chat `/chat`

### 设置步骤
1. 创建 3+ 会话(其中 1 置顶 + 2 最近)。
2. 在一个会话中:输入用户消息、得到 AI 回复、上传 1 个附件、附带 1 个 Skill。

### 5.1 主流程
| # | 状态 | 占位 |
|---|---|---|
| 5.1.1 | 完全空(无会话) | ![chat-empty](./screenshots/chat-empty-light.png) |
| 5.1.2 | 新建会话(SessionList 顶部按钮 hover) | ![chat-newsession-hover](./screenshots/chat-newsession-hover-light.png) |
| 5.1.3 | 选中空会话 | ![chat-blank-session](./screenshots/chat-blank-session-light.png) |
| 5.1.4 | 多条消息对话(用户 + AI + 附件) | ![chat-conversation](./screenshots/chat-conversation-light.png) |
| 5.1.5 | AI 正在流式生成(光标) | ![chat-streaming](./screenshots/chat-streaming-light.png) |
| 5.1.6 | 消息 hover 工具栏(复制 / 重新生成 / 元信息) | ![chat-bubble-hover](./screenshots/chat-bubble-hover-light.png) |

### 5.2 SessionList
| # | 状态 | 占位 |
|---|---|---|
| 5.2.1 | 置顶 + 最近双分组 | ![chat-sessionlist](./screenshots/chat-sessionlist-light.png) |
| 5.2.2 | hover 显示「置顶/重命名/删除」 | ![chat-session-hover](./screenshots/chat-session-hover-light.png) |
| 5.2.3 | 重命名 inline 输入 | ![chat-session-rename](./screenshots/chat-session-rename-light.png) |

### 5.3 InputArea
| # | 状态 | 占位 |
|---|---|---|
| 5.3.1 | 空 idle | ![chat-input-idle](./screenshots/chat-input-idle-light.png) |
| 5.3.2 | textarea 自动撑高(多行) | ![chat-input-multiline](./screenshots/chat-input-multiline-light.png) |
| 5.3.3 | 模型下拉展开 | ![chat-input-model](./screenshots/chat-input-model-light.png) |
| 5.3.4 | + 按钮 popover(上传/Skill) | ![chat-input-plus](./screenshots/chat-input-plus-light.png) |
| 5.3.5 | Skill 列表选择中 | ![chat-input-skill-pick](./screenshots/chat-input-skill-pick-light.png) |
| 5.3.6 | 发送按钮 idle / streaming / uploading 三态 | ![chat-input-send-states](./screenshots/chat-input-send-states-light.png) |

### 5.4 附件 chip 状态
| # | 状态 | 占位 |
|---|---|---|
| 5.4.1 | 上传中(黄边 + 旋转 ring) | ![chat-attach-uploading](./screenshots/chat-attach-uploading-light.png) |
| 5.4.2 | 上传完成(成功后 chip) | ![chat-attach-done](./screenshots/chat-attach-done-light.png) |
| 5.4.3 | 上传失败(红边 + ✗) | ![chat-attach-failed](./screenshots/chat-attach-failed-light.png) |

### 5.5 主题对照
| # | 状态 | 占位 |
|---|---|---|
| 5.5.1 | 对话页暗色 | ![chat-conversation-dark](./screenshots/chat-conversation-dark.png) |

---

## 6. Models `/models`(模型配置)

### 设置步骤
1. 添加 4 个模型(覆盖 Anthropic / OpenAI / DeepSeek / Ollama),设其中一个为默认。
2. 运行近 7 天有数据的解析,以填充用量。

### 6.1 顶部统计
| # | 状态 | 占位 |
|---|---|---|
| 6.1.1 | 4 个统计卡完整 | ![models-stats](./screenshots/models-stats-light.png) |
| 6.1.2 | 7 天柱状图正常 | ![models-chart](./screenshots/models-chart-light.png) |
| 6.1.3 | 柱状图 hover tooltip | ![models-chart-tooltip](./screenshots/models-chart-tooltip-light.png) |
| 6.1.4 | 「重建统计」点击后 toast | ![models-rebuild-toast](./screenshots/models-rebuild-toast-light.png) |

### 6.2 模型卡
| # | 状态 | 占位 |
|---|---|---|
| 6.2.1 | 默认模型卡(带「默认」徽章) | ![models-card-default](./screenshots/models-card-default-light.png) |
| 6.2.2 | 非默认模型卡 | ![models-card](./screenshots/models-card-light.png) |
| 6.2.3 | Key 状态绿/灰/橙 三态(横向裁剪) | ![models-key-states](./screenshots/models-key-states-light.png) |
| 6.2.4 | 「测试连接」点击中 / 成功 / 失败 | ![models-test-states](./screenshots/models-test-states-light.png) |
| 6.2.5 | 提供商图标对照(🅰️🟢🦙🔧 四种) | ![models-providers](./screenshots/models-providers-light.png) |

### 6.3 添加 / 编辑表单
| # | 状态 | 占位 |
|---|---|---|
| 6.3.1 | 添加表单展开(显示预设 chip) | ![models-add-form](./screenshots/models-add-form-light.png) |
| 6.3.2 | 预设选中后字段填充 | ![models-preset-applied](./screenshots/models-preset-applied-light.png) |
| 6.3.3 | 编辑表单 | ![models-edit-form](./screenshots/models-edit-form-light.png) |
| 6.3.4 | 价格字段 tooltip(hover 显示 hint) | ![models-price-hint](./screenshots/models-price-hint-light.png) |
| 6.3.5 | API Key 隐藏 / 显示状态 | ![models-apikey-toggle](./screenshots/models-apikey-toggle-light.png) |

### 6.4 空状态
| # | 状态 | 占位 |
|---|---|---|
| 6.4.1 | 零模型(dashed border 引导卡) | ![models-empty](./screenshots/models-empty-light.png) |

### 6.5 破坏性
| # | 状态 | 占位 |
|---|---|---|
| 6.5.1 | 删除模型 confirm(原生) | ![models-confirm-delete](./screenshots/models-confirm-delete.png) |

---

## 7. Skills `/skills`(Skill 管理)

### 设置步骤
1. 上传 1-2 个自定义 Skill;另外保留全部内置 Skill。
2. 让其中一个上传后触发 toast。

### 7.1 主流程
| # | 状态 | 占位 |
|---|---|---|
| 7.1.1 | 默认全态(自定义 section + 内置 section) | ![skills-default](./screenshots/skills-default-light.png) |
| 7.1.2 | 无自定义(dashed 卡引导) | ![skills-empty-custom](./screenshots/skills-empty-custom-light.png) |
| 7.1.3 | SkillRow 详细裁剪(icon + name + version + author + 推荐模型 chips + 动作列) | ![skills-row](./screenshots/skills-row-light.png) |
| 7.1.4 | 内置 Skill 行(只显示「复制并编辑」) | ![skills-builtin-row](./screenshots/skills-builtin-row-light.png) |

### 7.2 操作菜单/Toast
| # | 状态 | 占位 |
|---|---|---|
| 7.2.1 | 右上「+ 新建 ▾」展开 | ![skills-new-dropdown](./screenshots/skills-new-dropdown-light.png) |
| 7.2.2 | 上传中 / 上传成功 / 上传失败 Toast | ![skills-toast-states](./screenshots/skills-toast-states-light.png) |
| 7.2.3 | 删除自定义 Skill confirm(原生) | ![skills-confirm-delete](./screenshots/skills-confirm-delete.png) |

---

## 8. SkillGenerator `/skills/generate`

### 设置步骤
1. 至少 1 个可用模型;清空 localStorage(`sghub.skill-gen-draft.v1`)以确保空态。
2. 跑一轮:首发生成 → refine 一次 → 命中自动重试一次。

### 8.1 左侧对话区
| # | 状态 | 占位 |
|---|---|---|
| 8.1.1 | 完全空(TipsCard 显示 3 个示例) | ![skillgen-empty](./screenshots/skillgen-empty-light.png) |
| 8.1.2 | 无可用模型(amber banner + 「前往模型配置 →」) | ![skillgen-no-model](./screenshots/skillgen-no-model-light.png) |
| 8.1.3 | 用户首条消息发送后 + AI 「正在生成…」 | ![skillgen-generating](./screenshots/skillgen-generating-light.png) |
| 8.1.4 | 生成成功(「✅ Skill 已生成」气泡) | ![skillgen-first-ready](./screenshots/skillgen-first-ready-light.png) |
| 8.1.5 | refine 后(「✓ 已根据反馈更新」) | ![skillgen-refined](./screenshots/skillgen-refined-light.png) |
| 8.1.6 | 命中自动重试(气泡下方 amber「💡 已自动重试修正」) | ![skillgen-retry](./screenshots/skillgen-retry-light.png) |
| 8.1.7 | 错误气泡 + 底部 lastError banner | ![skillgen-error](./screenshots/skillgen-error-light.png) |

### 8.2 ModelPicker
| # | 状态 | 占位 |
|---|---|---|
| 8.2.1 | label + 下拉 idle | ![skillgen-modelpicker](./screenshots/skillgen-modelpicker-light.png) |
| 8.2.2 | 下拉展开 | ![skillgen-modelpicker-open](./screenshots/skillgen-modelpicker-open-light.png) |

### 8.3 右侧三 Tab
| # | 状态 | 占位 |
|---|---|---|
| 8.3.1 | 配置 Tab(名称 + 描述 + 推荐模型 + 输出维度卡列表 + 可折叠 Prompt 模板) | ![skillgen-tab-config](./screenshots/skillgen-tab-config-light.png) |
| 8.3.2 | 配置 Tab - Prompt 模板展开 | ![skillgen-tab-config-prompt](./screenshots/skillgen-tab-config-prompt-light.png) |
| 8.3.3 | YAML 源码 Tab | ![skillgen-tab-yaml](./screenshots/skillgen-tab-yaml-light.png) |
| 8.3.4 | 测试运行 Tab(运行前) | ![skillgen-tab-test-idle](./screenshots/skillgen-tab-test-idle-light.png) |
| 8.3.5 | 测试运行 Tab(流式中 ● ) | ![skillgen-tab-test-streaming](./screenshots/skillgen-tab-test-streaming-light.png) |
| 8.3.6 | 测试运行 Tab(完成) | ![skillgen-tab-test-done](./screenshots/skillgen-tab-test-done-light.png) |

### 8.4 Footer 动作
| # | 状态 | 占位 |
|---|---|---|
| 8.4.1 | 「💾 保存为 Skill」 idle / disabled / 保存中 | ![skillgen-save-states](./screenshots/skillgen-save-states-light.png) |
| 8.4.2 | 「✏️ 切换到高级编辑器」hover | ![skillgen-switch-advanced](./screenshots/skillgen-switch-advanced-light.png) |
| 8.4.3 | 「🗑️ 重新开始」 hover(红链接) | ![skillgen-reset-hover](./screenshots/skillgen-reset-hover-light.png) |

### 8.5 整体 split 与语言
| # | 状态 | 占位 |
|---|---|---|
| 8.5.1 | 整页(50/50 split,首发生成完毕态) | ![skillgen-full](./screenshots/skillgen-full-light.png) |
| 8.5.2 | English 版整页 | ![skillgen-full-en](./screenshots/skillgen-full-light-en.png) |
| 8.5.3 | 暗色版整页 | ![skillgen-full-dark](./screenshots/skillgen-full-dark.png) |

---

## 9. Settings `/settings`

### 9.1 常规设置
| # | 状态 | 占位 |
|---|---|---|
| 9.1.1 | 默认全态(语言/主题/默认模型/日志级别) | ![settings-general](./screenshots/settings-general-light.png) |
| 9.1.2 | 语言下拉展开(跟随系统 + 简中 + English) | ![settings-lang-dropdown](./screenshots/settings-lang-dropdown-light.png) |
| 9.1.3 | 默认模型 = 未设置(灰字提示) | ![settings-no-default-model](./screenshots/settings-no-default-model-light.png) |

### 9.2 UpdaterCard
| # | 状态 | 占位 |
|---|---|---|
| 9.2.1 | 关闭态(下方控件半透明) | ![settings-updater-off](./screenshots/settings-updater-off-light.png) |
| 9.2.2 | 开 + 每日频率 | ![settings-updater-daily](./screenshots/settings-updater-daily-light.png) |
| 9.2.3 | 开 + 每周频率(7 chip,部分选中) | ![settings-updater-weekly](./screenshots/settings-updater-weekly-light.png) |
| 9.2.4 | 时间下拉展开(96 项中部分截屏) | ![settings-updater-time](./screenshots/settings-updater-time-light.png) |
| 9.2.5 | 「立即检查」点击中 | ![settings-updater-checking](./screenshots/settings-updater-checking-light.png) |
| 9.2.6 | 「已是最新版本」toast | ![settings-updater-uptodate](./screenshots/settings-updater-uptodate-light.png) |
| 9.2.7 | 待安装版本(emerald 行 + 「立即安装」按钮) | ![settings-updater-pending](./screenshots/settings-updater-pending-light.png) |
| 9.2.8 | 错误态(红字 + 重试按钮) | ![settings-updater-error](./screenshots/settings-updater-error-light.png) |

### 9.3 DataDirCard
| # | 状态 | 占位 |
|---|---|---|
| 9.3.1 | Default 路径 idle(amber 徽章) | ![settings-datadir-default](./screenshots/settings-datadir-default-light.png) |
| 9.3.2 | Custom 路径 idle(显示「↩️ 恢复默认」) | ![settings-datadir-custom](./screenshots/settings-datadir-custom-light.png) |
| 9.3.3 | 路径点击复制 toast | ![settings-datadir-copy](./screenshots/settings-datadir-copy-light.png) |

### 9.4 数据迁移向导(Modal 3 步)
| # | 状态 | 占位 |
|---|---|---|
| 9.4.1 | Step 1 选目录(默认) | ![settings-migrate-step1](./screenshots/settings-migrate-step1-light.png) |
| 9.4.2 | Step 1 校验 ✓ | ![settings-migrate-step1-ok](./screenshots/settings-migrate-step1-ok-light.png) |
| 9.4.3 | Step 1 校验 ⚠ 已有数据 | ![settings-migrate-step1-warn](./screenshots/settings-migrate-step1-warn-light.png) |
| 9.4.4 | Step 1 校验 ✗ 错误 | ![settings-migrate-step1-error](./screenshots/settings-migrate-step1-error-light.png) |
| 9.4.5 | Step 2 3 个 radio card | ![settings-migrate-step2](./screenshots/settings-migrate-step2-light.png) |
| 9.4.6 | Step 3 摘要 + 红色警告 | ![settings-migrate-step3](./screenshots/settings-migrate-step3-light.png) |
| 9.4.7 | 执行中(进度条 + 当前文件名) | ![settings-migrate-running](./screenshots/settings-migrate-running-light.png) |
| 9.4.8 | 完成态(保留/删除旧 + 立即重启) | ![settings-migrate-done](./screenshots/settings-migrate-done-light.png) |

---

## 10. 共享业务组件

### 10.1 PaperPicker(cmdk)
| # | 状态 | 占位 |
|---|---|---|
| 10.1.1 | idle | ![paperpicker-idle](./screenshots/paperpicker-idle-light.png) |
| 10.1.2 | 空输入显示最近文献 | ![paperpicker-recent](./screenshots/paperpicker-recent-light.png) |
| 10.1.3 | 输入「diffusion」检索结果(`<mark>` 高亮) | ![paperpicker-results](./screenshots/paperpicker-results-light.png) |
| 10.1.4 | 无匹配 | ![paperpicker-nomatch](./screenshots/paperpicker-nomatch-light.png) |

### 10.2 PaperActions(论文动作行)
| # | 状态 | 占位 |
|---|---|---|
| 10.2.1 | 5 按钮齐全 idle | ![paperactions-idle](./screenshots/paperactions-idle-light.png) |
| 10.2.2 | 无可用原文链接(红字 inline 错误) | ![paperactions-nolink](./screenshots/paperactions-nolink-light.png) |
| 10.2.3 | PDF 下载中(96px 进度条 + 取消 ×) | ![paperactions-pdf-progress](./screenshots/paperactions-pdf-progress-light.png) |
| 10.2.4 | PDF 已存在(📂 打开) | ![paperactions-pdf-open](./screenshots/paperactions-pdf-open-light.png) |
| 10.2.5 | 非开放获取(下载禁用 + tooltip) | ![paperactions-pdf-disabled](./screenshots/paperactions-pdf-disabled-light.png) |
| 10.2.6 | 内联错误 chip | ![paperactions-error-chip](./screenshots/paperactions-error-chip-light.png) |

### 10.3 FavoriteButton
| # | 状态 | 占位 |
|---|---|---|
| 10.3.1 | 未收藏 - compact | ![fav-uncollected-compact](./screenshots/fav-uncollected-compact-light.png) |
| 10.3.2 | 未收藏 - full | ![fav-uncollected-full](./screenshots/fav-uncollected-full-light.png) |
| 10.3.3 | 已收藏 - 按钮态(琥珀色) | ![fav-collected](./screenshots/fav-collected-light.png) |
| 10.3.4 | 下拉展开 - 文件夹树 | ![fav-dropdown-tree](./screenshots/fav-dropdown-tree-light.png) |
| 10.3.5 | 下拉 + 新建文件夹 inline | ![fav-newfolder-inline](./screenshots/fav-newfolder-inline-light.png) |
| 10.3.6 | toast stack(底部右) | ![fav-toast-stack](./screenshots/fav-toast-stack-light.png) |

### 10.4 SkillEditor(`/skills/new`)
| # | 状态 | 占位 |
|---|---|---|
| 10.4.1 | 3 列布局 idle | ![skilleditor-default](./screenshots/skilleditor-default-light.png) |
| 10.4.2 | Monaco 编辑(YAML 高亮 + Ctrl+S 提示) | ![skilleditor-monaco](./screenshots/skilleditor-monaco-light.png) |
| 10.4.3 | YAML 解析失败提示(amber) | ![skilleditor-yaml-error](./screenshots/skilleditor-yaml-error-light.png) |
| 10.4.4 | 右侧「渲染后的 Prompt」 Tab + token 估算 | ![skilleditor-preview-prompt](./screenshots/skilleditor-preview-prompt-light.png) |
| 10.4.5 | 右侧「测试运行结果」Tab(流式中) | ![skilleditor-preview-test](./screenshots/skilleditor-preview-test-light.png) |
| 10.4.6 | 未保存 marker `●` + 保存中 | ![skilleditor-unsaved](./screenshots/skilleditor-unsaved-light.png) |
| 10.4.7 | beforeunload 警告(Windows) | ![skilleditor-beforeunload](./screenshots/skilleditor-beforeunload.png) |

---

## 11. 主题对照(亮 vs 暗)

至少为下列 5 个页面各采集亮暗一对,用于核对暗色变量对比度:

| 页面 | 亮 | 暗 |
|---|---|---|
| Search 结果页 | ![search-results-light](./screenshots/search-results-light.png) | ![search-results-dark](./screenshots/search-results-dark.png) |
| Library 主流程 | ![library-default-light](./screenshots/library-default-light.png) | ![library-default-dark](./screenshots/library-default-dark.png) |
| Parse 流式输出 | ![parse-streaming-light](./screenshots/parse-streaming-light.png) | ![parse-streaming-dark](./screenshots/parse-streaming-dark.png) |
| Chat 对话 | ![chat-conversation-light](./screenshots/chat-conversation-light.png) | ![chat-conversation-dark](./screenshots/chat-conversation-dark.png) |
| Settings 全态 | ![settings-general-light](./screenshots/settings-general-light.png) | ![settings-general-dark](./screenshots/settings-general-dark.png) |

---

## 12. 多语言对照(中 vs 英)

至少为下列 5 个页面各采集中英一对,核对长度与换行:

| 页面 | 中文 | English |
|---|---|---|
| Search Header + 副标题 | ![search-header-zh](./screenshots/search-header-light-zh.png) | ![search-header-en](./screenshots/search-header-light-en.png) |
| Sidebar 全态 | ![sidebar-zh](./screenshots/sidebar-search-active-light.png) | ![sidebar-en](./screenshots/sidebar-search-active-light-en.png) |
| Settings 常规卡 | ![settings-zh](./screenshots/settings-general-light.png) | ![settings-en](./screenshots/settings-general-light-en.png) |
| SkillGenerator 空 + TipsCard | ![skillgen-empty-zh](./screenshots/skillgen-empty-light.png) | ![skillgen-empty-en](./screenshots/skillgen-empty-light-en.png) |
| Library DnD drag-over 提示 | ![library-dragover-zh](./screenshots/library-dragover-light.png) | ![library-dragover-en](./screenshots/library-dragover-light-en.png) |

---

## 13. 边界 / 异常 / 极端态

| # | 场景 | 操作步骤 | 占位 |
|---|---|---|---|
| 13.1 | 小窗口 960×600 - Search | 拖到最小尺寸 | ![edge-search-min](./screenshots/edge-search-min-light.png) |
| 13.2 | 小窗口 960×600 - Library 三栏挤压 | 同上 | ![edge-library-min](./screenshots/edge-library-min-light.png) |
| 13.3 | 小窗口 - SkillGenerator(50/50 太窄) | 同上 | ![edge-skillgen-min](./screenshots/edge-skillgen-min-light.png) |
| 13.4 | 超长标题 / 长作者列表(测试 truncate / `等 N`) | 检索专门文献 | ![edge-long-title](./screenshots/edge-long-title-light.png) |
| 13.5 | 极多 Tag(>30)Library 标签云 | 批量加 tag | ![edge-many-tags](./screenshots/edge-many-tags-light.png) |
| 13.6 | 深层文件夹(>5 级缩进) | 嵌套创建 | ![edge-deep-folder](./screenshots/edge-deep-folder-light.png) |
| 13.7 | 模型 0 Token / 0 调用占位(Models 柱状图全零) | 重建统计后未跑 | ![edge-models-zero](./screenshots/edge-models-zero-light.png) |
| 13.8 | 流式中断后重连 | 中途断网 | ![edge-stream-interrupt](./screenshots/edge-stream-interrupt-light.png) |

---

## 14. 验收清单(给截图采集者)

完成全部截图后,自查:

- [ ] 0-13 节中所有占位 `![...](./screenshots/*.png)` 均已替换为真实图片
- [ ] 截图均为 PNG 无压缩,且未含敏感信息(Key / 邮箱 / 个人路径)
- [ ] 同一页面的不同状态保持窗口尺寸一致
- [ ] 所有暗色截图通过 `data-theme="dark"` 真实切换得到(不是后期调色)
- [ ] English 截图通过 Settings 切语言获得,字段含义匹配
- [ ] 边界场景(§13)至少抽样 4 张
- [ ] `docs/screenshots/` 总大小 < 50 MB(超出则压缩为 80% PNG 或 webp 后入库)

---

> 维护:每次 UI 改动 PR 应附上该 PR 涉及画面的新截图(覆盖旧文件名),并在 PR 描述中列出更新项。
