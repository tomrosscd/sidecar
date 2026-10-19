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
function card(doc, { title, query, table, list, more }) {
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

function markdownFor(options) {
  const dom = setup()
  const article = dom.window.document.createElement('article')
  dom.window.document.body.append(article)
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
