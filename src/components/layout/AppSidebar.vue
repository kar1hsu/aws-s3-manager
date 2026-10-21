<template>
  <aside class="app-sidebar">
    <div class="sidebar-brand">
      <img :src="`${publicPath}icon.png`" alt="" class="app-icon" />
      <strong>S3 文件管理</strong>
    </div>
    <nav class="sidebar-nav" aria-label="主导航">
      <router-link v-for="item in items" :key="item.to" :to="item.to" class="sidebar-link" active-class="is-active">
        <AppIcon :name="item.icon" :size="18" /><span>{{ item.label }}</span>
        <span v-if="item.to === '/upload' && $store.state.hasPendingUploads" class="pending-dot" title="有待上传文件" />
      </router-link>
    </nav>
    <div class="sidebar-bottom">
      <button class="sidebar-help" @click="$emit('help')"><AppIcon name="help" :size="17" /><span>使用帮助</span><span class="version">{{ version }}</span></button>
    </div>
  </aside>
</template>

<script>
import AppIcon from '@/components/ui/AppIcon.vue'

export default {
  name: 'AppSidebar',
  components: { AppIcon },
  props: { version: String },
  emits: ['help'],
  data: () => ({
    publicPath: process.env.BASE_URL,
    items: [
      { to: '/files', label: '文件浏览', icon: 'folder' },
      { to: '/upload', label: '上传文件', icon: 'upload' },
      { to: '/config', label: '连接设置', icon: 'settings' }
    ]
  })
}
</script>

<style scoped>
.app-sidebar { width: 184px; flex: 0 0 184px; height: 100%; display: flex; flex-direction: column; padding: 18px 10px 12px; background: var(--sidebar); color: var(--sidebar-text); }
.sidebar-brand { display: flex; align-items: center; gap: 9px; padding: 0 8px; margin-bottom: 31px; }
.app-icon { width: 30px; height: 30px; object-fit: contain; }
.sidebar-brand strong { color: #eeeef0; font-size: 14px; font-weight: 600; }
.sidebar-nav { display: flex; flex-direction: column; gap: 4px; }
.sidebar-link { min-height: 40px; display: flex; align-items: center; gap: 11px; padding: 10px 13px; border-radius: 5px; color: #b9bec6; text-decoration: none; font-size: 13px; transition: background 120ms; }
.sidebar-link:hover { background: #ffffff08; color: #f1f1f2; }
.sidebar-link.is-active { background: #ffffff0e; color: #f1f1f2; }
.sidebar-link.is-active > svg { color: #e4a179; }
.pending-dot { width: 5px; height: 5px; border-radius: 50%; margin-left: auto; background: #e4a179; }
.sidebar-bottom { margin-top: auto; padding-top: 24px; }
.sidebar-help { width: 100%; display: flex; align-items: center; gap: 8px; padding: 10px; border: 0; background: transparent; color: #a2a9b3; text-align: left; font-size: 12px; }
.sidebar-help:hover { color: #eeeef0; }
.version { margin-left: auto; color: #858e9b; font: 10px var(--font-mono); }
@media (max-width: 1060px) { .app-sidebar { width: 172px; flex-basis: 172px; } }
</style>
