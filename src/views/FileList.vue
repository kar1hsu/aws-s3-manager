<template>
  <div class="page-files">
    <div class="page-head">
      <div>
        <h1 class="page-title">文件</h1>
        <p class="page-desc">浏览与下载 Bucket 中的对象</p>
      </div>
      <el-button
        type="primary"
        plain
        icon="el-icon-upload2"
        :disabled="searchMode"
        @click="goUploadHere"
      >
        上传到此目录
      </el-button>
    </div>

    <el-card class="files-card" shadow="hover" v-loading="loading">
      <div class="toolbar">
        <div class="toolbar-row">
          <el-input
            v-model="searchInput"
            placeholder="按前缀搜索（全局，从 Bucket 根起）"
            clearable
            prefix-icon="el-icon-search"
            class="search-input"
            @keyup.enter.native="applySearch"
          />
          <el-button type="primary" @click="applySearch">搜索</el-button>
          <el-button v-if="searchMode" @click="clearSearch">退出搜索</el-button>
        </div>
        <div class="breadcrumb-row">
          <el-breadcrumb separator="/">
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
          <div class="toolbar-actions">
            <el-button size="small" icon="el-icon-refresh" @click="refreshList">
              刷新
            </el-button>
            <el-button
              size="small"
              type="primary"
              icon="el-icon-folder-add"
              @click="showCreateFolderDialog = true"
            >
              新建文件夹
            </el-button>
          </div>
        </div>
      </div>

      <el-alert
        v-if="listTruncated"
        title="当前目录对象较多，列表可能未完全展示。请使用更具体的路径或前缀搜索。"
        type="warning"
        :closable="false"
        show-icon
        class="alert-truncated"
      />

      <div v-if="!loading && displayRows.length === 0" class="empty-state">
        <i class="el-icon-folder-opened"></i>
        <p>{{ searchMode ? '没有匹配的对象' : '此目录下暂无文件' }}</p>
        <el-button v-if="!searchMode" type="text" @click="goUploadHere">
          上传文件
        </el-button>
      </div>

      <template v-else-if="displayRows.length">
        <div v-if="selectedRows.length" class="batch-bar">
          <span>已选 {{ selectedRows.length }} 项</span>
          <el-button size="small" type="danger" plain @click="batchDelete">
            批量删除
          </el-button>
          <el-button size="small" @click="$refs.table.clearSelection()">
            取消选择
          </el-button>
        </div>

        <el-table
          ref="table"
          :data="pagedRows"
          row-key="Key"
          style="width: 100%"
          @selection-change="selectedRows = $event"
        >
          <el-table-column type="selection" width="46" :selectable="rowSelectable" />
          <el-table-column label="名称" min-width="200">
            <template slot-scope="scope">
              <div class="file-item">
                <i :class="getFileIcon(scope.row)" class="file-icon"></i>
                <span
                  v-if="isDirectory(scope.row)"
                  class="dir-link"
                  @click="navigateTo(scope.row.Key)"
                >{{ getDisplayName(scope.row) }}</span>
                <span v-else class="file-name">{{ getDisplayName(scope.row) }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="对象 Key" min-width="180" show-overflow-tooltip>
            <template slot-scope="scope">
              <span class="key-text">{{ scope.row.Key }}</span>
            </template>
          </el-table-column>
          <el-table-column label="修改时间" width="168">
            <template slot-scope="scope">
              {{ formatDate(scope.row.LastModified) }}
            </template>
          </el-table-column>
          <el-table-column label="大小" width="100" align="right">
            <template slot-scope="scope">
              {{ isDirectory(scope.row) ? '—' : formatSize(scope.row.Size) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="300" fixed="right">
            <template slot-scope="scope">
              <div class="file-table-actions">
                <el-button
                  v-if="!isDirectory(scope.row)"
                  type="text"
                  size="small"
                  @click="handleDownload(scope.row)"
                >下载</el-button>
                <el-dropdown
                  v-if="!isDirectory(scope.row) && linkBases.length > 1"
                  class="file-table-actions__dropdown"
                  trigger="click"
                  @command="base => copyCdnBaseLink(scope.row, base)"
                >
                  <el-button type="text" size="small" class="btn-copy-link-menu">
                    <span class="btn-copy-link-menu__inner">
                      <span>复制链接</span>
                      <i class="el-icon-arrow-down btn-copy-link-menu__caret" />
                    </span>
                  </el-button>
                  <el-dropdown-menu slot="dropdown">
                    <el-dropdown-item
                      v-for="(base, i) in linkBases"
                      :key="'cdn-' + i"
                      :command="base"
                    >
                      自定义域名（{{ linkBaseMenuLabel(base) }}）
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </el-dropdown>
                <el-button
                  v-else-if="!isDirectory(scope.row) && linkBases.length === 1"
                  type="text"
                  size="small"
                  @click="copyCdnBaseLink(scope.row, linkBases[0])"
                >复制链接</el-button>
                <el-button
                  v-else-if="!isDirectory(scope.row)"
                  type="text"
                  size="small"
                  @click="handleCopyPlainS3Link(scope.row)"
                >复制链接</el-button>
                <el-button type="text" size="small" @click="copyKey(scope.row)">
                  复制 Key
                </el-button>
                <el-button
                  type="text"
                  size="small"
                  class="danger-text"
                  @click="handleDelete(scope.row)"
                >删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-wrap">
          <el-select v-model="sortBy" size="small" class="sort-select">
            <el-option label="名称 A→Z" value="name" />
            <el-option label="时间新→旧" value="time" />
            <el-option label="大小大→小" value="size" />
          </el-select>
          <el-pagination
            :current-page="currentPage"
            :page-sizes="[10, 20, 50, 100]"
            :page-size="pageSize"
            layout="total, sizes, prev, pager, next"
            :total="sortedRows.length"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </template>
    </el-card>

    <el-dialog
      title="新建文件夹"
      :visible.sync="showCreateFolderDialog"
      width="400px"
      append-to-body
    >
      <el-input
        v-model="newFolderName"
        placeholder="文件夹名称"
        @keyup.enter.native="createFolder"
      />
      <span slot="footer">
        <el-button @click="showCreateFolderDialog = false">取消</el-button>
        <el-button type="primary" @click="createFolder">创建</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import AWS from 'aws-sdk'
import { mapGetters } from 'vuex'
import {
  listFolderContents,
  searchByPrefix,
  deleteAllUnderPrefix,
  copyToClipboard,
  buildPublicS3ObjectUrl
} from '@/utils/s3-helpers'

export default {
  name: 'FileList',
  data() {
    return {
      s3: null,
      currentPath: [],
      searchInput: '',
      searchMode: false,
      searchPrefix: '',
      allRows: [],
      listTruncated: false,
      loading: false,
      currentPage: 1,
      pageSize: 20,
      sortBy: 'name',
      selectedRows: [],
      showCreateFolderDialog: false,
      newFolderName: ''
    }
  },
  computed: {
    ...mapGetters(['awsConfig']),
    displayRows() {
      return this.allRows
    },
    sortedRows() {
      const rows = [...this.displayRows]
      const isDir = r => r.Key.endsWith('/')
      if (this.sortBy === 'name') {
        return rows.sort((a, b) => {
          if (isDir(a) !== isDir(b)) return isDir(b) - isDir(a)
          return this.getDisplayName(a).localeCompare(this.getDisplayName(b))
        })
      }
      if (this.sortBy === 'time') {
        return rows.sort((a, b) => {
          if (isDir(a) !== isDir(b)) return isDir(b) - isDir(a)
          const ta = new Date(a.LastModified || 0).getTime()
          const tb = new Date(b.LastModified || 0).getTime()
          return tb - ta
        })
      }
      return rows.sort((a, b) => {
        if (isDir(a) !== isDir(b)) return isDir(b) - isDir(a)
        return (b.Size || 0) - (a.Size || 0)
      })
    },
    pagedRows() {
      const start = (this.currentPage - 1) * this.pageSize
      return this.sortedRows.slice(start, start + this.pageSize)
    },
    /** 至多一个自定义域名基础 URL */
    linkBases() {
      const b = this.awsConfig.baseUrls || this.awsConfig.cdnBaseUrls || []
      return Array.isArray(b) ? b.filter(Boolean) : []
    }
  },
  watch: {
    sortBy() {
      this.currentPage = 1
    },
    '$store.state.activeProfileId'() {
      this.initS3()
      this.currentPath = []
      this.searchMode = false
      this.searchInput = ''
      this.refreshList()
    }
  },
  created() {
    this.initS3()
    this.refreshList()
  },
  methods: {
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
          this.$message.error('请先完成 S3 配置')
          this.$router.push('/config')
        }
      }
    },
    rowSelectable(row) {
      return true
    },
    async refreshList() {
      if (!this.s3 || !this.awsConfig.bucketName) return
      this.loading = true
      this.selectedRows = []
      try {
        if (this.searchMode && this.searchPrefix) {
          const { items, isTruncated } = await searchByPrefix(
            this.s3,
            this.awsConfig.bucketName,
            this.searchPrefix,
            800
          )
          this.allRows = items
          this.listTruncated = isTruncated
        } else {
          const { directories, files, truncated } = await listFolderContents(
            this.s3,
            this.awsConfig.bucketName,
            this.currentPath
          )
          this.allRows = [...directories, ...files]
          this.listTruncated = truncated
        }
        this.currentPage = 1
        this.$nextTick(() => this.$refs.table && this.$refs.table.clearSelection())
      } catch (error) {
        this.$message.error('加载失败：' + (error.message || error))
        this.allRows = []
      } finally {
        this.loading = false
      }
    },
    applySearch() {
      const q = (this.searchInput || '').trim()
      if (!q) {
        this.clearSearch()
        return
      }
      this.searchMode = true
      this.searchPrefix = q.endsWith('/') ? q : q
      this.currentPath = []
      this.refreshList()
    },
    clearSearch() {
      this.searchMode = false
      this.searchPrefix = ''
      this.searchInput = ''
      this.refreshList()
    },
    getDisplayName(row) {
      const key = row.Key
      if (key.endsWith('/')) {
        const parts = key.slice(0, -1).split('/')
        return parts[parts.length - 1] || key
      }
      const parts = key.split('/')
      return parts[parts.length - 1] || key
    },
    formatDate(date) {
      if (!date) return '—'
      return new Date(date).toLocaleString()
    },
    formatSize(bytes) {
      if (!bytes) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    },
    isDirectory(item) {
      return item.Key.endsWith('/')
    },
    getFileIcon(item) {
      if (this.isDirectory(item)) return 'el-icon-folder'
      const ext = this.getDisplayName(item)
        .split('.')
        .pop()
        .toLowerCase()
      const map = {
        pdf: 'el-icon-document',
        doc: 'el-icon-document',
        docx: 'el-icon-document',
        png: 'el-icon-picture',
        jpg: 'el-icon-picture',
        jpeg: 'el-icon-picture',
        gif: 'el-icon-picture',
        zip: 'el-icon-folder-opened'
      }
      return map[ext] || 'el-icon-document'
    },
    navigateTo(path) {
      if (this.searchMode) {
        const clean = path.endsWith('/') ? path.slice(0, -1) : path
        this.currentPath = clean.split('/').filter(Boolean)
        this.clearSearch()
        return
      }
      const clean = path.endsWith('/') ? path.slice(0, -1) : path
      this.currentPath = clean.split('/').filter(Boolean)
      this.currentPage = 1
      this.refreshList()
    },
    navigateToRoot() {
      if (this.searchMode) this.clearSearch()
      this.currentPath = []
      this.currentPage = 1
      this.refreshList()
    },
    navigateToIndex(index) {
      if (this.searchMode) this.clearSearch()
      this.currentPath = this.currentPath.slice(0, index + 1)
      this.currentPage = 1
      this.refreshList()
    },
    handleSizeChange(val) {
      this.pageSize = val
      this.currentPage = 1
    },
    handleCurrentChange(val) {
      this.currentPage = val
    },
    goUploadHere() {
      const path = this.currentPath.join('/')
      this.$router.push({
        path: '/upload',
        query: path ? { path } : {}
      })
    },
    async handleDownload(file) {
      try {
        const url = await this.s3.getSignedUrlPromise('getObject', {
          Bucket: this.awsConfig.bucketName,
          Key: file.Key,
          ResponseContentType: this.getContentType(file.Key)
        })
        const link = document.createElement('a')
        link.href = url
        link.download = this.getDisplayName(file)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } catch (e) {
        this.$message.error('下载失败：' + e.message)
      }
    },
    getContentType(filename) {
      const ext = filename.split('.').pop().toLowerCase()
      const mime = {
        pdf: 'application/pdf',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        zip: 'application/zip',
        txt: 'text/plain'
      }
      return mime[ext] || 'application/octet-stream'
    },
    /** 未配置自定义域名时：复制标准 S3 对象 URL（无 X-Amz 预签名参数） */
    async handleCopyPlainS3Link(file) {
      try {
        const url = buildPublicS3ObjectUrl(
          this.awsConfig.bucketName,
          this.awsConfig.region || 'us-east-1',
          file.Key
        )
        await copyToClipboard(url)
        this.$message.success('已复制链接')
      } catch (e) {
        this.$message.error('复制失败：' + e.message)
      }
    },
    linkBaseMenuLabel(base) {
      const s = String(base || '').trim()
      if (!s) return '—'
      try {
        const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
        return u.hostname || s.slice(0, 40)
      } catch {
        return s.replace(/^https?:\/\//, '').split('/')[0].slice(0, 40) || s.slice(0, 40)
      }
    },
    async copyCdnBaseLink(file, base) {
      try {
        const url = `${String(base).replace(/\/$/, '')}/${file.Key}`
        await copyToClipboard(url)
        this.$message.success('已复制链接')
      } catch (e) {
        this.$message.error('复制失败：' + e.message)
      }
    },
    async copyKey(row) {
      try {
        await copyToClipboard(row.Key)
        this.$message.success('Key 已复制')
      } catch (e) {
        this.$message.error('复制失败')
      }
    },
    async handleDelete(row) {
      const isDir = this.isDirectory(row)
      const tip = isDir
        ? `将删除文件夹「${this.getDisplayName(row)}」及其下全部对象，不可恢复。`
        : `确定删除「${this.getDisplayName(row)}」？`
      try {
        await this.$confirm(tip, '确认删除', {
          type: 'warning',
          confirmButtonText: '删除',
          cancelButtonText: '取消'
        })
        this.loading = true
        if (isDir) {
          await deleteAllUnderPrefix(this.s3, this.awsConfig.bucketName, row.Key)
        } else {
          await this.s3
            .deleteObject({ Bucket: this.awsConfig.bucketName, Key: row.Key })
            .promise()
        }
        this.$message.success('已删除')
        await this.refreshList()
      } catch (e) {
        if (e !== 'cancel') {
          this.$message.error('删除失败：' + (e.message || e))
        }
      } finally {
        this.loading = false
      }
    },
    async batchDelete() {
      const rows = this.selectedRows
      if (!rows.length) return
      const hasDir = rows.some(r => this.isDirectory(r))
      try {
        await this.$confirm(
          hasDir
            ? '选中项包含文件夹，将删除其中全部对象。确定？'
            : `确定删除选中的 ${rows.length} 个对象？`,
          '批量删除',
          { type: 'warning' }
        )
        this.loading = true
        for (const row of rows) {
          if (this.isDirectory(row)) {
            await deleteAllUnderPrefix(
              this.s3,
              this.awsConfig.bucketName,
              row.Key
            )
          } else {
            await this.s3
              .deleteObject({
                Bucket: this.awsConfig.bucketName,
                Key: row.Key
              })
              .promise()
          }
        }
        this.$message.success('已删除')
        await this.refreshList()
      } catch (e) {
        if (e !== 'cancel') {
          this.$message.error('删除失败：' + (e.message || e))
        }
      } finally {
        this.loading = false
      }
    },
    async createFolder() {
      const name = (this.newFolderName || '').trim()
      if (!name) {
        this.$message.warning('请输入名称')
        return
      }
      const prefix =
        this.currentPath.length > 0 ? this.currentPath.join('/') + '/' : ''
      const folderKey = prefix + name + '/'
      try {
        await this.s3
          .putObject({
            Bucket: this.awsConfig.bucketName,
            Key: folderKey,
            Body: ''
          })
          .promise()
        this.$message.success('已创建')
        this.showCreateFolderDialog = false
        this.newFolderName = ''
        this.refreshList()
      } catch (e) {
        this.$message.error('创建失败：' + e.message)
      }
    }
  }
}
</script>

<style scoped>
.page-files {
  padding-bottom: 24px;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
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

.files-card {
  border-radius: 14px;
  border: none;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
}

.files-card >>> .el-card__body {
  padding: 20px;
}

.toolbar {
  margin-bottom: 16px;
}

.toolbar-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}

.search-input {
  flex: 1;
  min-width: 220px;
  max-width: 480px;
}

.breadcrumb-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}

