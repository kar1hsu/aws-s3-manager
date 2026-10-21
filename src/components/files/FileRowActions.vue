<template>
  <div class="file-row-actions">
    <el-tooltip v-if="!directory" content="复制文件链接" placement="top">
      <button type="button" class="row-action" aria-label="复制文件链接" @click="$emit('copy-link', row)"><el-icon><Link /></el-icon></button>
    </el-tooltip>
    <el-dropdown trigger="click" placement="bottom-end" @command="handleCommand">
      <button type="button" class="row-action" aria-label="更多文件操作"><el-icon><MoreFilled /></el-icon></button>
      <template #dropdown>
        <el-dropdown-menu class="file-action-menu">
          <el-dropdown-item v-if="previewable" command="preview" icon="View">预览图片</el-dropdown-item>
          <el-dropdown-item v-if="!directory" command="download" icon="Download">下载原文件</el-dropdown-item>
          <el-dropdown-item command="copy-key" icon="DocumentCopy">复制对象 Key</el-dropdown-item>
          <el-dropdown-item command="delete" icon="Delete" divided class="delete-action">{{ directory ? '删除文件夹' : '删除文件' }}</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script>
export default {
  name: 'FileRowActions',
  emits: ['copy-link', 'preview', 'download', 'copy-key', 'delete'],
  props: {
    row: { type: Object, required: true },
    directory: Boolean,
    previewable: Boolean
  },
  methods: {
    handleCommand(command) { this.$emit(command, this.row) }
  }
}
</script>

<style scoped>
.file-row-actions { display: flex; align-items: center; justify-content: flex-end; gap: 7px; }
.row-action { display: inline-flex; align-items: center; justify-content: center; width: 29px; height: 29px; border: 0; background: transparent; color: var(--text-secondary); font-size: 16px; border-radius: 6px; cursor: pointer; }
.row-action:hover, .row-action:focus-visible { color: var(--accent); background: var(--accent-soft); }
.file-action-menu { min-width: 160px; }
.delete-action { color: var(--danger); }
</style>
