// Diagnostic only, read-only. Paste into the DevTools console of a Shopify admin tab that shows a Sidekick
// conversation with a result card ("5 rows", "+N more"). It lists which attributes and properties the card
// elements respond to, so we can see whether a row limit or a "show all" switch exists. It clicks nothing and
// changes nothing. Saves "sidekick-card-api.json" to your Downloads. Nothing is sent anywhere.
(() => {
  const names = ['s-shopifyql-metric-card', 's-metric-card', 's-table', 's-table-body', 's-internal-section']
  const elements = {}
  for (const name of names) {
    const ctor = customElements.get(name)
    if (!ctor) {
      elements[name] = 'not defined'
      continue
    }
    const props = new Set()
    for (let proto = ctor.prototype; proto && proto !== HTMLElement.prototype; proto = Object.getPrototypeOf(proto))
      for (const p of Object.getOwnPropertyNames(proto)) if (p !== 'constructor') props.add(p)
    elements[name] = { observedAttributes: ctor.observedAttributes || [], properties: [...props].sort() }
  }

  // The first live card: its attributes, and the attributes of the elements inside it.
  const find = (root, sel) => {
    if (root.querySelector) {
      const hit = root.querySelector(sel)
      if (hit) return hit
    }
    for (const el of root.querySelectorAll ? root.querySelectorAll('*') : [])
      if (el.shadowRoot) {
        const hit = find(el.shadowRoot, sel)
        if (hit) return hit
      }
    return null
  }
  const attrs = (el) => (el ? Object.fromEntries([...el.attributes].map((a) => [a.name, a.value.slice(0, 100)])) : null)
  const card = find(document, 's-shopifyql-metric-card')
  const live = card
    ? {
        card: attrs(card),
        metricCard: attrs(find(card.shadowRoot || card, 's-metric-card')),
        table: attrs(find(card.shadowRoot || card, 's-table')),
        rowsInTable: (find(card.shadowRoot || card, 's-table')?.querySelectorAll('s-table-row').length) ?? null,
        footer: find(card.shadowRoot || card, '.table-footer')?.textContent?.trim() ?? null,
      }
    : 'no card found on this page'

  const blob = new Blob([JSON.stringify({ elements, live }, null, 1)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'sidekick-card-api.json'
  a.click()
  return `Saved sidekick-card-api.json. Card found: ${card ? 'yes' : 'no'}`
})()
