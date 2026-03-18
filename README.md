# AWS S3 文件管理器

[English](#english) · 基于 **Electron** + **Vue 2** 的桌面端 S3 管理工具。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 功能

- **多个连接配置**：不同 Bucket / 账号可保存为多套「连接」，顶部下拉切换；当前连接会写入配置文件。
- **自定义访问域名（多行）**：每行一个基础 URL（如 CDN、CloudFront），保存后写入 `~/.aws-s3-manager-config.json`。
- **复制链接**：未填域名时复制 S3 **预签名 URL**；填一行则直接拼 `域名/对象Key`；多行时下拉任选一条或选「预签名 URL」。
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

产物目录：`dist_electron/`。macOS 详见下文 Python/DMG 说明。

## 安全说明

- **不要将** `.env`、配置文件或含密钥的链接提交到公开仓库。
- **预签名 URL** 的查询串里会带出 Access Key **标识**（如 `X-Amz-Credential`），且链接过期前可被访问；请勿把此类链接发到不可信渠道，泄露后请在 IAM **轮换密钥**。
- 建议使用 **IAM 最小权限**；多连接时各环境分开 Key。

## 开源协议

[MIT License](LICENSE)

---

## English

Desktop **AWS S3** manager (Electron + Vue 2). **Multiple profiles**, **multiple CDN base URLs per profile**, browse/upload/download/delete.

**Config:** `~/.aws-s3-manager-config.json` (v2 format with `profiles`).  
**Develop:** `npm run electron:serve` · **Build:** `npm run electron:build:current`

**License:** MIT. Rotate keys if pre-signed URLs or credentials leak.
