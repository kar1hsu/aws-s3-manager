<template>
  <header class="page-header">
    <div class="page-header__copy">
      <h1>{{ title }}</h1><p v-if="description">{{ description }}</p>
    </div>
    <div v-if="$slots.default" class="page-header__actions"><slot /></div>
  </header>
</template>
<script>
export default { name: 'PageHeader', props: { title: { type: String, required: true }, description: String } }
</script>
<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; gap: 20px; min-height: 36px; margin-bottom: 16px; }
.page-header__copy { min-width: 0; }
h1 { font-size: 20px; line-height: 1.4; font-weight: 600; color: var(--text); margin: 0; }
p { margin: 9px 0 0; font-size: 12px; line-height: 1.6; color: var(--text-secondary); }
.page-header__actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.page-header__actions :deep(.el-button + .el-button) { margin-left: 0; }
@media (max-width: 1020px) { .page-header { gap: 16px; } .page-header__actions { flex-wrap: wrap; justify-content: flex-end; } }
</style>
