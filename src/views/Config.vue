<template>
  <div class="page-config">
    <PageHeader title="连接设置" />

    <div class="config-layout" v-loading="!configLoaded || switching">
      <aside class="config-sidebar">
        <ProfileList
          :profiles="profiles"
          :selected-id="selectedProfileId"
          :disabled="saving || testing || switching"
          @select="onSwitchProfile"
          @add="onAddProfile"
          @remove="onRemoveProfile"
        />
      </aside>

      <section class="connection-editor" aria-label="连接配置">
        <div class="editor-heading">
          <div>
            <h2>{{ form.name || '新连接' }}</h2>
          </div>
        </div>

        <ConnectionForm
          :model-value="form"
          :regions="regionOptions"
          :disabled="saving || testing || switching"
          @update:model-value="updateForm"
          @save="saveConfig"
        />

        <div class="editor-actions">
          <div class="save-state" :class="{ 'is-dirty': isDirty, 'is-success': testResult && testResult.success, 'is-error': testResult && !testResult.success }" aria-live="polite">
            <template v-if="testResult">
              <el-icon><CircleCheck v-if="testResult.success" /><Warning v-else /></el-icon>
              <span>{{ testResult.message }}</span>
            </template>
            <template v-else-if="isDirty">
              <span>有未保存的修改</span>
            </template>
          </div>
          <div class="action-buttons">
            <el-button :loading="testing" :disabled="!canTestForm || saving || switching" @click="testConnection">测试连接</el-button>
            <el-button type="primary" :loading="saving" :disabled="!canTestForm || testing || switching" @click="saveConfig">
              保存并打开文件
            </el-button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script>
import { HeadBucketCommand } from '@aws-sdk/client-s3'
import { mapGetters, mapActions } from 'vuex'
import { createS3Client } from '@/utils/s3-client'
import { normalizeBaseUrl } from '@/utils/s3-helpers'
import PageHeader from '@/components/ui/PageHeader.vue'
import ProfileList from '@/components/config/ProfileList.vue'
import ConnectionForm from '@/components/config/ConnectionForm.vue'

const REGION_OPTIONS = [
  { value: 'us-east-1', label: '美国东部 (弗吉尼亚) us-east-1' },
  { value: 'us-west-2', label: '美国西部 (俄勒冈) us-west-2' },
  { value: 'eu-west-1', label: '欧洲 (爱尔兰) eu-west-1' },
  { value: 'ap-northeast-1', label: '亚太 (东京) ap-northeast-1' },
  { value: 'ap-northeast-2', label: '亚太 (首尔) ap-northeast-2' },
  { value: 'ap-southeast-1', label: '亚太 (新加坡) ap-southeast-1' },
  { value: 'ap-southeast-2', label: '亚太 (悉尼) ap-southeast-2' },
  { value: 'ap-south-1', label: '亚太 (孟买) ap-south-1' },
  { value: 'cn-north-1', label: '中国 (北京) cn-north-1' },
  { value: 'cn-northwest-1', label: '中国 (宁夏) cn-northwest-1' }
]

