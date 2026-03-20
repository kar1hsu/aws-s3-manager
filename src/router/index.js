import Vue from 'vue'
import VueRouter from 'vue-router'
import FileList from '../views/FileList.vue'
import UploadFile from '../views/UploadFile.vue'
import Config from '../views/Config.vue'
import store from '../store'

Vue.use(VueRouter)

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

// Electron 下须用 hash；勿只依赖 IS_ELECTRON（Define 未注入时会误用 history → 白屏）
const isElectron =
  typeof process !== 'undefined' &&
  process.versions &&
  !!process.versions.electron

const router = new VueRouter({
  mode: isElectron || process.env.IS_ELECTRON ? 'hash' : 'history',
  routes
})

// 路由守卫，确保AWS配置已完成
router.beforeEach((to, from, next) => {
  const requiresConfig = to.matched.some(record => record.meta.requiresConfig)
  const isConfigured = store.getters.isConfigured
  
  if (requiresConfig && !isConfigured) {
    // 如果路由需要配置，但配置不完整，则重定向到配置页面
    Vue.prototype.$message.warning('请先完成AWS配置')
    next({ path: '/config' })
  } else {
    next()
  }
})

export default router 