const { contextBridge, ipcRenderer } = require('electron')

// Electron 45 的沙盒 preload 只依赖 electron；不向页面暴露通用 IPC / 文件系统。
contextBridge.exposeInMainWorld('electron', {
  config: {
    readConfig: () => ipcRenderer.invoke('readConfig'),
    saveConfig: (config) => ipcRenderer.invoke('saveConfig', config)
  }
})
