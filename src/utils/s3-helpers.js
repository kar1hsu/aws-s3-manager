import { DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'

/**
 * 列出当前「目录」下的文件夹与文件（自动翻页聚合）
 */
export async function listFolderContents(s3, bucket, pathSegments) {
  const prefix =
    pathSegments.length > 0 ? pathSegments.join('/') + '/' : ''
  const dirMap = new Map()
  const files = []
  let continuationToken
  let pageCount = 0
  const maxPages = 50
  let truncated = false

  while (pageCount < maxPages) {
    pageCount++
    const data = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      Delimiter: '/',
      MaxKeys: 1000,
      ContinuationToken: continuationToken
    }))

    for (const cp of data.CommonPrefixes || []) {
      dirMap.set(cp.Prefix, {
        Key: cp.Prefix,
        LastModified: null,
        Size: 0
      })
    }
    for (const obj of data.Contents || []) {
      if (obj.Key.endsWith('/')) continue
      files.push(obj)
    }

    if (!data.IsTruncated) break
    continuationToken = data.NextContinuationToken
    if (!continuationToken) break
    if (pageCount >= maxPages) {
      truncated = true
      break
    }
  }

  const directories = [...dirMap.values()].sort((a, b) =>
    a.Key.localeCompare(b.Key)
  )
  files.sort((a, b) => a.Key.localeCompare(b.Key))
  return { directories, files, truncated }
}

export async function searchByPrefix(s3, bucket, searchPrefix, maxKeys = 500) {
  const data = await s3.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: searchPrefix,
    MaxKeys: maxKeys
  }))
  const items = (data.Contents || []).filter(o => !o.Key.endsWith('/'))
  return { items, isTruncated: !!data.IsTruncated }
}

export async function deleteObjectKeys(s3, bucket, keys) {
  const chunks = []
  for (let i = 0; i < keys.length; i += 1000) {
    chunks.push(keys.slice(i, i + 1000))
  }
  for (const keyChunk of chunks) {
    const result = await s3.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: keyChunk.map(Key => ({ Key })),
        Quiet: true
      }
    }))
    if (result.Errors && result.Errors.length) {
      const first = result.Errors[0]
      throw new Error(`${result.Errors.length} 个对象删除失败：${first.Key}（${first.Message || first.Code}）`)
    }
  }
}

export async function deleteAllUnderPrefix(s3, bucket, prefix) {
  let continuationToken
  const allKeys = []
  do {
    const data = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
      MaxKeys: 1000
    }))
    for (const o of data.Contents || []) {
      allKeys.push(o.Key)
    }
    continuationToken = data.NextContinuationToken
  } while (continuationToken)

  if (allKeys.length === 0) return
  await deleteObjectKeys(s3, bucket, allKeys)
}

/**
 * 标准 S3 对象 HTTPS URL（无预签名查询串），虚拟主机样式。
 * 对象未对匿名公开时，浏览器直接打开会 403，仅表示「桶内对象的规范链接」。
 */
export function buildPublicS3ObjectUrl(bucket, region, key) {
  const path = String(key || '')
    .split('/')
    .map(encodeURIComponent)
    .join('/')
  const r = region || 'us-east-1'
  let host
  if (/^cn-/.test(r)) {
    host = `${bucket}.s3.${r}.amazonaws.com.cn`
  } else if (r === 'us-east-1') {
    host = `${bucket}.s3.amazonaws.com`
  } else {
    host = `${bucket}.s3.${r}.amazonaws.com`
  }
  return `https://${host}/${path}`
}

/** 对象 Key 逐段编码，保留目录分隔符，避免空格、#、? 改变链接含义。 */
export function buildObjectUrl(config, key) {
  const base = (config.baseUrls || config.cdnBaseUrls || [])[0]
  if (!base) return buildPublicS3ObjectUrl(config.bucketName, config.region, key)
  const normalized = normalizeBaseUrl(base)
  return `${normalized}/${String(key).split('/').map(encodeURIComponent).join('/')}`
}

export function normalizeBaseUrl(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : `https://${text}`)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('访问域名请使用 HTTP/HTTPS 地址，不包含账号、查询参数或片段')
  }
  return url.href.replace(/\/+$/, '')
}

export async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch (e) { /* 剪贴板权限不可用时尝试兼容方式 */ }
  }
  const input = document.createElement('textarea')
  input.value = text
  input.style.position = 'fixed'
  input.style.left = '-9999px'
  document.body.appendChild(input)
  input.select()
  try {
    if (!document.execCommand('copy')) throw new Error('无法访问剪贴板')
  } finally {
    document.body.removeChild(input)
  }
}
