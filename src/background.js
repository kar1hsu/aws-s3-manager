'use strict'

import { app, protocol, BrowserWindow, dialog, session, ipcMain } from 'electron'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
import installExtension, { VUEJS_DEVTOOLS } from 'electron-devtools-installer'
import path from 'path'
import fs from 'fs'
import os from 'os'
const isDevelopment = process.env.NODE_ENV !== 'production'

/** 打包版是否启动时打开开发者工具：命令行传 --devtools 或环境变量 ELECTRON_OPEN_DEVTOOLS=1 */
const wantPackedDevTools =
  process.argv.includes('--devtools') ||
  process.env.ELECTRON_OPEN_DEVTOOLS === '1'

// 设置应用名称
app.name = 'AWS S3 文件管理器'

// 配置文件路径
const configPath = path.join(os.homedir(), '.aws-s3-manager-config.json')

// IPC 处理程序
ipcMain.handle('readConfig', async () => {
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
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
    return true
  } catch (error) {
    console.error('保存配置失败:', error)
    return false
  }
})

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true } }
])

async function createWindow() {
  try {
    // Create the browser window.
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 900,
      minHeight: 700,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false,
        allowRunningInsecureContent: true
      },
      // Windows平台特定配置
      ...(process.platform === 'win32' && {
        frame: true,
        backgroundColor: '#f6f7f9',
        // ARM64优化
        ...(process.arch === 'arm64' && {
          enableLargerThanScreen: true,
          webPreferences: {
            zoomFactor: 1.0
          }
        })
      })
    })

    // 设置 CORS 相关的响应头
    win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Access-Control-Allow-Origin': ['*'],
          'Access-Control-Allow-Methods': ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          'Access-Control-Allow-Headers': ['*']
        }
      })
    })

    // 打包后无默认菜单时仍可用快捷键开关开发者工具：F12 / Ctrl+Shift+I / Cmd+Option+I
    win.webContents.on('before-input-event', (event, input) => {
      if (!input.isKeyDown || input.isAutoRepeat) return
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
    if (process.env.WEBPACK_DEV_SERVER_URL) {
      // Load the url of the dev server if in development mode
      await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
      if (!process.env.IS_TEST) win.webContents.openDevTools()
    } else {
      try {
        // hash 路由入口，避免 app:// 下 history 空白
        const appUrl = 'app://./index.html#/'
        console.log('加载:', appUrl)
        await win.loadURL(appUrl)
      } catch (error) {
        console.error('app 协议加载失败:', error)
        try {
          const indexPath = path.join(__dirname, 'index.html')
          if (fs.existsSync(indexPath)) {
            await win.loadFile(indexPath, { hash: '/' })
          } else {
            const alt = path.join(app.getAppPath(), 'index.html')
            await win.loadFile(alt, { hash: '/' })
          }
        } catch (fileError) {
          console.error('file 加载失败:', fileError)
          dialog.showErrorBox(
            '加载失败',
            `无法加载界面。\n${error.message}\n${fileError.message}`
          )
        }
      }
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
  if (!process.env.WEBPACK_DEV_SERVER_URL) {
    createProtocol('app')
  }

  if (isDevelopment && !process.env.IS_TEST) {
    try {
      await installExtension(VUEJS_DEVTOOLS)
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