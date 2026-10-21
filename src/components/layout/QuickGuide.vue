<template>
  <el-dialog title="使用帮助" :model-value="visible" width="500px" append-to-body @update:model-value="$emit('update:visible', $event)">
    <div v-for="(step, index) in steps" :key="step.title" class="guide-step"><span class="guide-step__number">0{{ index + 1 }}</span><div><h3>{{ step.title }}</h3><p>{{ step.text }}</p></div></div>
    <template #footer><el-button @click="$emit('update:visible', false)">关闭</el-button></template>
  </el-dialog>
</template>
<script>
export default {
  name: 'QuickGuide', props: { visible: Boolean }, emits: ['update:visible'], data: () => ({ steps: [
    { title: '配置切换', text: '在连接设置中保存 AWS 凭证、区域和 Bucket。使用顶部选择器或 ⌘ K / Ctrl K 快速查找、切换配置。每个配置会分别记住浏览目录。' },
    { title: '查找与预览', text: '当前目录支持按名称即时筛选；跨目录查找可切换为全局前缀搜索。点击图片名称预览，勾选多项可批量复制链接。' },
    { title: '上传与重试', text: '上传目标默认为当前目录。失败后可继续重试，已成功的文件不会再次上传。同名文件会被覆盖；使用 CDN 时还需等待缓存更新或手动刷新缓存。' }
  ] })
}
</script>
<style scoped>
.guide-step { display: flex; gap: 18px; margin: 0 0 25px; }
.guide-step__number { color: var(--accent); font: 12px var(--font-mono); padding-top: 4px; }
h3 { margin: 0 0 7px; color: var(--text); font-size: 14px; font-weight: 550; }
p { margin: 0; color: var(--text-secondary); font-size: 12px; line-height: 1.9; }
</style>
