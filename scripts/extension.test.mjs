// Run: node --test scripts/extension.test.mjs
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'

const require = createRequire(import.meta.url)
const { PROMPTS_URLS, fetchRemotePayload, payloadChanged } = require('../prompts-source.js')
const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'))

const good = { prompts: [{ slug: 'a' }] }
const isValid = (d) => Array.isArray(d?.prompts) && d.prompts.length > 0
const reply = (body, ok = true) => ({ ok, json: async () => body })
/** A fetch that answers from a map of url to a reply, or to an Error to throw. */
const fakeFetch = (answers) => async (url) => {
  const a = answers[url]
  if (a instanceof Error) throw a
  return a ?? reply(null, false)
}
const [NEW, OLD] = PROMPTS_URLS

test('tries the Cloudflare address first, then GitHub Pages', () => {
  assert.equal(NEW, 'https://convert-sidecar-prompts.pages.dev/prompts.json')
  assert.equal(OLD, 'https://tomrosscd.github.io/sidecar/prompts.json')
  assert.equal(PROMPTS_URLS.length, 2)
})

test('uses the new address and does not ask the old one', async () => {
  const calls = []
  const fetchFn = async (url) => (calls.push(url), reply(good))
  assert.deepEqual(await fetchRemotePayload(PROMPTS_URLS, isValid, fetchFn), good)
  assert.deepEqual(calls, [NEW])
})

test('asks with no-store so a stale copy is never reused', async () => {
  let init
  await fetchRemotePayload(PROMPTS_URLS, isValid, async (_url, i) => ((init = i), reply(good)))
  assert.deepEqual(init, { cache: 'no-store' })
})

test('falls back to the old address when the new one is blocked or down', async () => {
  for (const down of [new Error('blocked'), reply(null, false), reply({ prompts: [] })]) {
    assert.deepEqual(await fetchRemotePayload(PROMPTS_URLS, isValid, fakeFetch({ [NEW]: down, [OLD]: reply(good) })), good)
  }
})

test('returns null when every address fails, so the panel keeps its cache', async () => {
  assert.equal(await fetchRemotePayload(PROMPTS_URLS, isValid, fakeFetch({ [NEW]: new Error('x'), [OLD]: new Error('y') })), null)
  assert.equal(await fetchRemotePayload(PROMPTS_URLS, isValid, fakeFetch({ [NEW]: reply({ nope: 1 }) })), null)
})

// Adding a permission in an update disables the extension for every user until they accept a warning.
test('permissions are exactly those of 2.0.0', () => {
  assert.deepEqual(manifest.permissions, ['activeTab', 'scripting', 'clipboardWrite', 'sidePanel', 'storage'])
  assert.deepEqual(manifest.host_permissions, [
    'https://admin.shopify.com/*',
    'https://*.myshopify.com/*',
    'https://tomrosscd.github.io/*',
  ])
  assert.equal(manifest.version, '2.1.0')
})

test('the panel loads the sources file before panel.js and no longer hard-codes a URL', () => {
  const html = readFileSync(new URL('../panel.html', import.meta.url), 'utf8')
  assert.ok(html.indexOf('prompts-source.js') > 0 && html.indexOf('prompts-source.js') < html.indexOf('panel.js'))
  assert.doesNotMatch(readFileSync(new URL('../panel.js', import.meta.url), 'utf8'), /PROMPTS_URL\b(?!S)/)
})

// R4-12: the panel used to compare only `updated` and `count`.
test('a same-day, same-count edit counts as a change', () => {
  const cached = { updated: '2026-10-09', count: 1, prompts: [{ slug: 'a', body: 'Old text' }] }
  const fetched = { updated: '2026-10-09', count: 1, prompts: [{ slug: 'a', body: 'New text' }] }
  assert.equal(payloadChanged(cached, fetched), true)
})

test('an identical payload is not a change, and a missing cache always is', () => {
  const data = { updated: '2026-10-09', count: 1, prompts: [{ slug: 'a', body: 'Same' }] }
  assert.equal(payloadChanged(structuredClone(data), data), false)
  assert.equal(payloadChanged(null, data), true)
})

test('the panel caches every valid fetch and re-renders only on a content change', () => {
  const src = readFileSync(new URL('../panel.js', import.meta.url), 'utf8')
  assert.match(src, /payloadChanged\(cached, data\)/)
  assert.doesNotMatch(src, /data\.updated !== cached\.updated/)
})
