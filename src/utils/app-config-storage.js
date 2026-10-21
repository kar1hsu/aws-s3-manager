/**
 * 读写应用配置：Electron 下只使用隔离 preload 提供的有限接口。
 * 纯浏览器 dev 时用 localStorage
 */

function getConfigBridge() {
  if (typeof window === 'undefined') return null
  const bridge = window.electron && window.electron.config
  if (bridge) return bridge
  // Electron preload 加载异常时不能悄悄改存浏览器缓存，避免造成配置丢失的假象。
  if (window.location.protocol === 'app:' || /Electron\//.test(window.navigator.userAgent)) {
    throw new Error('应用配置接口未加载，请重启应用')
  }
  return null
}

export async function readAppConfig() {
  const configBridge = getConfigBridge()
  if (configBridge) {
    return configBridge.readConfig()
  }
  try {
    const raw = localStorage.getItem('aws-s3-manager-config')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function saveAppConfig(config) {
  const configBridge = getConfigBridge()
  if (configBridge) {
    // Vue 响应式对象不能经 structured clone 发送，先转换成纯数据。
    const plainConfig = JSON.parse(JSON.stringify(config))
    const ok = await configBridge.saveConfig(plainConfig)
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
