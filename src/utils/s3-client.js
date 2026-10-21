import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/** 每个连接使用独立客户端，不修改 SDK 的全局凭证。 */
export function createS3Client(config) {
  return new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    },
    region: config.region,
    forcePathStyle: true
  })
}

/** 自动选择普通/分段上传；失败时清理尚未完成的分段。 */
export async function uploadObject(s3, params, onProgress) {
  const upload = new Upload({
    client: s3,
    params,
    leavePartsOnError: false
  })
  if (onProgress) upload.on('httpUploadProgress', onProgress)
  return upload.done()
}

/** 签名有效期是签名选项，不能混入 GetObject 的请求参数。 */
export function getSignedObjectUrl(s3, params, expiresIn = 300) {
  return getSignedUrl(s3, new GetObjectCommand(params), { expiresIn })
}
