import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import { registerIcons } from '@/components/ui/icons'
import '@/styles/tokens.css'
import '@/styles/app.css'

const app = createApp(App)
app.use(store)
app.use(router)
app.use(ElementPlus, { locale: zhCn })
registerIcons(app)

// 全局错误处理
app.config.errorHandler = (err, vm, info) => {
  console.error('Vue错误:', err)
  console.error('错误信息:', info)
}

// 捕获Promise异常
window.addEventListener('unhandledrejection', event => {
  console.error('未处理的Promise拒绝:', event.reason)
  event.preventDefault()
})

// 勿仅用 DOMContentLoaded：生产分包若晚于该事件执行，监听不会触发 → 白屏
function mountApp () {
  app.mount('#app')
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp)
} else {
  mountApp()
}
