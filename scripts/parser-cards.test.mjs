// Tests that Sidekick's ShopifyQL result cards (a table, or a metric list) are exported, with fictional data.
// Needs jsdom, which this repo does not depend on. From a folder where you ran `npm i jsdom`:
//   node --test /path/to/SideMark/scripts/parser-cards.test.mjs
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'

const { JSDOM } = createRequire(process.cwd() + '/')('jsdom')
const parserSource = readFileSync(new URL('../parser.js', import.meta.url), 'utf8')

function setup() {
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only', virtualConsole: new (createRequire(process.cwd() + '/')('jsdom').VirtualConsole)() })
  dom.window.eval(parserSource)
  return dom
}

// Builds the same shape Sidekick renders: a code block (the query) and a sibling preview body, whose card header
// holds the title and whose <s-shopifyql-metric-card> keeps its table or value list in its shadow root.
function card(doc, { title, query, table, list, more, bars }) {
  const el = (tag, attrs = {}, kids = []) => {
    const node = doc.createElement(tag)
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
    for (const kid of kids) node.append(kid)
    return node
  }
  const text = (s) => doc.createTextNode(s)
  const root = el('div', { class: '_BaseCard_x' }, [
    el('div', { class: '_CodeCard_x' }, [el('div', { class: '_CodeCardCodeBlockWrapper_x' }, [el('pre', {}, [text(query)])])]),
  ])
  const metric = el('s-shopifyql-metric-card', { query })
  const inner = el('div', { class: 'shopifyql-metric-card' })
  if (table) {
    const [head, ...rows] = table
    inner.append(
      el('div', { class: 'metric-table' }, [
        el('s-table', {}, [
          el('s-table-header-row', {}, head.map((h) => el('s-table-header', {}, [el('span', {}, [text(h)])]))),
          el('s-table-body', {}, rows.map((r) => el('s-table-row', {}, r.map((c) => el('s-table-cell', {}, [el('span', {}, [text(c)])]))))),
        ]),
      ]),
    )
  }
  if (list) {
    inner.append(
      el('ul', { class: 'list-container' }, list.map(([label, value]) =>
        el('li', { class: 'list-item' }, [
          el('span', { class: 'label' }, [el('span', { class: 'label-text' }, [text(label)])]),
          el('span', { class: 'list-item-value' }, [el('strong', {}, [text(value)])]),
        ]),
      )),
    )
  }
  if (bars) {
    // A bar chart: the rows only exist as each bar's aria-label ("label: period value").
    for (const [label, value] of bars) {
      inner.append(el('div', { 'aria-label': `${label}: 26 Oct – 25 Nov 2026 ${value}` }), el('div', { 'aria-label': `26 Oct – 25 Nov 2026 ${value}` }))
    }
  }
  metric.attachShadow({ mode: 'open' }).append(inner)
  const body = el('div', { class: '_CodeCardBody_x' }, [
    el('div', { class: '_BaseCard_y', 'data-preview-card': 'true' }, [
      el('div', { class: '_CardHeader_y' }, [el('div', { class: '_CardHeaderTitle_y' }, [el('h6', {}, [el('s-internal-text', {}, [text(title)])])])]),
      el('div', { class: '_CardBodyContent_y' }, [metric, ...(more ? [el('div', {}, [el('s-internal-paragraph', {}, [text(`+${more} more`)])])] : [])]),
    ]),
  ])
  root.append(body)
  return root
}

// A plain table in the answer text, as Sidekick writes it before the card.
function textTable(doc, rows) {
  const wrap = doc.createElement('div')
  wrap.className = '_tableContainer_x'
  const table = doc.createElement('table')
  const [head, ...body] = rows
  const tr = (cells, tag) => {
    const row = doc.createElement('tr')
    for (const c of cells) { const cell = doc.createElement(tag); cell.textContent = c; row.append(cell) }
    return row
  }
  const thead = doc.createElement('thead'); thead.append(tr(head, 'th'))
  const tbody = doc.createElement('tbody'); for (const r of body) tbody.append(tr(r, 'td'))
  table.append(thead, tbody); wrap.append(table)
  return wrap
}

function markdownFor(options, { before = [] } = {}) {
  const dom = setup()
  const article = dom.window.document.createElement('article')
  dom.window.document.body.append(article)
  for (const rows of before) article.append(textTable(dom.window.document, rows))
  article.append(card(dom.window.document, options))
  return dom.window.articleToMarkdown(article, 'https://admin.shopify.com')
}

const QUERY = 'FROM sales\n  SHOW orders, net_sales\n  GROUP BY sales_channel'

