<template>
  <div class="page-upload">
    <PageHeader title="上传文件">
      <el-button icon="Back" :disabled="interactionLocked" @click="goToFiles">
        返回文件
      </el-button>
    </PageHeader>

    <div class="upload-workspace">
      <main class="upload-main">
        <UploadDropzone :disabled="interactionLocked" @add="handleFileChange" />
        <UploadQueue
          :files="fileList"
          :uploading="interactionLocked"
          @remove="removeFile"
          @copy="copyUploadedLinks([$event])"
          @clear="handleClear"
        />
      </main>
      <aside class="upload-sidebar" aria-label="上传设置">
        <UploadDestination
          v-model="directoryInput"
          :bucket="awsConfig.bucketName"
          :path="currentPath"
          :disabled="interactionLocked"
          @apply="applyDirectory"
          @browse="openDirectoryDialog"
          @root="navigateToRoot"
          @navigate="navigateToIndex"
        />
        <UploadSummary
          :files="fileList"
          :pending-count="pendingFiles.length"
          :completed-count="completedFiles.length"
          :has-failures="hasFailures"
          :disabled="switchingProfile"
          :uploading="uploading"
          :stop-requested="stopRequested"
          :progress="uploadProgress"
          :status="uploadStatus"
          :status-text="uploadStatusText"
          :current-file="currentFileName"
          @upload="handleUpload"
          @stop="stopRequested = true"
          @copy="copyUploadedLinks(completedFiles)"
        />
        <p class="upload-note"><el-icon><InfoFilled /></el-icon><span>同名文件会被覆盖。使用 CDN 时，新内容可能需要等待缓存更新。</span></p>
      </aside>
    </div>

    <DirectoryPicker
      v-model:visible="directoryDialogVisible"
      :bucket="awsConfig.bucketName"
      :tree-props="defaultProps"
      :load-node="loadTreeNode"
      :selected="selectedDirectory"
      :disabled="interactionLocked"
      @open="onDialogOpen"
      @select="handleDirectorySelect"
      @confirm="confirmDirectory"
    />
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { ListObjectsV2Command } from '@aws-sdk/client-s3'
import PageHeader from '@/components/ui/PageHeader.vue'
import UploadDropzone from '@/components/upload/UploadDropzone.vue'
import UploadQueue from '@/components/upload/UploadQueue.vue'
import UploadDestination from '@/components/upload/UploadDestination.vue'
import UploadSummary from '@/components/upload/UploadSummary.vue'
import DirectoryPicker from '@/components/upload/DirectoryPicker.vue'
import { buildObjectUrl, copyToClipboard } from '@/utils/s3-helpers'
import { uploadObject } from '@/utils/s3-client'
import {
  resolveS3ContentType,
  resolveS3UploadBody
} from '@/utils/upload-body'

