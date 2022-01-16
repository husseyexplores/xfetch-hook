import esbuild from 'esbuild'

const minify = true
const ext = [minify && 'min', 'js'].filter(Boolean).join('.')

/**
 *
 * @param {import('esbuild').BuildOptions} conf
 * @returns {import('esbuild').BuildOptions}
 */
const defaultConfig = (conf = {}) => ({
  bundle: true,
  minify,
  metafile: true,
  logLevel: 'info',
  ...conf,
})

/**
 * @type {[import('esbuild').BuildOptions]}
 */
const buildConfigs = [
  // Build all middlewares as ESM
  {
    format: 'esm',
    entryPoints: ['./src/main.js'],
    outfile: `./dist/fetch-xhr.module.${ext}`,
  },
  // Build all middlewares as IIFE
  {
    format: 'iife',
    globalName: 'xfetch',
    entryPoints: ['./src/main.js'],
    outfile: `./dist/fetch-xhr.${ext}`,
  },

  /* Build each middleware as ESM and IIFE */
  // fetch ESM
  {
    format: 'esm',
    entryPoints: ['./src/fetch-middleware.js'],
    outfile: `./dist/fetch.module.${ext}`,
  },
  // fetch IIFE
  {
    format: 'iife',
    globalName: 'xfetch.fetchHook',
    entryPoints: ['./src/fetch-middleware.js'],
    outfile: `./dist/fetch.${ext}`,
    footer: {
      js: `xfetch.fetchHook = xfetch.fetchHook.default;`,
    },
  },
  // xhr ESM
  {
    format: 'esm',
    entryPoints: ['./src/xhr-middleware.js'],
    outfile: `./dist/xhr.module.${ext}`,
  },
  // xhr IIFE
  {
    format: 'iife',
    globalName: 'xfetch.xhrHook',
    entryPoints: ['./src/xhr-middleware.js'],
    outfile: `./dist/xhr.${ext}`,
    footer: {
      js: `xfetch.xhrHook = xfetch.xhrHook.default;`,
    },
  },
]

function buildAllInParallel(params) {
  return Promise.all(
    buildConfigs.map(conf => esbuild.build(defaultConfig(conf)))
  )
}

function buildOneByOne(params) {
  return buildConfigs.reduce(
    (p, conf) => p.then(() => esbuild.build(defaultConfig(conf))),
    Promise.resolve()
  )
}

console.log(`Building ${buildConfigs.length} bundles ...`)
buildOneByOne()
  .then(() => {
    console.log('Successfully built the bundles!')
  })
  .catch(e => {
    throw new Error('Failed during the build - ', e.message)
  })
