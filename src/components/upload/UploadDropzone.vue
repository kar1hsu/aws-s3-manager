<template>
  <section
    class="upload-dropzone"
    :class="{ 'is-dragging': dragDepth > 0 && !disabled, 'is-disabled': disabled }"
    @dragenter.prevent="dragDepth++"
    @dragover.prevent
    @dragleave.prevent="dragDepth = Math.max(0, dragDepth - 1)"
    @drop.prevent="onDrop"
  >
    <div class="dropzone-icon"><el-icon><Upload /></el-icon></div>
    <div class="dropzone-content">
      <h2>{{ disabled ? '文件正在上传' : '将文件拖到这里' }}</h2>
      <p>{{ disabled ? '完成后可继续添加文件' : '或选择本地文件，支持多选' }}</p>
    </div>
    <el-button :disabled="disabled" icon="Plus" @click="$refs.input.click()">选择文件</el-button>
    <input ref="input" type="file" multiple :disabled="disabled" class="file-input" aria-label="选择要上传的文件" @change="onChange">
  </section>
</template>

<script>
export default {
  name: 'UploadDropzone',
  emits: ['add'],
  props: { disabled: Boolean },
  data() { return { dragDepth: 0, sequence: 0 } },
  methods: {
    addFiles(files) {
      if (this.disabled) return
      Array.from(files || []).forEach(raw => {
        this.$emit('add', { raw, name: raw.name, size: raw.size, uid: `upload-${Date.now()}-${this.sequence++}` })
      })
    },
    onChange(event) {
      this.addFiles(event.target.files)
      event.target.value = ''
    },
    onDrop(event) {
      this.dragDepth = 0
      this.addFiles(event.dataTransfer.files)
    }
  }
}
</script>

<style scoped>
.upload-dropzone { display: flex; align-items: center; gap: 16px; padding: 24px 22px; min-height: 112px; box-sizing: border-box; border: 1px dashed #cec9c1; border-radius: var(--radius); background: var(--surface); transition: background .15s, border-color .15s; }
.upload-dropzone.is-dragging { border-color: var(--accent); background: var(--accent-soft); }
.upload-dropzone.is-disabled { background: var(--surface-alt); }
.dropzone-icon { display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--text-secondary); font-size: 28px; }
.dropzone-content { flex: 1; min-width: 0; }
h2 { margin: 0 0 6px; font-size: 14px; font-weight: 600; color: var(--text); }
p { margin: 0; color: var(--text-secondary); font-size: 12px; line-height: 1.65; }
.file-input { display: none; }
@media (max-width: 1100px) { .upload-dropzone { padding: 22px 18px; gap: 12px; } }
@media (max-width: 620px) { .upload-dropzone { flex-wrap: wrap; } .dropzone-content { min-width: 150px; } .upload-dropzone > .el-button { margin-left: 40px; } }
</style>
