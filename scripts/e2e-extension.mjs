// Checks the prompt sources in real Chrome with this folder loaded as an unpacked extension.
// Not part of CI and not shipped: it needs Playwright, which this repo does not depend on.
//   cd "$(mktemp -d)" && npm init -y && npm i playwright && npx playwright install chromium
//   node /path/to/sidecar/scripts/e2e-extension.mjs   (run from the folder where you installed playwright)
import { createRequire } from 'node:module'
const { chromium } = createRequire(process.cwd() + '/')('playwright')
import { readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
const EXT = new URL('../', import.meta.url).pathname.replace(/\/$/, '')
const NEW = 'https://convert-sidecar-prompts.pages.dev/prompts.json', OLD = 'https://tomrosscd.github.io/sidecar/prompts.json'
const base = JSON.parse(readFileSync(EXT + '/prompts.json', 'utf8'))
const withTitle = (t) => ({ ...base, prompts: base.prompts.map((p, i) => i ? p : { ...p, title: t }) })
const bundledTitle = base.prompts[0].title
async function session(answers, userDataDir, fn) {
  const ctx = await chromium.launchPersistentContext(userDataDir, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] })
  const seen = []
  await ctx.route(/pages\.dev|github\.io/, (r) => { const u = r.request().url(); seen.push(u); const a = answers[u]
    a ? r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(a) }) : r.abort('blockedbyclient') })
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker')
  const id = sw.url().split('/')[2]
  const page = await ctx.newPage()
  await page.goto(`chrome-extension://${id}/panel.html`)
  await page.waitForSelector('.prompt-title', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const titles = await page.$$eval('.prompt-title', (els) => els.map((e) => e.textContent))
  await ctx.close()
  return { first: titles.length ? titles.find((t) => t.includes('Corrected') || t) : null, titles, seen }
}
const has = (r, t) => r.titles.includes(t)
const dir = mkdtempSync(tmpdir() + '/sc-')
const mk = () => mkdtempSync(tmpdir() + '/sc-')
const out = []
const ok = (name, cond, extra='') => { out.push(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`) }
// 1. loads from Cloudflare first, old not asked
let r = await session({ [NEW]: withTitle('From Cloudflare'), [OLD]: withTitle('From GitHub') }, mk())
ok('loads from Cloudflare first', has(r, 'From Cloudflare') && !r.seen.includes(OLD), JSON.stringify(r.seen))
// 2. Cloudflare blocked -> GitHub
r = await session({ [OLD]: withTitle('From GitHub') }, mk())
ok('Cloudflare blocked: falls back to GitHub Pages', has(r, 'From GitHub') && r.seen.includes(OLD))
// 3. both blocked, no cache -> bundled
r = await session({}, mk())
ok('both blocked, no cache: bundled prompts', has(r, bundledTitle), r.titles.length + ' prompts')
// 4/5. cache then same-day same-count edit, then both blocked with cache
const prof = mk()
await session({ [NEW]: withTitle('Old title') }, prof)
r = await session({ [NEW]: withTitle('Corrected title') }, prof)
ok('same-day, same-count edit reaches a cached user (after reload)', has(r, 'Corrected title'))
r = await session({}, prof)
ok('both blocked with a cache: cached prompts show', has(r, 'Corrected title'))
console.log(out.join('\n'))
