<template>
  <section class="upload-queue">
    <header class="queue-heading">
      <div><h2>上传队列</h2><span class="queue-count">{{ files.length }}</span></div>
      <el-button text :disabled="!files.length || uploading" @click="$emit('clear')">清空队列</el-button>
    </header>
    <div v-if="files.length" class="queue-table" role="list" aria-label="待上传文件">
      <div v-for="file in files" :key="file.uid" class="queue-row" role="listitem">
        <div class="file-icon" :class="{ 'is-image': isImage(file.name) }"><el-icon><Picture v-if="isImage(file.name)" /><Document v-else /></el-icon></div>
        <div class="file-detail">
          <div class="file-name" :title="file.name">{{ file.name }}</div>
          <div class="file-meta"><span>{{ formatSize(file.size) }}</span><span class="file-phase" :class="file.phase"><el-icon :class="{ 'is-loading': file.phase === 'uploading' }"><component :is="phaseIcon(file.phase)" /></el-icon>{{ phaseLabel(file) }}</span></div>
          <el-progress v-if="file.phase === 'uploading'" :percentage="file.progress" :stroke-width="3" :show-text="false" class="file-progress" />
          <p v-if="file.error" class="file-error">{{ file.error }}</p>
        </div>
        <div class="file-actions">
          <el-tooltip v-if="file.phase === 'success'" content="复制访问链接" placement="top"><el-button text icon="Link" aria-label="复制访问链接" @click="$emit('copy', file)" /></el-tooltip>
          <el-button text :disabled="uploading" class="remove-action" @click="$emit('remove', file)">移除</el-button>
        </div>
      </div>
    </div>
    <EmptyState v-else class="queue-empty" icon="Files" title="暂无待上传文件" />
    <footer v-if="files.length" class="queue-footer"><span>{{ completedCount }} 个已上传</span><span>{{ files.length - completedCount }} 个待处理</span></footer>
  </section>
</template>

<script>
import EmptyState from '@/components/ui/EmptyState.vue'

export default {
  name: 'UploadQueue',
  emits: ['clear', 'remove', 'copy'],
  components: { EmptyState },
  props: { files: { type: Array, default: () => [] }, uploading: Boolean },
  computed: { completedCount() { return this.files.filter(file => file.phase === 'success').length } },
  methods: {
    isImage(name) { return /\.(png|jpe?g|webp|gif|svg|avif|heic|heif|bmp|tiff?|ico)$/i.test(name) },
    formatSize(size) {
      if (!size) return '0 B'
      const unit = Math.min(Math.floor(Math.log(size) / Math.log(1024)), 3)
      return `${Number((size / Math.pow(1024, unit)).toFixed(unit ? 1 : 0))} ${['B', 'KB', 'MB', 'GB'][unit]}`
    },
    phaseLabel(file) { return { pending: '待上传', success: '已上传', failed: '上传失败' }[file.phase] || `上传中 ${file.progress}%` },
    phaseIcon(phase) { return { pending: 'Clock', success: 'CircleCheck', failed: 'Warning' }[phase] || 'Loading' }
  }
}
</script>

<style scoped>
.upload-queue { border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); overflow: hidden; }
.queue-heading { min-height: 50px; padding: 0 18px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); }
.queue-heading > div { display: flex; align-items: center; gap: 10px; }
h2 { font-size: 14px; font-weight: 600; margin: 0; color: var(--text); }
.queue-count { font: 12px var(--font-mono); color: var(--text-secondary); }
.queue-heading .el-button { font-size: 12px; color: var(--text-secondary); }
.queue-heading .el-button.is-disabled { color: var(--muted); }
.queue-table { max-height: 380px; overflow-y: auto; }
.queue-row { display: flex; align-items: center; gap: 12px; padding: 13px 18px; border-bottom: 1px solid var(--line); }
.queue-row:last-child { border-bottom: 0; }
.file-icon { width: 25px; height: 36px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--text-secondary); font-size: 21px; }
.file-icon.is-image { color: var(--text-secondary); }
.file-detail { min-width: 0; flex: 1; }
.file-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 500; line-height: 1.5; color: var(--text); }
.file-meta { display: flex; gap: 12px; align-items: center; margin-top: 4px; font-size: 12px; color: var(--text-secondary); }
.file-meta > span:first-child { font-family: var(--font-mono); }
.file-phase { display: inline-flex; gap: 4px; align-items: center; }
.file-phase.success { color: var(--success); }
.file-phase.failed { color: var(--danger); }
.file-phase.uploading { color: var(--accent); }
.file-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.file-actions .el-button { margin: 0; padding: 7px 0; font-size: 12px; }
.file-actions .remove-action { color: var(--text-secondary); }
.file-actions .remove-action:hover { color: var(--danger); }
.file-actions .remove-action.is-disabled { color: var(--muted); }
.file-progress { margin-top: 9px; }
.file-error { margin: 6px 0 0; color: var(--danger); font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.queue-footer { display: flex; justify-content: space-between; padding: 11px 18px; border-top: 1px solid var(--line); font-size: 12px; color: var(--text-secondary); }
.queue-empty { padding: 42px 20px; }
.queue-empty :deep(.empty-state__icon) { width: auto; height: auto; border: 0; border-radius: 0; background: transparent; font-size: 24px; }
.queue-empty :deep(h3) { margin: 12px 0 0; font-size: 13px; font-weight: 400; color: var(--text-secondary); }
@media (max-width: 620px) { .queue-heading, .queue-footer { padding-left: 16px; padding-right: 16px; } .queue-row { padding: 16px; gap: 10px; } .file-actions { gap: 8px; } }
</style>
