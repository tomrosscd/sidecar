// Drives the real SideCar panel (loaded unpacked) against a Sidekick test page built from November 2026 markup.
// Needs Playwright and exceljs, which this repo does not depend on. From a folder where you ran
//   npm i playwright exceljs && npx playwright install chromium
//   node /path/to/sidecar/scripts/e2e-panel.mjs
// Not part of CI and not shipped.
import { createRequire } from 'node:module'
import { readFileSync, mkdtempSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
const require = createRequire(process.cwd() + '/')
const { chromium } = require('playwright')
const ExcelJS = require('exceljs')

const EXT = new URL('../', import.meta.url).pathname.replace(/\/$/, '')
const FIXTURE = new URL('./fixtures/sidekick-nov-2026.html', import.meta.url).pathname
const OUT = mkdtempSync(tmpdir() + '/sc-e2e-out-')
mkdirSync(OUT, { recursive: true })
const results = []
const check = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`); return cond }

const ctx = await chromium.launchPersistentContext(mkdtempSync(tmpdir() + '/sc-e2e-'), {
  channel: 'chromium', headless: true, acceptDownloads: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
})
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'])
// The test store page, and the prompt feed blocked so the bundled prompts load.
await ctx.route('https://admin.shopify.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: readFileSync(FIXTURE, 'utf8') }))
await ctx.route(/pages\.dev|github\.io/, (r) => r.abort('blockedbyclient'))

let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker')
const id = sw.url().split('/')[2]
const version = await sw.evaluate(() => chrome.runtime.getManifest().version)
check('extension loads', !!id, `version ${version}`)

const shop = await ctx.newPage()
await shop.goto('https://admin.shopify.com/store/test-store')
const panel = await ctx.newPage()
const errors = []
panel.on('pageerror', (e) => errors.push(e.message))
await panel.goto(`chrome-extension://${id}/panel.html`)
// In the real side panel the active tab is the Shopify tab. Here the panel is a tab itself, so point it at the shop.
await panel.evaluate(async () => {
  const [t] = await chrome.tabs.query({ url: 'https://admin.shopify.com/*' })
  window.getActiveTab = async () => t
})

// ---- Prompts tab: Insert --------------------------------------------------
await panel.waitForSelector('.prompt-row-header', { timeout: 8000 })
const promptCount = await panel.$$eval('.prompt-row-header', (els) => els.length)
check('prompt library shows', promptCount > 10, `${promptCount} prompts`)
const firstTitle = await panel.$eval('.prompt-title', (e) => e.textContent)
await panel.click('.prompt-row-header')
const insertBtn = panel.locator('.prompt-row button.btn-primary', { hasText: 'Insert' }).first()
await insertBtn.click()
await panel.waitForTimeout(800)
const inputs = await shop.evaluate(() => ({ chat: document.getElementById('chatBox').value, home: document.getElementById('homeBox').value, events: window.__inputs.chatBox.length }))
check('Insert fills the Sidekick chat box', inputs.chat.length > 200, `${inputs.chat.length} chars, "${firstTitle}"`)
check('Insert leaves the home-page box alone', inputs.home === '')
check('Insert fires an input event (React sees it)', inputs.events > 0)
check('Insert includes the full-tables sentence', inputs.chat.includes('complete markdown table'))
const insertMsg = await panel.$$eval('.prompt-insert-msg', (els) => els.map((e) => e.textContent).join(' '))
check('no Insert error message', !/open sidekick|could not/i.test(insertMsg), insertMsg)

// ---- Export tab: scan -----------------------------------------------------
const progress = new Set()
const poll = setInterval(() => panel.$eval('#scanning', (e) => (e.hidden ? '' : e.textContent)).then((t) => t && progress.add(t)).catch(() => {}), 100)
await panel.evaluate(() => { const r = document.querySelector('input[name="topMode"][value="export"]'); r.checked = true; r.dispatchEvent(new Event('change')) })
await panel.waitForSelector('#content:not([hidden])', { timeout: 30000 })
clearInterval(poll)
check('scan shows progress', [...progress].some((t) => /prompts? so far/.test(t)), [...progress].join(' | '))
const allCount = await panel.$eval('#allCount', (e) => e.textContent)
check('All Prompts count', allCount === '(4)', allCount)
const md = await panel.$eval('#preview', (e) => e.value)
const expect = [
  ['every prompt', ['Give me sessions by device', 'Show sessions by day', 'Full performance table', 'what should I fix first']],
  ['prose paragraphs', ['Here are sessions by device for both periods.', 'Finish payment setup first.', 'Then check product descriptions.']],
  ['numbered section keeps its number', ['2. Device table', '2. Performance table']],
  ['comparison chart, one column per period', ['| Label | 27 Oct – 25 Nov 2026 | 27 Sept – 26 Oct 2026 |', '| Desktop | 1,319 | 12 |', '| Mobile | 4 | 0 |']],
  ['"+N more" table card with note and report link', ['| 29 Oct 2026 | 29 |', 'Showing 5 of 30 rows', '[Open the full report in Shopify Analytics](https://admin.shopify.com/store/test-store/analytics/reports/explore?ql=FROM%20sessions%20SHOW%20sessions%20TIMESERIES%20day)']],
  ['plain table', ['| Desktop | 1,319 | 2.5% | $1,020.50 |']],
  ['funnel card', ['| Sessions | 320 |', '| Conversion rate | 0% |']],
]
for (const [name, needles] of expect) { const missing = needles.filter((n) => !md.includes(n)); check(`Markdown: ${name}`, missing.length === 0, missing.join(' ; ')) }
check('Markdown: no empty prompts', !md.includes('(empty prompt)'))

// ---- Copy and Download .md -----------------------------------------------
await panel.click('#copyBtn')
await panel.waitForTimeout(300)
const status = await panel.$eval('#actionStatus', (e) => e.textContent)
const clip = await panel.evaluate(() => navigator.clipboard.readText()).catch(() => '')
check('Copy Markdown', /Copied/.test(status) && clip === md, status)
let [dl] = await Promise.all([panel.waitForEvent('download'), panel.click('#downloadBtn')])
await dl.saveAs(`${OUT}/${dl.suggestedFilename()}`)
check('Download .md matches the preview', readFileSync(`${OUT}/${dl.suggestedFilename()}`, 'utf8') === md, dl.suggestedFilename())

// ---- Latest prompt only ---------------------------------------------------
await panel.evaluate(() => { const r = document.querySelector('input[name="exportSubMode"][value="latest"]'); r.checked = true; r.dispatchEvent(new Event('change')) })
const latest = await panel.$eval('#preview', (e) => e.value)
check('Latest Prompt shows only the last prompt', latest.includes('what should I fix first') && !latest.includes('Give me sessions by device'))
await panel.evaluate(() => { const r = document.querySelector('input[name="exportSubMode"][value="all"]'); r.checked = true; r.dispatchEvent(new Event('change')) })

// ---- Tables view ----------------------------------------------------------
await panel.evaluate(() => { const r = document.querySelector('input[name="exportSubView"][value="tables"]'); r.checked = true; r.dispatchEvent(new Event('change')) })
await panel.waitForTimeout(300)
const tablesText = await panel.$eval('#tablesList', (e) => e.innerText)
const tablesCount = await panel.$eval('#tablesCount', (e) => e.textContent)
check('Tables view lists the tables', /Sessions by device type/.test(tablesText) && /Sessions by day/.test(tablesText) && /Performance table/.test(tablesText) && /conversion funnel/.test(tablesText), `count ${tablesCount}`)
await panel.click('#tablesRescanBtn')
await panel.waitForSelector('#content:not([hidden])', { timeout: 30000 })
await panel.waitForTimeout(300)
check('Tables view Rescan', (await panel.$eval('#allCount', (e) => e.textContent)) === '(4)')
await panel.evaluate(() => { const r = document.querySelector('input[name="exportSubView"][value="tables"]'); r.checked = true; r.dispatchEvent(new Event('change')) })

;[dl] = await Promise.all([panel.waitForEvent('download'), panel.click('#downloadXlsxBtn')])
const xlsxPath = `${OUT}/${dl.suggestedFilename()}`
await dl.saveAs(xlsxPath)
const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(xlsxPath)
const sheets = wb.worksheets.map((w) => w.name)
check('Download All (.xlsx) opens', sheets.length === 4, sheets.join(' | '))
const dev = wb.worksheets.find((w) => /device type/.test(w.name))
check('xlsx: comparison values are numbers', dev && dev.getCell('B2').value === 1319 && dev.getCell('C2').value === 12, dev && JSON.stringify(dev.getRow(2).values))
const perf = wb.worksheets.find((w) => /Performance/.test(w.name))
check('xlsx: rate and money are numbers', perf && perf.getCell('C2').value === 0.025 && perf.getCell('D2').value === 1020.5, perf && JSON.stringify(perf.getRow(2).values))
const day = wb.worksheets.find((w) => /by day/.test(w.name))
check('xlsx: dates stay text', day && day.getCell('A3').value === '27 Oct 2026', day && JSON.stringify(day.getRow(3).values))

;[dl] = await Promise.all([panel.waitForEvent('download'), panel.locator('#tablesView, .download-xlsx-row').locator('.js-download-everything').first().click()])
const zipPath = `${OUT}/${dl.suggestedFilename()}`
await dl.saveAs(zipPath)
const listing = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' }).trim().split('\n')
check('Download everything (.zip)', listing.some((n) => n.endsWith('.md')) && listing.some((n) => n.endsWith('-tables.xlsx')) && listing.filter((n) => n.startsWith('csv/')).length === 4, listing.join(', '))
const unz = mkdtempSync(tmpdir() + '/sc-zip-')
execFileSync('unzip', ['-q', zipPath, '-d', unz])
const zmd = listing.find((n) => n.endsWith('.md'))
check('zip: Markdown matches the preview', readFileSync(`${unz}/${zmd}`, 'utf8') === md)
const csv = readFileSync(`${unz}/${listing.find((n) => /csv\/01-/.test(n))}`, 'utf8')
check('zip: CSV has the comparison rows', csv.includes('Desktop,"1,319",12') || csv.includes('Desktop,1319,12') || csv.includes('Desktop,"1,319",12'), csv.split('\r\n').slice(0, 3).join(' / '))
const wb2 = new ExcelJS.Workbook(); await wb2.xlsx.readFile(`${unz}/${listing.find((n) => n.endsWith('.xlsx'))}`)
check('zip: xlsx inside opens', wb2.worksheets.length === 4)

// ---- Markdown view Rescan and the Download everything button there --------
await panel.evaluate(() => { const r = document.querySelector('input[name="exportSubView"][value="markdown"]'); r.checked = true; r.dispatchEvent(new Event('change')) })
await panel.click('#rescanBtn')
await panel.waitForSelector('#content:not([hidden])', { timeout: 30000 })
check('Markdown view Rescan', (await panel.$eval('#allCount', (e) => e.textContent)) === '(4)')
;[dl] = await Promise.all([panel.waitForEvent('download'), panel.locator('#markdownView .js-download-everything').click()])
check('Download everything from the Markdown view', /\.zip$/.test(dl.suggestedFilename()), dl.suggestedFilename())

check('no panel errors', errors.length === 0, errors.join(' ; '))
await ctx.close()
console.log(results.join('\n'))
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`)
