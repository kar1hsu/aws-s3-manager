<template>
  <el-dialog :model-value="visible" width="min(820px, 90%)" class="file-preview-dialog" append-to-body @update:model-value="$emit('update:visible', $event)" @closed="$emit('closed')">
    <template #header="{ titleId }">
      <div class="preview-heading">
        <span class="preview-heading-icon"><el-icon><Picture /></el-icon></span>
        <div><h2 :id="titleId">{{ name || '图片预览' }}</h2><p>图片预览</p></div>
      </div>
    </template>
    <div v-if="row" class="preview-content">
      <div class="image-stage">
        <el-image v-if="url" :src="url" fit="contain" class="preview-image">
          <template #placeholder><div class="preview-feedback"><el-icon class="is-loading"><Loading /></el-icon><span>正在加载图片…</span></div></template>
          <template #error><div class="preview-feedback"><el-icon><Picture /></el-icon><span>暂时无法预览这张图片</span><small>请检查读取权限，或下载原文件查看。</small></div></template>
        </el-image>
        <div v-else class="preview-feedback"><el-icon class="is-loading"><Loading /></el-icon><span>正在准备预览…</span></div>
      </div>
      <div class="preview-details">
        <div class="preview-detail"><span>对象路径</span><code>{{ row.Key }}</code></div>
        <div class="preview-detail"><span>文件大小</span><strong>{{ size }}</strong></div>
      </div>
    </div>
    <template #footer>
      <div class="preview-footer">
        <span><el-icon><CircleCheck /></el-icon>直接从 S3 读取</span>
        <div>
          <el-button v-if="row" icon="Link" @click="$emit('copy-link', row)">复制链接</el-button>
          <el-button v-if="row" type="primary" icon="Download" @click="$emit('download', row)">下载原文件</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script>
export default {
  name: 'FilePreview',
  emits: ['update:visible', 'closed', 'copy-link', 'download'],
  props: {
    visible: Boolean,
    row: { type: Object, default: null },
    url: { type: String, default: '' },
    name: { type: String, default: '' },
    size: { type: String, default: '' }
  }
}
</script>

<style scoped>
.preview-heading { display: flex; align-items: center; gap: 10px; padding-right: 24px; }
.preview-heading-icon { flex: 0 0 24px; width: 24px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); font-size: 22px; }
.preview-heading h2 { margin: 0; color: var(--text); font-size: 15px; line-height: 22px; overflow-wrap: anywhere; }
.preview-heading p { margin: 3px 0 0; color: var(--muted); font-size: 12px; }
.image-stage { height: 390px; border: 1px solid var(--line); border-radius: 9px; overflow: hidden; background-color: #faf9f7; background-image: linear-gradient(45deg, #eeedea 25%, transparent 25%), linear-gradient(-45deg, #eeedea 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eeedea 75%), linear-gradient(-45deg, transparent 75%, #eeedea 75%); background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0; }
.preview-image { width: 100%; height: 100%; }
.preview-image :deep(.el-image__inner) { padding: 20px; box-sizing: border-box; }
.preview-feedback { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--text-secondary); }
.preview-feedback i { font-size: 28px; color: var(--muted); }
.preview-feedback small { color: var(--muted); font-size: 12px; }
.preview-details { display: flex; flex-direction: column; gap: 12px; margin-top: 22px; }
.preview-detail { display: flex; align-items: baseline; gap: 22px; font-size: 12px; }
.preview-detail > span { flex: 0 0 60px; color: var(--muted); }
.preview-detail code { color: var(--text-secondary); font-family: var(--font-mono); font-size: 12px; overflow-wrap: anywhere; }
.preview-detail strong { font-size: 12px; font-weight: 500; color: var(--text-secondary); }
.preview-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.preview-footer > span { color: var(--muted); font-size: 12px; }
.preview-footer > span i { color: var(--success); margin-right: 5px; }
</style>
