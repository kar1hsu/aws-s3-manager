function genId() {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export const emptyProfile = () => ({
  id: genId(),
  name: '默认连接',
  accessKeyId: '',
  secretAccessKey: '',
  region: 'us-east-1',
  bucketName: '',
  /** 自定义访问基础 URL 列表，复制链接时用；第一项也可单独理解为「主域名」 */
  cdnBaseUrls: []
})

/** 从磁盘数据解析为 { profiles, activeProfileId } */
export function migrateFromDisk(raw) {
  if (!raw || typeof raw !== 'object') {
    const p = emptyProfile()
    return { profiles: [p], activeProfileId: p.id }
  }
  if (Array.isArray(raw.profiles) && raw.profiles.length) {
    const profiles = raw.profiles.map(normalizeProfile)
    const activeProfileId =
      raw.activeProfileId && profiles.some(x => x.id === raw.activeProfileId)
        ? raw.activeProfileId
        : profiles[0].id
    return { profiles, activeProfileId }
  }
  // 旧版：单对象平铺
  const p = normalizeProfile({
    ...raw,
    id: genId(),
    name: raw.name || '默认连接',
    cdnBaseUrls: normalizeCdnList(raw)
  })
  return { profiles: [p], activeProfileId: p.id }
}

function normalizeCdnList(raw) {
  const list = []
  if (raw.cdnBaseUrls && Array.isArray(raw.cdnBaseUrls)) {
    for (const u of raw.cdnBaseUrls) {
      const t = (u || '').trim().replace(/\/$/, '')
      if (t) list.push(t)
    }
  }
  const legacy = (raw.url || '').trim().replace(/\/$/, '')
  if (legacy && !list.includes(legacy)) list.unshift(legacy)
  return list
}

function normalizeProfile(p) {
  const id = p.id || genId()
  return {
    id,
    name: (p.name || '未命名').slice(0, 64),
    accessKeyId: p.accessKeyId != null ? String(p.accessKeyId) : '',
    secretAccessKey: p.secretAccessKey != null ? String(p.secretAccessKey) : '',
    region: p.region || 'us-east-1',
    bucketName: p.bucketName != null ? String(p.bucketName) : '',
    cdnBaseUrls: normalizeCdnList(p)
  }
}

/** 写入磁盘的完整对象 */
export function buildPersistPayload(profiles, activeProfileId) {
  return {
    version: 2,
    activeProfileId,
    profiles: profiles.map(p => ({
      id: p.id,
      name: p.name,
      accessKeyId: p.accessKeyId,
      secretAccessKey: p.secretAccessKey,
      region: p.region,
      bucketName: p.bucketName,
      cdnBaseUrls: [...(p.cdnBaseUrls || [])]
    }))
  }
}

/** 当前连接扁平给页面用（兼容原 awsConfig.url / 多域名） */
export function flatActiveProfile(p) {
  if (!p) {
    return {
      accessKeyId: '',
      secretAccessKey: '',
      region: 'us-east-1',
      bucketName: '',
      url: '',
      cdnBaseUrls: [],
      baseUrls: []
    }
  }
  const bases = [...(p.cdnBaseUrls || [])].map(u =>
    String(u || '')
      .trim()
      .replace(/\/$/, '')
  ).filter(Boolean)
  return {
    ...p,
    url: bases[0] || '',
    cdnBaseUrls: bases,
    baseUrls: bases
  }
}
