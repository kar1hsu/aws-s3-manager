/**
 * Electron + Node aws-sdk 下，el-upload 的 File/Blob 不能直接作为 S3 Body。
 * 优先用本地路径流式上传；否则读入 Buffer。
 */
export async function resolveS3UploadBody(raw) {
  if (!raw) {
    throw new Error('未找到文件数据，请重新选择文件')
  }

  const tryRequire = () => {
    if (typeof window !== 'undefined' && typeof window.require === 'function') {
      try {
        return window.require
      } catch (e) {
        return null
      }
    }
    if (typeof require !== 'undefined') {
      try {
        return require
      } catch (e) {
        return null
      }
    }
    return null
  }

  const req = tryRequire()
  const p = raw.path
  if (req && typeof p === 'string' && p.length > 0) {
    try {
      const fs = req('fs')
      if (fs.existsSync(p)) {
        return fs.createReadStream(p)
      }
    } catch (e) {
      /* 继续走内存 */
    }
  }

  if (typeof raw.arrayBuffer === 'function') {
    const ab = await raw.arrayBuffer()
    return Buffer.from(ab)
  }

  throw new Error('无法读取该文件，请换用「选择文件」或更新 Electron 版本')
}
