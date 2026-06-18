# 代码签名与公证 / Code signing & notarization

> 目的:消除 Windows **SmartScreen「发布者未知」** 与 macOS **Gatekeeper「无法打开」** 提示。
> 现状:发布流水线(`.github/workflows/release.yml`)已为签名预留接线 —— **配置好对应的
> GitHub Secrets 后自动生效;未配置时构建产物为"未签名",流程不报错**(过渡可用)。

---

## 一、macOS 签名 + 公证(notarization)

`tauri-action` 在检测到下列环境变量时会自动:导入证书 → 用 Developer ID 签名 `.app`/`.dmg`
→ 调 `notarytool` 公证 → staple。release.yml 已把这些变量从 Secrets 透传进去。

### 需要的材料
1. Apple Developer 账号(99 USD/年)。
2. **Developer ID Application** 证书(在 Apple Developer → Certificates 创建,下载后导入钥匙串,
   导出为 `.p12` 并设密码)。
3. App-specific password(appleid.apple.com → 登录与安全 → App 专用密码)。
4. Team ID(Apple Developer → Membership)。

### 需要配置的 GitHub Secrets(Settings → Secrets and variables → Actions)
| Secret | 内容 |
|---|---|
| `APPLE_CERTIFICATE` | `.p12` 的 base64:`base64 -i cert.p12 \| pbcopy` |
| `APPLE_CERTIFICATE_PASSWORD` | 导出 `.p12` 时设的密码 |
| `APPLE_SIGNING_IDENTITY` | 形如 `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_ID` | Apple 账号邮箱 |
| `APPLE_PASSWORD` | 上面的 App 专用密码 |
| `APPLE_TEAM_ID` | 10 位 Team ID |
| `KEYCHAIN_PASSWORD` | 任意随机串(CI 临时钥匙串口令) |

配齐后,下次打 `v*.*.*` tag 触发的 Release 即为已签名 + 已公证,用户双击直接打开,无需「右键 → 打开」。

---

## 二、Windows 代码签名

Windows 签名需要在 `tauri.conf.json` 的 `bundle.windows` 配置 `certificateThumbprint` **或**
`signCommand`。**为保持未签名构建可用,仓库默认不写死签名配置**;选定方案后按下面任一种启用。

### 方案对比
| 方案 | 成本 | SmartScreen | 备注 |
|---|---|---|---|
| **OV 证书**(组织验证) | 较低/年 | 需累积声誉后才消除警告 | 软证书,可放 CI |
| **EV 证书**(扩展验证) | 较高/年 | **即时**消除警告 | 需硬件 token / 云 HSM,CI 接入复杂 |
| **Azure Trusted Signing** | 按量,很低 | 即时(基于 Microsoft 根) | 推荐:云签名,无需自管 token |

### 启用方式 A — certificateThumbprint(证书已导入构建机证书库)
```jsonc
// src-tauri/tauri.conf.json → bundle.windows
"certificateThumbprint": "你的证书指纹(去空格)",
"digestAlgorithm": "sha256",
"timestampUrl": "http://timestamp.digicert.com"
```

### 启用方式 B — signCommand(自定义 signtool / Azure Trusted Signing)
```jsonc
// src-tauri/tauri.conf.json → bundle.windows
"signCommand": "trusted-signing-cli -e %URL% -a %ACCOUNT% -c %PROFILE% %1"
```
CI 中用 [`azure/trusted-signing-action`](https://github.com/Azure/trusted-signing-action) 或
在 release.yml 增加一个签名步骤,并把账户/凭据放进 Secrets(参考 macOS 节的做法)。

> 选定后,记得把对应 Secrets 加好,并在本文件「启用状态」处记录,避免下次发布漏签。

---

## 三、过渡方案(暂无证书时)

下载页 / README 提示用户绕过:
- **Windows**:运行安装包时若弹 SmartScreen → 点 **「更多信息」→「仍要运行」**。
- **macOS**:首次打开若提示「无法验证开发者」→ **右键(Control 点按)程序 → 打开 → 打开**;
  或终端执行 `xattr -dr com.apple.quarantine /Applications/SG\ Hub.app`。

---

## 四、验证已签名

- **Windows**:右键 `.exe` → 属性 → **数字签名** 选项卡应出现签名者;或
  `signtool verify /pa /v SGHub_x64-setup.exe`。
- **macOS**:`codesign -dv --verbose=4 "/Applications/SG Hub.app"`;
  `spctl -a -vvv "/Applications/SG Hub.app"` 应显示 `accepted / Notarized Developer ID`;
  `xcrun stapler validate "/Applications/SG Hub.app"`。
