<template>
  <div class="page-config">
    <div class="page-head">
      <h1 class="page-title">连接设置</h1>
      <p class="page-desc">支持多个 AWS 连接；自定义域名可填多行，复制链接时可选。</p>
    </div>

    <el-card class="config-card" shadow="hover" v-loading="!configLoaded">
      <div slot="header" class="card-head">
        <div class="profile-bar">
          <span class="card-title">AWS S3</span>
          <el-select
            v-model="selectedProfileId"
            placeholder="选择连接"
            class="profile-select"
            @change="onSwitchProfile"
          >
            <el-option
              v-for="p in profiles"
              :key="p.id"
              :label="p.name || '未命名'"
              :value="p.id"
            />
          </el-select>
          <el-button size="small" icon="el-icon-plus" @click="onAddProfile">新建连接</el-button>
          <el-button
            size="small"
            icon="el-icon-delete"
            :disabled="profiles.length <= 1"
            @click="onRemoveProfile"
          >删除当前</el-button>
        </div>
        <el-button
          size="small"
          :loading="testing"
          :disabled="!canTestForm"
          @click="testConnection"
        >
          <i class="el-icon-connection"></i> 测试连接
        </el-button>
      </div>

      <el-form ref="form" :model="form" label-width="140px" class="config-form">
        <el-form-item label="连接名称">
          <el-input v-model="form.name" placeholder="便于区分，如：生产 Bucket" clearable />
        </el-form-item>
        <el-form-item label="Access Key ID" required>
          <el-input
            v-model="form.accessKeyId"
            placeholder="必填"
            clearable
            show-password
          />
        </el-form-item>
        <el-form-item label="Secret Access Key" required>
          <el-input
            v-model="form.secretAccessKey"
            type="password"
            show-password
            placeholder="必填"
            clearable
          />
        </el-form-item>
        <el-form-item label="区域 Region" required>
          <el-select
            v-model="form.region"
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入区域代码"
            style="width: 100%"
          >
            <el-option
              v-for="r in regionOptions"
              :key="r.value"
              :label="r.label"
              :value="r.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="Bucket 名称" required>
          <el-input v-model="form.bucketName" placeholder="my-bucket" clearable />
        </el-form-item>
        <el-form-item label="自定义访问域名">
          <el-input
            v-model="form.cdnUrlsText"
            type="textarea"
            :rows="4"
            placeholder="每行一个基础 URL，例如：https://cdn.example.com;https://d111111.cloudfront.net"
          />
          <div class="form-tip">
            用于「复制链接」时拼接对象 Key；可填多个 CDN/域名。不填则仅可复制 S3 预签名链接。
          </div>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="saveConfig">
            保存当前连接
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script>
import AWS from 'aws-sdk'
import { mapGetters, mapActions } from 'vuex'

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
        cdnUrlsText: ''
      },
      testing: false,
      saving: false,
      switching: false
    }
  },
  computed: {
    ...mapGetters(['profiles', 'activeProfileId', 'configLoaded', 'activeProfile']),
    canTestForm() {
      return !!(
        this.form.accessKeyId &&
        this.form.secretAccessKey &&
        this.form.region &&
        this.form.bucketName
      )
    }
  },
  watch: {
    configLoaded(v) {
      if (v) this.syncFromStore()
    },
    activeProfileId(v) {
      if (v && !this.switching) this.selectedProfileId = v
    }
  },
  mounted() {
    this.selectedProfileId = this.activeProfileId
    this.syncFromStore()
  },
  methods: {
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
        cdnUrlsText: (p.cdnBaseUrls || []).join('\n')
      }
    },
    async onSwitchProfile(id) {
      if (!id || id === this.activeProfileId) return
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
      try {
        await this.addProfile()
        this.syncFromStore()
        this.$message.success('已添加新连接，请填写后保存')
      } catch (e) {
        this.$message.error(e.message || '添加失败')
      }
    },
    async onRemoveProfile() {
      try {
        await this.$confirm('确定删除当前连接配置？', '提示', { type: 'warning' })
        await this.removeProfile(this.activeProfileId)
        this.syncFromStore()
        this.$message.success('已删除')
      } catch (e) {
        if (e !== 'cancel') this.$message.error(e.message || '删除失败')
      }
    },
    buildS3() {
      return new AWS.S3({
        accessKeyId: this.form.accessKeyId,
        secretAccessKey: this.form.secretAccessKey,
        region: this.form.region,
        signatureVersion: 'v4',
        s3ForcePathStyle: true,
        endpoint: `https://s3.${this.form.region}.amazonaws.com`
      })
    },
    async testConnection() {
      if (!this.canTestForm) {
        this.$message.warning('请先填写完整凭证与 Bucket')
        return
      }
      this.testing = true
      try {
        const s3 = this.buildS3()
        await s3.headBucket({ Bucket: this.form.bucketName }).promise()
        this.$message.success('连接成功，可访问该 Bucket')
      } catch (e) {
        const msg =
          e.code === 'Forbidden' || e.statusCode === 403
            ? '无权限访问该 Bucket（403）'
            : e.code === 'NotFound' || e.statusCode === 404
              ? 'Bucket 不存在（404）'
              : e.message || '连接失败'
        this.$message.error(msg)
      } finally {
        this.testing = false
      }
    },
    async saveConfig() {
      if (
        !this.form.accessKeyId ||
        !this.form.secretAccessKey ||
        !this.form.region ||
        !this.form.bucketName
      ) {
        this.$message.warning('请填写 Access Key、Secret、区域与 Bucket')
        return
      }
      const cdnBaseUrls = this.form.cdnUrlsText
        .split('\n')
        .map(s => s.trim().replace(/\/$/, ''))
        .filter(Boolean)

      this.saving = true
      try {
        await this.saveActiveProfile({
          name: this.form.name,
          accessKeyId: this.form.accessKeyId,
          secretAccessKey: this.form.secretAccessKey,
          region: this.form.region,
          bucketName: this.form.bucketName,
          cdnBaseUrls
        })
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
  padding-bottom: 32px;
}

.page-head {
  margin-bottom: 20px;
}

.page-title {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: -0.03em;
}

.page-desc {
  margin: 0;
  font-size: 14px;
  color: #718096;
}

.config-card {
  border-radius: 14px;
  border: none;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
}

.config-card >>> .el-card__header {
  padding: 16px 20px;
  border-bottom: 1px solid #f0f2f5;
}

.card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-weight: 600;
  font-size: 16px;
}

.profile-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.card-title {
  margin-right: 8px;
}

.profile-select {
  width: 200px;
}

.config-form {
  max-width: 640px;
  padding: 8px 0 16px;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
  margin-top: 6px;
}
</style>
