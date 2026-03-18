<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="header-brand">
        <div class="logo-wrap">
          <i class="el-icon-cloudy"></i>
        </div>
        <div class="header-titles">
          <span class="header-title">S3 文件管理器</span>
          <span v-if="isConfigured" class="header-sub">
            <i class="el-icon-folder-opened"></i>
            <template v-if="activeProfile && activeProfile.name">{{ activeProfile.name }} · </template>
            {{ awsConfig.bucketName }}
            <el-tag size="mini" type="info" class="region-tag">{{ awsConfig.region }}</el-tag>
          </span>
          <span v-else class="header-sub muted">未连接 · 请前往设置</span>
        </div>
      </div>
      <div class="header-actions">
        <el-tooltip content="使用说明" placement="bottom">
          <el-button type="text" icon="el-icon-question" @click="helpVisible = true" />
        </el-tooltip>
        <el-tooltip content="设置" placement="bottom">
          <el-button
            type="text"
            icon="el-icon-setting"
            :class="{ 'is-active-route': $route.path === '/config' }"
            @click="$router.push('/config')"
          />
        </el-tooltip>
      </div>
    </header>

    <div class="app-body">
      <aside class="app-sidebar">
        <nav class="nav-menu">
          <router-link
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="nav-item"
            active-class="active"
          >
            <i :class="item.icon"></i>
            <span>{{ item.label }}</span>
          </router-link>
        </nav>
        <div class="sidebar-footer">
          <span class="ver">v{{ appVersion }}</span>
        </div>
      </aside>

      <main class="app-main">
        <div class="app-main-inner">
          <router-view />
        </div>
      </main>
    </div>

    <el-dialog
      title="使用说明"
      :visible.sync="helpVisible"
      width="520px"
      custom-class="help-dialog"
    >
      <ul class="help-list">
        <li>在<strong>设置</strong>中可管理多个连接；填写 Key、Bucket 与可选的自定义访问域名后保存。</li>
        <li><strong>文件</strong>：按目录浏览；可用前缀搜索；支持下载、复制链接、复制对象 Key、批量删除。</li>
        <li><strong>上传</strong>：选择目标目录后拖拽或选择文件；可从文件页「上传到此目录」跳转并带上路径。</li>
        <li>凭证保存在本机用户目录，请勿在公共电脑保存敏感 Bucket。</li>
      </ul>
      <span slot="footer">
        <el-button type="primary" @click="helpVisible = false">知道了</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'App',
  data() {
    return {
      helpVisible: false,
      appVersion: '0.1.0',
      navItems: [
        { to: '/files', label: '文件', icon: 'el-icon-folder' },
        { to: '/upload', label: '上传', icon: 'el-icon-upload2' },
        { to: '/config', label: '设置', icon: 'el-icon-setting' }
      ]
    }
  },
  computed: {
    ...mapGetters(['awsConfig', 'isConfigured', 'activeProfile'])
  },
  created() {
    this.$store.dispatch('loadAwsConfig')
    window.addEventListener('error', e => console.error('全局错误:', e.error))
  }
}
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: linear-gradient(165deg, #eef2f7 0%, #f6f7f9 45%, #f0f4f8 100%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-header {
  height: 56px;
  padding: 0 20px 0 24px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  z-index: 20;
  -webkit-app-region: drag;
}

.app-header .el-button {
  -webkit-app-region: no-drag;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.logo-wrap {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #0066cc 0%, #004a99 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 20px;
  box-shadow: 0 4px 12px rgba(0, 102, 204, 0.25);
}

.header-titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.header-title {
  font-size: 17px;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: -0.02em;
}

.header-sub {
  font-size: 12px;
  color: #5a6578;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.header-sub.muted {
  color: #909399;
}

.header-sub i {
  font-size: 14px;
}

.region-tag {
  margin-left: 4px;
  font-weight: 500;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.header-actions .el-button {
  font-size: 18px;
  color: #606266;
  padding: 8px;
}

.header-actions .el-button.is-active-route {
  color: #0066cc;
}

.app-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.app-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.65);
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  box-sizing: border-box;
}

.nav-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  color: #5c6370;
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
}

.nav-item i {
  font-size: 18px;
  width: 22px;
  text-align: center;
}

.nav-item:hover {
  background: rgba(0, 102, 204, 0.08);
  color: #0066cc;
}

.nav-item.active {
  background: linear-gradient(90deg, rgba(0, 102, 204, 0.12) 0%, rgba(0, 102, 204, 0.04) 100%);
  color: #0066cc;
  font-weight: 600;
}

.sidebar-footer {
  margin-top: auto;
  padding: 16px;
  font-size: 11px;
  color: #a0a8b5;
}

.ver {
  font-variant-numeric: tabular-nums;
}

.app-main {
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding: 20px 24px 28px;
  box-sizing: border-box;
}

.app-main-inner {
  max-width: 1200px;
  margin: 0 auto;
  min-height: calc(100vh - 56px - 48px);
}

.help-list {
  margin: 0;
  padding-left: 20px;
  line-height: 1.75;
  color: #4a5568;
  font-size: 14px;
}

.help-list li {
  margin-bottom: 10px;
}
</style>

<style>
.help-dialog .el-dialog__body {
  padding-top: 8px;
}
</style>
