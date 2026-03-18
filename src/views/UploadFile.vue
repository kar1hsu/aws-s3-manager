<template>
  <div class="page-upload">
    <div class="page-head">
      <div>
        <h1 class="page-title">上传</h1>
        <p class="page-desc">将本地文件上传到当前 Bucket 指定目录</p>
      </div>
      <el-button type="text" icon="el-icon-folder" @click="$router.push('/files')">
        返回文件列表
      </el-button>
    </div>

    <el-card class="upload-card" shadow="hover">
      <div class="card-section">
        <div class="section-label">上传到</div>
        <el-breadcrumb separator="/" class="path-crumb">
          <el-breadcrumb-item>
            <a href="javascript:;" @click="navigateToRoot">根目录</a>
          </el-breadcrumb-item>
          <el-breadcrumb-item
            v-for="(item, index) in currentPath"
            :key="index"
          >
            <a href="javascript:;" @click="navigateToIndex(index)">{{ item }}</a>
          </el-breadcrumb-item>
        </el-breadcrumb>
        <el-button
          size="small"
          type="primary"
          plain
          icon="el-icon-folder-opened"
          class="pick-dir-btn"
          @click="openDirectoryDialog"
        >
          选择目录
        </el-button>
      </div>

      <div class="card-section">
        <el-upload
          class="upload-zone"
          drag
          action="#"
          :auto-upload="false"
          :on-change="handleFileChange"
          :file-list="fileList"
          multiple
        >
          <div class="upload-inner">
            <i class="el-icon-upload upload-ico"></i>
            <p class="upload-title">拖拽文件到此处，或 <em>点击选择</em></p>
            <p class="upload-hint">支持多文件；大文件请耐心等待</p>
          </div>
        </el-upload>
      </div>

      <div class="card-actions">
        <el-button @click="handleClear" :disabled="fileList.length === 0 || uploading">
          清空列表
        </el-button>
        <el-button
          type="primary"
          :loading="uploading"
          :disabled="fileList.length === 0"
          icon="el-icon-upload2"
          @click="handleUpload"
        >
          开始上传
        </el-button>
      </div>

      <div v-if="uploading || uploadStatus" class="progress-block">
        <el-progress
          :percentage="uploadProgress"
          :status="uploadStatus || undefined"
          :stroke-width="8"
        />
        <p class="progress-text" :class="uploadStatus">
          <i :class="statusIcon"></i>
          {{ uploadStatusText }}
        </p>
        <p v-if="currentFileName" class="current-file">当前：{{ currentFileName }}</p>
      </div>
    </el-card>

    <el-dialog
      title="选择目录"
      :visible.sync="directoryDialogVisible"
      width="480px"
      append-to-body
      @open="onDialogOpen"
    >
      <p class="dialog-hint">点击文件夹展开；不选则上传到根目录。</p>
      <el-tree
        class="dir-tree"
        :props="defaultProps"
        node-key="path"
        highlight-current
        lazy
        :load="loadTreeNode"
        @node-click="handleDirectorySelect"
      />
      <span slot="footer">
        <el-button @click="directoryDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmDirectory">确定</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import AWS from 'aws-sdk'
import { mapGetters } from 'vuex'

