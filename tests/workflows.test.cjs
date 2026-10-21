const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { transformSync } = require('@babel/core')
const { parse } = require('@vue/compiler-sfc')

// Only replace network-oriented SDK boundaries; the actual application wrappers,
// commands and Vue components still run. s3-sdk.test.cjs covers the real SDK.
const workflowStubs = {
  '@aws-sdk/lib-storage': {
    Upload: class {
      constructor({ client, params, leavePartsOnError }) {
        assert.equal(leavePartsOnError, false, 'failed multipart uploads must be cleaned up')
        this.client = client
        this.params = params
      }
      on(event, callback) { assert.equal(event, 'httpUploadProgress'); this.progress = callback; return this }
      done() { return this.client.uploadObject(this.params, this.progress) }
    }
  },
  '@aws-sdk/s3-request-presigner': {
    getSignedUrl: (client, command, options) => client.signObject(command, options)
  }
}

// Load the actual Vue 3 component scripts and ES modules without a browser or AWS credentials.
const root = path.resolve(__dirname, '..')
const cache = new Map()
function load(relative, stubs = workflowStubs, moduleCache = cache) {
  let filename = path.resolve(root, relative)
  if (!path.extname(filename)) filename += '.js'
  if (moduleCache.has(filename)) return moduleCache.get(filename)
  const source = fs.readFileSync(filename, 'utf8')
  const code = filename.endsWith('.vue') ? parse(source).descriptor.script.content : source
  const mod = new Module(filename, module)
  mod.filename = filename
  mod.paths = Module._nodeModulePaths(path.dirname(filename))
  mod.require = request => {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request]
    if (request.startsWith('@/')) return load('src/' + request.slice(2), stubs, moduleCache)
    if (request.startsWith('.') && ['', '.js', '.vue'].includes(path.extname(request))) {
      return load(path.resolve(path.dirname(filename), request), stubs, moduleCache)
    }
    return Module.prototype.require.call(mod, request)
  }
  mod._compile(transformSync(code, {
    filename, babelrc: false, configFile: false,
    plugins: ['@babel/plugin-transform-modules-commonjs']
  }).code, filename)
  moduleCache.set(filename, mod.exports)
  return mod.exports
}

const helpers = load('src/utils/s3-helpers.js')
const { resolveS3ContentType } = load('src/utils/upload-body.js')
const Upload = load('src/views/UploadFile.vue').default
const Files = load('src/views/FileList.vue').default
const Config = load('src/views/Config.vue').default
const App = load('src/App.vue').default

function context(component, s3) {
  const messages = []
  const getters = {
    awsConfig: { bucketName: 'test-bucket', region: 'us-east-1', baseUrls: ['https://cdn.example.com'] },
    s3Instance: s3,
    currentDirectory: 'image/game'
  }
  const state = { busyOperation: false, hasPendingUploads: false, switchingProfile: false }
  const vm = {
    ...component.data(),
    $store: { getters, state, commit(type, value) {
      if (type === 'rememberDirectory') getters.currentDirectory = value
      if (type === 'setBusyOperation') state.busyOperation = value
      if (type === 'setPendingUploads') state.hasPendingUploads = value
    } },
    $refs: {}, $route: { query: { path: 'image/game' } },
    $router: { push: route => { vm.lastRoute = route; return Promise.resolve() } },
    $nextTick: callback => callback(),
    $message: Object.fromEntries(['error', 'warning', 'info', 'success'].map(key => [key, message => messages.push(message)])),
    $confirm: async () => {}, messages
  }
  for (const [name, fn] of Object.entries(component.methods)) vm[name] = fn.bind(vm)
  for (const [name, getter] of Object.entries(component.computed || {})) Object.defineProperty(vm, name, { get: () => getter.call(vm) })
  return vm
}

function profileSwitcher() {
  const vm = context(App)
  Object.assign(vm.$store.getters, { activeProfileId: 'original', isConfigured: true, currentDirectory: 'original/folder' })
  vm.$route.path = '/files'
  vm.$router.replace = async route => { vm.lastRoute = route }
  return vm
}

function file(name, uid) {
  return { name, uid, size: 10, raw: { type: '', arrayBuffer: async () => new ArrayBuffer(10) } }
}

