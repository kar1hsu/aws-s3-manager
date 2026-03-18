// preload.js
const { contextBridge, ipcRenderer } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

// 暴露给渲染进程的API
contextBridge.exposeInMainWorld('electron', {
  // 文件系统API
  fs: {
    readFile: (filePath) => {
      return fs.readFileSync(filePath, 'utf8')
    },
    writeFile: (filePath, data) => {
      return fs.writeFileSync(filePath, data)
    },
    exists: (filePath) => {
      return fs.existsSync(filePath)
    }
  },
  // 路径API
  path: {
    join: (...args) => path.join(...args),
    resolve: (...args) => path.resolve(...args),
    dirname: (p) => path.dirname(p)
  },
  // 操作系统API
  os: {
    homedir: () => os.homedir(),
    platform: () => os.platform()
  },
  // IPC通信
  ipcRenderer: {
    send: (channel, ...args) => {
      ipcRenderer.send(channel, ...args)
    },
    on: (channel, func) => {
      ipcRenderer.on(channel, (event, ...args) => func(...args))
    },
    once: (channel, func) => {
      ipcRenderer.once(channel, (event, ...args) => func(...args))
    },
    removeAllListeners: (channel) => {
      ipcRenderer.removeAllListeners(channel)
    },
    invoke: (channel, ...args) => {
      return ipcRenderer.invoke(channel, ...args)
    }
  },
  // 配置API
  config: {
    readConfig: () => ipcRenderer.invoke('readConfig'),
    saveConfig: (config) => ipcRenderer.invoke('saveConfig', config)
  }
})

// 添加全局错误处理
window.addEventListener('error', (event) => {
  console.error('渲染进程错误:', event.error)
})

// 添加未处理的Promise拒绝处理
window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的Promise拒绝:', event.reason)
}) 