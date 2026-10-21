const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const asar = require('@electron/asar')
const config = require('../vue.config.js')
const { inspectArtifactPaths, formatFindings } = require('./artifact-security.cjs')

function runPluginTap(hook, pluginName, input) {
  let output
  hook({ plugin(name) {
    assert.equal(name, pluginName)
    return { tap(callback) { output = callback(input) } }
  } })
  assert.ok(output, 'the build hook must filter the environment plugin')
  return output
}

test('renderer DefinePlugin contains only approved build constants, including direct definitions', () => {
  const args = runPluginTap(config.chainWebpack, 'define', [{
    'process.env': {
      NODE_ENV: '"production"', BASE_URL: '"./"', IS_ELECTRON: 'true',
      VUE_APP_AWS_ACCESS_KEY_ID: '"synthetic-access-marker"',
      VUE_APP_AWS_SECRET_ACCESS_KEY: '"synthetic-secret-marker"',
      VUE_APP_OTHER_TOKEN: '"synthetic-other-marker"', SERVICE_PASSWORD: '"synthetic-password-marker"'
    },
    'process.env.VUE_APP_DIRECT_TOKEN': '"synthetic-direct-marker"',
    'process.env.SERVICE_PASSWORD': '"synthetic-direct-password-marker"',
    'process.env.NODE_ENV': '"production"',
    __VUE_OPTIONS_API__: true
  }])
  assert.deepEqual(args, [{
    'process.env': { NODE_ENV: '"production"', BASE_URL: '"./"', IS_ELECTRON: 'true' },
    'process.env.NODE_ENV': '"production"', __VUE_OPTIONS_API__: true
  }])
  assert.ok(!JSON.stringify(args).includes('synthetic-'))
})

test('main and preload EnvironmentPlugin also remove synthetic application credentials', () => {
  const args = runPluginTap(config.pluginOptions.electronBuilder.chainWebpackMainProcess, 'env', [{
    WEBPACK_DEV_SERVER_URL: 'http://localhost:8080', NODE_MODULES_PATH: '/synthetic/node_modules',
    ELECTRON_NODE_INTEGRATION: false,
    VUE_APP_AWS_ACCESS_KEY_ID: 'synthetic-access-marker',
    VUE_APP_AWS_SECRET_ACCESS_KEY: 'synthetic-secret-marker',
    VUE_APP_OTHER_TOKEN: 'synthetic-other-marker', SERVICE_PASSWORD: 'synthetic-password-marker'
  }])
  assert.deepEqual(args, [{
    WEBPACK_DEV_SERVER_URL: 'http://localhost:8080', NODE_MODULES_PATH: '/synthetic/node_modules',
    ELECTRON_NODE_INTEGRATION: false
  }])
})

test('artifact scanner rejects synthetic leaks and configuration files in folders and asar without printing their contents', async t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 's3-artifact-security-'))
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }))
  const fixture = path.join(temporary, 'fixture')
  fs.mkdirSync(fixture)
  const syntheticKey = 'AKIA' + 'Z'.repeat(16)
  const syntheticSecret = 'synthetic-private-payload-never-print'
  fs.writeFileSync(path.join(fixture, 'bundle.js'), `var env = { VUE_APP_AWS_SECRET_ACCESS_KEY: '${syntheticSecret}', key: '${syntheticKey}' };`)
  fs.writeFileSync(path.join(fixture, '.env.production'), 'SYNTHETIC_ONLY=' + syntheticSecret)
  fs.writeFileSync(path.join(fixture, '.aws-s3-manager-config.json'), '{}')
  const archive = path.join(temporary, 'app.asar')
  await asar.createPackage(fixture, archive)
  const result = inspectArtifactPaths([fixture, archive])
  assert.equal(result.findings.filter(item => item.rule === 'inlined_client_environment').length, 2)
  assert.equal(result.findings.filter(item => item.rule === 'aws_access_key_format').length, 2)
  assert.equal(result.findings.filter(item => item.rule === 'packaged_configuration_file').length, 4)
  assert.ok(result.findings.some(item => item.path.includes('app.asar!/bundle.js')))
  const output = formatFindings(result.findings)
  assert.ok(!output.includes(syntheticSecret))
  assert.ok(!output.includes(syntheticKey))
  assert.ok(!output.includes('VUE_APP_AWS_SECRET_ACCESS_KEY'))
})

test('artifact scanner accepts clean artifacts and rejects missing targets', t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 's3-artifact-clean-'))
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }))
  fs.writeFileSync(path.join(temporary, 'index.html'), '<html><body>Safe fixture</body></html>')
  assert.deepEqual(inspectArtifactPaths([temporary]), { findings: [], filesChecked: 1 })
  assert.equal(inspectArtifactPaths([path.join(temporary, 'missing')]).findings[0].rule, 'missing_or_unreadable_artifact')
})
