import { terser } from 'rollup-plugin-terser'

const IS_PROD = process.env.BUILD === 'production'
const plugins = [IS_PROD && terser()]
// const plugins = []

/**
 * @type {import('rollup').RollupOptions}
 */
const config = [
  // All
  {
    input: 'src/main.js',
    output: [
      {
        plugins,
        file: 'dist/fetch-xhr.module.min.js',
        format: 'esm',
      },
      {
        plugins,
        file: 'dist/fetch-xhr.min.js',
        format: 'iife',
        name: 'xfetch',
      },
    ],
  },

  // Fetch
  {
    input: 'src/fetch-middleware.js',
    output: [
      {
        plugins,
        file: 'dist/fetch.module.min.js',
        format: 'esm',
      },
      {
        plugins,
        file: 'dist/fetch.min.js',
        format: 'iife',
        name: 'xfetch.fetchMiddleware',
      },
    ],
  },

  // xhr
  {
    input: 'src/xhr-middleware.js',
    output: [
      {
        plugins,
        file: 'dist/xhr.module.min.js',
        format: 'esm',
      },
      {
        plugins,
        file: 'dist/xhr.min.js',
        format: 'iife',
        name: 'xfetch.xhrMiddleware',
      },
    ],
  },
]

export default config