function uploader(onUpload) {
  const calls = []
  return {
    calls,
    async uploadObject(params, progress) {
      calls.push(params)
      progress({ loaded: 5, total: 10 })
      if (onUpload) await onUpload(params)
      return {}
    }
  }
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

function storeWithPersistence(save) {
  const store = load('src/store/index.js', {
    ...workflowStubs,
    '@/utils/app-config-storage': { saveAppConfig: save, readAppConfig: async () => null }
  }, new Map()).default
  store.commit('setProfilesState', {
    profiles: ['original', 'target'].map(id => ({
      id, name: id, region: 'us-east-1', bucketName: `${id}-bucket`,
      accessKeyId: '', secretAccessKey: '', cdnBaseUrls: []
    })),
    activeProfileId: 'original'
  })
  return store
}

test('links encode special characters without breaking directories; no-extension names remain binary', () => {
  assert.equal(helpers.buildObjectUrl({ baseUrls: ['cdn.example.com/assets/'] }, '图片/a #?%.png'),
    'https://cdn.example.com/assets/%E5%9B%BE%E7%89%87/a%20%23%3F%25.png')
  assert.equal(helpers.buildObjectUrl({ bucketName: 'test', region: 'cn-north-1' }, 'a.png'),
    'https://test.s3.cn-north-1.amazonaws.com.cn/a.png')
  assert.equal(resolveS3ContentType({ type: 'application/octet-stream' }, 'photo.WEBP'), 'image/webp')
  assert.equal(resolveS3ContentType({ type: 'image/jpeg' }, 'wrong.png'), 'image/jpeg')
  assert.equal(resolveS3ContentType(null, 'png'), 'application/octet-stream')
  assert.equal(resolveS3ContentType(null, 'file.constructor'), 'application/octet-stream')
  assert.throws(() => helpers.normalizeBaseUrl('https://cdn.example.com?token=invalid'))
})

test('removed uploads are excluded; retry only sends failed files and keeps successful URLs', async () => {
  let fail = true
  const s3 = uploader(params => { if (params.Key.endsWith('retry.png') && fail) throw new Error('simulated failure') })
  const vm = context(Upload, s3)
  vm.syncPathFromRoute()
  vm.handleFileChange(file('ok.png', 1))
  vm.handleFileChange(file('retry.png', 2))
  vm.handleFileChange(file('removed.png', 3))
  vm.removeFile(vm.fileList[2])
  vm.handleFileChange(file('ok.png', 4))
  assert.equal(vm.fileList.length, 2)
  await vm.handleUpload()
  assert.deepEqual(s3.calls.map(call => call.Key), ['image/game/ok.png', 'image/game/retry.png'])
  assert.equal(vm.completedFiles.length, 1)
  assert.equal(vm.pendingFiles.length, 1)
  assert.equal(vm.uploadStatus, 'exception')
  assert.equal(s3.calls[0].ContentType, 'image/png')
  fail = false
  await vm.handleUpload()
  assert.deepEqual(s3.calls.map(call => call.Key), ['image/game/ok.png', 'image/game/retry.png', 'image/game/retry.png'])
  assert.equal(vm.completedFiles.length, 2)
  assert.equal(vm.completedFiles[0].publicUrl, 'https://cdn.example.com/image/game/ok.png')
  assert.equal(vm.uploadProgress, 100)
  assert.equal(vm.$store.state.busyOperation, false)
  vm.goToFiles()
  assert.equal(vm.lastRoute.query.path, 'image/game')
})

test('upload snapshots its client, bucket and directory; re-entry and removal are blocked', async () => {
  let vm
  const s3 = uploader(async () => {
    vm.$store.getters.awsConfig = { bucketName: 'other-bucket', region: 'us-west-2' }
    vm.$store.getters.s3Instance = uploader(() => { throw new Error('wrong client') })
    vm.setDirectory('wrong-directory')
    vm.removeFile(vm.fileList[1])
    await vm.handleUpload()
    let allowed = true
    await vm.confirmLeave(result => { allowed = result })
    assert.equal(allowed, false)
  })
  vm = context(Upload, s3)
  vm.syncPathFromRoute()
  vm.handleFileChange(file('one.png', 1))
  vm.handleFileChange(file('two.png', 2))
  await vm.handleUpload()
  assert.equal(s3.calls.length, 2)
  assert.ok(s3.calls.every(call => call.Bucket === 'test-bucket' && call.Key.startsWith('image/game/')))
})

test('stop finishes the active upload and leaves remaining files pending', async () => {
  let vm
  const s3 = uploader(() => { vm.stopRequested = true })
  vm = context(Upload, s3)
  vm.syncPathFromRoute()
  vm.handleFileChange(file('one.png', 1))
  vm.handleFileChange(file('two.png', 2))
  await vm.handleUpload()
  assert.equal(s3.calls.length, 1)
  assert.equal(vm.completedFiles.length, 1)
  assert.equal(vm.pendingFiles.length, 1)
  assert.equal(vm.uploadStatus, 'warning')
})

test('a late directory response cannot overwrite the latest list or its loading state', async () => {
  const responses = []
  const vm = context(Files, { send: command => {
    assert.equal(command.constructor.name, 'ListObjectsV2Command')
    return new Promise(resolve => responses.push(resolve))
  } })
  const old = vm.refreshList()
  vm.currentPath = ['new']
  const recent = vm.refreshList()
  responses[1]({ Contents: [{ Key: 'new/current.png' }] })
  await recent
  responses[0]({ Contents: [{ Key: 'old/stale.png' }] })
  await old
  assert.deepEqual(vm.allRows.map(row => row.Key), ['new/current.png'])
  assert.equal(vm.loading, false)
})

test('a late upload directory response is discarded after switching configuration', async () => {
  const response = deferred()
  let requests = 0
  const vm = context(Upload, { send: command => {
    requests++
    assert.equal(command.constructor.name, 'ListObjectsV2Command')
    return response.promise
  } })
  let nodes
  const loading = vm.loadTreeNode({ level: 0 }, value => { nodes = value })
  vm.$store.getters.s3Instance = { send: async () => { throw new Error('wrong client') } }
  vm.$store.getters.awsConfig = { bucketName: 'other-bucket' }
  response.resolve({ CommonPrefixes: [{ Prefix: 'stale/' }], IsTruncated: true, NextContinuationToken: 'old-token' })
  await loading
  assert.deepEqual(nodes, [])
  assert.equal(requests, 1, 'old profile directory pagination must stop')
  assert.deepEqual(vm.messages, [])
})

test('local filtering matches filename fragments; leaving global search retains the folder', () => {
  const vm = context(Files)
  vm.allRows = [{ Key: 'image/game/BlueCoin.PNG' }, { Key: 'image/game/red.png' }]
  vm.searchInput = 'coin'
  assert.deepEqual(vm.displayRows.map(row => row.Key), ['image/game/BlueCoin.PNG'])
  vm.currentPath = ['image', 'game']
  vm.refreshList = () => {}
  vm.searchScope = 'global'
  vm.searchInput = 'docs/'
  vm.applySearch()
  vm.clearSearch()
  assert.deepEqual(vm.currentPath, ['image', 'game'])
})

test('preview uses inline image MIME even for old object metadata; stale preview is discarded', async () => {
  let params
  let resolve
  const vm = context(Files, { signObject: (command, options) => {
    assert.equal(command.constructor.name, 'GetObjectCommand')
    assert.equal(options.expiresIn, 300)
    params = command.input
    return new Promise(done => { resolve = done })
  } })
  const pending = vm.previewFile({ Key: 'image/game/photo.webp' })
  assert.equal(params.ResponseContentType, 'image/webp')
  assert.equal(params.ResponseContentDisposition, 'inline')
  vm.resetPreview()
  resolve('https://example.com/temporary')
  await pending
  assert.equal(vm.previewUrl, '')
})

test('download signs an attachment with an encoded filename rather than using the inline preview URL', async () => {
  const previousDocument = global.document
  let commandInput
  let clicked = false
  const link = { click: () => { clicked = true } }
  global.document = { createElement: () => link, body: { appendChild() {}, removeChild() {} } }
  try {
    const vm = context(Files, { signObject: async (command, options) => {
      commandInput = command.input
      assert.equal(options.expiresIn, 300)
      return 'https://example.com/signed-download'
    } })
    await vm.handleDownload({ Key: 'image/coin #1.png' })
    assert.equal(commandInput.ResponseContentType, 'image/png')
    assert.equal(commandInput.ResponseContentDisposition, "attachment; filename*=UTF-8''coin%20%231.png")
    assert.equal(link.href, 'https://example.com/signed-download')
    assert.equal(link.download, 'coin #1.png')
    assert.equal(clicked, true)
    assert.deepEqual(vm.messages, [])
  } finally {
    if (previousDocument === undefined) delete global.document
    else global.document = previousDocument
  }
})

test('S3 partial delete failures are surfaced instead of reporting success', async () => {
  const s3 = { send: async command => {
    assert.equal(command.constructor.name, 'DeleteObjectsCommand')
    return { Errors: [{ Key: 'locked.png', Code: 'AccessDenied' }] }
  } }
  await assert.rejects(() => helpers.deleteObjectKeys(s3, 'bucket', ['locked.png']), /AccessDenied/)
})

test('connection check uses HeadBucketCommand, recognizes v3 status metadata, and releases its client', async () => {
  for (const status of [200, 403, 404]) {
    const vm = context(Config)
    Object.assign(vm.form, { accessKeyId: 'fixture', secretAccessKey: 'fixture', region: 'us-east-1', bucketName: ' test-bucket ' })
    let destroyed = false
    vm.buildS3 = () => ({
      send: async command => {
        assert.equal(command.constructor.name, 'HeadBucketCommand')
        assert.equal(command.input.Bucket, 'test-bucket')
        if (status !== 200) throw Object.assign(new Error('service error'), { $metadata: { httpStatusCode: status } })
      },
      destroy: () => { destroyed = true }
    })
    await vm.testConnection()
    assert.equal(vm.testResult.success, status === 200)
    if (status !== 200) assert.ok(vm.testResult.message.includes(String(status)))
    assert.equal(destroyed, true)
    assert.equal(vm.testing, false)
  }
})

test('canceling unsaved-settings prompt prevents discarding edits', async () => {
  const vm = context(Config)
  vm.savedSnapshot = JSON.stringify(vm.form)
  vm.form.bucketName = 'changed'
  vm.$confirm = async () => { throw 'cancel' }
  assert.equal(vm.isDirty, true)
  assert.equal(await vm.confirmDiscard(), false)
})

test('quick profile switch waits for activation and restores the destination profile directory', async () => {
  const vm = profileSwitcher()
  const calls = []
  let activate
  vm.$store.dispatch = (action, id) => {
    calls.push([action, id])
    return new Promise(resolve => {
      activate = () => {
        Object.assign(vm.$store.getters, { activeProfileId: id, currentDirectory: 'target/assets' })
        resolve()
      }
    })
  }

  const switching = vm.switchProfile('target')
  assert.equal(vm.switchingProfile, true)
  assert.equal(vm.lastRoute, undefined, 'navigation must wait for the selected profile to load')
  await vm.switchProfile('another-profile')
  assert.deepEqual(calls, [['switchProfile', 'target']], 'a second click must not race the active switch')
  activate()
  await switching
  assert.deepEqual(vm.lastRoute, { path: '/files', query: { path: 'target/assets' } })
  assert.equal(vm.switchingProfile, false)
})

test('quick switching to an incomplete profile opens settings without the previous folder', async () => {
  const vm = profileSwitcher()
  vm.$route.path = '/upload'
  vm.$store.dispatch = async (action, id) => {
    assert.equal(action, 'switchProfile')
    assert.equal(id, 'incomplete')
    Object.assign(vm.$store.getters, { activeProfileId: id, isConfigured: false })
  }
  await vm.switchProfile('incomplete')
  assert.deepEqual(vm.lastRoute, { path: '/config', query: {} })
  assert.equal(vm.switchingProfile, false)
})

for (const settingsPath of ['/config', '/config/']) {
test(`quick switching from ${settingsPath} honors cancel and delegates confirmed edits to its existing guard`, async () => {
  const vm = profileSwitcher()
  const settings = context(Config)
  settings.$store = vm.$store
  vm.$store.getters.activeProfile = { id: 'original', name: 'Original connection', bucketName: 'original-bucket' }
  settings.syncFromStore()
  settings.form.name = 'Unsaved connection name'
  vm.$route.path = settingsPath
  vm.$refs.view = settings
  let confirmations = 0
  let dispatches = 0
  settings.$confirm = async () => { confirmations++; throw 'cancel' }
  vm.$store.dispatch = async (action, id) => {
    dispatches++
    assert.equal(action, 'switchProfile')
    vm.$store.getters.activeProfileId = id
    vm.$store.getters.activeProfile = { id, name: 'Target connection', bucketName: 'target-bucket' }
  }

  await vm.switchProfile('target')
  assert.equal(confirmations, 1)
  assert.equal(dispatches, 0, 'cancel must not activate the target profile')
  assert.equal(settings.form.name, 'Unsaved connection name')
  assert.equal(settings.selectedProfileId, 'original')
  assert.equal(settings.isDirty, true)
  assert.equal(vm.switchingProfile, false)
  assert.equal(vm.lastRoute, undefined)

  settings.$confirm = async () => { confirmations++ }
  await vm.switchProfile('target')
  assert.equal(confirmations, 2)
  assert.equal(dispatches, 1, 'settings alone should dispatch the confirmed switch')
  assert.equal(settings.form.name, 'Target connection')
  assert.equal(settings.isDirty, false)
  assert.equal(settings.switching, false)
  assert.equal(vm.switchingProfile, false)
  assert.equal(vm.lastRoute, undefined, 'switching from settings must keep the settings page open')
})
}

test('profile persistence locks upload actions until the selected profile is written', async () => {
  const write = deferred()
  const writes = []
  const store = storeWithPersistence(payload => { writes.push(payload); return write.promise })
  const s3 = uploader()
  store.state.s3Instance = s3
  const vm = context(Upload)
  vm.$store = store
  vm.setDirectory('image/game')
  vm.handleFileChange(file('queued.png', 1))

  const switching = store.dispatch('switchProfile', 'target')
  assert.equal(store.state.switchingProfile, true)
  assert.equal(store.state.activeProfileId, 'original', 'the old client remains active until persistence succeeds')
  assert.equal(vm.uploading, false)
  assert.equal(vm.interactionLocked, true, 'profile persistence alone must lock upload interactions')
  assert.equal(writes.length, 1)
  assert.equal(writes[0].activeProfileId, 'target')

  vm.handleFileChange(file('blocked.png', 2))
  vm.removeFile(vm.fileList[0])
  await vm.handleUpload()
  vm.directoryInput = 'different/path'
  vm.applyDirectory()
  vm.navigateToRoot()
  vm.navigateToIndex(0)
  vm.openDirectoryDialog()
  vm.handleDirectorySelect({ path: 'different/path' })
  vm.confirmDirectory()
  vm.goToFiles()

  assert.deepEqual(vm.fileList.map(item => item.name), ['queued.png'])
  assert.equal(vm.fileList[0].phase, 'pending')
  assert.equal(s3.calls.length, 0, 'the old client must not upload during a profile change')
  assert.deepEqual(vm.currentPath, ['image', 'game'])
  assert.equal(store.getters.currentDirectory, 'image/game')
  assert.equal(vm.directoryDialogVisible, false)
  assert.equal(vm.selectedDirectory, null)
  assert.equal(vm.lastRoute, undefined)
  assert.equal(store.state.busyOperation, false)
  await assert.rejects(store.dispatch('switchProfile', 'original'), /请先完成当前操作/)
  assert.equal(writes.length, 1, 'a concurrent profile switch must not start another write')

  write.resolve(true)
  await switching
  assert.equal(store.state.activeProfileId, 'target')
  assert.equal(store.state.switchingProfile, false)
  assert.equal(vm.interactionLocked, false)
  vm.handleFileChange(file('allowed.png', 3))
  vm.applyDirectory()
  assert.deepEqual(vm.fileList.map(item => item.name), ['queued.png', 'allowed.png'])
  assert.deepEqual(vm.currentPath, ['different', 'path'])
})

test('a failed profile write preserves the original profile and releases the store lock for retry', async () => {
  const write = deferred()
  let attempts = 0
  const store = storeWithPersistence(() => ++attempts === 1 ? write.promise : Promise.resolve(true))
  store.commit('rememberDirectory', 'original/folder')

  const switching = store.dispatch('switchProfile', 'target')
  assert.equal(store.state.switchingProfile, true)
  assert.equal(store.state.activeProfileId, 'original')
  const failed = assert.rejects(switching, /simulated disk failure/)
  write.reject(new Error('simulated disk failure'))
  await failed

  assert.equal(store.state.switchingProfile, false)
  assert.equal(store.state.activeProfileId, 'original')
  assert.equal(store.getters.currentDirectory, 'original/folder')
  await store.dispatch('switchProfile', 'target')
  assert.equal(attempts, 2)
  assert.equal(store.state.activeProfileId, 'target')
  assert.equal(store.state.switchingProfile, false)
})

test('quick profile switching is ignored during operations, pending uploads, another switch, or for the active profile', async () => {
  for (const guard of ['busyOperation', 'hasPendingUploads', 'switchingProfile', 'activeProfile']) {
    const vm = profileSwitcher()
    let dispatches = 0
    vm.$store.dispatch = async () => { dispatches++ }
    if (guard === 'switchingProfile') vm.switchingProfile = true
    else if (guard !== 'activeProfile') vm.$store.state[guard] = true
    await vm.switchProfile(guard === 'activeProfile' ? 'original' : 'target')
    assert.equal(dispatches, 0, guard)
    assert.equal(vm.lastRoute, undefined, guard)
    assert.equal(vm.switchingProfile, guard === 'switchingProfile', guard)
  }
})

test('configuration bridge sends plain snapshots and never falls back after a disk write failure', async () => {
  const previousWindow = global.window
  const previousStorage = global.localStorage
  const payload = require('vue').reactive({ profiles: [{ id: 'test', name: 'Changed' }], activeProfileId: 'test' })
  let received
  global.window = { electron: { config: {
    readConfig: async () => ({ profiles: [{ id: 'persisted' }] }),
    saveConfig: async data => { received = data; return false }
  } } }
  global.localStorage = { setItem: () => { throw new Error('must not fall back to localStorage') } }
  try {
    const storage = load('src/utils/app-config-storage.js', {}, new Map())
    assert.deepEqual(await storage.readAppConfig(), { profiles: [{ id: 'persisted' }] })
    await assert.rejects(storage.saveAppConfig(payload), /写入配置文件失败/)
    assert.equal(require('vue').isProxy(received), false)
    assert.equal(require('vue').isProxy(received.profiles), false)
    assert.deepEqual(received, { profiles: [{ id: 'test', name: 'Changed' }], activeProfileId: 'test' })
    global.window.electron.config.saveConfig = async () => true
    assert.equal(await storage.saveAppConfig(payload), true)
  } finally {
    if (previousWindow === undefined) delete global.window
    else global.window = previousWindow
    if (previousStorage === undefined) delete global.localStorage
    else global.localStorage = previousStorage
  }
})

test('missing Electron preload is reported instead of silently reading a different configuration store', async () => {
  const previousWindow = global.window
  global.window = { location: { protocol: 'app:' }, navigator: { userAgent: 'Electron/45' } }
  try {
    const storage = load('src/utils/app-config-storage.js', {}, new Map())
    await assert.rejects(storage.readAppConfig(), /配置接口未加载/)
    await assert.rejects(storage.saveAppConfig({ profiles: [] }), /配置接口未加载/)
  } finally {
    if (previousWindow === undefined) delete global.window
    else global.window = previousWindow
  }
})

test('a failed quick profile switch reports its error and releases the lock for retry', async () => {
  const vm = profileSwitcher()
  vm.$store.dispatch = async () => { throw new Error('Configuration could not be saved') }
  await vm.switchProfile('target')
  assert.deepEqual(vm.messages, ['Configuration could not be saved'])
  assert.equal(vm.switchingProfile, false)
  assert.equal(vm.lastRoute, undefined)

  vm.$store.dispatch = async () => {
    vm.$store.getters.activeProfileId = 'target'
    vm.$store.getters.currentDirectory = 'recovered/folder'
  }
  await vm.switchProfile('target')
  assert.deepEqual(vm.lastRoute, { path: '/files', query: { path: 'recovered/folder' } })
  assert.equal(vm.switchingProfile, false)
})
