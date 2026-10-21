<template>
  <div class="page-files">
    <PageHeader title="文件浏览">
      <el-button type="primary" icon="Upload" :disabled="searchMode || loading" @click="goUploadHere">上传文件</el-button>
    </PageHeader>

    <section v-loading="loading" class="files-panel" aria-label="文件浏览器">
      <FileToolbar
        :current-path="currentPath"
        :bucket-name="awsConfig.bucketName"
        v-model:path-input="pathInput"
        v-model:search-scope="searchScope"
        v-model:search-input="searchInput"
        v-model:show-object-key="showObjectKey"
        :search-mode="searchMode"
        :search-prefix="searchPrefix"
        :loading="loading"
        @parent="navigateToIndex(currentPath.length - 2)"
        @root="navigateToRoot"
        @navigate-index="navigateToIndex"
        @navigate="navigateTo"
        @refresh="refreshList"
        @create-folder="showCreateFolderDialog = true"
        @scope-change="changeSearchScope"
        @search="applySearch"
        @clear-search="clearSearch"
      />

      <el-alert v-if="listTruncated" title="对象数量较多，当前仅显示部分结果。可输入更具体的路径或前缀查找。" type="warning" :closable="false" show-icon class="alert-truncated" />

      <FileTable
        ref="table"
        :rows="pagedRows"
        :presentation="filePresentation"
        :selected-count="selectedRows.length"
        :selected-file-count="selectedFiles.length"
        :total="sortedRows.length"
        :current-page="currentPage"
        :page-size="pageSize"
        v-model:sort-by="sortBy"
        :show-object-key="searchMode || showObjectKey"
        :filtered="Boolean(searchMode || searchInput)"
        @selection-change="selectedRows = $event"
        @navigate="navigateTo"
        @preview="previewFile"
        @download="handleDownload"
        @copy-link="copyLink"
        @copy-key="copyKey"
        @delete="handleDelete"
        @copy-selected="copySelectedLinks"
        @delete-selected="batchDelete"
        @size-change="handleSizeChange"
        @page-change="handleCurrentChange"
      >
        <template #empty>
          <EmptyState
            icon="FolderOpened"
            :title="searchMode || searchInput ? '没有匹配的文件' : '当前目录为空'"
            :description="searchMode || searchInput ? '更改搜索内容，或清除筛选。' : ''"
          >
            <el-button v-if="searchMode || searchInput" @click="clearSearch">清除筛选</el-button>
            <el-button v-else type="primary" icon="Upload" @click="goUploadHere">上传文件</el-button>
          </EmptyState>
        </template>
      </FileTable>
    </section>

    <FilePreview
      v-model:visible="previewVisible"
      :row="previewRow"
      :url="previewUrl"
      :name="previewRow ? getDisplayName(previewRow) : ''"
      :size="previewRow ? formatSize(previewRow.Size) : ''"
      @closed="resetPreview"
      @copy-link="copyLink"
      @download="handleDownload"
    />

    <el-dialog v-model="showCreateFolderDialog" title="新建文件夹" width="420px" append-to-body @opened="focusFolderName">
      <p class="folder-location">创建位置 <span>{{ currentPath.length ? '/' + currentPath.join('/') + '/' : '/' }}</span></p>
      <el-input ref="folderNameInput" v-model="newFolderName" placeholder="输入文件夹名称" aria-label="文件夹名称" @keyup.enter="createFolder" />
      <template #footer>
        <el-button @click="showCreateFolderDialog = false">取消</el-button>
        <el-button type="primary" :loading="creatingFolder" @click="createFolder">创建文件夹</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import FileToolbar from '@/components/files/FileToolbar.vue'
import FileTable from '@/components/files/FileTable.vue'
import FilePreview from '@/components/files/FilePreview.vue'
import { resolveS3ContentType } from '@/utils/upload-body'
import { getSignedObjectUrl } from '@/utils/s3-client'
import {
  listFolderContents,
  searchByPrefix,
  deleteAllUnderPrefix,
  deleteObjectKeys,
  copyToClipboard,
  buildObjectUrl
} from '@/utils/s3-helpers'

