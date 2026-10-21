const rendererEnvKeys = new Set(['NODE_ENV', 'BASE_URL', 'IS_ELECTRON'])
const electronEnvKeys = new Set([
  'WEBPACK_DEV_SERVER_URL',
  'NODE_MODULES_PATH',
  'ELECTRON_NODE_INTEGRATION'
])

function keepAllowedEnv(env, allowedKeys) {
  return Object.fromEntries(Object.entries(env).filter(([key]) => allowedKeys.has(key)))
}

module.exports = {
  // 打包后必须用相对路径，否则 JS/CSS 从 app:// 根加载失败 → 白屏
  publicPath: process.env.NODE_ENV === 'production' ? './' : '/',
  chainWebpack(config) {
    // CLI 会默认把所有 VUE_APP_* 写入客户端代码；SDK 引用整个 process.env 时
    // 即使业务没有读取这些字段也会泄露。只允许实际需要的非敏感编译常量。
    config.plugin('define').tap(args => {
      const definitions = args[0]
      definitions['process.env'] = keepAllowedEnv(definitions['process.env'] || {}, rendererEnvKeys)
      for (const key of Object.keys(definitions)) {
        if (key.startsWith('process.env.') && !rendererEnvKeys.has(key.slice('process.env.'.length))) {
          delete definitions[key]
        }
      }
      return args
    })
  },
  pluginOptions: {
    electronBuilder: {
      mainProcessFile: 'src/background.js',
      preload: 'src/preload.js',
      nodeIntegration: false,
      customFileProtocol: 'app://bundle/',
      chainWebpackMainProcess(config) {
        // 此 hook 同时用于 main 和 preload，插件默认也会复制全部 VUE_APP_*。
        config.plugin('env').tap(args => [keepAllowedEnv(args[0], electronEnvKeys)])
      },
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
          "!**/.env",
          "!**/.env.*",
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
          minimumSystemVersion: '13.0.0',
          target: ['dmg'],
          category: 'public.app-category.utilities'
        },
        win: {
          icon: 'public/icon.ico',
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
          installerIcon: 'public/icon.ico',
          uninstallerIcon: 'public/icon.ico',
          installerHeaderIcon: 'public/icon.ico',
          createDesktopShortcut: true,
          createStartMenuShortcut: true,
          shortcutName: 'AWS S3 文件管理器'
        }
      }
    }
  },
  configureWebpack: {
    target: 'web',
    resolve: {
      fallback: {
        // lib-storage 的浏览器流依赖，不重新开放渲染进程的 Node API。
        events: require.resolve('events/')
      }
    },
    node: {
      __dirname: false,
      __filename: false
    }
  }
}
