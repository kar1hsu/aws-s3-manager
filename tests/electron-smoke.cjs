const { app, BrowserWindow, ipcMain, protocol, net } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

// Isolated configuration, fake S3 operations and blocked external networking.
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'aws-s3-smoke-'))
const bundleDirectory = path.resolve(process.env.AWS_S3_SMOKE_DIST || path.join(__dirname, '../dist'))
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true } }])
app.setPath('userData', path.join(output, 'user-data'))
ipcMain.handle('readConfig', () => null)
let failNextSave = false
const savedConfigurations = []
ipcMain.handle('saveConfig', (event, config) => {
  if (failNextSave) { failNextSave = false; return false }
  savedConfigurations.push(config)
  return true
})
let win
const timeout = setTimeout(async () => {
  console.error('Smoke test timed out')
  if (win) {
    console.error(await win.webContents.executeJavaScript('JSON.stringify({ step: window.__smoke && window.__smoke.step, dialogs: [...document.querySelectorAll(".el-message-box")].map(node => ({ text: node.innerText, visible: !!node.offsetParent })) })'))
  }
  app.exit(1)
}, 60000)

app.whenReady().then(async () => {
  protocol.handle('app', request => {
    const url = new URL(request.url)
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '')
    const filename = path.resolve(bundleDirectory, relative)
    if (url.host !== 'bundle' || !filename.startsWith(bundleDirectory + path.sep)) return new Response('Forbidden', { status: 403 })
    return net.fetch(pathToFileURL(filename).href)
  })
  const bundledPreload = path.join(bundleDirectory, 'preload.js')
  const preload = fs.existsSync(bundledPreload) ? bundledPreload : path.resolve(__dirname, '../src/preload.js')
  win = new BrowserWindow({ width: 1200, height: 800, show: false, webPreferences: {
    preload, nodeIntegration: false, contextIsolation: true, sandbox: true,
    webSecurity: false, allowRunningInsecureContent: false, backgroundThrottling: false
  } })
  const signedPreviews = []
  win.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, done) => {
    const url = new URL(details.url)
    if (url.host === 's3.us-east-1.amazonaws.com' && url.pathname.startsWith('/demo-assets/') && url.searchParams.get('response-content-disposition') === 'inline') {
      signedPreviews.push(url)
      done({ redirectURL: 'app://bundle/icon.png' })
    } else done({ cancel: true })
  })
  const errors = []
  win.webContents.on('console-message', event => {
    if (event.level === 'error' && !event.message.includes('ERR_BLOCKED_BY_CLIENT')) errors.push(event.message)
  })
  const evaluate = fn => win.webContents.executeJavaScript(`(${fn.toString()})()`)
  const screenshot = async name => {
    // Hidden macOS windows may retain the previous compositor frame even when
    // the DOM has changed. Briefly reveal without focus and await actual paints.
    win.showInactive()
    await evaluate(async () => {
      window.__smoke.root.$message.closeAll()
      await window.__smoke.root.$nextTick()
      await document.fonts.ready
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    })
    await new Promise(resolve => setTimeout(resolve, 450))
    fs.writeFileSync(path.join(output, name + '.png'), (await win.webContents.capturePage()).toPNG())
    win.hide()
  }
  await win.loadURL('app://bundle/index.html#/')
  await win.webContents.insertCSS('*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; scroll-behavior: auto !important; }')
  await evaluate(async () => {
    const waitFor = async test => {
      for (let count = 0; count < 100; count++) {
        if (test()) return
        await new Promise(resolve => setTimeout(resolve, 30))
      }
      throw new Error('UI did not reach expected state: ' + (window.__smoke && window.__smoke.step))
    }
    await waitFor(() => document.querySelector('.app-shell') && document.querySelector('.page-config'))
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
      return root.$options.name === name ? root : walk(rootInstance.subTree)
    }
    const assert = (value, message) => { if (!value) throw new Error(message) }
    const calls = []
    let failOnce = true
    const attachFakeTransport = client => {
      client.config.maxAttempts = async () => 1
      client.config.requestHandler = {
        async handle(request) {
          const respond = (body, headers = {}) => ({ response: { statusCode: 200, headers, body: new TextEncoder().encode(body) } })
          if (request.method === 'GET' && request.query['list-type'] === '2') {
            const prefix = request.query.prefix || ''
            const folders = prefix ? '' : '<CommonPrefixes><Prefix>image/</Prefix></CommonPrefixes>'
            const files = ['gc-coin.png', 'hero banner.webp', 'notes.txt', 'background.jpg'].map((name, index) =>
              `<Contents><Key>${prefix + name}</Key><Size>${11688 * (index + 1)}</Size><LastModified>2026-10-21T08:00:00Z</LastModified></Contents>`).join('')
            return respond(`<ListBucketResult><IsTruncated>false</IsTruncated>${folders}${files}</ListBucketResult>`)
          }
          if (request.method === 'PUT') {
            const key = decodeURIComponent(request.path).split('/').slice(2).join('/')
            calls.push(key)
            assert(request.body instanceof Uint8Array, 'upload body must not need Buffer or File.path')
            assert(request.headers['content-type'] === 'image/png', 'image upload lost its MIME type')
            await new Promise(resolve => setTimeout(resolve, 80))
            if (key.endsWith('retry.png') && failOnce) { failOnce = false; throw new Error('模拟网络失败，可重试') }
            return respond('', { etag: '"test-only"' })
          }
          throw new Error('Unexpected SDK request: ' + request.method + ' ' + request.path)
        },
        destroy() {}
      }
      return client
    }
    const profiles = [
      { id: 'demo', name: '生产资源', bucketName: 'demo-assets', region: 'us-east-1', accessKeyId: 'demo-only', secretAccessKey: 'demo-only', cdnBaseUrls: ['https://cdn.example.com'] },
      { id: 'test', name: '测试配置', bucketName: 'test-assets', region: 'ap-southeast-1', accessKeyId: 'test-only', secretAccessKey: 'test-only', cdnBaseUrls: [] }
    ]
    root.$store.commit('setProfilesState', { profiles, activeProfileId: 'demo' })
    // Keep the real v3 commands, serializers, upload and signing; only the HTTP
    // transport is replaced, so no real S3 object can be read or modified.
    const initializeClient = root.$store._mutations.initS3Instance.slice()
    root.$store._mutations.initS3Instance = [() => {
      initializeClient.forEach(initialize => initialize())
      attachFakeTransport(root.$store.state.s3Instance)
    }]
    root.$store.commit('initS3Instance')
    await root.$router.push({ path: '/files', query: { path: 'image/game' } })
    await waitFor(() => find('FileList') && !find('FileList').loading)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__smoke.clipboard = text } } })
    document.execCommand = () => true
    window.__smoke = { root, find, assert, waitFor, calls }
    assert(typeof window.require === 'undefined' && typeof window.process === 'undefined' && typeof window.Buffer === 'undefined', 'renderer Node globals must remain disabled')
    assert(JSON.stringify(Object.keys(window.electron)) === '["config"]', 'preload must expose only the configuration bridge')
    assert(!document.querySelector('.bucket-info'), 'redundant sidebar bucket information must be removed')
    assert(root.version === '0.2.0' && document.querySelector('.sidebar-help .version').textContent.trim() === '0.2.0', 'release version must be 0.2.0 in both application state and sidebar')
    assert(find('FileList').allRows.length === 4, 'file list failed')
    const icon = document.querySelector('.app-icon')
    await waitFor(() => icon.complete)
    assert(icon.naturalWidth === 256, 'icon not loaded at expected size')
  })
  await screenshot('01-files')
  await evaluate(async () => {
    const { find, assert, waitFor } = window.__smoke
    const vm = find('FileList')
    window.__smoke.step = 'file action menu'
    document.querySelector('[aria-label="更多文件操作"]').click()
    await waitFor(() => [...document.querySelectorAll('.el-dropdown-menu__item')].some(item => item.offsetParent && item.textContent.includes('复制对象 Key')))
    ;[...document.querySelectorAll('.el-dropdown-menu__item')].find(item => item.offsetParent && item.textContent.includes('复制对象 Key')).click()
    await waitFor(() => window.__smoke.clipboard === 'image/game/background.jpg')
    const input = document.querySelector('.search-input input')
    input.value = 'coin'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await vm.$nextTick()
    assert(vm.displayRows.length === 1, 'instant filter failed')
    vm.searchInput = ''
    await vm.$nextTick()
    vm.$refs.table.toggleRowSelection(vm.allRows.find(row => row.Key.endsWith('gc-coin.png')), true)
    vm.$refs.table.toggleRowSelection(vm.allRows.find(row => row.Key.endsWith('hero banner.webp')), true)
    await vm.copySelectedLinks()
    assert(window.__smoke.clipboard.includes('hero%20banner.webp'), 'batch link encoding failed')
    document.querySelector('.preview-name').click()
    await waitFor(() => vm.previewUrl && document.querySelector('.preview-image img'))
    await waitFor(() => document.querySelector('.preview-image img').naturalWidth > 0)
  })
  await screenshot('02-preview')
  await evaluate(async () => {
    const { root, find, assert, waitFor } = window.__smoke
    find('FileList').previewVisible = false
    find('FileList').goUploadHere()
    await waitFor(() => find('UploadFile'))
    const vm = find('UploadFile')
    assert(vm.currentPath.join('/') === 'image/game', 'upload lost folder')
    window.__smoke.step = 'directory picker'
    document.querySelector('.upload-destination .el-button').click()
    await waitFor(() => document.querySelector('.dir-tree .tree-folder'))
    document.querySelector('.dir-tree .tree-folder').click()
    await waitFor(() => vm.selectedDirectory && vm.selectedDirectory.path === 'image/')
    ;[...document.querySelectorAll('.el-dialog__footer button')].find(button => button.offsetParent && button.textContent.includes('使用此目录')).click()
    await waitFor(() => !vm.directoryDialogVisible && vm.directoryInput === 'image')
    const directoryInput = document.querySelector('#upload-directory')
    directoryInput.value = 'image/game'
    directoryInput.dispatchEvent(new Event('input', { bubbles: true }))
    await vm.$nextTick()
    directoryInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    await waitFor(() => vm.currentPath.join('/') === 'image/game')
    const input = document.querySelector('input[type=file]')
    const transfer = new DataTransfer()
    transfer.items.add(new File(['success'], 'ok.png', { type: 'image/png' }))
    transfer.items.add(new File(['failure'], 'retry.png', { type: 'image/png' }))
    transfer.items.add(new File(['removed'], 'removed.png', { type: 'image/png' }))
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await vm.$nextTick()
    assert(vm.fileList.length === 3, 'file picker did not populate queue')
    const remove = [...document.querySelectorAll('.queue-table button')].find(button => button.textContent.includes('移除'))
    remove.click()
    await vm.$nextTick()
    assert(vm.fileList.length === 2 && !vm.fileList.some(file => file.name === 'ok.png'), 'remove did not update queue')
    vm.removeFile(vm.fileList.find(file => file.name === 'removed.png'))
    vm.handleFileChange({ name: 'ok.png', uid: 'smoke-ok', size: 10, raw: new File(['success'], 'ok.png', { type: 'image/png' }) })
    const uploading = vm.handleUpload()
    await vm.$nextTick()
    assert(document.querySelector('.header-profile input').disabled, 'profile switch must lock during uploads')
    await root.$router.push('/files').catch(() => {})
    assert(root.$route.path === '/upload', 'navigation should be blocked during upload')
    await uploading
    assert(vm.pendingFiles.length === 1 && vm.completedFiles.length === 1, 'failure/success state mismatch')
  })
  await screenshot('03-upload-retry')
  await evaluate(async () => {
    const { root, find, assert, waitFor, calls } = window.__smoke
    window.__smoke.step = 'retry'
    const vm = find('UploadFile')
    await vm.handleUpload()
    assert(vm.pendingFiles.length === 0, 'retry failed')
    assert(calls.filter(key => key.endsWith('ok.png')).length === 1, 'successful file uploaded twice')
    await vm.copyUploadedLinks(vm.completedFiles)
    assert(window.__smoke.clipboard.split('\n').length === 2, 'upload result links missing')
    vm.goToFiles()
    window.__smoke.step = 'return to files'
    await waitFor(() => find('FileList') && !find('FileList').loading)
    assert(root.$route.query.path === 'image/game', 'return lost folder')
    window.__smoke.step = 'open settings'
    await root.$router.push('/config')
    await waitFor(() => find('ConfigPage'))
    const settings = find('ConfigPage')
    settings.form.name = '未保存的修改'
    window.__smoke.step = 'settings leave prompt'
    const leaving = root.$router.push('/files').catch(() => {})
    await waitFor(() => {
      const button = document.querySelector('.el-message-box__btns button')
      return button && button.offsetParent
    })
    document.querySelector('.el-message-box__btns button').click()
    window.__smoke.step = 'settings canceled, waiting for router'
    await leaving
    assert(root.$route.path === '/config' && settings.isDirty, 'canceling lost unsaved edits')
  })
  await screenshot('04-settings')
  await evaluate(async () => {
    const { root, find, assert, waitFor } = window.__smoke
    window.__smoke.step = 'cancel quick switch from dirty settings'
    const switching = find('App').switchProfile('test')
    await waitFor(() => {
      const button = document.querySelector('.el-message-box__btns button')
      return button && button.offsetParent
    })
    document.querySelector('.el-message-box__btns button').click()
    await switching
    assert(root.$store.getters.activeProfileId === 'demo', 'canceling quick switch changed profile')
    assert(find('ConfigPage').form.name === '未保存的修改', 'canceling quick switch lost edits')
    await new Promise(resolve => setTimeout(resolve, 350))
  })
  await evaluate(async () => {
    const { root, find, assert, waitFor } = window.__smoke
    const leaving = root.$router.push('/files')
    await waitFor(() => {
      const button = document.querySelector('.el-message-box__btns button')
      return button && button.offsetParent
    })
    const buttons = document.querySelectorAll('.el-message-box__btns button')
    buttons[buttons.length - 1].click()
    await leaving
    await waitFor(() => find('FileList') && !find('FileList').loading)
    assert(root.$route.path === '/files', 'discard should navigate after one confirmation')
    assert(find('FileList').currentPath.join('/') === 'image/game', 'sidebar navigation lost folder')
  })
  await evaluate(async () => {
    const { root, find, assert, waitFor } = window.__smoke
    window.__smoke.step = 'switch to test profile'
    await find('App').switchProfile('test')
    await waitFor(() => find('FileList') && !find('FileList').loading)
    assert(root.$store.getters.activeProfileId === 'test', 'quick profile switch failed')
    assert(find('FileList').currentPath.length === 0, 'new profile inherited previous directory')
    find('FileList').navigateTo('exports')
    window.__smoke.step = 'visit exports'
    await waitFor(() => root.$route.query.path === 'exports' && !find('FileList').loading)
    await find('App').switchProfile('demo')
    window.__smoke.step = 'restore demo profile'
    await waitFor(() => !find('FileList').loading)
    assert(root.$route.query.path === 'image/game', 'profile switch lost previous directory')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
    window.__smoke.step = 'open profile picker with shortcut'
    await waitFor(() => document.querySelector('.profile-menu') && document.querySelector('.profile-menu').offsetParent)
    const input = document.querySelector('.header-profile input')
    input.value = 'test-assets'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    window.__smoke.step = 'filter profiles by bucket'
    await waitFor(() => document.querySelectorAll('.profile-menu .el-select-dropdown__item').length === 1)
    assert(document.querySelector('.profile-menu').textContent.includes('测试配置'), 'profile search by bucket failed')
  })
  await screenshot('05-quick-switch')
  await evaluate(async () => {
    const { root, find, assert, waitFor } = window.__smoke
    document.querySelector('.profile-menu .el-select-dropdown__item').click()
    await waitFor(() => root.$store.getters.activeProfileId === 'test' && !find('App').switchingProfile && !find('FileList').loading)
    assert(root.$route.query.path === 'exports', 'profile picker did not restore target directory')
    assert(find('FileList').allRows.every(row => row.Key.startsWith('exports/')), 'profile shows wrong folder contents')
  })
  win.setSize(900, 700)
  await screenshot('06-files-compact')
  await evaluate(async () => {
    const { root, find, assert, waitFor } = window.__smoke
    await root.$router.push('/upload')
    await waitFor(() => find('UploadFile'))
    assert(document.documentElement.scrollWidth <= innerWidth, 'compact layout has horizontal overflow')
  })
  await screenshot('07-upload-compact')
  await evaluate(async () => {
    const { root, find, waitFor } = window.__smoke
    await root.$router.push('/config')
    await waitFor(() => find('ConfigPage'))
  })
  await screenshot('08-settings-compact')
  await evaluate(async () => {
    const { root, find, assert, waitFor } = window.__smoke
    window.__smoke.step = 'edit and save configuration through form'
    const name = document.querySelector('.connection-form input')
    name.value = '已更新配置'
    name.dispatchEvent(new Event('input', { bubbles: true }))
    await waitFor(() => find('ConfigPage').form.name === '已更新配置')
    assert(find('ConfigPage').isDirty, 'form change did not mark settings dirty')
    const workspace = document.querySelector('.workspace-main')
    workspace.scrollTop = workspace.scrollHeight
    await root.$nextTick()
  })
  await screenshot('09-settings-actions-compact')
  failNextSave = true
  await evaluate(async () => {
    const { root, find, assert, waitFor } = window.__smoke
    window.__smoke.step = 'configuration bridge rejects a failed save'
    const oldName = root.$store.getters.activeProfile.name
    document.querySelector('.editor-actions .el-button--primary').click()
    await waitFor(() => document.querySelector('.el-message--error') && !find('ConfigPage').saving)
    assert(root.$route.path === '/config', 'failed configuration save must not navigate away')
    assert(root.$store.getters.activeProfile.name === oldName, 'failed save must not replace the active configuration')
    assert(find('ConfigPage').isDirty, 'failed save must retain unsaved edits for retry')
    assert(localStorage.getItem('aws-s3-manager-config') === null, 'Electron IPC failure must not silently fall back to browser storage')
    root.$message.closeAll()
  })
  await evaluate(async () => {
    const { root, find, assert, waitFor } = window.__smoke
    document.querySelector('.editor-actions .el-button--primary').click()
    await waitFor(() => find('FileList') && !find('FileList').loading)
    assert(root.$store.getters.activeProfile.name === '已更新配置', 'form save failed')
    assert(find('FileList').currentPath.join('/') === 'exports', 'saving configuration lost remembered directory')
  })
  if (!savedConfigurations.some(config => config.profiles.some(profile => profile.name === '已更新配置'))) throw new Error('No updated configuration reached the isolated IPC handler')
  if (!signedPreviews.some(url => url.searchParams.get('response-content-type') === 'image/jpeg' && url.searchParams.get('X-Amz-Expires') === '300' && url.searchParams.has('X-Amz-Signature'))) throw new Error('Image preview did not use a real v3 inline signed URL')
  if (errors.length) throw new Error(errors.join('\n'))
  console.log('PASS: Sandboxed Electron without Node globals, real SDK v3 upload/signing, filtering, preview, picker/removal, upload locking/retry, links, folder restoration, unsaved-settings guard, searchable profile switching, IPC save failure/retry, sidebar cleanup and compact layouts.')
  console.log('Screenshots: ' + output)
  clearTimeout(timeout)
  app.exit(0)
}).catch(error => {
  console.error(error.stack || error)
  clearTimeout(timeout)
  app.exit(1)
})