export default {
  name: 'UploadFile',
  components: { PageHeader, UploadDropzone, UploadQueue, UploadDestination, UploadSummary, DirectoryPicker },
  data() {
    return {
      fileList: [],
      uploading: false,
      currentPath: [],
      directoryInput: '',
      stopRequested: false,
      directoryDialogVisible: false,
      defaultProps: {
        children: 'children',
        label: 'name',
        isLeaf: 'leaf'
      },
      selectedDirectory: null,
      uploadProgress: 0,
      uploadStatus: '',
      uploadStatusText: '',
      currentFileName: '',
      totalFiles: 0,
      uploadedCount: 0
    }
  },
  computed: {
    ...mapGetters(['awsConfig', 's3Instance']),
    switchingProfile() { return Boolean(this.$store.state.switchingProfile) },
    interactionLocked() { return this.uploading || this.switchingProfile },
    pendingFiles() { return this.fileList.filter(file => file.phase !== 'success') },
    completedFiles() { return this.fileList.filter(file => file.phase === 'success') },
    hasFailures() { return this.fileList.some(file => file.phase === 'failed') },
    statusIcon() {
      if (this.uploadStatus === 'success') return 'CircleCheckFilled'
      if (this.uploadStatus === 'exception') return 'CircleCloseFilled'
      if (this.uploadStatus === 'warning') return 'VideoPause'
      return 'Loading'
    }
  },
  watch: {
    '$route.query.path': {
      handler() {
        this.syncPathFromRoute()
      },
      immediate: true
    },
    '$store.state.activeProfileId'() {
      this.directoryDialogVisible = false
      this.setDirectory(this.$store.getters.currentDirectory)
      this.handleClear()
    },
    pendingFiles(files) {
      this.$store.commit('setPendingUploads', files.length > 0)
    }
  },
  created() {
    this.syncPathFromRoute()
  },
  mounted() {
    window.addEventListener('beforeunload', this.preventUnload)
  },
  beforeUnmount() {
    window.removeEventListener('beforeunload', this.preventUnload)
    this.$store.commit('setPendingUploads', false)
  },
  beforeRouteLeave(to, from, next) {
    this.confirmLeave(next)
  },
  beforeRouteUpdate(to, from, next) {
    if (this.uploading) next(false)
    else next()
  },
  methods: {
    preventUnload(event) {
      if (this.uploading || this.pendingFiles.length) {
        event.preventDefault()
        event.returnValue = ''
      }
    },
    async confirmLeave(next) {
      if (this.uploading) {
        this.$message.info('上传进行中，请等待完成，或选择「完成当前后停止」')
        next(false)
        return
      }
      if (this.pendingFiles.length) {
        try {
          await this.$confirm('离开后将清空未上传的文件，确定离开？', '还有待上传文件', {
            confirmButtonText: '离开', cancelButtonText: '继续上传', type: 'warning', closeOnHashChange: false
          })
        } catch (e) { next(false); return }
      }
      next()
    },
    goToFiles() {
      if (this.interactionLocked) return
      this.$router.push({ path: '/files', query: { path: this.currentPath.join('/') } }).catch(() => {})
    },
    setDirectory(path) {
      if (this.uploading) return
      this.currentPath = String(path || '').split('/').filter(Boolean)
      this.directoryInput = this.currentPath.join('/')
      this.$store.commit('rememberDirectory', this.directoryInput)
    },
    applyDirectory() {
      if (this.interactionLocked) return
      this.setDirectory(this.directoryInput)
    },
    syncPathFromRoute() {
      this.setDirectory(typeof this.$route.query.path === 'string' ? this.$route.query.path : this.$store.getters.currentDirectory)
    },
    onDialogOpen() {
      this.selectedDirectory = null
    },
    openDirectoryDialog() {
      if (this.interactionLocked) return
      this.directoryDialogVisible = true
    },
    async loadTreeNode(node, resolve) {
      if (!this.s3Instance || this.switchingProfile) {
        resolve([])
        return
      }
      const prefix =
        node.level === 0
          ? ''
          : node.data.path || ''
      const s3 = this.s3Instance
      const bucket = this.awsConfig.bucketName
      try {
        const nodes = []
        let token
        do {
          const data = await s3.send(new ListObjectsV2Command({
            Bucket: bucket,
            Delimiter: '/',
            Prefix: prefix,
            ContinuationToken: token
          }))
          if (s3 !== this.s3Instance || bucket !== this.awsConfig.bucketName) {
            resolve([])
            return
          }
          nodes.push(...(data.CommonPrefixes || []).map(cp => {
            const name = cp.Prefix.slice(prefix.length).replace(/\/$/, '')
            return { name, path: cp.Prefix, leaf: false }
          }))
          token = data.IsTruncated ? data.NextContinuationToken : null
        } while (token)
        resolve(nodes)
      } catch (e) {
        if (s3 === this.s3Instance && bucket === this.awsConfig.bucketName) {
          this.$message.error('加载目录失败：' + e.message)
        }
        resolve([])
      }
    },
    handleDirectorySelect(data) {
      if (this.interactionLocked) return
      this.selectedDirectory = data
    },
    confirmDirectory() {
      if (this.interactionLocked) return
      if (this.selectedDirectory && this.selectedDirectory.path) {
        this.setDirectory(this.selectedDirectory.path)
      } else {
        this.setDirectory('')
      }
      this.directoryDialogVisible = false
    },
    handleFileChange(file) {
      if (this.interactionLocked) return
      if (this.fileList.some(item => item.name === file.name)) {
        this.fileList = this.fileList.slice()
        this.$message.warning(`「${file.name}」已在队列中；如需替换，请先移除原项`)
        return
      }
      this.fileList = [...this.fileList, { ...file, phase: 'pending', progress: 0, error: '', publicUrl: '' }]
      this.uploadStatus = ''
    },
    removeFile(file) {
      if (!this.interactionLocked) this.fileList = this.fileList.filter(item => item.uid !== file.uid)
    },
    phaseLabel(phase) {
      return { pending: '待上传', success: '已上传', failed: '上传失败' }[phase] || '上传中'
    },
    async copyUploadedLinks(files) {
      try {
        await copyToClipboard(files.map(file => file.publicUrl).join('\n'))
        this.$message.success(`已复制 ${files.length} 个链接`)
      } catch (error) { this.$message.error('复制失败：' + error.message) }
    },
    handleClear() {
      if (this.uploading) return
      this.fileList = []
      this.uploadStatus = ''
      this.uploadStatusText = ''
    },
    async handleUpload() {
      if (this.interactionLocked || !this.pendingFiles.length || !this.s3Instance) return
      this.applyDirectory()
      const files = [...this.pendingFiles]
      const s3 = this.s3Instance
      const config = { ...this.awsConfig }
      this.uploading = true
      this.$store.commit('setBusyOperation', true)
      this.stopRequested = false
      this.uploadProgress = 0
      this.uploadStatus = ''
      this.uploadStatusText = '上传中…'
      this.totalFiles = files.length
      this.uploadedCount = 0
      this.currentFileName = ''

      const prefix =
        this.currentPath.length > 0 ? this.currentPath.join('/') + '/' : ''
      const failed = []
      const totalBytes = files.reduce((sum, file) => sum + Math.max(file.size || 0, 1), 0)
      let completedBytes = 0

      try {
        for (let i = 0; i < files.length; i++) {
          if (this.stopRequested) break
          const file = files[i]
          const key = prefix + file.name
          file.phase = 'uploading'
          file.progress = 0
          file.error = ''
          this.currentFileName = file.name
          this.uploadStatusText = `上传中 ${i + 1}/${this.totalFiles}`
          try {
            const body = await resolveS3UploadBody(file.raw)
            const publicUrl = buildObjectUrl(config, key)
            await uploadObject(s3, {
              Bucket: config.bucketName,
              Key: key,
              Body: body,
              ContentType: resolveS3ContentType(file.raw, file.name)
            }, event => {
              const fraction = event.total ? Math.min(event.loaded / event.total, 1) : 0
              file.progress = Math.min(99, Math.round(fraction * 100))
              this.uploadProgress = Math.min(99, Math.round((completedBytes + Math.max(file.size || 0, 1) * fraction) / totalBytes * 100))
            })
            file.phase = 'success'
            file.progress = 100
            file.publicUrl = publicUrl
            this.uploadedCount++
            completedBytes += Math.max(file.size || 0, 1)
            this.uploadProgress = Math.round(completedBytes / totalBytes * 100)
          } catch (err) {
            const errorName = err.name || err.code
            const detail =
              errorName && errorName !== 'Error' && err.message
                ? `${errorName}: ${err.message}`
                : err.message || String(err)
            failed.push({ name: file.name, err: detail })
            file.phase = 'failed'
            file.error = detail
          }
        }

        if (this.stopRequested && this.pendingFiles.length && !failed.length) {
          this.uploadStatus = 'warning'
          this.uploadStatusText = `已停止，剩余 ${this.pendingFiles.length} 个文件可继续上传`
        } else if (failed.length === 0) {
          this.uploadStatus = 'success'
          this.uploadStatusText = `已完成 ${this.totalFiles} 个文件`
          this.$message.success('上传完成')
        } else {
          this.uploadStatus = 'exception'
          this.uploadStatusText = `${this.uploadedCount} 个成功，${failed.length} 个失败${this.stopRequested ? '，已停止后续上传' : ''}`
          const first = failed[0]
          this.$message.error(
            `部分失败（${failed.length} 个）：${first.name} — ${first.err}` +
              (failed.length > 1 ? ' …' : '')
          )
        }
      } catch (e) {
        this.uploadStatus = 'exception'
        this.uploadStatusText = '上传异常'
        this.$message.error(e.message)
      } finally {
        this.uploading = false
        this.$store.commit('setBusyOperation', false)
        this.currentFileName = ''
      }
    },
    navigateToRoot() {
      if (this.interactionLocked) return
      this.setDirectory('')
    },
    navigateToIndex(index) {
      if (this.interactionLocked) return
      this.setDirectory(this.currentPath.slice(0, index + 1).join('/'))
    }
  }
}
</script>