.alert-truncated {
  margin-bottom: 12px;
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: #a0aec0;
}

.empty-state i {
  font-size: 56px;
  margin-bottom: 12px;
  display: block;
}

.empty-state p {
  margin: 0 0 12px;
  font-size: 15px;
}

.batch-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #f0f7ff;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 14px;
  color: #2c5282;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-icon {
  color: #718096;
  font-size: 16px;
}

.dir-link {
  color: #0066cc;
  cursor: pointer;
  font-weight: 500;
}

.dir-link:hover {
  text-decoration: underline;
}

.file-name {
  color: #2d3748;
}

.key-text {
  font-size: 12px;
  color: #718096;
  font-family: ui-monospace, monospace;
}

.danger-text {
  color: #f56c6c;
}

/* 操作列：flex 统一垂直居中，避免下拉与文字按钮基线不齐 */
.file-table-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 8px;
  row-gap: 4px;
}

.file-table-actions >>> .el-button {
  margin-left: 0 !important;
  margin-right: 0 !important;
}

.file-table-actions__dropdown {
  display: inline-flex;
  align-items: center;
  line-height: 1;
}

/* 文字与箭头同一行垂直居中（与默认 el-icon--right 错位区分开） */
.btn-copy-link-menu__inner {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  line-height: 1;
}

.btn-copy-link-menu__caret {
  margin: 0 !important;
  font-size: 12px;
  line-height: 1;
  flex-shrink: 0;
}

.pagination-wrap {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #f0f2f5;
}

.sort-select {
  width: 130px;
}
</style>
