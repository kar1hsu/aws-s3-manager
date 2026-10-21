<template>
  <div class="empty-state"><el-icon class="empty-state__icon"><component :is="icon" /></el-icon><h3>{{ title }}</h3><p v-if="description">{{ description }}</p><div v-if="$slots.default" class="empty-state__actions"><slot /></div></div>
</template>
<script>
export default { name: 'EmptyState', props: { icon: { type: String, default: 'FolderOpened' }, title: { type: String, required: true }, description: String } }
</script>
<style scoped>
.empty-state { padding: 42px 24px; text-align: center; }
.empty-state__icon { display: inline-block; color: #9aa09e; font-size: 28px; }
h3 { margin: 18px 0 8px; font-size: 15px; font-weight: 550; color: var(--text); }
p { max-width: 340px; margin: 0 auto; font-size: 12px; line-height: 1.8; color: var(--muted); }
.empty-state__actions { margin-top: 20px; }
</style>
