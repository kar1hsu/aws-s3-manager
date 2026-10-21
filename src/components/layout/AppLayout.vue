<template>
  <div class="app-shell">
    <AppSidebar :version="version" @help="helpVisible = true" />
    <div class="app-workspace">
      <WorkspaceHeader :switching="switchingProfile" @switch-profile="$emit('switch-profile', $event)" />
      <main v-loading="switchingProfile" class="workspace-main"><div class="workspace-content"><slot /></div></main>
    </div>
    <QuickGuide v-model:visible="helpVisible" />
  </div>
</template>
<script>
import AppSidebar from './AppSidebar.vue'
import WorkspaceHeader from './WorkspaceHeader.vue'
import QuickGuide from './QuickGuide.vue'
export default {
  name: 'AppLayout',
  components: { AppSidebar, WorkspaceHeader, QuickGuide },
  props: { version: String, switchingProfile: Boolean },
  emits: ['switch-profile'],
  data: () => ({ helpVisible: false })
}
</script>
<style scoped>
.app-shell { display: flex; height: 100vh; min-height: 600px; overflow: hidden; background: var(--bg); }
.app-workspace { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.workspace-main { flex: 1; min-height: 0; overflow-y: auto; padding: 22px 24px 24px; }
.workspace-content { max-width: 1480px; margin: 0 auto; }
@media (max-width: 1060px) { .workspace-main { padding: 20px; } }
</style>
