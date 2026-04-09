/**
 * Electron + Node aws-sdk 下，el-upload 的 File/Blob 不能直接作为 S3 Body。
 * webpack 打包 aws-sdk 会走 browser 入口（isNode()=false），ManagedUpload
 * 不支持 Node stream，因此必须返回 Buffer（有 .slice），不能用 createReadStream。
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
        return await new Promise((resolve, reject) => {
          fs.readFile(p, (err, buf) => (err ? reject(err) : resolve(buf)))
        })
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
