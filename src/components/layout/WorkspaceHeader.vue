<template>
  <header class="workspace-header">
    <div class="connection-control" :title="locked ? '请先完成当前操作或清空待上传文件' : '快速切换配置（⌘ K / Ctrl K）'">
      <label for="active-profile" class="connection-label">当前配置</label>
      <el-select
        id="active-profile"
        ref="profile"
        :model-value="activeProfileId"
        :disabled="switching || locked"
        filterable
        :filter-method="filterProfiles"
        size="small"
        class="header-profile"
        popper-class="profile-menu"
        placeholder="选择配置"
        aria-label="快速切换配置"
        @update:model-value="$emit('switch-profile', $event)"
        @visible-change="query = ''"
      >
        <el-option v-for="profile in filteredProfiles" :key="profile.id" :label="profile.name" :value="profile.id">
          <div class="profile-option">
            <div><strong>{{ profile.name }}</strong><span>{{ profile.bucketName || '尚未配置 Bucket' }}<template v-if="profile.bucketName"> · {{ profile.region }}</template></span></div>
            <el-icon v-if="profile.id === activeProfileId"><Check /></el-icon>
          </div>
        </el-option>
      </el-select>
    </div>
    <span class="active-bucket" :title="awsConfig.bucketName"><AppIcon name="bucket" :size="15" />{{ awsConfig.bucketName || '未配置存储桶' }}</span>
    <div class="header-actions">
      <span v-if="locked" class="operation-lock"><el-icon><Lock /></el-icon>当前操作完成后可切换</span>
      <span v-else class="switch-shortcut" title="快速切换配置">{{ shortcut }}</span>
      <el-button v-if="$route.name !== 'Config'" text icon="Setting" @click="openSettings">管理配置</el-button>
      <span v-else class="local-label"><el-icon><Lock /></el-icon>本机配置</span>
    </div>
  </header>
</template>

<script>
import { mapGetters } from 'vuex'
import AppIcon from '@/components/ui/AppIcon.vue'

export default {
  name: 'WorkspaceHeader',
  components: { AppIcon },
  props: { switching: Boolean },
  emits: ['switch-profile'],
  data: () => ({ query: '', shortcut: /Mac/.test(navigator.platform) ? '⌘ K' : 'Ctrl K' }),
  computed: {
    ...mapGetters(['profiles', 'activeProfileId', 'awsConfig']),
    locked() { return this.$store.state.busyOperation || this.$store.state.hasPendingUploads || this.$store.state.switchingProfile },
    filteredProfiles() {
      const query = this.query.toLocaleLowerCase()
      return this.profiles.filter(profile => `${profile.name} ${profile.bucketName} ${profile.region}`.toLocaleLowerCase().includes(query))
    }
  },
  mounted() { window.addEventListener('keydown', this.onShortcut) },
  beforeUnmount() { window.removeEventListener('keydown', this.onShortcut) },
  methods: {
    filterProfiles(query) { this.query = query },
    onShortcut(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (!this.locked && !this.switching) {
          this.$refs.profile.focus()
          this.$refs.profile.toggleMenu()
        }
      }
    },
    openSettings() { this.$router.push('/config').catch(() => {}) }
  }
}
</script>

<style scoped>
.workspace-header { height: 52px; flex-shrink: 0; display: flex; align-items: center; gap: 20px; padding: 0 24px; border-bottom: 1px solid var(--line); background: #fafaf8; -webkit-app-region: drag; }
.connection-control { display: flex; align-items: center; gap: 12px; flex-shrink: 0; -webkit-app-region: no-drag; }
.connection-label { color: var(--text-secondary); font-size: 12px; }
.header-profile { width: 200px; }
.header-profile :deep(.el-select__wrapper) { font-size: 13px; background: #fff; min-height: 32px; }
.active-bucket { display: flex; align-items: center; gap: 7px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-secondary); font-size: 12px; }
.active-bucket svg { flex-shrink: 0; color: var(--muted); }
.header-actions { display: flex; align-items: center; gap: 18px; margin-left: auto; flex-shrink: 0; -webkit-app-region: no-drag; }
.header-actions > .el-button { font-size: 12px; }
.switch-shortcut { font: 11px var(--font-mono); color: var(--muted); }
.local-label, .operation-lock { display: flex; align-items: center; gap: 5px; color: var(--muted); font-size: 12px; }
.profile-option { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.profile-option strong { display: block; color: var(--text); font-size: 13px; line-height: 20px; font-weight: 500; }
.profile-option span { display: block; color: var(--text-secondary); font-size: 12px; line-height: 18px; font-weight: 400; }
.profile-option i { color: var(--accent); }
@media (max-width: 1060px) { .workspace-header { padding-inline: 20px; gap: 12px; } .header-profile { width: 180px; } .active-bucket, .switch-shortcut { display: none; } }
</style>
<style>
.profile-menu .el-select-dropdown__item { height: auto; padding: 10px 14px; }
.profile-menu { min-width: 310px !important; }
.profile-menu .el-select-dropdown__item.selected { background: var(--surface-alt); }
</style>
