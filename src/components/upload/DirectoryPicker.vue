<template>
  <el-dialog title="选择上传目录" :model-value="visible" width="460px" append-to-body @update:model-value="$emit('update:visible', $event)" @open="$emit('open')">
    <p class="picker-hint">选择现有文件夹，或直接使用根目录。</p>
    <div class="directory-browser">
      <button type="button" class="root-directory" :class="{ 'is-selected': !selected }" :disabled="disabled" @click="selectRoot"><el-icon><Box /></el-icon><span>{{ bucket }}</span><span class="root-label">根目录</span></button>
      <el-tree v-if="visible" ref="tree" class="dir-tree" :class="{ 'is-disabled': disabled }" :aria-disabled="disabled" :props="treeProps" node-key="path" highlight-current lazy :load="loadNode" empty-text="暂无子目录" @node-click="$emit('select', $event)">
        <template #default="{ data }"><span class="tree-folder"><el-icon><Folder /></el-icon><span>{{ data.name }}</span></span></template>
      </el-tree>
    </div>
    <div class="selected-directory"><span>已选目录</span><code>/{{ selected ? selected.path : '' }}</code></div>
    <template #footer><el-button @click="$emit('update:visible', false)">取消</el-button><el-button type="primary" :disabled="disabled" @click="$emit('confirm')">使用此目录</el-button></template>
  </el-dialog>
</template>

<script>
export default {
  name: 'DirectoryPicker',
  emits: ['update:visible', 'open', 'select', 'confirm'],
  props: {
    visible: Boolean,
    disabled: Boolean,
    bucket: { type: String, default: '' },
    treeProps: { type: Object, required: true },
    loadNode: { type: Function, required: true },
    selected: { type: Object, default: null }
  },
  methods: {
    selectRoot() {
      if (this.disabled) return
      this.$emit('select', null)
      if (this.$refs.tree) this.$refs.tree.setCurrentKey(null)
    }
  }
}
</script>

<style scoped>
.picker-hint { color: var(--text-secondary); font-size: 12px; margin: 0 0 16px; }
.directory-browser { padding: 8px; border: 1px solid var(--line); border-radius: 9px; min-height: 210px; max-height: 340px; overflow: auto; }
.root-directory { display: flex; align-items: center; gap: 9px; width: 100%; padding: 11px; border: 0; border-radius: 6px; text-align: left; font-size: 12px; background: transparent; color: var(--text); cursor: pointer; }
.root-directory i { font-size: 16px; color: var(--accent); }
.root-directory > span:first-of-type { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.root-directory.is-selected { background: var(--accent-soft); }
.root-label { margin-left: auto; color: var(--text-secondary); font-size: 12px; flex-shrink: 0; }
.dir-tree { margin-top: 6px; }
.dir-tree.is-disabled { pointer-events: none; opacity: .6; }
.tree-folder { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; overflow: hidden; }
.tree-folder i { color: var(--accent); font-size: 15px; }
.tree-folder span { text-overflow: ellipsis; overflow: hidden; }
.selected-directory { display: flex; gap: 12px; align-items: baseline; margin-top: 17px; font-size: 12px; }
.selected-directory > span { color: var(--muted); flex-shrink: 0; }
.selected-directory code { color: var(--text-secondary); font: 12px var(--font-mono); overflow-wrap: anywhere; }
</style>
