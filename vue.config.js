const path = require('path')

module.exports = {
  // 打包后必须用相对路径，否则 JS/CSS 从 app:// 根加载失败 → 白屏
  publicPath: process.env.NODE_ENV === 'production' ? './' : '/',
  pluginOptions: {
    electronBuilder: {
      mainProcessFile: 'src/background.js',
      nodeIntegration: true,
      customFileProtocol: 'app://./',
      builderOptions: {
        productName: 'AWS S3 文件管理器',
        appId: 'com.aws-s3.app',
        files: [
          "**/*",
          "!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}",
          "!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}",
          "!**/node_modules/*.d.ts",
          "!**/node_modules/.bin",
          "!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}",
          "!.editorconfig",
          "!**/{.DS_Store,.git,.gitattributes,.gitignore,.hg,.idea,.vs,.vscode}",
          "!**/._*",
          "public/index.html"
        ],
        extraResources: [
          {
            from: "public",
            to: "public"
          }
        ],
        directories: {
          output: 'dist_electron'
        },
        mac: {
          icon: 'public/icon.icns',
          // 仅打 dmg，避免 zip 的 blockmap 步骤依赖已移除的 /usr/bin/python
          target: ['dmg'],
          category: 'public.app-category.utilities'
        },
        win: {
          icon: 'public/icon.png',
          target: [
            {
              target: 'nsis',
              arch: ['x64', 'arm64']
            }
          ],
          artifactName: '${productName}-Setup-${version}.${ext}'
        },
        nsis: {
          oneClick: false,
          allowToChangeInstallationDirectory: true,
          perMachine: false,
          installerIcon: 'public/icon.png',
          uninstallerIcon: 'public/icon.png',
          installerHeaderIcon: 'public/icon.png',
          createDesktopShortcut: true,
          createStartMenuShortcut: true,
          shortcutName: 'AWS S3 文件管理器'
        }
      }
    }
  },
  configureWebpack: {
    target: 'electron-renderer',
    node: {
      __dirname: false,
      __filename: false
    },
    externals: {
      'aws-sdk': 'commonjs aws-sdk'
    }
  }
} 