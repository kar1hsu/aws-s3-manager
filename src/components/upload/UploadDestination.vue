<template>
  <section class="upload-destination">
    <div class="section-heading"><h2>上传到</h2><el-button text :disabled="disabled" @click="$emit('browse')">浏览目录 <el-icon><ArrowRight /></el-icon></el-button></div>
    <div class="bucket-label"><el-icon><Box /></el-icon><span :title="bucket">{{ bucket || '尚未选择 Bucket' }}</span></div>
    <nav class="directory-crumbs" aria-label="目标目录">
      <button type="button" :disabled="disabled" @click="$emit('root')"><el-icon><Folder /></el-icon>根目录</button>
      <template v-for="(segment, index) in path" :key="index"><span class="crumb-divider">/</span><button type="button" :disabled="disabled" @click="$emit('navigate', index)">{{ segment }}</button></template>
    </nav>
    <label for="upload-directory">目录路径</label>
    <el-input id="upload-directory" :model-value="modelValue" :disabled="disabled" class="directory-input" placeholder="例如 image/game" @update:model-value="$emit('update:modelValue', $event)" @keyup.enter="$emit('apply')">
      <template #append><el-button icon="Check" :disabled="disabled" aria-label="使用此目录" title="使用此目录" @click="$emit('apply')" /></template>
    </el-input>
    <p class="directory-hint">可以直接输入新目录，上传时自动创建。</p>
  </section>
</template>

<script>
export default {
  name: 'UploadDestination',
  emits: ['browse', 'root', 'navigate', 'update:modelValue', 'apply'],
  props: { bucket: { type: String, default: '' }, path: { type: Array, default: () => [] }, modelValue: { type: String, default: '' }, disabled: Boolean }
}
</script>

<style scoped>
.upload-destination { padding: 18px; }
.section-heading { display: flex; justify-content: space-between; align-items: center; margin-bottom: 17px; }
h2 { margin: 0; font-size: 14px; font-weight: 600; color: var(--text); }
.section-heading .el-button { padding: 0; font-size: 12px; }
.section-heading .el-button i { margin-left: 3px; font-size: 10px; }
.bucket-label { display: flex; align-items: center; gap: 8px; color: var(--text); font-size: 13px; font-weight: 500; }
.bucket-label i { color: var(--accent); font-size: 17px; }
.bucket-label span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-mono); font-size: 12px; }
.directory-crumbs { display: flex; align-items: center; flex-wrap: wrap; gap: 3px; margin: 10px 0 16px; color: var(--text-secondary); }
.directory-crumbs button { border: 0; padding: 3px 4px; background: transparent; color: var(--text-secondary); border-radius: 4px; cursor: pointer; font: inherit; font-size: 12px; overflow-wrap: anywhere; max-width: 100%; }
.directory-crumbs button i { margin-right: 5px; }
.directory-crumbs button:hover { background: var(--accent-soft); color: var(--accent); }
.directory-crumbs button:disabled { cursor: default; opacity: .6; }
.crumb-divider { color: var(--muted); font-size: 12px; }
label { display: block; margin-bottom: 8px; font-size: 12px; font-weight: 500; color: var(--text-secondary); }
.directory-input :deep(input) { font-size: 12px; font-family: var(--font-mono); }
.directory-input :deep(.el-input-group__append) { padding: 0 13px; }
.directory-hint { margin: 9px 0 0; color: var(--text-secondary); font-size: 12px; line-height: 1.6; }
</style>