<style scoped>
.page-upload { padding-bottom: 24px; }
.upload-workspace { display: grid; grid-template-columns: minmax(0, 1fr) 290px; gap: 18px; align-items: start; }
.upload-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.upload-sidebar { min-width: 0; overflow: hidden; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); }
.upload-note { display: flex; align-items: flex-start; gap: 7px; margin: 0; padding: 0 18px 17px; color: var(--text-secondary); font-size: 12px; line-height: 1.65; }
.upload-note i { margin-top: 4px; flex-shrink: 0; }
@media (max-width: 1100px) { .upload-workspace { grid-template-columns: minmax(0, 1fr) 272px; gap: 16px; } }
@media (max-width: 900px) {
  .upload-workspace { display: flex; flex-direction: column; gap: 16px; }
  .upload-main { display: contents; }
  .upload-workspace > *, .upload-main > * { width: 100%; box-sizing: border-box; }
  .upload-main > .upload-dropzone { order: 0; }
  .upload-sidebar { order: 1; display: grid; grid-template-columns: minmax(0, 1fr) 244px; }
  .upload-note { grid-column: 1 / -1; padding-top: 0; }
  .upload-main > .upload-queue { order: 2; }
}
@media (max-width: 620px) { .upload-sidebar { display: block; } }
</style>