export default {
  name: 'ConfigPage',
  components: { PageHeader, ProfileList, ConnectionForm },
  data() {
    return {
      regionOptions: REGION_OPTIONS,
      selectedProfileId: '',
      form: {
        name: '',
        accessKeyId: '',
        secretAccessKey: '',
        region: 'us-east-1',
        bucketName: '',
        cdnBaseUrl: ''
      },
      testing: false,
      saving: false,
      switching: false,
      testResult: null,
      savedSnapshot: ''
    }
  },
  computed: {
    ...mapGetters(['profiles', 'activeProfileId', 'configLoaded', 'activeProfile']),
    isDirty() { return !!this.savedSnapshot && JSON.stringify(this.form) !== this.savedSnapshot },
    canTestForm() {
      return !!(
        this.form.accessKeyId.trim() &&
        this.form.secretAccessKey.trim() &&
        this.form.region.trim() &&
        this.form.bucketName.trim()
      )
    }
  },
  watch: {
    configLoaded(v) {
      if (v) this.syncFromStore()
    },
    activeProfileId(v) {
      if (v && !this.switching) this.syncFromStore()
    }
  },
  mounted() {
    this.selectedProfileId = this.activeProfileId
    this.syncFromStore()
    window.addEventListener('beforeunload', this.preventUnload)
  },
  beforeUnmount() {
    window.removeEventListener('beforeunload', this.preventUnload)
  },
  async beforeRouteLeave(to, from, next) {
    if (this.saving || this.switching) { next(false); return }
    next(await this.confirmDiscard())
  },
  methods: {
    updateForm(value) {
      this.form = value
      this.testResult = null
    },
    preventUnload(event) {
      if (this.isDirty) { event.preventDefault(); event.returnValue = '' }
    },
    async confirmDiscard() {
      if (!this.isDirty) return true
      try {
        await this.$confirm('当前连接有未保存的修改，是否放弃？', '未保存的修改', {
          confirmButtonText: '放弃修改', cancelButtonText: '继续编辑', type: 'warning', closeOnHashChange: false
        })
        return true
      } catch (e) { return false }
    },
    ...mapActions([
      'saveActiveProfile',
      'switchProfile',
      'addProfile',
      'removeProfile'
    ]),
    syncFromStore() {
      const p = this.activeProfile
      if (!p) return
      this.selectedProfileId = this.activeProfileId
      this.form = {
        name: p.name || '',
        accessKeyId: p.accessKeyId || '',
        secretAccessKey: p.secretAccessKey || '',
        region: p.region || 'us-east-1',
        bucketName: p.bucketName || '',
        cdnBaseUrl: (p.cdnBaseUrls && p.cdnBaseUrls[0]) || p.url || ''
      }
      this.savedSnapshot = JSON.stringify(this.form)
      this.testResult = null
    },
    async onSwitchProfile(id) {
      if (this.saving || this.testing || this.switching) return
      if (!id || id === this.activeProfileId) return
      if (!(await this.confirmDiscard())) { this.selectedProfileId = this.activeProfileId; return }
      this.switching = true
      try {
        await this.switchProfile(id)
        this.syncFromStore()
      } catch (e) {
        this.$message.error(e.message || '切换失败')
        this.selectedProfileId = this.activeProfileId
      } finally {
        this.switching = false
      }
    },
    async onAddProfile() {
      if (!(await this.confirmDiscard())) return
      this.switching = true
      try {
        await this.addProfile()
        this.syncFromStore()
        this.$message.success('已添加新连接，请填写后保存')
      } catch (e) {
        this.$message.error(e.message || '添加失败')
      } finally {
        this.switching = false
      }
    },
    async onRemoveProfile() {
      try {
        await this.$confirm('确定删除当前连接配置？未保存的修改将丢弃，Bucket 内的文件不会删除。', '删除连接', { type: 'warning', closeOnHashChange: false })
        this.switching = true
        await this.removeProfile(this.activeProfileId)
        this.syncFromStore()
        this.$message.success('已删除')
      } catch (e) {
        if (e !== 'cancel' && e !== 'close') this.$message.error(e.message || '删除失败')
      } finally {
        this.switching = false
      }
    },
    buildS3() {
      return createS3Client({
        accessKeyId: this.form.accessKeyId.trim(),
        secretAccessKey: this.form.secretAccessKey.trim(),
        region: this.form.region.trim()
      })
    },
    async testConnection() {
      if (!this.canTestForm) {
        this.$message.warning('请先填写完整凭证与 Bucket')
        return
      }
      this.testing = true
      this.testResult = null
      let s3
      try {
        s3 = this.buildS3()
        await s3.send(new HeadBucketCommand({ Bucket: this.form.bucketName.trim() }))
        this.testResult = { success: true, message: '连接成功，Bucket 可访问' }
        this.$message.success('连接成功，可访问该 Bucket')
      } catch (e) {
        const statusCode = e.$metadata && e.$metadata.httpStatusCode
        const msg =
          e.name === 'Forbidden' || statusCode === 403
            ? '无权限访问该 Bucket（403）'
            : e.name === 'NotFound' || statusCode === 404
              ? 'Bucket 不存在（404）'
              : e.message || '连接失败'
        this.testResult = { success: false, message: msg }
        this.$message.error(msg)
      } finally {
        if (s3) s3.destroy()
        this.testing = false
      }
    },
    async saveConfig() {
      if (this.saving) return
      if (!this.canTestForm) {
        this.$message.warning('请填写 Access Key、Secret、区域与 Bucket')
        return
      }
      this.saving = true
      try {
        const one = normalizeBaseUrl(this.form.cdnBaseUrl)
        const cdnBaseUrls = one ? [one] : []
        await this.saveActiveProfile({
          name: this.form.name.trim(),
          accessKeyId: this.form.accessKeyId.trim(),
          secretAccessKey: this.form.secretAccessKey.trim(),
          region: this.form.region.trim(),
          bucketName: this.form.bucketName.trim(),
          cdnBaseUrls
        })
        this.syncFromStore()
        this.saving = false
        this.$message.success('已保存')
        this.$router.push('/files').catch(() => {})
      } catch (error) {
        this.$message.error('保存失败：' + (error.message || error))
      } finally {
        this.saving = false
      }
    }
  }
}
</script>

<style scoped>
.page-config {
  padding-bottom: 8px;
}
.config-layout {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}
.config-sidebar { min-width: 0; border-right: 1px solid var(--line); }
.connection-editor {
  min-width: 0;
}
.editor-heading {
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 17px 22px;
  border-bottom: 1px solid var(--line);
}
.editor-heading > div { min-width: 0; }
.editor-heading h2 {
  margin: 0;
  font-size: 14px;
  line-height: 1.4;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.editor-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 22px;
  background: var(--surface);
  border-top: 1px solid var(--line);
  border-radius: 0 0 var(--radius) 0;
}
.save-state {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
  min-width: 0;
  overflow-wrap: anywhere;
}
.save-state > .el-icon { flex-shrink: 0; margin-top: 2px; font-size: 14px; }
.save-state.is-dirty { color: var(--accent); }
.save-state.is-success { color: var(--success); }
.save-state.is-error { color: var(--danger); }
.action-buttons { display: flex; align-items: center; margin-left: auto; white-space: nowrap; }
@media (max-width: 1050px) {
  .config-layout { grid-template-columns: minmax(0, 1fr); }
  .config-sidebar { border-right: 0; border-bottom: 1px solid var(--line); }
  .editor-actions { border-bottom-left-radius: var(--radius); }
}
@media (max-width: 640px) {
  .editor-heading, .editor-actions { padding: 14px 18px; }
  .action-buttons { width: 100%; }
  .action-buttons .el-button { flex: 1; padding-left: 12px; padding-right: 12px; }
}
</style>
