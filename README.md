# AWS S3 文件管理器

[English](#english) · 基于 **Electron** + **Vue 2** 的桌面端 S3 管理工具。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 功能

- **多个连接配置**：不同 Bucket / 账号可保存为多套「连接」，顶部下拉切换；当前连接会写入配置文件。
- **自定义访问域名（可选一项）**：一个基础 URL（如 CDN、CloudFront），保存后写入 `~/.aws-s3-manager-config.json`。
- **复制链接**：始终为**无查询串**的直链——未填域名时复制标准 **S3 对象 URL**；已填自定义域名时复制 **域名 + Key**（多个域名时下拉选择）。
- 文件列表：前缀搜索、目录导航、分页、批量删除、复制 Key。
- 上传：拖拽/多选、按连接切换 Bucket。

## 配置文件说明

- 路径：**`~/.aws-s3-manager-config.json`**（Electron）或浏览器 localStorage（仅 `npm run serve`）。
- 新版为 **`version: 2`**，含 `profiles` 数组与 `activeProfileId`；首次打开会自动把旧版单对象配置迁成一条连接。

## 环境要求

- Node.js 16+（建议 LTS）
- npm 或 yarn

## 开发

```bash
npm install
npm run electron:serve
```

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

## 构建安装包

```bash
npm run electron:build:current   # 当前平台
npm run electron:build:mac       # macOS DMG
npm run electron:build:win       # Windows
```

产物目录：`dist_electron/`。

### macOS：DMG 与 Python

打 DMG 时 **electron-builder / dmg-builder** 会调用 Python；默认路径曾为 `/usr/bin/python`，在较新 macOS 上已不存在。脚本里已设置 **`PYTHON_PATH=/usr/bin/python3`**（需 Xcode 命令行工具或系统 `python3`）。若仍报错，可用 `which python3` 查路径后临时设置 `PYTHON_PATH`。

**依赖版本：** `package.json` 中的 **`overrides`** 将 `vue-cli-plugin-electron-builder` 内的 **electron-builder** 固定为 **23.6.0**（与顶层 devDependency 一致），避免插件自带的旧版 `dmg-builder` 在 Python 3 下报错；**无需**改 `node_modules`，`npm install` 后解析一致，适合协作。

## 安全说明

- **不要将** `.env`、配置文件或含密钥的链接提交到公开仓库。
- **下载**会通过应用内临时请求拉取对象；若你自行对外分享可访问链接，请留意桶策略与 CDN 权限。复制出的直链在未公开读时，浏览器直接打开可能 **403**。
- 建议使用 **IAM 最小权限**；多连接时各环境分开 Key。

## 开源协议

[MIT License](LICENSE)

---

## English

Desktop **AWS S3** manager (Electron + Vue 2). **Multiple profiles**, **multiple CDN base URLs per profile**, browse/upload/download/delete.

**Config:** `~/.aws-s3-manager-config.json` (v2 format with `profiles`).  
**Develop:** `npm run electron:serve` · **Build:** `npm run electron:build:current`

**License:** MIT. Rotate keys if credentials or config files leak.
