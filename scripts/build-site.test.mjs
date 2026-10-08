// Run: node --test scripts/build-site.test.mjs
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSite } from './build-site.mjs'

const repo = new URL('../', import.meta.url)
const dir = () => pathToFileURL(mkdtempSync(`${tmpdir()}/sidecar-site-`) + '/')

test('builds exactly the five site files', () => {
  const out = new URL('dist/', dir())
  buildSite(repo, out)
  assert.deepEqual(readdirSync(out).sort(), ['_headers', 'privacy.html', 'prompts.json', 'robots.txt'].sort())
})

test('prompts.json is copied byte for byte', () => {
  const out = new URL('dist/', dir())
  buildSite(repo, out)
  assert.equal(readFileSync(new URL('prompts.json', out), 'utf8'), readFileSync(new URL('prompts.json', repo), 'utf8'))
})

test('headers allow cross-origin reads, block indexing and stop caching prompts.json', () => {
  const out = new URL('dist/', dir())
  buildSite(repo, out)
  const headers = readFileSync(new URL('_headers', out), 'utf8')
  assert.match(headers, /^\/\*\n {2}X-Robots-Tag: noindex, nofollow, noarchive, nosnippet\n {2}Access-Control-Allow-Origin: \*/)
  assert.match(headers, /\/prompts\.json\n {2}Cache-Control: no-store/)
  assert.equal(readFileSync(new URL('robots.txt', out), 'utf8'), 'User-agent: *\nDisallow: /\n')
})

test('refuses to build when prompts.json is invalid', () => {
  const root = dir()
  writeFileSync(new URL('prompts.json', root), JSON.stringify({ schema: 2, updated: '2026-10-05', count: 1, prompts: [{ slug: 'a' }] }))
  writeFileSync(new URL('privacy.html', root), '<p>x</p>')
  assert.throws(() => buildSite(root, new URL('dist/', root)), /problem/)
  assert.throws(() => readdirSync(new URL('dist/', root)))
})