export default {
  name: 'FileList',
  components: { PageHeader, EmptyState, FileToolbar, FileTable, FilePreview },
  data() {
    return {
      currentPath: [],
      pathInput: '',
      searchScope: 'folder',
      showObjectKey: false,
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
      newFolderName: '',
      creatingFolder: false,
      requestId: 0,
      previewVisible: false,
      previewRow: null,
      previewUrl: ''
    }
  },
  computed: {
    ...mapGetters(['awsConfig', 's3Instance']),
    s3() { return this.s3Instance },
    filePresentation() {
      return {
        name: this.getDisplayName,
        icon: this.getFileIcon,
        isDirectory: this.isDirectory,
        canPreview: this.canPreview,
        date: this.formatDate,
        size: this.formatSize
      }
    },
    displayRows() {
      const q = this.searchInput.trim().toLowerCase()
      return this.searchScope === 'folder' && q
        ? this.allRows.filter(row => this.getDisplayName(row).toLowerCase().includes(q))
        : this.allRows
    },
    selectedFiles() {
      return this.selectedRows.filter(row => !this.isDirectory(row))
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
  },
  watch: {
    sortBy() {
      this.currentPage = 1
      this.clearSelection()
    },
    searchInput() {
      this.currentPage = 1
      this.clearSelection()
    },
    '$route.query.path'() { this.syncDirectory() },
    s3Instance() {
      this.previewVisible = false
      this.resetPreview()
      this.searchMode = false
      this.searchInput = ''
      this.searchPrefix = ''
      this.currentPath = this.$store.getters.currentDirectory.split('/').filter(Boolean)
      this.pathInput = this.currentPath.join('/')
      this.refreshList()
    }
  },
  created() {
    this.syncDirectory()
  },
  beforeUnmount() {
    this.requestId++
    this.resetPreview()
  },
  beforeRouteLeave(to, from, next) {
    if (this.$store.state.busyOperation || this.$store.state.switchingProfile) {
      this.$message.info('请等待当前操作完成')
      next(false)
    } else next()
  },
  methods: {
    syncDirectory() {
      const path = typeof this.$route.query.path === 'string' ? this.$route.query.path : this.$store.getters.currentDirectory
      this.currentPath = path.split('/').filter(Boolean)
      this.pathInput = this.currentPath.join('/')
      this.$store.commit('rememberDirectory', this.pathInput)
      this.searchMode = false
      this.searchPrefix = ''
      this.searchInput = ''
      this.refreshList()
    },
    clearSelection() {
      this.selectedRows = []
      if (this.$refs.table) this.$refs.table.clearSelection()
    },
    async refreshList() {
      const id = ++this.requestId
      const s3 = this.s3
      const bucket = this.awsConfig.bucketName
      this.allRows = []
      this.listTruncated = false
      this.clearSelection()
      if (!s3 || !bucket) { this.loading = false; return }
      this.loading = true
      try {
        if (this.searchMode && this.searchPrefix) {
          const { items, isTruncated } = await searchByPrefix(
            s3,
            bucket,
            this.searchPrefix,
            800
          )
          if (id !== this.requestId) return
          this.allRows = items
          this.listTruncated = isTruncated
        } else {
          const { directories, files, truncated } = await listFolderContents(
            s3,
            bucket,
            this.currentPath
          )
          if (id !== this.requestId) return
          this.allRows = [...directories, ...files]
          this.listTruncated = truncated
        }
        this.currentPage = 1
        this.$nextTick(() => this.$refs.table && this.$refs.table.clearSelection())
      } catch (error) {
        if (id !== this.requestId) return
        this.$message.error('加载失败：' + (error.message || error))
        this.allRows = []
      } finally {
        if (id === this.requestId) this.loading = false
      }
    },
    applySearch() {
      if (this.searchScope === 'folder') return
      const q = (this.searchInput || '').trim()
      if (!q) {
        this.clearSearch()
        return
      }
      this.searchMode = true
      this.searchPrefix = q
      this.refreshList()
    },
    clearSearch() {
      const wasGlobal = this.searchMode
      this.searchMode = false
      this.searchPrefix = ''
      this.searchInput = ''
      if (wasGlobal) this.refreshList()
    },
    changeSearchScope() {
      this.clearSearch()
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
      return new Date(date).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
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
      if (this.isDirectory(item)) return 'Folder'
      if (this.canPreview(item)) return 'Picture'
      const ext = this.getDisplayName(item)
        .split('.')
        .pop()
        .toLowerCase()
      const map = {
        pdf: 'Document',
        doc: 'Document',
        docx: 'Document',
        png: 'Picture',
        jpg: 'Picture',
        jpeg: 'Picture',
        gif: 'Picture',
        zip: 'FolderOpened'
      }
      return map[ext] || 'Document'
    },
    navigateTo(path) {
      const clean = String(path || '').replace(/^\/+|\/+$/g, '')
      if (clean === this.$route.query.path) this.syncDirectory()
      else this.$router.push({ path: '/files', query: { path: clean } }).catch(() => {})
    },
    navigateToRoot() {
      this.navigateTo('')
    },
    navigateToIndex(index) {
      this.navigateTo(this.currentPath.slice(0, index + 1).join('/'))
    },
    handleSizeChange(val) {
      this.pageSize = val
      this.currentPage = 1
      this.clearSelection()
    },
    handleCurrentChange(val) {
      this.currentPage = val
      this.clearSelection()
    },
    goUploadHere() {
      const path = this.currentPath.join('/')
      this.$router.push({
        path: '/upload',
        query: { path }
      }).catch(() => {})
    },
    async handleDownload(file) {
      try {
        const url = await getSignedObjectUrl(this.s3, {
          Bucket: this.awsConfig.bucketName,
          Key: file.Key,
          ResponseContentType: resolveS3ContentType(null, file.Key),
          ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(this.getDisplayName(file))}`
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
    canPreview(file) {
      return !this.isDirectory(file) && /\.(png|jpe?g|jfif|gif|webp|avif|bmp|ico|svg)$/i.test(file.Key)
    },
    resetPreview() {
      this.previewRow = null
      this.previewUrl = ''
    },
    async previewFile(file) {
      this.previewRow = file
      this.previewUrl = ''
      this.previewVisible = true
      try {
        const url = await getSignedObjectUrl(this.s3, {
          Bucket: this.awsConfig.bucketName,
          Key: file.Key,
          ResponseContentType: resolveS3ContentType(null, file.Key),
          ResponseContentDisposition: 'inline'
        })
        if (this.previewRow === file && this.previewVisible) this.previewUrl = url
      } catch (e) {
        if (this.previewRow === file) {
          this.previewVisible = false
          this.$message.error('预览失败：' + e.message)
        }
      }
    },
    async copyLink(file) {
      try {
        await copyToClipboard(buildObjectUrl(this.awsConfig, file.Key))
        this.$message.success('已复制链接')
      } catch (e) {
        this.$message.error('复制失败：' + e.message)
      }
    },
    async copySelectedLinks() {
      try {
        await copyToClipboard(this.selectedFiles.map(file => buildObjectUrl(this.awsConfig, file.Key)).join('\n'))
        this.$message.success(`已复制 ${this.selectedFiles.length} 个文件链接，每行一个`)
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
      if (this.$store.state.busyOperation) return
      const s3 = this.s3
      const bucket = this.awsConfig.bucketName
      this.$store.commit('setBusyOperation', true)
      const isDir = this.isDirectory(row)
      const tip = isDir
        ? `将删除文件夹「${this.getDisplayName(row)}」及其下全部对象，不可恢复。`
        : `确定删除「${this.getDisplayName(row)}」？`
      try {
        await this.$confirm(tip, '确认删除', {
          type: 'warning',
          closeOnHashChange: false,
          confirmButtonText: '删除',
          cancelButtonText: '取消'
        })
        this.loading = true
        if (isDir) {
          await deleteAllUnderPrefix(s3, bucket, row.Key)
        } else {
          await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: row.Key }))
        }
        this.$message.success('已删除')
        await this.refreshList()
      } catch (e) {
        if (e !== 'cancel' && e !== 'close') {
          this.$message.error('删除失败：' + (e.message || e))
          await this.refreshList()
        }
      } finally {
        this.loading = false
        this.$store.commit('setBusyOperation', false)
      }
    },
    async batchDelete() {
      if (this.$store.state.busyOperation) return
      const rows = [...this.selectedRows]
      if (!rows.length) return
      const s3 = this.s3
      const bucket = this.awsConfig.bucketName
      this.$store.commit('setBusyOperation', true)
      const hasDir = rows.some(r => this.isDirectory(r))
      try {
        await this.$confirm(
          hasDir
            ? '选中项包含文件夹，将删除其中全部对象。确定？'
            : `确定删除选中的 ${rows.length} 个对象？`,
          '批量删除',
          { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消', closeOnHashChange: false }
        )
        this.loading = true
        for (const row of rows) {
          if (this.isDirectory(row)) {
            await deleteAllUnderPrefix(
              s3,
              bucket,
              row.Key
            )
          }
        }
        await deleteObjectKeys(s3, bucket, rows.filter(row => !this.isDirectory(row)).map(row => row.Key))
        this.$message.success('已删除')
        await this.refreshList()
      } catch (e) {
        if (e !== 'cancel' && e !== 'close') {
          this.$message.error('删除失败：' + (e.message || e))
          await this.refreshList()
        }
      } finally {
        this.loading = false
        this.$store.commit('setBusyOperation', false)
      }
    },
    focusFolderName() {
      if (this.$refs.folderNameInput) this.$refs.folderNameInput.focus()
    },
    async createFolder() {
      if (this.creatingFolder || this.searchMode || this.$store.state.busyOperation) return
      const name = (this.newFolderName || '').trim()
      if (!name) {
        this.$message.warning('请输入名称')
        return
      }
      if (name.includes('/') || name === '.' || name === '..') {
        this.$message.warning('请输入单个文件夹名称，不包含 /，也不能为 . 或 ..')
        return
      }
      const prefix =
        this.currentPath.length > 0 ? this.currentPath.join('/') + '/' : ''
      const folderKey = prefix + name + '/'
      this.creatingFolder = true
      this.$store.commit('setBusyOperation', true)
      try {
        await this.s3.send(new PutObjectCommand({
          Bucket: this.awsConfig.bucketName,
          Key: folderKey,
          Body: ''
        }))
        this.$message.success('已创建')
        this.showCreateFolderDialog = false
        this.newFolderName = ''
        this.refreshList()
      } catch (e) {
        this.$message.error('创建失败：' + e.message)
      } finally {
        this.creatingFolder = false
        this.$store.commit('setBusyOperation', false)
      }
    }
  }
}
</script>

<style scoped>
.page-files { padding-bottom: 24px; }
.files-panel { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
.alert-truncated { width: auto; margin: 12px 16px 0; }
.folder-location { margin: 0 0 20px; color: var(--text-secondary); font-size: 12px; }
.folder-location span { margin-left: 8px; color: var(--text); font-family: var(--font-mono); overflow-wrap: anywhere; }
</style>