export default {
  name: 'UploadFile',
  data() {
    return {
      fileList: [],
      uploading: false,
      s3: null,
      currentPath: [],
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
    ...mapGetters(['awsConfig']),
    statusIcon() {
      if (this.uploadStatus === 'success') return 'el-icon-success'
      if (this.uploadStatus === 'exception') return 'el-icon-error'
      return 'el-icon-loading'
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
      this.initS3()
    }
  },
  created() {
    this.initS3()
    this.syncPathFromRoute()
  },
  methods: {
    syncPathFromRoute() {
      const p = this.$route.query.path
      if (typeof p === 'string' && p.trim()) {
        this.currentPath = p.split('/').filter(Boolean)
      }
    },
    initS3() {
      if (this.$store.getters.s3Instance) {
        this.s3 = this.$store.getters.s3Instance
      } else {
        try {
          this.s3 = new AWS.S3({
            accessKeyId: this.awsConfig.accessKeyId,
            secretAccessKey: this.awsConfig.secretAccessKey,
            region: this.awsConfig.region || 'us-east-1',
            signatureVersion: 'v4',
            s3ForcePathStyle: true,
            endpoint: `https://s3.${this.awsConfig.region || 'us-east-1'}.amazonaws.com`
          })
        } catch (e) {
          this.$message.error('请先完成配置')
          this.$router.push('/config')
        }
      }
    },
    onDialogOpen() {
      this.selectedDirectory = null
    },
    openDirectoryDialog() {
      this.directoryDialogVisible = true
    },
    async loadTreeNode(node, resolve) {
      if (!this.s3) {
        resolve([])
        return
      }
      const prefix =
        node.level === 0
          ? ''
          : node.data.path || ''
      try {
        const data = await this.s3
          .listObjectsV2({
            Bucket: this.awsConfig.bucketName,
            Delimiter: '/',
            Prefix: prefix
          })
          .promise()
        const nodes = (data.CommonPrefixes || []).map(cp => {
          const name = cp.Prefix.replace(prefix, '').replace(/\/$/, '')
          return {
            name,
            path: cp.Prefix,
            leaf: false
          }
        })
        resolve(nodes)
      } catch (e) {
        this.$message.error('加载目录失败：' + e.message)
        resolve([])
      }
    },
    handleDirectorySelect(data) {
      this.selectedDirectory = data
    },
    confirmDirectory() {
      if (this.selectedDirectory && this.selectedDirectory.path) {
        this.currentPath = this.selectedDirectory.path
          .split('/')
          .filter(Boolean)
      } else {
        this.currentPath = []
      }
      this.directoryDialogVisible = false
    },
    handleFileChange(file, fileList) {
      this.fileList = fileList
    },
    handleClear() {
      if (this.uploading) return
      this.fileList = []
      this.uploadStatus = ''
      this.uploadStatusText = ''
    },
    async handleUpload() {
      if (!this.fileList.length || !this.s3) return
      this.uploading = true
      this.uploadProgress = 0
      this.uploadStatus = ''
      this.uploadStatusText = '上传中…'
      this.totalFiles = this.fileList.length
      this.uploadedCount = 0
      this.currentFileName = ''

      const prefix =
        this.currentPath.length > 0 ? this.currentPath.join('/') + '/' : ''
      const failed = []

      try {
        for (let i = 0; i < this.fileList.length; i++) {
          const file = this.fileList[i]
          this.currentFileName = file.name
          this.uploadStatusText = `上传中 ${i + 1}/${this.totalFiles}`
          try {
            await this.s3
              .upload({
                Bucket: this.awsConfig.bucketName,
                Key: prefix + file.name,
                Body: file.raw
              })
              .promise()
            this.uploadedCount++
            this.uploadProgress = Math.round(
              (this.uploadedCount / this.totalFiles) * 100
            )
          } catch (err) {
            failed.push({ name: file.name, err: err.message })
          }
        }

        if (failed.length === 0) {
          this.uploadStatus = 'success'
          this.uploadStatusText = `已完成 ${this.totalFiles} 个文件`
          this.$message.success('上传完成')
          this.fileList = []
        } else {
          this.uploadStatus = 'exception'
          this.uploadStatusText = `${failed.length} 个失败`
          this.$message.error(
            '部分失败：' + failed.map(f => f.name).join(', ')
          )
        }
      } catch (e) {
        this.uploadStatus = 'exception'
        this.uploadStatusText = '上传异常'
        this.$message.error(e.message)
      } finally {
        this.uploading = false
        this.currentFileName = ''
      }
    },
    navigateToRoot() {
      this.currentPath = []
    },
    navigateToIndex(index) {
      this.currentPath = this.currentPath.slice(0, index + 1)
    }
  }
}
</script>

<style scoped>
.page-upload {
  padding-bottom: 32px;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  gap: 16px;
}

.page-title {
  margin: 0 0 6px;
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
}

.page-desc {
  margin: 0;
  font-size: 14px;
  color: #718096;
}

.upload-card {
  border-radius: 14px;
  border: none;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
}

.upload-card >>> .el-card__body {
  padding: 24px;
}

.card-section {
  margin-bottom: 24px;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: #718096;
  margin-bottom: 10px;
}

.path-crumb {
  margin-bottom: 12px;
  font-size: 14px;
}

.path-crumb a {
  color: #0066cc;
}

.pick-dir-btn {
  border-radius: 8px;
}

.upload-zone {
  width: 100%;
}

.upload-zone >>> .el-upload {
  width: 100%;
}

.upload-zone >>> .el-upload-dragger {
  width: 100%;
  min-height: 200px;
  border-radius: 12px;
  border: 2px dashed #dce3ec;
  background: #fafbfc;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s, background 0.2s;
}

.upload-zone >>> .el-upload-dragger:hover {
  border-color: #0066cc;
  background: #f0f7ff;
}

.upload-inner {
  text-align: center;
  padding: 24px;
}

.upload-ico {
  font-size: 52px;
  color: #0066cc;
  margin-bottom: 12px;
}

.upload-title {
  margin: 0 0 8px;
  font-size: 16px;
  color: #2d3748;
}

.upload-title em {
  color: #0066cc;
  font-style: normal;
  font-weight: 600;
}

.upload-hint {
  margin: 0;
  font-size: 13px;
  color: #a0aec0;
}

.card-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.progress-block {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #f0f2f5;
}

.progress-text {
  margin: 12px 0 0;
  font-size: 14px;
  color: #606266;
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-text.success {
  color: #67c23a;
}

.progress-text.exception {
  color: #f56c6c;
}

.current-file {
  margin: 8px 0 0;
  font-size: 12px;
  color: #909399;
  word-break: break-all;
}

.dialog-hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: #909399;
}
</style>
