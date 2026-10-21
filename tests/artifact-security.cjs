const fs = require('node:fs')
const path = require('node:path')
const asar = require('@electron/asar')

const contentRules = [
  ['inlined_client_environment', /\bVUE_APP_[A-Z0-9_]*/],
  ['aws_access_key_format', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/]
]

function configurationPath(filename) {
  const normalized = filename.replaceAll('\\', '/')
  const basename = path.posix.basename(normalized)
  return /^\.env(?:\..*)?$/i.test(basename) ||
    /^\.?aws-s3-manager-config\.json$/i.test(basename) ||
    /(?:^|\/)\.aws(?:\/|$)/i.test(normalized)
}

/** Inspect release artifacts only. Never load dotenv, home files, or credentials. */
function inspectArtifactPaths(targets) {
  const findings = []
  let filesChecked = 0
  const report = (rule, filename) => findings.push({ rule, path: filename })
  const inspectContent = (filename, bytes) => {
    filesChecked++
    // Latin-1 preserves byte boundaries even for binary artifacts. Do not print
    // any matched bytes, surrounding source, or parsed environment values.
    const content = bytes.toString('latin1')
    for (const [rule, pattern] of contentRules) if (pattern.test(content)) report(rule, filename)
  }
  const inspectArchive = archive => {
    try {
      for (const entry of asar.listPackage(archive)) {
        const relative = entry.replace(/^\/+/, '')
        const filename = `${archive}!/${relative}`
        if (configurationPath(relative)) report('packaged_configuration_file', filename)
        const stat = asar.statFile(archive, relative, false)
        if (stat.files || stat.link) continue
        try { inspectContent(filename, asar.extractFile(archive, relative)) }
        catch { report('unreadable_archive_entry', filename) }
      }
    } catch { report('unreadable_archive', archive) }
  }
  const inspect = filename => {
    let stat
    try { stat = fs.lstatSync(filename) }
    catch { report('missing_or_unreadable_artifact', filename); return }
    if (configurationPath(filename)) report('packaged_configuration_file', filename)
    if (stat.isSymbolicLink()) { report('uninspected_symbolic_link', filename); return }
    if (stat.isDirectory()) {
      try { fs.readdirSync(filename).sort().forEach(entry => inspect(path.join(filename, entry))) }
      catch { report('unreadable_artifact_directory', filename) }
    } else if (stat.isFile()) {
      if (filename.endsWith('.asar')) inspectArchive(filename)
      else {
        try { inspectContent(filename, fs.readFileSync(filename)) }
        catch { report('unreadable_artifact_file', filename) }
      }
    }
  }
  targets.forEach(target => inspect(path.resolve(target)))
  return { findings, filesChecked }
}

function formatFindings(findings) {
  return findings.map(finding => `${finding.rule}: ${finding.path}`).join('\n')
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..')
  const targets = process.argv.slice(2)
  const checked = targets.length ? targets : [
    path.join(root, 'dist_electron/bundled'),
    path.join(root, 'dist_electron/mac-arm64/AWS S3 文件管理器.app/Contents/Resources')
  ]
  const result = inspectArtifactPaths(checked)
  if (result.findings.length) {
    console.error(formatFindings(result.findings))
    console.error(`FAIL: artifact security checks (${result.findings.length} findings; matched values withheld).`)
    process.exitCode = 1
  } else console.log(`PASS: ${result.filesChecked} release artifact files checked; no inlined client environment, AWS access-key patterns, or packaged configuration files.`)
}

module.exports = { inspectArtifactPaths, formatFindings }
