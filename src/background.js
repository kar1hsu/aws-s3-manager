'use strict'

import { app, protocol, net, BrowserWindow, dialog, ipcMain } from 'electron'
import installExtension, { VUEJS3_DEVTOOLS } from 'electron-devtools-installer'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { pathToFileURL } from 'url'
const isDevelopment = process.env.NODE_ENV !== 'production'

/** 打包版是否启动时打开开发者工具：命令行传 --devtools 或环境变量 ELECTRON_OPEN_DEVTOOLS=1 */
const wantPackedDevTools =
  process.argv.includes('--devtools') ||
  process.env.ELECTRON_OPEN_DEVTOOLS === '1'

// 设置应用名称
app.name = 'AWS S3 文件管理器'

// 配置文件路径
const configPath = path.join(os.homedir(), '.aws-s3-manager-config.json')
const devServerUrl = process.env.WEBPACK_DEV_SERVER_URL
const appUrl = 'app://bundle/index.html#/'

function isAppPage(url) {
  try {
    const parsed = new URL(url)
    if (devServerUrl) return parsed.origin === new URL(devServerUrl).origin
    return parsed.protocol === 'app:' && parsed.host === 'bundle' &&
      !parsed.username && !parsed.password && parsed.pathname === '/index.html'
  } catch {
    return false
  }
}

function assertConfigSender(event) {
  if (event.senderFrame !== event.sender.mainFrame || !isAppPage(event.senderFrame.url)) {
    throw new Error('不允许此页面访问应用配置')
  }
}

// IPC 处理程序
ipcMain.handle('readConfig', async (event) => {
  assertConfigSender(event)
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8')
      return JSON.parse(data)
    }
    return null
  } catch (error) {
    console.error('读取配置失败:', error)
    return null
  }
})

ipcMain.handle('saveConfig', async (event, config) => {
  assertConfigSender(event)
  try {
    if (!config || typeof config !== 'object' || Array.isArray(config)) return false
    const data = JSON.stringify(config, null, 2)
    if (Buffer.byteLength(data) > 1024 * 1024) return false
    fs.writeFileSync(configPath, data, { mode: 0o600 })
    return true
  } catch (error) {
    console.error('保存配置失败:', error)
    return false
  }
})

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true } }
])

function registerAppProtocol() {
  // 只服务打包目录；不能把 URL 当作任意本地文件路径。
  protocol.handle('app', async (request) => {
    const url = new URL(request.url)
    if (url.host !== 'bundle' || url.username || url.password) {
      return new Response('Not found', { status: 404 })
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response('Method not allowed', { status: 405 })
    }
    let pathname
    try {
      pathname = decodeURIComponent(url.pathname)
    } catch {
      return new Response('Invalid path', { status: 400 })
    }
    if (pathname.includes('\\') || pathname.includes('\0')) {
      return new Response('Invalid path', { status: 400 })
    }
    const filePath = path.resolve(__dirname, pathname === '/' ? 'index.html' : pathname.slice(1))
    const relativePath = path.relative(__dirname, filePath)
    if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return new Response('Forbidden', { status: 403 })
    }
    try {
      const response = await net.fetch(pathToFileURL(filePath).toString(), { method: request.method })
      const headers = new Headers(response.headers)
      headers.set('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' https: http: data: blob:",
        "media-src 'self' https: http: blob:",
        "font-src 'self' data:",
        "connect-src 'self' https: http:",
        "object-src 'none'",
        "frame-src 'none'",
        "base-uri 'none'",
        "form-action 'none'"
      ].join('; '))
      return new Response(response.body, { status: response.status, headers })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}

async function createWindow() {
  try {
    // Create the browser window.
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 900,
      minHeight: 700,
      backgroundColor: '#f6f7f9',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        // 桌面 S3 客户端保持无需 Bucket CORS 的兼容性；页面只有本地脚本且无法访问 Node。
        // 后续若把 S3 请求移至主进程，可同时恢复 webSecurity 默认值。
        webSecurity: false,
        allowRunningInsecureContent: false,
        webviewTag: false
      }
    })

    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.webContents.on('will-navigate', (event, url) => {
      if (isAppPage(url)) return
      event.preventDefault()
      // 文件列表中的签名链接只触发下载，不让远程内容替换持有配置桥的主页面。
      try {
        const target = new URL(url)
        if (target.protocol === 'https:' && !target.username && !target.password) {
          win.webContents.downloadURL(url)
        }
      } catch {
        // 非 URL 导航直接拒绝。
      }
    })
    win.webContents.on('will-redirect', (event, url) => {
      if (!isAppPage(url)) event.preventDefault()
    })
    win.webContents.on('will-attach-webview', (event) => event.preventDefault())
    win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => {
      callback(false)
    })

    // 打包后无默认菜单时仍可用快捷键开关开发者工具：F12 / Ctrl+Shift+I / Cmd+Option+I
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown' || input.isAutoRepeat) return
      const k = input.key.toLowerCase()
      const toggle =
        input.key === 'F12' ||
        (input.control && input.shift && k === 'i') ||
        (input.meta && input.alt && k === 'i')
      if (toggle) {
        event.preventDefault()
        win.webContents.toggleDevTools()
      }
    })

    // 打开开发者工具调试
    if (devServerUrl) {
      // Load the url of the dev server if in development mode
      await win.loadURL(devServerUrl)
      if (!process.env.IS_TEST) win.webContents.openDevTools()
    } else {
      await win.loadURL(appUrl)
      if (wantPackedDevTools) {
        win.webContents.openDevTools({ mode: 'detach' })
      }
    }

    win.webContents.on('did-fail-load', (_e, code, desc, url) => {
      console.error('did-fail-load', code, desc, url)
    })
  } catch (error) {
    console.error('创建窗口失败:', error)
    dialog.showErrorBox('启动失败', `无法创建应用窗口: ${error.message}`)
  }
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  // 必须在加载页面前注册 app 协议（只注册一次）
  if (!devServerUrl) {
    registerAppProtocol()
  }

  if (isDevelopment && !process.env.IS_TEST) {
    try {
      await installExtension(VUEJS3_DEVTOOLS)
    } catch (e) {
      console.error('Vue Devtools failed to install:', e.toString())
    }
  }
  createWindow()
})

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === 'win32') {
    process.on('message', (data) => {
      if (data === 'graceful-exit') {
        app.quit()
      }
    })
  } else {
    process.on('SIGTERM', () => {
      app.quit()
    })
  }
}
