// Vendor Convert Product UI's generated tokens.css.
// Run: node scripts/update-tokens.mjs <path to convert-product-ui-X.Y.Z.tgz>
// Only dist/tokens.css is copied. No React, no styles.css, no fonts.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const tgz = process.argv[2]
if (!tgz) {
  console.error('Usage: node scripts/update-tokens.mjs <convert-product-ui-X.Y.Z.tgz>')
  process.exit(1)
}
const tmp = mkdtempSync(join(tmpdir(), 'product-ui-'))
execFileSync('tar', ['-xzf', tgz, '-C', tmp, 'package/dist/tokens.css', 'package/package.json'])
const pkg = JSON.parse(readFileSync(join(tmp, 'package/package.json'), 'utf8'))
const dest = new URL('../vendor/product-ui/', import.meta.url).pathname
mkdirSync(dest, { recursive: true })
copyFileSync(join(tmp, 'package/dist/tokens.css'), join(dest, 'tokens.css'))
const sha256 = createHash('sha256').update(readFileSync(join(dest, 'tokens.css'))).digest('hex')
writeFileSync(
  join(dest, 'VERSION.json'),
  JSON.stringify(
    {
      package: pkg.name,
      version: pkg.version,
      source: 'dist/tokens.css from the built tarball (repo tomrosscd/cd-product-ui)',
      sha256,
    },
    null,
    2,
  ) + '\n',
)
console.log(`Vendored ${pkg.name} ${pkg.version} (sha256 ${sha256.slice(0, 12)}...)`)
