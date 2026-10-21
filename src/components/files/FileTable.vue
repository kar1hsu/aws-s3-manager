<template>
  <div class="file-browser-table">
    <div class="list-summary" :class="{ 'has-selection': selectedCount }">
      <div v-if="selectedCount" class="selection-summary">
        <span class="selection-count">已选 {{ selectedCount }} 项</span>
        <el-button size="small" icon="Link" :disabled="!selectedFileCount" @click="$emit('copy-selected')">复制链接<span v-if="selectedFileCount"> · {{ selectedFileCount }}</span></el-button>
        <el-button size="small" class="delete-selected" icon="Delete" @click="$emit('delete-selected')">删除</el-button>
        <button type="button" class="clear-selection" @click="clearSelection">取消</button>
      </div>
      <span v-else class="list-count"><strong>{{ total }}</strong> 个项目<span v-if="filtered" class="filtered-label"> · 筛选结果</span></span>
      <el-select :model-value="sortBy" size="small" class="sort-select" aria-label="文件排序" @update:model-value="$emit('update:sortBy', $event)">
        <el-option label="名称 A → Z" value="name" />
        <el-option label="最近修改" value="time" />
        <el-option label="文件大小" value="size" />
      </el-select>
    </div>

    <el-table ref="table" :data="rows" row-key="Key" class="files-table" @selection-change="$emit('selection-change', $event)" @row-dblclick="openRow">
      <el-table-column type="selection" width="44" align="center" />
      <el-table-column label="文件名称" min-width="230">
        <template #default="scope">
          <div class="file-item">
            <span class="file-symbol" :class="{ 'is-folder': presentation.isDirectory(scope.row), 'is-image': presentation.canPreview(scope.row) }"><el-icon><component :is="presentation.icon(scope.row)" /></el-icon></span>
            <div class="file-label">
              <button v-if="presentation.isDirectory(scope.row)" type="button" class="file-title dir-link" @click="$emit('navigate', scope.row.Key)">{{ presentation.name(scope.row) }}</button>
              <button v-else-if="presentation.canPreview(scope.row)" type="button" class="file-title preview-name" @click="$emit('preview', scope.row)">{{ presentation.name(scope.row) }}</button>
              <span v-else class="file-title file-name">{{ presentation.name(scope.row) }}</span>
              <span v-if="showObjectKey" class="object-key" :title="scope.row.Key">{{ scope.row.Key }}</span>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="修改时间" min-width="144">
        <template #default="scope"><span class="modified-date">{{ presentation.date(scope.row.LastModified) }}</span></template>
      </el-table-column>
      <el-table-column label="大小" width="90" align="right">
        <template #default="scope"><span class="file-size">{{ presentation.isDirectory(scope.row) ? '—' : presentation.size(scope.row.Size) }}</span></template>
      </el-table-column>
      <el-table-column label="操作" width="98" align="right">
        <template #default="scope">
          <FileRowActions :row="scope.row" :directory="presentation.isDirectory(scope.row)" :previewable="presentation.canPreview(scope.row)" @copy-link="$emit('copy-link', $event)" @copy-key="$emit('copy-key', $event)" @download="$emit('download', $event)" @preview="$emit('preview', $event)" @delete="$emit('delete', $event)" />
        </template>
      </el-table-column>
      <template #empty><slot name="empty" /></template>
    </el-table>

    <div class="list-footer">
      <span class="list-hint"><el-icon><InfoFilled /></el-icon>点击图片名称即可预览</span>
      <el-pagination :current-page="currentPage" :page-sizes="[10, 20, 50, 100]" :page-size="pageSize" layout="sizes, prev, pager, next" :total="total" @update:page-size="$emit('size-change', $event)" @update:current-page="$emit('page-change', $event)" />
    </div>
  </div>
</template>

<script>
import FileRowActions from '@/components/files/FileRowActions.vue'

