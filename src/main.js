import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'

Vue.use(ElementUI)
Vue.config.productionTip = false

// 全局错误处理
Vue.config.errorHandler = (err, vm, info) => {
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
  new Vue({
    router,
    store,
    render: h => h(App)
  }).$mount('#app')
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp)
} else {
  mountApp()
} 