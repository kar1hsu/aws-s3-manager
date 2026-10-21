const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { transformSync } = require('@babel/core')

function loadSource(relative) {
  const filename = path.resolve(__dirname, '..', relative)
  const mod = new Module(filename, module)
  mod.filename = filename
  mod.paths = Module._nodeModulePaths(path.dirname(filename))
  mod._compile(transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, babelrc: false, configFile: false,
    plugins: ['@babel/plugin-transform-modules-commonjs']
  }).code, filename)
  return mod.exports
}

const { createS3Client, uploadObject, getSignedObjectUrl } = loadSource('src/utils/s3-client.js')
const { resolveS3UploadBody, resolveS3ContentType } = loadSource('src/utils/upload-body.js')
const config = { accessKeyId: 'test-access-key', secretAccessKey: 'test-secret-key', region: 'us-east-1' }

// This request handler receives real serialized/signed SDK requests, but never
// opens a socket. Only synthetic credentials and objects are used.
function fixtureClient(respond) {
  const client = createS3Client(config)
  const requests = []
  client.config.maxAttempts = async () => 1
  client.config.requestHandler = {
    async handle(request) {
      requests.push(request)
      const result = await respond(request)
      return { response: { statusCode: 200, headers: {}, body: Buffer.from(''), ...result } }
    },
    destroy() {}
  }
  return { client, requests }
}

test('File/Blob upload body needs neither File.path nor renderer Node globals', async () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/utils/upload-body.js'), 'utf8')
  const vm = require('node:vm')
  const context = vm.createContext({ Uint8Array, ArrayBuffer, Error, exports: {} })
  vm.runInContext(transformSync(source, {
    babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs']
  }).code, context)
  assert.equal(vm.runInContext('typeof Buffer + ":" + typeof require + ":" + typeof process', context), 'undefined:undefined:undefined')
  const bytes = new Uint8Array([137, 80, 78, 71])
  const body = await context.exports.resolveS3UploadBody({ arrayBuffer: async () => bytes.buffer })
  assert.ok(body instanceof Uint8Array)
  assert.deepEqual([...body], [...bytes])
  await assert.rejects(context.exports.resolveS3UploadBody({ path: '/not-a-real-file.png' }), /重新选择/)
})

test('real SDK v3 upload sends inferred image Content-Type and exact bytes', async () => {
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const raw = { type: 'application/octet-stream', arrayBuffer: async () => bytes.buffer }
  const { client, requests } = fixtureClient(() => ({ headers: { etag: '"fixture-etag"' } }))
  const progress = []
  try {
    await uploadObject(client, {
      Bucket: 'test-bucket', Key: 'image/coin #1.png', Body: await resolveS3UploadBody(raw),
      ContentType: resolveS3ContentType(raw, 'coin #1.png')
    }, event => progress.push(event))
    assert.equal(requests.length, 1)
    assert.equal(requests[0].method, 'PUT')
    assert.equal(requests[0].headers['content-type'], 'image/png')
    assert.equal(requests[0].path, '/test-bucket/image/coin%20%231.png')
    assert.deepEqual(new Uint8Array(requests[0].body), bytes)
    assert.match(requests[0].headers.authorization, /AWS4-HMAC-SHA256/)
    assert.equal(progress.at(-1).loaded, bytes.length)
  } finally { client.destroy() }
})

test('real multipart failure aborts incomplete parts and a new upload retries successfully', async () => {
  let attempt = 0
  const { client, requests } = fixtureClient(request => {
    if (request.method === 'POST' && Object.hasOwn(request.query, 'uploads')) {
      attempt++
      return { body: Buffer.from(`<InitiateMultipartUploadResult><Bucket>test-bucket</Bucket><Key>large.png</Key><UploadId>upload-${attempt}</UploadId></InitiateMultipartUploadResult>`) }
    }
    if (request.method === 'PUT' && request.query.partNumber) {
      if (attempt === 1 && request.query.partNumber === '2') {
        return { statusCode: 500, body: Buffer.from('<Error><Code>InternalError</Code><Message>simulated part failure</Message></Error>') }
      }
      return { headers: { etag: `"part-${request.query.partNumber}"` } }
    }
    if (request.method === 'DELETE') return { statusCode: 204 }
    if (request.method === 'POST' && request.query.uploadId) {
      return { body: Buffer.from('<CompleteMultipartUploadResult><Bucket>test-bucket</Bucket><Key>large.png</Key><ETag>"complete"</ETag></CompleteMultipartUploadResult>') }
    }
    throw new Error('Unexpected multipart request: ' + request.method + ' ' + JSON.stringify(request.query))
  })
  const params = { Bucket: 'test-bucket', Key: 'large.png', Body: new Uint8Array(6 * 1024 * 1024), ContentType: 'image/png' }
  try {
    await assert.rejects(uploadObject(client, params), /simulated part failure/)
    assert.equal(requests.filter(request => request.method === 'DELETE' && request.query.uploadId === 'upload-1').length, 1)
    assert.equal(requests.filter(request => request.method === 'POST' && request.query.uploadId === 'upload-1').length, 0)
    const result = await uploadObject(client, params)
    assert.equal(result.ETag, '"complete"')
    assert.equal(attempt, 2)
    assert.equal(requests.filter(request => request.method === 'PUT' && request.query.uploadId === 'upload-2').length, 2)
    assert.ok(requests.filter(request => Object.hasOwn(request.query, 'uploads')).every(request => request.headers['content-type'] === 'image/png'))
  } finally { client.destroy() }
})

test('presigned preview and download preserve special keys, MIME, disposition and expiry without networking', async () => {
  const { client, requests } = fixtureClient(() => { throw new Error('Signing must not make a request') })
  try {
    for (const disposition of ['inline', "attachment; filename*=UTF-8''coin%20%231.png"]) {
      const url = new URL(await getSignedObjectUrl(client, {
        Bucket: 'test-bucket', Key: '图片/coin #1.png',
        ResponseContentType: 'image/png', ResponseContentDisposition: disposition
      }))
      assert.equal(decodeURIComponent(url.pathname), '/test-bucket/图片/coin #1.png')
      assert.equal(url.searchParams.get('response-content-type'), 'image/png')
      assert.equal(url.searchParams.get('response-content-disposition'), disposition)
      assert.equal(url.searchParams.get('X-Amz-Expires'), '300')
      assert.ok(url.searchParams.get('X-Amz-Signature'))
    }
    assert.equal(requests.length, 0)
  } finally { client.destroy() }
})
