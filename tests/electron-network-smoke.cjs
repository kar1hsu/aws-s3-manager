const { app, BrowserWindow, ipcMain, protocol, net } = require('electron')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { crc32 } = require('node:zlib')

// Exercise the real browser Fetch transport against an in-process S3 fixture.
// All credentials, objects and persisted app state are synthetic/local only.
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'aws-s3-network-smoke-'))
const bundle = path.resolve(process.env.AWS_S3_SMOKE_DIST || 'dist_electron/bundled')
const image = fs.readFileSync(path.join(bundle, 'icon.png'))
const objectKey = 'image/game/coin #1.png'
const requests = []
const errors = []
const blocked = []
let finished = false
app.setPath('userData', path.join(output, 'user-data'))
app.setPath('sessionData', path.join(output, 'session-data'))
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true } }])
ipcMain.handle('readConfig', () => null)
ipcMain.handle('saveConfig', () => true)

const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1')
  const chunks = []
  request.on('data', chunk => chunks.push(chunk))
  request.on('end', () => {
    requests.push({ method: request.method, url, headers: request.headers, body: Buffer.concat(chunks) })
    // Deliberately omit CORS headers: the desktop client must still work without
    // asking existing S3 users to reconfigure their bucket's CORS policy.
    if (request.method === 'GET' && url.searchParams.get('list-type') === '2') {
      response.writeHead(200, { 'content-type': 'application/xml' })
      response.end(`<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>${objectKey}</Key><Size>${image.length}</Size><LastModified>2026-10-21T08:00:00Z</LastModified></Contents></ListBucketResult>`)
    } else if (request.method === 'PUT') {
      response.writeHead(200, { etag: '"network-fixture"' })
      response.end()
    } else if (request.method === 'GET' && url.searchParams.get('response-content-disposition') === 'inline') {
      response.writeHead(200, { 'content-type': 'image/png', 'content-disposition': 'inline' })
      response.end(image)
    } else {
      response.writeHead(400, { 'content-type': 'application/xml' })
      response.end('<Error><Code>UnexpectedRequest</Code></Error>')
    }
  })
})

const finish = (error) => {
  if (finished) return
  finished = true
  clearTimeout(timeout)
  server.close()
  if (error) console.error(error, { errors, blocked })
  app.exit(error ? 1 : 0)
}
const timeout = setTimeout(() => finish(new Error('Real Fetch smoke timed out')), 45000)

