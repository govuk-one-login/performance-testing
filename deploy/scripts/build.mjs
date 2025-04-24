import { build } from 'esbuild'
import { copy } from 'esbuild-plugin-copy'
import { sync } from 'glob'
const outbase = './src'
const outdir = './dist'

build({
  entryPoints: sync(['src/*/*.ts']),
  outbase,
  outdir,
  target: 'es2017',
  format: 'esm',
  bundle: true,
  sourcemap: false,
  minify: true,
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
    sync(outdir + '/*/*.js')
      .sort()
      .forEach(file => {
        console.log(`+ \x1b[32m${file}\x1b[0m`)
      })
  })
  // eslint-disable-next-line no-undef
  .catch(() => process.exit(1))
