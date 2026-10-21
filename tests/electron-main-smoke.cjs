const { app, net, protocol } = require('electron')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

// Run the real bundled main/preload/protocol, but never read or write user data.
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'aws-s3-main-smoke-'))
const bundle = path.resolve(process.env.AWS_S3_SMOKE_DIST || 'dist_electron/bundled')
os.homedir = () => output
app.setPath('userData', path.join(output, 'user-data'))
app.setPath('sessionData', path.join(output, 'session-data'))
const configFile = path.join(output, '.aws-s3-manager-config.json')
const errors = []
const timeout = setTimeout(() => {
  console.error('Main-process smoke timed out', errors)
  app.exit(1)
}, 35000)

app.once('browser-window-created', (_, win) => {
  win.hide()
  const downloadUrl = 'https://download.example.test/fixture.png'
  const fixture = fs.readFileSync(path.join(bundle, 'icon.png'))
  // Intercept a synthetic HTTPS URL entirely in-process: this tests the real
  // navigation/download path without contacting any host or real S3 bucket.
  protocol.handle('https', request => request.url === downloadUrl
    ? new Response(fixture, { headers: { 'Content-Type': 'image/png', 'Content-Disposition': 'attachment; filename="fixture.png"' } })
    : new Response('Blocked by test', { status: 403 }))
  win.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, done) => done({ cancel: details.url !== downloadUrl }))
  win.webContents.on('console-message', ({ level, message }) => {
    if (level === 'error' && !message.includes('ERR_BLOCKED_BY_CLIENT')) errors.push(message)
  })
  win.webContents.once('did-finish-load', async () => {
    try {
      const preferences = win.webContents.getLastWebPreferences()
      assert.equal(preferences.nodeIntegration, false)
      assert.equal(preferences.contextIsolation, true)
      assert.equal(preferences.sandbox, true)
      assert.match(win.webContents.getURL(), /^app:\/\/bundle\//)
      const result = await win.webContents.executeJavaScript(`(async () => {
        for (let i = 0; i < 100 && !document.querySelector('.page-config'); i++) {
          await new Promise(resolve => setTimeout(resolve, 30))
        }
        if (!document.querySelector('.page-config')) throw new Error('Configuration page failed to mount')
        const config = { version: 2, activeProfileId: '', profiles: [] }
        const before = await window.electron.config.readConfig()
        const saved = await window.electron.config.saveConfig(config)
        const after = await window.electron.config.readConfig()
        return {
          before, saved, after,
          requireType: typeof window.require, bufferType: typeof window.Buffer,
          bridgeKeys: Object.keys(window.electron), configKeys: Object.keys(window.electron.config),
          redundantBucket: !!document.querySelector('.bucket-info'),
          iconLoaded: document.querySelector('.app-icon').naturalWidth === 256
        }
      })()`)
      assert.equal(result.before, null)
      assert.equal(result.saved, true)
      assert.deepEqual(result.after, { version: 2, activeProfileId: '', profiles: [] })
      assert.deepEqual(JSON.parse(fs.readFileSync(configFile, 'utf8')), result.after)
      assert.equal(result.requireType, 'undefined')
      assert.equal(result.bufferType, 'undefined')
      assert.deepEqual(result.bridgeKeys, ['config'])
      assert.deepEqual(result.configKeys.sort(), ['readConfig', 'saveConfig'])
      assert.equal(result.redundantBucket, false)
      assert.equal(result.iconLoaded, true)
      const foreignHost = await net.fetch('app://untrusted/index.html')
      const traversal = await net.fetch('app://bundle/%2e%2e%2fpackage.json')
      const indexHead = await net.fetch('app://bundle/index.html', { method: 'HEAD' })
      assert.equal(foreignHost.status, 404)
      assert.equal(traversal.status, 403)
      assert.equal(indexHead.status, 200)
      assert.equal(await indexHead.text(), '')
      assert.match(indexHead.headers.get('content-security-policy'), /script-src 'self'/)
      const downloadPath = path.join(output, 'fixture.png')
      const downloadFinished = new Promise((resolve, reject) => {
        win.webContents.session.once('will-download', (_event, item) => {
          item.setSavePath(downloadPath)
          item.once('done', (_event, state) => state === 'completed' ? resolve() : reject(new Error('Download ended: ' + state)))
        })
      })
      await win.webContents.executeJavaScript(`(() => {
        const link = document.createElement('a')
        link.href = ${JSON.stringify(downloadUrl)}
        link.download = 'fixture.png'
        document.body.appendChild(link)
        link.click()
        link.remove()
      })()`)
      await downloadFinished
      assert.deepEqual(fs.readFileSync(downloadPath), fixture)
      assert.match(win.webContents.getURL(), /^app:\/\/bundle\//)
      assert.deepEqual(errors, [])
      fs.writeFileSync(path.join(output, 'main-window.png'), (await win.webContents.capturePage()).toPNG())
      console.log(JSON.stringify({ ok: true, electron: process.versions.electron, output, checks: 'real main/preload, isolated renderer, config IPC persistence, safe protocol paths, download to disk, no duplicate sidebar bucket' }))
      clearTimeout(timeout)
      app.exit(0)
    } catch (error) {
      console.error(error, errors)
      clearTimeout(timeout)
      app.exit(1)
    }
  })
})

require(path.join(bundle, 'background.js'))
