# AWS S3 文件管理器

[English](#english) · 基于 **Electron** + **Vue 3** + **Element Plus** 的桌面端 S3 管理工具。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 下载与安装（0.2.0）

从 [v0.2.0 Release](https://github.com/kar1hsu/aws-s3-manager/releases/tag/v0.2.0) 下载与电脑架构对应的安装包。Mac 均要求 **macOS 13 Ventura 或以上**：

- **Apple Silicon（M 系列芯片）**：选择文件名以 `arm64.dmg` 结尾的安装包。
- **Intel Mac**：选择文件名以 `x64.dmg` 结尾的安装包；不要下载 Apple Silicon 版本。
- **Windows 10 / 11（x64 或 ARM64）**：选择 `aws-s3-manager-0.2.0-windows-x64-arm64-setup.exe`；同一安装器包含两种架构，会根据系统选择。

### macOS 安装

1. 退出旧版应用，打开 DMG，将「AWS S3 文件管理器」拖入「应用程序」。
2. 已有安装可替换应用；连接配置仍保存在原来的 `~/.aws-s3-manager-config.json`，无需随应用删除。
3. 启动后，侧栏底部版本应显示 **0.2.0**。配置只在顶部切换，不再在侧栏重复显示存储桶。

macOS 安装包使用开发证书签名，但**未经过 Apple 公证**，首次打开可能被 Gatekeeper 阻止。确认下载来源和 Release 中的 SHA-256 后，可在「系统设置 → 隐私与安全性」允许本应用；不要关闭系统安全检查。

### Windows 安装

1. 退出旧版应用，运行 `aws-s3-manager-0.2.0-windows-x64-arm64-setup.exe`，按安装向导选择目录并完成安装。
2. 从开始菜单或桌面快捷方式启动；连接配置保存在 `%USERPROFILE%\.aws-s3-manager-config.json`，更新应用时无需删除。

Windows 安装器**未签名**，SmartScreen 可能显示未知发布者或风险提示。请先核对下载来源和 Release 中的 SHA-256；无法确认时不要运行，不要关闭 SmartScreen 或防病毒保护。Windows 包在 macOS 上交叉构建，**尚未完成 Windows 实机安装与运行验证**。

### 0.2.0 更新

- 升级 Vue 3 / Element Plus、Electron 45.0.0、AWS SDK v3.1154.0，更新 macOS 打包链。
- 重构组件、桌面布局与配色，更换同尺寸图标。
- 新增可搜索的配置快速切换与 `⌘ K` / `Ctrl K` 快捷键，分别记住浏览目录。
- 优化文件筛选、目录直达、批量复制链接、上传队列与失败重试。
- 修复图片上传 MIME、签名预览的内联显示，以及配置切换、保存失败时的状态保护。
- 隔离 preload 与渲染进程，阻止构建环境中的 AWS 凭证被内联到应用，增加发布产物安全检查。

## 功能

- **快速切换配置**：不同 Bucket / 账号可保存为多套「连接」。顶部选择器支持按配置名、Bucket 和区域搜索，`⌘ K` / `Ctrl K` 快速打开；分别记住各自浏览目录。
- **自定义访问域名（可选一项）**：一个基础 URL（如 CDN、CloudFront），保存后写入 `~/.aws-s3-manager-config.json`。
- **复制链接**：始终为**无查询串**的直链——未填域名时复制标准 **S3 对象 URL**；已填自定义域名时复制 **域名 + Key**（多个域名时下拉选择）。
- 文件列表：当前目录即时筛选、全局前缀搜索、路径直达、上一级、图片预览、分页、批量复制链接/删除、复制 Key。普通浏览默认收起完整 Key，全局搜索时自动展示。
- 上传：沿用当前目录，拖拽/多选、移除队列项、逐文件进度、仅重试失败项、完成当前文件后停止；成功后可直接复制链接或返回目标目录。
- 操作保护：上传期间固定连接和目录；待上传文件或设置修改未保存时，离页会提示。切换连接后分别记住本次应用会话的浏览目录。
- 图标：`public/icon.png` 保持 256×256，`public/icon.icns` 保留原有 32/64/128 像素规格；高清源图和生成提示词在 `assets/icons/`。

## 常用操作

1. 设置中保存连接后进入文件页；使用顶部选择器或 `⌘ K` / `Ctrl K` 查找、切换配置。上传和配置写盘期间锁定切换；未保存表单会先提示。
2. 在当前目录输入文件名片段即可筛选；跨目录查找时切换为「全局前缀」，输入完整前缀并搜索。退出搜索会回到原目录。
3. 点击图片名称打开预览。预览通过短期 S3 签名链接读取，并指定图片类型；「复制链接」仍生成原有公开直链，不包含凭证或签名参数。
4. 点击「上传文件」，目标默认沿用当前目录。上传失败会保留逐项错误，重试不会重复发送成功的文件；成功项的链接保留其实际上传目录。
5. 同名上传会覆盖对象。修改图片类型只对新上传生效；覆盖 CloudFront 缓存中的对象后仍需等待缓存到期或在 CloudFront 刷新路径。

## 配置文件说明

- 路径：**`~/.aws-s3-manager-config.json`**（Electron）或浏览器 localStorage（仅 `npm run serve`）。
- 新版为 **`version: 2`**，含 `profiles` 数组与 `activeProfileId`；首次打开会自动把旧版单对象配置迁成一条连接。

## 环境要求

- Node.js 22.12+（Electron 45 的开发依赖要求，测试使用 Node 内置测试运行器）
- npm 或 yarn
- macOS 安装包要求 macOS 13 Ventura 或以上，分别提供 Apple Silicon / arm64 与 Intel / x64 版本
- Windows 安装包面向 Windows 10 / 11 的 x64 和 ARM64 系统；不提供 32 位版本，不支持 Windows 7 / 8 / 8.1，参见 [Electron 官方系统兼容变更](https://www.electronjs.org/docs/latest/breaking-changes#removed-windows-7--8--81-support)

安装预编译应用不需要另行安装 Node.js 或 npm；以上开发依赖仅用于开发、测试和自行构建。

## 开发

```bash
npm install
npm run electron:serve
```

### 前端结构与设计约定

- `src/components/layout/`：侧栏、常驻配置选择器、应用布局与帮助。
- `src/components/files/`：目录工具栏、文件表格、行操作与图片预览。
- `src/components/upload/`：拖放选择、上传队列、目标目录、摘要与目录选择器。
- `src/components/config/`：配置列表与连接表单。
- `src/components/ui/`：公共页头、空状态和 SVG 图标注册。
- `src/styles/tokens.css` / `app.css`：统一配色、字号、间距和 Element Plus 外观。
- `src/views/` 保留页面编排与业务流程；展示组件通过 props / emits 交互。

界面按桌面文件工具组织：紧凑列表、明确工具栏、单一强调色，不使用营销口号、装饰性英文眉题、渐变和统计卡片。设计参考 [Transmit](https://panic.com/transmit/) 与 [ForkLift](https://binarynights.com/) 的操作布局，不复制其素材。

已使用原生 Vue 3（不依赖兼容构建）、Element Plus、Vue Router 4、Vuex 4。保留 Options API 和现有 Vue CLI 构建链，未同时迁移 Vite 或 Pinia。

0.2.0 将 Electron 升至 45.0.0、electron-builder 升至 26.15.3，移除 AWS SDK v2，改用 AWS SDK v3 的 `@aws-sdk/client-s3`、`@aws-sdk/lib-storage` 和 `@aws-sdk/s3-request-presigner`（3.1154.0）。上传、分段上传清理和签名链接使用 v3 API；文件读取使用标准 File API，不再依赖 Electron 已移除的 `File.path`。

Electron 的系统要求和废弃接口以[官方兼容变更说明](https://www.electronjs.org/docs/latest/breaking-changes)为准；SDK 接口迁移参考 [AWS v3 迁移说明](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/migrate-whats-different.html)。

### 打包后的应用如何打开开发者工具

- **快捷键**：**F12**，或 **Ctrl+Shift+I**（Windows/Linux），或 **Cmd+Option+I**（macOS）。
- **启动参数**（需直接运行可执行文件，不要只双击 `.app` 外壳）：在可执行文件后加 `--devtools`。  
  例（macOS，名称以你 `.app` 内 `MacOS` 下实际文件名为准）：  
  `"/Applications/AWS S3 文件管理器.app/Contents/MacOS/AWS S3 文件管理器" --devtools`
- **环境变量**：`ELECTRON_OPEN_DEVTOOLS=1` 同上一条一样从终端启动可执行文件时生效。

仅 Web 预览（部分能力依赖 Electron）：

```bash
npm run serve
```

## 验证

```bash
npm run lint -- --no-fix
npm test
npm run build
npm run test:ui
# 完成 Electron 构建后，验证实际主进程、preload、配置持久化与协议
npm run test:main
# 真实 Fetch、MIME、签名与字节校验，仅请求本机 HTTP 测试服务
npm run test:network
# 检查打包目录和 macOS app.asar，不输出任何敏感匹配值
npm run test:artifact
# 使用安装包构建的前端重复 UI 回归
AWS_S3_SMOKE_DIST=dist_electron/bundled npm run test:ui
```

`test:ui` 使用独立 Electron 配置、模拟 S3 与禁用外网的测试会话，验证筛选、预览、文件选择与移除、上传重试、配置搜索/切换、目录恢复和未保存设置保护，并截取 1200×800 / 900×700 窗口。`test:main` 加载真实打包主进程，将配置和会话目录隔离到临时目录，同时校验协议路径及下载落盘；`test:network` 使用本机 HTTP 服务验证真实 Fetch 上传、签名预览、MIME、CRC32 与文件字节。测试不读取本机 AWS 配置，也不操作真实 Bucket。

## 构建安装包

```bash
npm run electron:build:current                     # 当前平台与架构
npm run electron:build:mac -- --arm64 --publish never  # Apple Silicon DMG
npm run electron:build:mac -- --x64 --publish never    # Intel Mac DMG
npm run electron:build:win -- --x64 --arm64 --publish never  # Windows 双架构 NSIS 安装包
```

产物目录：`dist_electron/`。

Mac 的两种架构分别生成 DMG；Windows 的 x64 与 ARM64 合并为一个 NSIS 安装器。跨平台构建成功不等于目标系统实机验证；发布前应分别检查架构、签名状态、产物安全及实际安装运行。

### macOS：DMG 与 Python

打 DMG 时 **electron-builder / dmg-builder** 会调用 Python；默认路径曾为 `/usr/bin/python`，在较新 macOS 上已不存在。脚本里已设置 **`PYTHON_PATH=/usr/bin/python3`**（需 Xcode 命令行工具或系统 `python3`）。若仍报错，可用 `which python3` 查路径后临时设置 `PYTHON_PATH`。

**依赖版本：** `package.json` 中的 **`overrides`** 将 `vue-cli-plugin-electron-builder` 内的 **electron-builder** 固定为 **26.15.3**（与顶层 devDependency 一致），避免插件使用旧版打包器；无需修改 `node_modules`。Electron 42 起首次运行才下载二进制；如需提前下载，可运行 `npx install-electron --no`。

## 安全说明

- **不要将** `.env`、配置文件或含密钥的链接提交到公开仓库。
- 不要通过 `VUE_APP_*` 环境变量提供 AWS 凭证。应用运行时从本机连接配置读取凭证；构建端只允许注入必要的公开常量，发布前必须通过产物安全检查。
- **下载**会通过应用内临时请求拉取对象；若你自行对外分享可访问链接，请留意桶策略与 CDN 权限。复制出的直链在未公开读时，浏览器直接打开可能 **403**。
- 建议使用 **IAM 最小权限**；多连接时各环境分开 Key。
- 渲染进程启用 `contextIsolation` / `sandbox`，禁用 `nodeIntegration`，preload 只提供配置读写接口。配置文件仍保存在原路径，不上传凭证。
- 为保持无需配置 Bucket CORS 的桌面直连能力，目前仍保留 `webSecurity: false`。应用限制导航和弹窗、限制本地协议路径并设置 CSP，但这不等同于完整安全隔离。后续若要开启 Web 安全策略，需将 S3 请求迁至主进程或配置 Bucket CORS。
- 生产依赖可通过 `npm audit --omit=dev --registry=https://registry.npmjs.org` 检查；旧 Vue CLI 开发工具链仍有审计告警，本次未宣称整个依赖树零漏洞。

## 开源协议

[MIT License](LICENSE)

---

## English

Desktop **AWS S3** manager (Electron + Vue 3 + Element Plus). **Searchable profile switching**, **custom CDN base URL**, browse/upload/download/delete.

**Download:** [v0.2.0](https://github.com/kar1hsu/aws-s3-manager/releases/tag/v0.2.0). On macOS 13+, choose `arm64.dmg` for Apple Silicon or `x64.dmg` for Intel. Open the DMG and drag the app into Applications. Both Mac builds are development-signed, not Apple-notarized; verify the source and release SHA-256 before allowing the app through macOS Privacy & Security. Do not disable system security checks. Existing local connection settings are preserved.

**Windows:** Windows 10 / 11, x64 or ARM64. `aws-s3-manager-0.2.0-windows-x64-arm64-setup.exe` contains both architectures and selects the appropriate one during installation. Run the installer and follow the setup wizard. It is **unsigned**, so SmartScreen may warn about an unknown publisher. Verify the download source and release SHA-256; do not disable SmartScreen or antivirus protection. These packages were cross-built on macOS and **have not been installation- or runtime-tested on a Windows machine**.

**Config:** `~/.aws-s3-manager-config.json` (v2 format with `profiles`). On Windows: `%USERPROFILE%\.aws-s3-manager-config.json`.

**Develop:** Node.js 22.12+, then `npm install` and `npm run electron:serve`. Prebuilt apps do not require Node.js.

**Build:** `npm run electron:build:mac -- --arm64 --publish never` or `--x64` for Mac; `npm run electron:build:win -- --x64 --arm64 --publish never` for the combined Windows installer.

**License:** MIT. Rotate keys if credentials or config files leak.
