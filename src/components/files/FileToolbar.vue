<template>
  <div class="file-toolbar">
    <div class="directory-bar">
      <button class="icon-control back-control" type="button" title="上一级目录" aria-label="上一级目录" :disabled="!currentPath.length || searchMode" @click="$emit('parent')">
        <el-icon><Back /></el-icon>
      </button>
      <nav class="directory-crumbs" aria-label="当前目录">
        <button class="root-crumb" type="button" @click="$emit('root')"><el-icon><Box /></el-icon>{{ bucketName || '根目录' }}</button>
        <template v-for="(part, index) in currentPath" :key="index">
          <span class="crumb-divider">/</span>
          <button type="button" :class="{ 'current-crumb': index === currentPath.length - 1 }" @click="$emit('navigate-index', index)">{{ part }}</button>
        </template>
      </nav>
      <button class="icon-control path-control" type="button" title="输入目录路径" aria-label="输入目录路径" :aria-expanded="pathVisible" @click="togglePath"><el-icon><Edit /></el-icon></button>
      <div class="directory-actions">
        <el-tooltip content="刷新文件列表" placement="top">
          <el-button class="refresh-control" icon="Refresh" aria-label="刷新文件列表" :loading="loading" @click="$emit('refresh')" />
        </el-tooltip>
        <el-button icon="FolderAdd" :disabled="searchMode || loading" @click="$emit('create-folder')">新建文件夹</el-button>
      </div>
    </div>

    <div v-if="pathVisible" class="path-entry">
      <span>前往目录</span>
      <el-input ref="pathField" :model-value="pathInput" placeholder="例如 image/game/，按 Enter 前往" aria-label="目录路径" @update:model-value="$emit('update:pathInput', $event)" @keyup.enter="$emit('navigate', pathInput)">
        <template #append><el-button icon="Right" @click="$emit('navigate', pathInput)">前往</el-button></template>
      </el-input>
      <button class="icon-control" type="button" title="收起路径输入" aria-label="收起路径输入" @click="pathVisible = false"><el-icon><Close /></el-icon></button>
    </div>

    <div class="search-bar">
      <div class="search-group">
        <el-select :model-value="searchScope" class="scope-select" aria-label="搜索范围" @update:model-value="$emit('update:searchScope', $event)" @change="$emit('scope-change')">
          <el-option label="当前目录" value="folder" />
          <el-option label="全局前缀" value="global" />
        </el-select>
        <el-input :model-value="searchInput" :placeholder="searchScope === 'folder' ? '搜索当前目录中的文件…' : '输入对象前缀，如 image/game/'" clearable prefix-icon="Search" class="search-input" aria-label="搜索文件" @update:model-value="$emit('update:searchInput', $event)" @keyup.enter="$emit('search')" @clear="$emit('clear-search')" />
      </div>
      <el-button v-if="searchScope === 'global'" type="primary" @click="$emit('search')">搜索</el-button>
      <el-checkbox :model-value="showObjectKey" class="key-toggle" :disabled="searchMode" @update:model-value="$emit('update:showObjectKey', $event)">完整 Key</el-checkbox>
    </div>
    <div v-if="searchMode" class="search-context">
      <span><el-icon><Search /></el-icon>全局前缀 <code>{{ searchPrefix }}</code></span>
      <button type="button" @click="$emit('clear-search')">退出搜索 <el-icon><Close /></el-icon></button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FileToolbar',
  emits: ['parent', 'root', 'navigate-index', 'navigate', 'refresh', 'create-folder', 'scope-change', 'search', 'clear-search', 'update:pathInput', 'update:searchScope', 'update:searchInput', 'update:showObjectKey'],
  props: {
    currentPath: { type: Array, default: () => [] },
    bucketName: { type: String, default: '' },
    pathInput: { type: String, default: '' },
    searchScope: { type: String, default: 'folder' },
    searchInput: { type: String, default: '' },
    searchMode: Boolean,
    searchPrefix: { type: String, default: '' },
    showObjectKey: Boolean,
    loading: Boolean
  },
  data() {
    return { pathVisible: false }
  },
  methods: {
    togglePath() {
      this.pathVisible = !this.pathVisible
      if (this.pathVisible) this.$nextTick(() => this.$refs.pathField.focus())
    }
  }
}
</script>

