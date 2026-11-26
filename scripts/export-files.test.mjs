// Tests the spreadsheet and zip helpers in panel.js (number cells, sheet names, the Download everything zip).
// Run: node --test scripts/export-files.test.mjs
import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

const src = readFileSync(new URL('../panel.js', import.meta.url), 'utf8')
const grab = (from, to) => src.match(new RegExp(`^function ${from}[\\s\\S]*?^function ${to}[\\s\\S]*?^}`, 'm'))[0]
const api = new Function(`${grab('isTableRowLine', 'tableToCsv')}\n${grab('crc32', 'buildZipBytes')}
  return { parseSheetNumber, tableLinesToSheetXml, safeSheetName, buildZipBytes, tableToCsv }`)()

test('reads amounts, counts and rates as numbers, and leaves the rest as text', () => {
  assert.deepEqual(api.parseSheetNumber('1,234'), { value: 1234, style: 1 })
  assert.deepEqual(api.parseSheetNumber('2026'), { value: 2026, style: 0 })
  assert.deepEqual(api.parseSheetNumber('12.4%'), { value: 0.124, style: 3 })
  assert.deepEqual(api.parseSheetNumber('$1,020.50'), { value: 1020.5, style: 4 })
  assert.deepEqual(api.parseSheetNumber('USD 0.00'), { value: 0, style: 2 })
  assert.deepEqual(api.parseSheetNumber('−2'), { value: -2, style: 0 })
  for (const text of ['00123', '320 / 0', 'N/A', '26 Oct 2026', '$5%', '']) assert.equal(api.parseSheetNumber(text), null, text)
})

test('keeps the header row as text and writes numbers as numeric cells', () => {
  const xml = api.tableLinesToSheetXml(['| Day | 2026 |', '| --- | --- |', '| Mon | 1,204 |'])
  assert.match(xml, /<c r="B1" t="inlineStr"><is><t>2026<\/t>/)
  assert.match(xml, /<c r="B2" s="1"><v>1204<\/v><\/c>/)
})

test('sheet names are cut to 31 characters and trimmed', () => {
  assert.equal(api.safeSheetName('Sessions by landing page (last 30 days)'), 'Sessions by landing page (last')
  assert.equal(api.safeSheetName('a/b:c'), 'a_b_c')
})

test('the zip lists every file it was given', () => {
  const zip = api.buildZipBytes([['chat.md', '# Chat\n'], ['csv/01-a.csv', 'a,b\r\n1,2']])
  const text = new TextDecoder().decode(zip)
  assert.ok(text.includes('chat.md') && text.includes('csv/01-a.csv'))
  assert.deepEqual([...zip.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04])
})