test('a result table becomes a heading and a markdown table, with the query kept', () => {
  const md = markdownFor({
    title: 'Sales by channel',
    query: QUERY,
    table: [['Sales channel', 'Orders', 'Net sales'], ['Summary', '30', '$3,000.00'], ['Online Store', '20', '$2,000.00'], ['Shop', '10', '$1,000.00']],
  })
  assert.match(md, /```\nFROM sales/)
  assert.match(md, /#### Sales by channel\n\| Sales channel \| Orders \| Net sales \|\n\| --- \| --- \| --- \|/)
  assert.match(md, /\| Online Store \| 20 \| \$2,000\.00 \|/)
  assert.doesNotMatch(md, /Showing/)
})

test('says how many rows the preview left out, so a partial table is not taken for the whole', () => {
  const md = markdownFor({
    title: 'By product',
    query: QUERY,
    table: [['Product', 'Net sales'], ['Summary', '$10'], ['A', '$5'], ['B', '$3'], ['C', '$1'], ['D', '$1'], ['E', '$0']],
    more: 59,
  })
  assert.match(md, /Showing 5 of 64 rows\. Sidekick's preview left out 59 more/)
})

test('a metric list (a funnel) becomes a Label and Value table under its title, without repeating the query', () => {
  const md = markdownFor({ title: 'Session funnel', query: QUERY, list: [['Sessions', '1,000'], ['Conversion rate', '2.5%']] })
  assert.match(md, /#### Session funnel\n\| Label \| Value \|\n\| --- \| --- \|\n\| Sessions \| 1,000 \|\n\| Conversion rate \| 2\.5% \|/)
  assert.equal(md.split('FROM sales').length - 1, 1)
})

test('the heading is what the Tables tab uses to name the sheet', () => {
  const md = markdownFor({ title: 'Sales by channel', query: QUERY, table: [['A', 'B'], ['1', '2']] })
  const heading = md.split('\n').find((line) => /^#{1,6}\s+/.test(line))
  assert.equal(heading, '#### Sales by channel')
})

const CHANNELS = [['Sales channel', 'Orders', 'Net sales'], ['Online Store', '20', '$2,000.00'], ['Recharge', '10', '$1,000.00'], ['Shop', '5', '$500.00'], ['Draft Orders', '2', '$10.00'], ['Total', '37', '$3,510.00']]
const CHANNEL_CARD = [['Sales channel', 'Orders', 'Net sales'], ['Summary', '37', '$3,510.00'], ['Online Store', '20', '$2,000.00'], ['Recharge', '10', '$1,000.00'], ['Shop', '5', '$500.00']]

test('drops a card table that a plain table in the same answer already covers, and keeps the query', () => {
  const md = markdownFor({ title: 'Sales by channel', query: QUERY, table: CHANNEL_CARD, more: 1 }, { before: [CHANNELS] })
  assert.match(md, /\| Draft Orders \| 2 \|/) // the complete text table is there
  assert.doesNotMatch(md, /#### Sales by channel/)
  assert.doesNotMatch(md, /Showing/)
  assert.doesNotMatch(md, /\| Summary \|/)
  assert.match(md, /```\nFROM sales/) // the query stays
  assert.equal(md.includes('\u0001'), false)
})

test('drops a funnel card whose labels are all in a plain table, even with different column names', () => {
  const funnel = [['Metric', 'Value'], ['Sessions', '1,000'], ['Conversion rate', '2.5%']]
  const md = markdownFor({ title: 'Session funnel', query: QUERY, list: [['Sessions', '1,000'], ['Conversion rate', '2.4%']] }, { before: [funnel] })
  assert.doesNotMatch(md, /#### Session funnel/)
  assert.match(md, /\| Sessions \| 1,000 \|/)
})

test('keeps a card table when the answer has no plain table for it', () => {
  const md = markdownFor({ title: 'Sales by channel', query: QUERY, table: CHANNEL_CARD, more: 1 })
  assert.match(md, /#### Sales by channel/)
  assert.match(md, /Showing 3 of 4 rows/)
})

test('keeps a card table that has rows the plain table does not', () => {
  const partial = [['Sales channel', 'Orders', 'Net sales'], ['Online Store', '20', '$2,000.00']]
  const md = markdownFor({ title: 'Sales by channel', query: QUERY, table: CHANNEL_CARD }, { before: [partial] })
  assert.match(md, /#### Sales by channel/)
  assert.match(md, /\| Recharge \| 10 \|/)
})

test('keeps a card table whose columns differ from the plain table', () => {
  const other = [['Sales channel', 'Orders'], ['Online Store', '20'], ['Recharge', '10'], ['Shop', '5']]
  const md = markdownFor({ title: 'Sales by channel', query: QUERY, table: CHANNEL_CARD }, { before: [other] })
  assert.match(md, /#### Sales by channel/)
})

test('reads a bar chart card from its bar labels', () => {
  const md = markdownFor({ title: 'Sessions by country', query: QUERY, bars: [['United States', '308'], ['Australia', '12']] })
  assert.match(md, /#### Sessions by country/)
  assert.match(md, /\| United States \| 308 \|/)
  assert.match(md, /\| Australia \| 12 \|/)
  assert.equal((md.match(/United States/g) || []).length, 1)
})

test('notes a chart card whose values are not in the page', () => {
  const md = markdownFor({ title: 'Sessions by day', query: QUERY, bars: [] })
  assert.match(md, /values are not in the page/)
})