app.whenReady().then(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  protocol.handle('app', async request => {
    const url = new URL(request.url)
    const filename = path.resolve(bundle, decodeURIComponent(url.pathname).replace(/^\/+/, ''))
    if (url.host !== 'bundle' || !filename.startsWith(bundle + path.sep)) return new Response('Forbidden', { status: 403 })
    const response = await net.fetch(pathToFileURL(filename).href)
    const headers = new Headers(response.headers)
    headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: http: data: blob:; font-src 'self' data:; connect-src 'self' https: http:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'")
    return new Response(response.body, { status: response.status, headers })
  })
  const bundledPreload = path.join(bundle, 'preload.js')
  const win = new BrowserWindow({ show: false, width: 1200, height: 800, webPreferences: {
    preload: fs.existsSync(bundledPreload) ? bundledPreload : path.resolve(__dirname, '../src/preload.js'),
    nodeIntegration: false, contextIsolation: true, sandbox: true,
    webSecurity: false, allowRunningInsecureContent: false, backgroundThrottling: false
  } })
  win.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, done) => {
    const url = new URL(details.url)
    const allowed = url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port === String(port)
    if (!allowed) blocked.push(url.origin)
    done({ cancel: !allowed })
  })
  win.webContents.on('console-message', ({ level, message }) => {
    if (level === 'error') errors.push(message)
  })
  await win.loadURL('app://bundle/index.html#/')
  const result = await win.webContents.executeJavaScript(`(async () => {
    const waitFor = async condition => {
      for (let i = 0; i < 200; i++) {
        if (condition()) return
        await new Promise(resolve => setTimeout(resolve, 30))
      }
      throw new Error('Network smoke UI timeout: ' + (window.networkStep || 'startup'))
    }
    await waitFor(() => document.querySelector('.page-config'))
    const rootInstance = document.querySelector('#app')._vnode.component
    const root = rootInstance.proxy
    const find = name => {
      const walk = vnode => {
        if (!vnode || typeof vnode !== 'object') return
        if (vnode.component) {
          if (vnode.component.type.name === name) return vnode.component.proxy
          const found = walk(vnode.component.subTree)
          if (found) return found
        }
        if (Array.isArray(vnode.children)) return vnode.children.map(walk).find(Boolean)
      }
      return walk(rootInstance.subTree)
    }
    root.$store.commit('setProfilesState', {
      profiles: [{ id: 'network', name: '本机网络测试', bucketName: 'fixture-bucket', region: 'us-east-1', accessKeyId: 'fixture-only-key', secretAccessKey: 'fixture-only-secret', cdnBaseUrls: [] }],
      activeProfileId: 'network'
    })
    root.$store.commit('initS3Instance')
    const client = root.$store.state.s3Instance
    client.config.endpoint = async () => ({ protocol: 'http:', hostname: '127.0.0.1', port: ${port}, path: '/' })
    client.config.isCustomEndpoint = true
    client.config.maxAttempts = async () => 1
    const handlerType = typeof client.config.requestHandler.handle
    window.networkStep = 'listing'
    await root.$router.push({ path: '/files', query: { path: 'image/game' } })
    await waitFor(() => find('FileList') && !find('FileList').loading && find('FileList').allRows.length === 1)
    const listedKey = find('FileList').allRows[0].Key
    window.networkStep = 'upload'
    await root.$router.push({ path: '/upload', query: { path: 'image/game' } })
    const upload = find('UploadFile')
    const bytes = Uint8Array.from(atob(${JSON.stringify(image.toString('base64'))}), value => value.charCodeAt(0))
    const raw = new File([bytes], 'coin #1.png', { type: 'application/octet-stream' })
    upload.handleFileChange({ uid: 'network-fixture', name: raw.name, size: raw.size, raw })
    await upload.handleUpload()
    if (upload.uploadStatus !== 'success') throw new Error('Real upload failed: ' + upload.fileList[0].error)
    const progress = upload.uploadProgress
    window.networkStep = 'preview'
    await root.$router.push({ path: '/files', query: { path: 'image/game' } })
    await waitFor(() => find('FileList') && !find('FileList').loading && find('FileList').allRows.length === 1)
    await find('FileList').previewFile(find('FileList').allRows[0])
    await waitFor(() => document.querySelector('.preview-image img')?.naturalWidth > 0)
    return {
      listedKey, progress, handlerType, runtime: client.config.runtime,
      imageWidth: document.querySelector('.preview-image img').naturalWidth,
      nodeGlobals: [typeof window.require, typeof window.Buffer, typeof window.process]
    }
  })()`)
  assert.equal(result.listedKey, objectKey)
  assert.equal(result.progress, 100)
  assert.equal(result.runtime, 'browser')
  assert.equal(result.handlerType, 'function')
  assert.equal(result.imageWidth, 256)
  assert.deepEqual(result.nodeGlobals, ['undefined', 'undefined', 'undefined'])
  const uploads = requests.filter(request => request.method === 'PUT')
  assert.equal(uploads.length, 1)
  const upload = uploads[0]
  assert.equal(upload.url.pathname, '/fixture-bucket/image/game/coin%20%231.png')
  assert.equal(upload.headers['content-type'], 'image/png')
  assert.deepEqual(upload.body, image)
  assert.match(upload.headers.authorization, /^AWS4-HMAC-SHA256 Credential=fixture-only-key\//)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(image))
  assert.equal(upload.headers['x-amz-checksum-crc32'], checksum.toString('base64'))
  const preview = requests.find(request => request.url.searchParams.get('response-content-disposition') === 'inline')
  assert.ok(preview)
  assert.equal(preview.url.searchParams.get('response-content-type'), 'image/png')
  assert.equal(preview.url.searchParams.get('X-Amz-Expires'), '300')
  assert.ok(preview.url.searchParams.get('X-Amz-Signature'))
  assert.deepEqual(blocked, [])
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ ok: true, electron: process.versions.electron, requests: requests.length, bytes: upload.body.length,
    checks: 'real browser Fetch, no bucket CORS, signed listing/upload/preview, inferred image MIME, exact bytes and CRC32, isolated renderer' }))
  finish()
}).catch(finish)
