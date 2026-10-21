<template>
  <section class="profile-panel" aria-label="已保存的连接">
    <div class="profile-heading"><h2>连接</h2><span>{{ profiles.length }}</span></div>
    <div class="profile-list">
      <button
        v-for="profile in profiles"
        :key="profile.id"
        class="profile-item"
        :class="{ 'is-active': profile.id === selectedId }"
        :disabled="disabled"
        :aria-current="profile.id === selectedId ? 'true' : null"
        @click="$emit('select', profile.id)"
      >
        <span class="profile-detail">
          <strong>{{ profile.name || '未命名连接' }}</strong>
          <span>{{ profile.bucketName || '等待配置' }}</span>
        </span>
        <el-icon v-if="profile.id === selectedId" class="selected-check"><Check /></el-icon>
      </button>
    </div>
    <button class="add-profile" :disabled="disabled" @click="$emit('add')"><el-icon><Plus /></el-icon>新建连接</button>
    <div class="profile-footer">
      <button class="remove-profile" title="删除当前连接" :disabled="disabled || profiles.length <= 1" @click="$emit('remove')"><el-icon><Delete /></el-icon>删除当前连接</button>
    </div>
  </section>
</template>

<script>
export default {
  name: 'ProfileList',
  emits: ['select', 'add', 'remove'],
  props: {
    profiles: { type: Array, default: () => [] },
    selectedId: { type: String, default: '' },
    disabled: Boolean
  }
}
</script>

<style scoped>
.profile-panel { display: flex; flex-direction: column; height: 100%; padding: 19px 10px 0; }
.profile-heading { display: flex; align-items: center; justify-content: space-between; padding: 0 9px 15px; }
.profile-heading h2 { margin: 0; font-size: 13px; font-weight: 600; color: var(--text-secondary); }
.profile-heading > span { color: var(--muted); font-size: 12px; }
.profile-list { display: flex; flex-direction: column; gap: 3px; max-height: 440px; overflow-y: auto; }
button { font: inherit; cursor: pointer; border: 0; background: none; }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
button:disabled { opacity: .45; cursor: not-allowed; }
.profile-item { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 58px; padding: 10px; border-radius: 4px; text-align: left; color: var(--text-secondary); transition: background .15s, color .15s; }
.profile-item:hover:not(:disabled) { background: var(--surface-alt); }
.profile-item.is-active { background: var(--accent-soft); color: var(--accent); }
.profile-item.is-active:hover:not(:disabled) { background: var(--accent-soft); }
.profile-detail { min-width: 0; display: flex; flex: 1; flex-direction: column; gap: 4px; }
.profile-detail strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 600; }
.profile-detail > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: var(--muted); }
.selected-check { flex-shrink: 0; font-size: 13px; }
.add-profile { display: flex; align-items: center; justify-content: center; width: 100%; gap: 7px; margin: 12px 0 16px; padding: 9px 8px; font-size: 13px; font-weight: 500; color: var(--text-secondary); border: 1px solid var(--line); border-radius: 4px; }
.add-profile:hover:not(:disabled) { color: var(--accent); border-color: var(--accent); background: var(--accent-soft); }
.profile-footer { margin: auto -10px 0; padding: 20px 15px; border-top: 1px solid var(--line); }
.remove-profile { display: flex; align-items: center; justify-content: center; width: 100%; gap: 7px; font-size: 12px; color: var(--muted); }
.remove-profile:hover:not(:disabled) { color: var(--danger); }
@media (max-width: 1050px) {
  .profile-panel { flex-direction: row; flex-wrap: wrap; align-items: center; gap: 12px; padding: 10px 12px; height: auto; }
  .profile-heading { gap: 8px; padding: 0 4px; }
  .profile-list { flex-direction: row; flex: 1; min-width: 180px; overflow-x: auto; }
  .profile-item { min-height: 48px; width: auto; min-width: 150px; max-width: 215px; padding: 8px 10px; }
  .add-profile { width: auto; margin: 0; padding: 9px; white-space: nowrap; }
  .profile-footer { padding: 0 2px; margin: 0; border: 0; }
  .remove-profile { font-size: 0; }
  .remove-profile .el-icon { font-size: 16px; }
}
</style>
