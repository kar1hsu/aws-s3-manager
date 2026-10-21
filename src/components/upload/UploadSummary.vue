<template>
  <section class="upload-summary">
    <p class="summary-stat">{{ files.length }} 个文件 <span>·</span> {{ totalSize }}</p>
    <p v-if="completedCount" class="summary-detail">已完成 {{ completedCount }} 个，待处理 {{ pendingCount }} 个</p>
    <div v-if="uploading || status" class="upload-progress" aria-live="polite">
      <div class="progress-heading" :class="status"><span>{{ statusText }}</span><b>{{ progress }}%</b></div>
      <el-progress :percentage="progress" :status="status || undefined" :stroke-width="4" :show-text="false" />
      <p v-if="currentFile" :title="currentFile">{{ currentFile }}</p>
    </div>
    <el-button class="upload-primary" type="primary" :loading="uploading" :disabled="disabled || !pendingCount || uploading" @click="$emit('upload')">
      <el-icon v-if="!uploading"><Upload /></el-icon>
      {{ uploading ? '正在上传' : hasFailures ? '重试失败并继续' : '开始上传' }}<span v-if="pendingCount && !uploading" class="button-count">{{ pendingCount }}</span>
    </el-button>
    <el-button v-if="uploading" class="summary-secondary" :disabled="stopRequested || disabled" @click="$emit('stop')">{{ stopRequested ? '当前文件完成后停止' : '完成当前后停止' }}</el-button>
    <el-button v-if="completedCount" class="summary-secondary" icon="Link" :disabled="uploading || disabled" @click="$emit('copy')">复制已上传链接</el-button>
    <p v-if="hasFailures && !uploading" class="summary-hint">仅重试失败和待上传的文件。</p>
  </section>
</template>

<script>
export default {
  name: 'UploadSummary',
  emits: ['upload', 'stop', 'copy'],
  props: {
    files: { type: Array, default: () => [] },
    pendingCount: { type: Number, default: 0 },
    completedCount: { type: Number, default: 0 },
    hasFailures: Boolean,
    uploading: Boolean,
    disabled: Boolean,
    stopRequested: Boolean,
    progress: { type: Number, default: 0 },
    status: { type: String, default: '' },
    statusText: { type: String, default: '' },
    currentFile: { type: String, default: '' }
  },
  computed: {
    totalSize() {
      const size = this.files.reduce((total, file) => total + (file.size || 0), 0)
      if (!size) return '0 B'
      const unit = Math.min(Math.floor(Math.log(size) / Math.log(1024)), 3)
      return `${Number((size / Math.pow(1024, unit)).toFixed(unit ? 1 : 0))} ${['B', 'KB', 'MB', 'GB'][unit]}`
    }
  }
}
</script>

<style scoped>
.upload-summary { margin: 0 18px; padding: 17px 0; border-top: 1px solid var(--line); }
.summary-stat { margin: 0 0 15px; color: var(--text); font-size: 13px; line-height: 1.5; }
.summary-stat > span { padding: 0 4px; color: var(--muted); }
.summary-detail { margin: -6px 0 15px; color: var(--text-secondary); font-size: 12px; }
.upload-primary, .summary-secondary { width: 100%; margin: 0; }
.upload-primary i { margin-right: 5px; }
.summary-secondary { margin-top: 9px; font-size: 12px; }
.upload-summary > .el-button + .el-button { margin-left: 0; }
.button-count { display: inline-block; margin-left: 10px; padding-left: 10px; border-left: 1px solid rgba(255, 255, 255, .35); font-family: var(--font-mono); }
.summary-hint { margin: 10px 0 0; color: var(--text-secondary); font-size: 12px; line-height: 1.65; }
.upload-progress { padding: 0 0 17px; }
.progress-heading { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 10px; color: var(--text-secondary); font-size: 12px; line-height: 1.5; }
.progress-heading b { font: 12px var(--font-mono); flex-shrink: 0; }
.progress-heading.success { color: var(--success); }
.progress-heading.exception { color: var(--danger); }
.progress-heading.warning { color: var(--accent); }
.upload-progress p { margin: 8px 0 0; font-size: 12px; color: var(--text-secondary); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
@media (max-width: 900px) and (min-width: 621px) { .upload-summary { margin: 18px 18px 18px 0; padding: 0 0 0 18px; border-top: 0; border-left: 1px solid var(--line); } }
</style>
