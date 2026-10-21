<template>
  <el-form :model="modelValue" :disabled="disabled" label-position="top" class="connection-form" @submit.prevent="$emit('save')">
    <section class="form-section">
      <h3 class="section-heading">连接信息</h3>
      <div class="field-grid">
        <el-form-item label="连接名称">
          <el-input :model-value="modelValue.name" placeholder="例如：产品资源" clearable @update:model-value="update('name', $event)" />
        </el-form-item>
        <el-form-item label="Bucket 名称" required>
          <el-input :model-value="modelValue.bucketName" placeholder="my-bucket" clearable @update:model-value="update('bucketName', $event)" />
        </el-form-item>
      </div>
      <el-form-item label="存储区域" required>
        <el-select :model-value="modelValue.region" filterable allow-create default-first-option placeholder="选择或输入区域代码" @update:model-value="update('region', $event)">
          <el-option v-for="region in regions" :key="region.value" :label="region.label" :value="region.value" />
        </el-select>
      </el-form-item>
    </section>

    <section class="form-section">
      <h3 class="section-heading">访问凭证</h3>
      <div class="field-grid">
        <el-form-item label="Access Key ID" required>
          <el-input :model-value="modelValue.accessKeyId" type="password" show-password placeholder="输入 Access Key ID" autocomplete="off" @update:model-value="update('accessKeyId', $event)" />
        </el-form-item>
        <el-form-item label="Secret Access Key" required>
          <el-input :model-value="modelValue.secretAccessKey" type="password" show-password placeholder="输入 Secret Access Key" autocomplete="new-password" @update:model-value="update('secretAccessKey', $event)" />
        </el-form-item>
      </div>
    </section>

    <section class="form-section">
      <h3 class="section-heading">公开链接</h3>
      <el-form-item label="访问域名（可选）">
        <el-input :model-value="modelValue.cdnBaseUrl" placeholder="https://cdn.example.com" clearable @update:model-value="update('cdnBaseUrl', $event)" />
        <p class="field-hint">不填则使用 S3 地址。公开访问需配置 Bucket 或 CDN 权限。</p>
      </el-form-item>
    </section>
  </el-form>
</template>

<script>
export default {
  name: 'ConnectionForm',
  props: {
    modelValue: { type: Object, required: true },
    regions: { type: Array, default: () => [] },
    disabled: Boolean
  },
  emits: ['update:modelValue', 'save'],
  methods: {
    update(field, value) { this.$emit('update:modelValue', { ...this.modelValue, [field]: value }) }
  }
}
</script>

<style scoped>
.connection-form { padding: 0 22px; }
.form-section { padding: 17px 0 2px; }
.form-section + .form-section { border-top: 1px solid var(--line); }
.section-heading { margin: 0 0 14px; font-size: 13px; line-height: 1.4; font-weight: 600; color: var(--text); }
.field-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; }
.connection-form :deep(.el-form-item) { margin-bottom: 15px; }
.connection-form :deep(.el-form-item__label) { float: none; display: block; padding: 0 0 7px; line-height: 1.2; color: var(--text-secondary); font-size: 13px; font-weight: 400; }
.connection-form :deep(.el-form-item.is-required .el-form-item__label::before) { color: var(--accent); }
.connection-form :deep(.el-select) { display: block; width: 100%; }
.field-hint { margin: 7px 0 0; font-size: 12px; color: var(--muted); line-height: 1.6; }
@media (max-width: 640px) { .connection-form { padding: 0 18px; } .field-grid { grid-template-columns: 1fr; gap: 0; } }
</style>