export default {
  name: 'FileTable',
  emits: ['copy-selected', 'delete-selected', 'update:sortBy', 'selection-change', 'navigate', 'preview', 'copy-link', 'copy-key', 'download', 'delete', 'size-change', 'page-change'],
  components: { FileRowActions },
  props: {
    rows: { type: Array, default: () => [] },
    presentation: { type: Object, required: true },
    selectedCount: { type: Number, default: 0 },
    selectedFileCount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    currentPage: { type: Number, default: 1 },
    pageSize: { type: Number, default: 20 },
    sortBy: { type: String, default: 'name' },
    showObjectKey: Boolean,
    filtered: Boolean
  },
  methods: {
    clearSelection() { if (this.$refs.table) this.$refs.table.clearSelection() },
    toggleRowSelection(row, selected) { if (this.$refs.table) this.$refs.table.toggleRowSelection(row, selected) },
    openRow(row) {
      if (this.presentation.isDirectory(row)) this.$emit('navigate', row.Key)
      else if (this.presentation.canPreview(row)) this.$emit('preview', row)
    }
  }
}
</script>

<style scoped>
.list-summary { min-height: 40px; padding: 5px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--line); }
.list-count { color: var(--text-secondary); font-size: 12px; }
.list-count strong { font-weight: 600; color: var(--text); }
.filtered-label { color: var(--muted); }
.sort-select { width: 124px; flex-shrink: 0; }
.sort-select :deep(.el-select__wrapper) { box-shadow: none; background: transparent; color: var(--text-secondary); font-size: 12px; }
.has-selection { background: var(--accent-soft); }
.selection-summary { display: flex; gap: 8px; align-items: center; }
.selection-count { font-size: 12px; font-weight: 600; color: var(--accent-hover); margin-right: 6px; }
.selection-summary :deep(.el-button + .el-button) { margin-left: 0; }
.selection-summary :deep(.el-button--small) { padding: 6px 9px; background: var(--surface); }
.selection-summary :deep(.delete-selected) { color: var(--danger); }
.clear-selection { background: none; padding: 4px; border: 0; font-size: 12px; color: var(--text-secondary); cursor: pointer; }
.file-item { display: flex; align-items: center; gap: 10px; min-width: 0; }
.file-symbol { flex: 0 0 22px; width: 22px; height: 24px; display: flex; align-items: center; justify-content: center; color: #7d858e; font-size: 22px; }
.file-symbol.is-folder { color: #b08b45; }
.file-symbol.is-image { color: #6f897d; }
.file-label { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.file-title { display: block; max-width: 100%; padding: 0; border: 0; background: none; font-family: inherit; font-size: 13px; font-weight: 500; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 20px; text-align: left; }
button.file-title { cursor: pointer; }
button.file-title:hover { color: var(--accent); }
.object-key { color: var(--muted); font-size: 12px; line-height: 16px; }
.object-key { font-family: var(--font-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.modified-date { color: var(--text-secondary); font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.file-size { color: var(--text-secondary); font-family: var(--font-mono); font-size: 12px; white-space: nowrap; }
.files-table { width: 100%; }
.files-table :deep(th.el-table__cell) { height: 34px; background: var(--surface-alt); font-size: 12px; font-weight: 500; color: var(--text-secondary); padding: 5px 0; }
.files-table :deep(td.el-table__cell) { height: 42px; padding: 6px 0; border-bottom-color: #f0efec; }
.files-table :deep(.el-table-column--selection .cell) { display: flex; align-items: center; justify-content: center; padding: 0; overflow: visible; text-overflow: clip; }
.files-table :deep(.el-table-column--selection .el-checkbox) { display: inline-flex; margin: 0; }
.files-table :deep(.el-table__row > td:last-child .cell),  .files-table :deep(.el-table__header-wrapper th:last-child .cell) { padding-right: 16px; }
.files-table :deep(.el-table__empty-block) { min-height: 300px; }
.files-table :deep(.el-table__empty-text) { width: 100%; line-height: normal; }
.files-table::before { display: none; }
.list-footer { min-height: 46px; padding: 8px 12px 8px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.list-hint { color: var(--muted); font-size: 12px; white-space: nowrap; }
.list-hint i { margin-right: 5px; }
.list-footer :deep(.el-pagination) { padding: 0; white-space: nowrap; }
.list-footer :deep(.el-pagination__sizes .el-select) { width: 100px; margin: 0; }
.list-footer :deep(.el-pagination__sizes) { margin-right: 8px; }
@media (max-width: 1100px) {
  .list-summary { padding-left: 16px; padding-right: 16px; }
  .selection-summary { gap: 5px; }
  .selection-count { margin-right: 0; }
  .list-hint { display: none; }
  .list-footer { justify-content: flex-end; }
}
</style>
