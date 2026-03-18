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
    const data = await s3
      .listObjectsV2({
        Bucket: bucket,
        Prefix: prefix,
        Delimiter: '/',
        MaxKeys: 1000,
        ContinuationToken: continuationToken
      })
      .promise()

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
  const data = await s3
    .listObjectsV2({
      Bucket: bucket,
      Prefix: searchPrefix,
      MaxKeys: maxKeys
    })
    .promise()
  const items = (data.Contents || []).filter(o => !o.Key.endsWith('/'))
  return { items, isTruncated: !!data.IsTruncated }
}

export async function deleteObjectKeys(s3, bucket, keys) {
  const chunks = []
  for (let i = 0; i < keys.length; i += 1000) {
    chunks.push(keys.slice(i, i + 1000))
  }
  for (const keyChunk of chunks) {
    await s3
      .deleteObjects({
        Bucket: bucket,
        Delete: {
          Objects: keyChunk.map(Key => ({ Key })),
          Quiet: true
        }
      })
      .promise()
  }
}

export async function deleteAllUnderPrefix(s3, bucket, prefix) {
  let continuationToken
  const allKeys = []
  do {
    const data = await s3
      .listObjectsV2({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000
      })
      .promise()
    for (const o of data.Contents || []) {
      allKeys.push(o.Key)
    }
    continuationToken = data.NextContinuationToken
  } while (continuationToken)

  if (allKeys.length === 0) return
  await deleteObjectKeys(s3, bucket, allKeys)
}

export async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text)
  }
  const input = document.createElement('input')
  input.value = text
  document.body.appendChild(input)
  input.select()
  document.execCommand('copy')
  document.body.removeChild(input)
}
