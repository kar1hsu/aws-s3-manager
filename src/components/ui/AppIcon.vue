<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" :stroke-width="strokeWidth" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-for="(path, index) in paths" :key="index" :d="path" /></svg>
</template>
<script>
const icons = {
  folder: ['M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3Z'],
  upload: ['M12 16V3', 'm7 8 5-5 5 5', 'M4 15v5h16v-5'],
  settings: ['M4 7h16M4 17h16', 'M8 4v6M16 14v6'],
  help: ['M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5', 'M12 16h.01', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0'],
  chevron: ['m9 5 7 7-7 7'],
  bucket: ['M5 6c0-4 14-4 14 0s-14 4-14 0', 'M5 6v12c0 4 14 4 14 0V6', 'M5 12c0 4 14 4 14 0'],
  grid: ['M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z']
}
export default { name: 'AppIcon', props: { name: { type: String, required: true }, size: { type: [Number, String], default: 20 }, strokeWidth: { type: [Number, String], default: 1.6 } }, computed: { paths() { return icons[this.name] || icons.folder } } }
</script>
