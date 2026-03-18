/**
 * 读写应用配置：Electron 下用 IPC（与 preload 无关，兼容 contextIsolation: false）
 * 纯浏览器 dev 时用 localStorage
 */

function getIpcRenderer() {
  try {
    if (typeof window !== 'undefined' && typeof window.require === 'function') {
      return window.require('electron').ipcRenderer
    }
    // eslint-disable-next-line no-undef
    if (typeof require !== 'undefined') {
      // eslint-disable-next-line no-undef
      return require('electron').ipcRenderer
    }
  } catch (e) {
    /* 非 Electron 环境 */
  }
  return null
}

export async function readAppConfig() {
  const ipc = getIpcRenderer()
  if (ipc) {
    try {
      return await ipc.invoke('readConfig')
    } catch (e) {
      console.error('readConfig IPC:', e)
    }
  }
  if (typeof window !== 'undefined' && window.electron && window.electron.config) {
    return window.electron.config.readConfig()
  }
  try {
    const raw = localStorage.getItem('aws-s3-manager-config')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function saveAppConfig(config) {
  const ipc = getIpcRenderer()
  if (ipc) {
    const ok = await ipc.invoke('saveConfig', config)
    if (ok) return true
    throw new Error('写入配置文件失败')
  }
  if (typeof window !== 'undefined' && window.electron && window.electron.config) {
    const ok = await window.electron.config.saveConfig(config)
    if (ok) return true
    throw new Error('写入配置文件失败')
  }
  try {
    localStorage.setItem('aws-s3-manager-config', JSON.stringify(config))
    return true
  } catch (e) {
    throw new Error('无法保存（非 Electron 且无 localStorage）')
  }
}
