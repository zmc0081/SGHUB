# 发布前 Checklist / Release checklist

> 每次发布新版本逐项确认。目标:**代码版本 = 打包版本 = 安装后显示版本**,且 Windows/macOS
> 的图标、签名、安装/卸载/快捷方式都健壮。配套:[`code-signing.md`](code-signing.md)。

## 0. 版本号(强制)
- [ ] `node scripts/bump-version.cjs X.Y.Z` 一键更新四处版本号
- [ ] `npm run check-version` 通过(package.json / tauri.conf.json / Cargo.toml / Cargo.lock 全一致)
      —— CI(pr-check)也会跑这一步,不一致直接红
- [ ] CLAUDE.md「当前版本」已更新(bump 脚本会顺带改)
- [ ] 设置页「版本」行显示值 = 本次版本(来自 `app.package_info()`,非硬编码)

## 1. 干净重建
- [ ] `cd src-tauri && cargo clean`(清掉旧 dev 残留,避免拿到旧产物)
- [ ] `npm ci`(锁定依赖)
- [ ] `npm run tauri build`(图标、版本号均在构建期嵌入)

## 2. Logo / 图标
- [ ] 如换过 Logo:用 1024×1024 源图跑 `npm run tauri icon <源图>` 重新生成 `src-tauri/icons/` 全规格
      (源矢量在 `src-tauri/icons/app-icon.svg`)
- [ ] `tauri.conf.json` 的 `bundle.icon` 指向正确(32/128/128@2x/icns/ico)
- [ ] **Windows**:安装包 exe 图标、安装后程序图标、开始菜单/桌面快捷方式图标均为新 Logo
- [ ] **macOS**:`.app` 图标、`.dmg` 卷图标均为新 Logo

## 3. 签名(见 code-signing.md)
- [ ] **Windows**:已签名,SmartScreen 无「发布者未知」;或下载页有过渡说明
- [ ] **macOS**:已签名 + 公证,`spctl -a -vvv` 显示 Notarized,用户无需「右键打开」;或有过渡说明

## 4. Windows 安装/卸载/快捷方式健壮性
- [ ] `installMode` 与历史版本一致(当前固定 `currentUser`)—— **切勿在版本间改动**,否则产生
      重复安装项 / 幽灵卸载项
- [ ] 装过旧版(2.2.x)的机器上装新版:旧版被正确清理,不残留第二份卸载项
- [ ] 同目录覆盖升级:文件正确替换、版本号更新、**用户数据保留**(数据目录在 APPDATA,不随卸载删除)
- [ ] `uninstall.exe` 生成,且控制面板「卸载」项指向真实安装路径(非开发目录)
- [ ] 快捷方式指向**正式安装目录**的 exe(绝不指向 `D:\...\SG_Hub\...` 的 dev 产物)
- [ ] 可正常卸载,卸载后无残留注册表卸载项

## 5. macOS 安装健壮性
- [ ] DMG 拖拽到 Applications 安装体验正常
- [ ] 升级覆盖:正确替换 `.app`
- [ ] `minimumSystemVersion` = 12.0(低版本系统给出明确提示而非崩溃)

## 6. 安装后自检
- [ ] 设置页版本号 = 本次打包版本(历史教训:曾出现快捷方式被「修复」后指向旧 dev 版 2.2.1)
- [ ] 首次启动引导(全新安装)/ 老用户升级不弹引导,行为正确
- [ ] 冷启动 < 3 秒、安装包 < 100MB(关键约束)

## 7. 发布
- [ ] PR 合并进 `main`,`pr-check` 全绿(含 check-version)
- [ ] 打 tag `vX.Y.Z` 并推送 → `release.yml` 自动构建 Windows NSIS + macOS DMG
- [ ] Release 为 **draft**:核对资产(exe/dmg)、图标、签名后再 **Publish**

---

### 验收用例(历史踩坑回归)
1. 装过旧版的机器装新版 → 旧版清理、无幽灵卸载项 ✅
2. 自定义安装目录(若启用)→ 安装成功、快捷方式指向该目录、可正常打开与卸载 ✅
3. 安装后版本号 = 打包版本(不会打开旧 dev 版)✅
4. Windows + macOS 各处图标均为新 Logo ✅
