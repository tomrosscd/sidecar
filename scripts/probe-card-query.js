// Diagnostic only. Paste into the DevTools console of a Shopify admin tab showing a Sidekick conversation with a
// TABLE card that says "5 rows" and "+N more" (not the funnel card). It asks: when the card runs its own query,
// does the response hold every row, even though only 5 are shown?
//
// What it does: listens for any event the card fires, then makes the card run its own query again by setting its
// `query` attribute to the same text with a trailing space, and logs what comes back (event names, and the row
// count and first 2 rows of any response). It then puts the query back as it was. The query is the one Sidekick
// already ran: a read-only report query, no different from reloading the page. Nothing is clicked or saved in
// your store. Saves "sidekick-card-query.json" to Downloads. Nothing is sent anywhere.
(async () => {
  const find = (root, sel) => {
    const hit = root.querySelector && root.querySelector(sel)
    if (hit) return hit
    for (const el of root.querySelectorAll ? root.querySelectorAll('*') : [])
      if (el.shadowRoot) {
        const inner = find(el.shadowRoot, sel)
        if (inner) return inner
      }
    return null
  }
  const cards = []
  const walk = (root) => {
    for (const el of root.querySelectorAll ? root.querySelectorAll('*') : []) {
      if (el.localName === 's-shopifyql-metric-card') cards.push(el)
      if (el.shadowRoot) walk(el.shadowRoot)
    }
  }
  walk(document)
  const card = cards.find((c) => find(c.shadowRoot || c, 's-table'))
  if (!card) return 'No table card found. Open a conversation with a "5 rows / +N more" card first.'

  const countRows = () => (find(card.shadowRoot || card, 's-table')?.querySelectorAll('s-table-row').length ?? 0)
  const report = { rowsBefore: countRows(), events: [], responses: [], propertiesBefore: {} }
  for (const p of ['overrideCardQuery', 'queryFormatting', 'pollingInterval', 'summary', 'primaryAction'])
    try { report.propertiesBefore[p] = String(card[p]).slice(0, 200) } catch {}

  // Log every event the card (or anything inside it) fires.
  const seen = new Set()
  const log = (e) => {
    const detail = e.detail
    const entry = { type: e.type, detailType: detail === undefined ? 'none' : Array.isArray(detail) ? 'array' : typeof detail }
    if (detail && typeof detail === 'object') entry.detailKeys = Object.keys(detail).slice(0, 20)
    if (!seen.has(e.type + entry.detailType)) { seen.add(e.type + entry.detailType); report.events.push(entry) }
    // Find an array of rows anywhere in a small depth of the detail.
    const rows = (o, depth = 0) => {
      if (!o || typeof o !== 'object' || depth > 5) return null
      if (Array.isArray(o) && o.length && typeof o[0] === 'object') return o
      for (const v of Object.values(o)) { const r = rows(v, depth + 1); if (r) return r }
      return null
    }
    const found = rows(detail)
    if (found) report.responses.push({ eventType: e.type, rowCount: found.length, firstRows: found.slice(0, 2) })
  }
  const targets = [card, card.shadowRoot].filter(Boolean)
  const types = ['queryresponse', 'query-response', 'response', 'load', 'change', 'data', 'datachange', 'queryresult', 'error']
  for (const t of targets) for (const type of types) t.addEventListener(type, log, true)
  const origDispatch = EventTarget.prototype.dispatchEvent
  EventTarget.prototype.dispatchEvent = function (e) {
    if (this === card || (card.shadowRoot && card.shadowRoot.contains && this instanceof Node && card.shadowRoot.contains(this))) log(e)
    return origDispatch.call(this, e)
  }

  const original = card.getAttribute('query')
  card.setAttribute('query', original + ' ')
  await new Promise((r) => setTimeout(r, 6000))
  report.rowsAfter = countRows()
  card.setAttribute('query', original)
  await new Promise((r) => setTimeout(r, 3000))
  EventTarget.prototype.dispatchEvent = origDispatch
  report.rowsRestored = countRows()

  const blob = new Blob([JSON.stringify(report, null, 1)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'sidekick-card-query.json'
  a.click()
  return `Saved sidekick-card-query.json. Rows before ${report.rowsBefore}, after ${report.rowsAfter}, restored ${report.rowsRestored}. Events seen: ${report.events.length}`
})()