<style scoped>
.file-toolbar { padding: 12px 16px; border-bottom: 1px solid var(--line); }
.file-toolbar :deep(.el-input), .file-toolbar :deep(.el-select) { --el-input-height: 32px; --el-component-size: 32px; }
.file-toolbar :deep(.el-input__inner) { line-height: 30px; }
.file-toolbar :deep(.el-input__icon) { line-height: 32px; }
.file-toolbar :deep(.el-button) { min-height: 32px; padding-top: 8px; padding-bottom: 8px; }
.directory-bar, .directory-crumbs, .directory-actions, .search-bar, .search-group, .path-entry { display: flex; align-items: center; }
.directory-bar { gap: 8px; min-height: 32px; }
.directory-crumbs { flex: 1; gap: 10px; min-width: 0; overflow-x: auto; scrollbar-width: thin; }
.directory-crumbs button { background: none; border: 0; padding: 4px 0; font: inherit; font-size: 13px; color: var(--text-secondary); cursor: pointer; white-space: nowrap; }
.directory-crumbs button:hover { color: var(--accent); }
.directory-crumbs .root-crumb { display: flex; align-items: center; gap: 7px; }
.root-crumb i { color: var(--muted); font-size: 16px; }
.directory-crumbs .current-crumb { color: var(--text); font-weight: 600; }
.crumb-divider { color: #c6c8cd; font-size: 12px; }
.icon-control { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; flex: 0 0 30px; border: 0; border-radius: 6px; background: transparent; color: var(--text-secondary); cursor: pointer; font-size: 16px; }
.icon-control:hover:not(:disabled) { background: var(--bg); color: var(--text); }
.icon-control:disabled { color: #c7c9cc; cursor: not-allowed; }
.directory-actions { gap: 8px; margin-left: 10px; }
.directory-actions :deep(.el-button + .el-button) { margin-left: 0; }
.directory-actions :deep(.refresh-control) { padding-left: 10px; padding-right: 10px; }
.search-bar { margin-top: 10px; gap: 12px; }
.search-group { flex: 1; min-width: 0; gap: 8px; }
.scope-select { flex: 0 0 116px; width: 116px; }
.search-input { flex: 1; min-width: 150px; }
.key-toggle { margin-left: auto; padding-left: 5px; }
.key-toggle :deep(.el-checkbox__label) { font-size: 12px; }
.path-entry { margin-top: 10px; padding: 8px 10px; gap: 10px; border-radius: 4px; background: var(--surface-alt); }
.path-entry > span { white-space: nowrap; font-size: 12px; color: var(--text-secondary); }
.path-entry :deep(.el-input__inner) { font-family: var(--font-mono); font-size: 12px; }
.search-context { display: flex; align-items: center; gap: 14px; margin-top: 14px; font-size: 12px; color: var(--text-secondary); }
.search-context > span { display: inline-flex; align-items: center; gap: 7px; min-width: 0; }
.search-context code { color: var(--accent); font-family: var(--font-mono); overflow-wrap: anywhere; }
.search-context button { flex-shrink: 0; border: 0; padding: 3px 0; background: transparent; color: var(--text-secondary); cursor: pointer; font: inherit; }
@media (max-width: 1000px) {
  .file-toolbar { padding: 12px; }
  .directory-actions { gap: 5px; margin-left: 0; }
  .directory-actions :deep(.el-button) { padding-left: 9px; padding-right: 9px; }
  .directory-crumbs { gap: 7px; }
}
</style>
