const { build } = require('esbuild')
const { copy } = require('esbuild-plugin-copy')
const glob = require('glob')
const outbase = './src'
const outdir = './dist'

build({
  entryPoints: glob.sync(['src/*/*.ts', 'src/*/*/*.ts']),
  outbase,
  outdir,
  target: 'es6',
  format: 'esm',
  bundle: true,
  sourcemap: true,
  minify: false,
  external: ['k6*', 'https://*'],
  plugins: [
    copy({
      assets: {
        from: [outbase + '/**/*.csv', outbase + '/**/*.json'],
        to: ['.']
      }
    })
  ]
})
  .then(() => {
    console.log('Test scripts transpiled:')
    glob.sync(outdir + '/*/*.js').sort().forEach(file => {
      console.log(`+ \x1b[32m${file}\x1b[0m`)
    })
  })
  .catch(() => process.exit(1))
