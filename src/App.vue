<template>
  <AppLayout :version="version" :switching-profile="switchingProfile" @switch-profile="switchProfile">
    <router-view v-slot="{ Component }"><component :is="Component" ref="view" /></router-view>
  </AppLayout>
</template>

<script>
import AppLayout from '@/components/layout/AppLayout.vue'
import packageInfo from '../package.json'

export default {
  name: 'App',
  components: { AppLayout },
  data: () => ({ version: packageInfo.version, switchingProfile: false }),
  created() { this.$store.dispatch('loadAwsConfig') },
  methods: {
    async switchProfile(id) {
      const { state, getters } = this.$store
      if (this.switchingProfile || id === getters.activeProfileId || state.busyOperation || state.hasPendingUploads || state.switchingProfile) return
      this.switchingProfile = true
      try {
        // Settings owns its unsaved form, so it also owns the discard decision.
        const view = this.$refs.view
        if (view && view.onSwitchProfile) {
          await view.onSwitchProfile(id)
          return
        }
        await this.$store.dispatch('switchProfile', id)
        const path = getters.isConfigured ? '/files' : '/config'
        await this.$router.replace({ path, query: path === '/files' ? { path: getters.currentDirectory } : {} }).catch(() => {})
      } catch (error) {
        this.$message.error(error.message || '切换配置失败')
      } finally {
        this.switchingProfile = false
      }
    }
  }
}
</script>
