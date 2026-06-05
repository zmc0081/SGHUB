# Logo 资产规格速查（V2.2.2）

> 用途：新 Logo 的全部产物尺寸 / 规格清单，便于后续重新优化后**直接对位替换**。
> 新 Logo = 文件夹轮廓（folder，左上凸耳 tab）+ 竖向金色书签（bookmark，从文件夹体顶边垂下，底部燕尾缺口）。源自 "SG Hub logo design 应用版" 设计稿（竖版/正向参考）。
> 产物分两类：**桌面图标文件**（`src-tauri/icons/`，由 `tauri icon` 自动生成）与 **应用内 UI Logo**（`src/components/BrandLogo.tsx` 矢量组件）。

---

## 表 1 · 桌面图标文件（`src-tauri/icons/`）

> 全部由母源 `app-icon.svg` 经 `npx tauri icon` 自动生成，**不要手动逐张替换**。

| 文件 | 像素尺寸 | 格式 | 大小 | 用途 | 被 `tauri.conf.json` `bundle.icon` 引用 |
|---|---|---|---|---|---|
| `app-icon.svg` | 矢量 1024×1024 | SVG | 1.1 KB | **母源**，改这一个再重生成全套 | 否（仅生成源） |
| `32x32.png` | 32×32 | PNG | 0.6 KB | 小图标（窗口/任务栏小尺寸） | ✅ |
| `64x64.png` | 64×64 | PNG | 1.1 KB | 中间档（部分 Linux/托盘） | 否 |
| `128x128.png` | 128×128 | PNG | 1.9 KB | 标准应用图标 | ✅ |
| `128x128@2x.png` | 256×256 | PNG | 3.6 KB | 高 DPI（Retina）128 图标 | ✅ |
| `icon.png` | 512×512 | PNG | 7.1 KB | 通用大图（托盘/about 备用） | 否 |
| `icon.ico` | 256×256（多分辨率打包 16/32/48/64/128/256） | ICO | 8.2 KB | **Windows 窗口 + 任务栏 + exe 嵌入** | ✅ |
| `icon.icns` | 多分辨率（16→1024） | ICNS | 43.4 KB | **macOS 应用图标** | ✅ |
| `StoreLogo.png` | 50×50 | PNG | 0.9 KB | MS Store 列表标 | 否（MSIX 用） |
| `Square30x30Logo.png` | 30×30 | PNG | 0.6 KB | Win 磁贴 | 否（MSIX 用） |
| `Square44x44Logo.png` | 44×44 | PNG | 0.8 KB | Win 任务栏/磁贴 | 否（MSIX 用） |
| `Square71x71Logo.png` | 71×71 | PNG | 1.2 KB | Win 小磁贴 | 否（MSIX 用） |
| `Square89x89Logo.png` | 89×89 | PNG | 1.4 KB | Win 磁贴 | 否（MSIX 用） |
| `Square107x107Logo.png` | 107×107 | PNG | 1.7 KB | Win 中磁贴 | 否（MSIX 用） |
| `Square142x142Logo.png` | 142×142 | PNG | 2.1 KB | Win 磁贴 | 否（MSIX 用） |
| `Square150x150Logo.png` | 150×150 | PNG | 2.2 KB | Win 中磁贴 | 否（MSIX 用） |
| `Square284x284Logo.png` | 284×284 | PNG | 3.9 KB | Win 大磁贴（@2x） | 否（MSIX 用） |
| `Square310x310Logo.png` | 310×310 | PNG | 4.4 KB | Win 大磁贴 | 否（MSIX 用） |

---

## 表 2 · 应用内 UI Logo 变体（`src/components/BrandLogo.tsx`）

> 矢量组件，主题色靠 `currentColor` 自适应，**不是图片文件**；改形态只需改这一个文件里的两条 path。

| 变体 / 组件 | 渲染尺寸 | 出现位置 | 描边色（卡片） | 旗帜色 | 文字 |
|---|---|---|---|---|---|
| `<LogoMark size={18} />` | 18×18 px | 自定义标题栏 `Titlebar.tsx` | `currentColor`（=白，navy 底） | `--brand-gold` | 无 |
| `<LogoMark size={30} />` | 30×30 px | 侧栏**折叠态** `Sidebar.tsx` | 同上 | `--brand-gold` | 无 |
| `<LogoLockup />` | mark 30×30 + 文字 | 侧栏**展开态** `Sidebar.tsx` | 同上 | `--brand-gold` | "SG Hub" 18px 衬线粗体 + "Academic AI" 11px 大写 0.22em |
| mark 基础几何 | `viewBox 0 0 64 64` | 所有变体共享 | `stroke-width 4` | `fill` | — |

---

## 表 3 · 品牌设计规格（颜色 / 字体 / 几何）

| 维度 | 值 | 定义位置 |
|---|---|---|
| 靛蓝（桌面图标 squircle 底） | `#14213D` | `app-icon.svg`（硬编码，在 `src-tauri/` 下，豁免 src/ 禁 hex 规则） |
| 靛蓝（应用内 navy token） | `#1F2E4D`（`--navy`） | `src/styles/index.css` |
| 学院金（书签旗） | `#C9A24C`（`--brand-gold`） | `src/styles/index.css`（亮+暗双主题）→ `tailwind.config.js: brand-gold` |
| 纸面色（图标描边） | `#F2EBD8` | `app-icon.svg` |
| 文件夹轮廓 path（左上凸耳 tab） | `M14 16 H25 L29 22 H50 A4 4 0 0 1 54 26 V48 A4 4 0 0 1 50 52 H14 A4 4 0 0 1 10 48 V20 A4 4 0 0 1 14 16 Z` | `BrandLogo.tsx` + `app-icon.svg`（两处同步） |
| 竖向书签 path（底部燕尾） | `M36 22 H44 V36 L40 33 L36 36 Z` | 同上 |
| 绘制顺序 | **先书签（fill）后文件夹（stroke）** —— 文件夹体顶边描边压在书签顶端，书签如从顶边垂下 | 同上 |
| squircle 圆角 | `rx/ry = 230`（1024 画布，≈22.5%） | `app-icon.svg` |
| 图标内 mark 变换 | `translate(128 104) scale(12)`，描边 `4` | `app-icon.svg` |
| 衬线字体栈 | Source Serif 4 → Source Serif Pro → Georgia → Times New Roman → serif | `tailwind.config.js` |

---

## 后续替换入口（两处即可，无需碰其他文件）

1. **桌面图标（全套）**：替换/重画 `src-tauri/icons/app-icon.svg`（保持 1024×1024 方形）→ 运行
   ```
   npx tauri icon src-tauri/icons/app-icon.svg -o src-tauri/icons
   ```
   → 自动重生表 1 里所有 PNG / ICO / ICNS / 磁贴；生成后删掉多余的 `icons/ios`、`icons/android`（本项目只做 Win/macOS）；再 `cargo tauri build` 才会嵌入（**dev 模式看不到图标变化**）。

2. **应用内 Logo**：改 `src/components/BrandLogo.tsx` 里的 `CARD_PATH` / `FLAG_PATH`（**同步**改 `app-icon.svg` 的同名 path，保持桌面/应用内一致）。颜色统一走 `--brand-gold` token，**不要在 `src/` 里写死 hex**（PR 阻塞规则）。

> 数据采集时间：V2.2.2（2026-06）。文件大小为生成时实测值，重新生成后会随新图形略有变化。
