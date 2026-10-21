import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
import FileList from '../views/FileList.vue'
import UploadFile from '../views/UploadFile.vue'
import Config from '../views/Config.vue'
import store from '../store'

const routes = [
  {
    path: '/',
    redirect: '/files'
  },
  {
    path: '/files',
    name: 'FileList',
    component: FileList,
    meta: { requiresConfig: true }
  },
  {
    path: '/upload',
    name: 'UploadFile',
    component: UploadFile,
    meta: { requiresConfig: true }
  },
  {
    path: '/config',
    name: 'Config',
    component: Config
  }
]

// 隔离的 Electron 页面没有 process / require，通过 preload 桥识别桌面环境。
// file/app 协议也使用 hash，便于独立构建预览与安装包回归。
const isElectron =
  typeof window !== 'undefined' && (
    !!window.electron?.config ||
    ['app:', 'file:'].includes(window.location.protocol)
  )

const router = createRouter({
  history: isElectron || process.env.IS_ELECTRON ? createWebHashHistory() : createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  if (store.state.switchingProfile) {
    ElMessage.info('正在切换配置，请稍候')
    next(false)
    return
  }
  const requiresConfig = to.matched.some(record => record.meta.requiresConfig)
  if (requiresConfig) {
    if (!store.getters.configLoaded) {
      await store.dispatch('loadAwsConfig')
    }
    if (!store.getters.isConfigured) {
      ElMessage.warning('请先完成 AWS 配置')
      next({ path: '/config' })
      return
    }
  }
  next()
})

export default router
