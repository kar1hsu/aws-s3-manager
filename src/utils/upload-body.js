/**
 * 使用标准 File/Blob API，兼容不再提供 File.path 的新版 Electron。
 * Uint8Array 同时受 SDK v3 的浏览器与 Node 上传实现支持，无需 Node 全局对象。
 */
export async function resolveS3UploadBody(raw) {
  if (!raw) {
    throw new Error('未找到文件数据，请重新选择文件')
  }

  if (typeof raw.arrayBuffer === 'function') {
    const ab = await raw.arrayBuffer()
    return new Uint8Array(ab)
  }

  throw new Error('无法读取该文件，请重新选择文件')
}

/**
 * 优先使用文件对象自带的 MIME type；Electron/OS 未识别时按扩展名兜底。
 */
export function resolveS3ContentType(raw, filename = '') {
  const suppliedType =
    raw && typeof raw.type === 'string' ? raw.type.trim() : ''

  if (suppliedType && suppliedType !== 'application/octet-stream') {
    return suppliedType
  }

  const match = String(filename).match(/\.([\w-]+)$/)
  const ext = match ? match[1].toLowerCase() : ''
  const mimeTypes = {
    avif: 'image/avif',
    bmp: 'image/bmp',
    gif: 'image/gif',
    heic: 'image/heic',
    heif: 'image/heif',
    ico: 'image/x-icon',
    jfif: 'image/jpeg',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    svg: 'image/svg+xml',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    webp: 'image/webp',
    pdf: 'application/pdf',
    txt: 'text/plain',
    json: 'application/json',
    csv: 'text/csv',
    zip: 'application/zip',
    mp4: 'video/mp4',
    mp3: 'audio/mpeg'
  }

  return (Object.prototype.hasOwnProperty.call(mimeTypes, ext) && mimeTypes[ext]) || suppliedType || 'application/octet-stream'
}
