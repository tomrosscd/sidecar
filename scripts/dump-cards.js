// Diagnostic only. Paste into the DevTools console of a Shopify admin tab that shows a Sidekick conversation
// (Cmd+Option+J, click the console, paste, Enter). It saves "sidekick-cards-dump.json" to your Downloads.
//
// It finds the report cards that hold a result ("+N more", "N rows", or a metric list such as a funnel), plus any
// dialog or side panel that is open (click a card's "See more" or the expander first to capture the full view),
// and writes their structure:
// tag names, attributes, class names, shadow roots and the text of each element. It follows shadow roots,
// which "Save page as HTML" cannot. Nothing is sent anywhere. Check the file before sharing it.
(() => {
  const MAX_TEXT = 80
  const dump = (node, depth = 0) => {
    if (node.nodeType === 3) {
      const t = node.textContent.trim()
      return t ? { text: t.slice(0, MAX_TEXT) } : null
    }
    if (node.nodeType !== 1 || depth > 40) return null
    const el = node
    const out = { tag: el.tagName.toLowerCase() }
    for (const a of el.attributes) {
      if (['style', 'src', 'srcset', 'href'].includes(a.name)) continue
      out[`@${a.name}`] = a.value.slice(0, 120)
    }
    const kids = []
    if (el.shadowRoot) kids.push({ shadow: [...el.shadowRoot.childNodes].map((c) => dump(c, depth + 1)).filter(Boolean) })
    for (const c of el.childNodes) {
      const d = dump(c, depth + 1)
      if (d) kids.push(d)
    }
    if (kids.length) out.kids = kids
    return out
  }
  const deepText = (el) => {
    let s = el.textContent || ''
    for (const d of el.querySelectorAll('*')) if (d.shadowRoot) s += ' ' + d.shadowRoot.textContent
    return s
  }
  const log = document.querySelector('[role="log"]') || document
  const cards = [...log.querySelectorAll('[class*="BaseCard"], [class*="CodeCard"]')].filter((el) => {
    const t = deepText(el)
    const hasResult = /\+\d+ more|\d+ rows?\b/.test(t) || el.querySelector('s-shopifyql-metric-card')
    return hasResult && !el.parentElement.closest('[class*="BaseCard"], [class*="CodeCard"]')
  })
  const overlays = [...document.querySelectorAll('[role="dialog"], s-modal, s-drawer, [class*="Modal"], [class*="Drawer"], [class*="Canvas"]')]
    .filter((el) => !el.parentElement.closest('[role="dialog"], s-modal, s-drawer'))
    .filter((el) => el.querySelector('s-table, table, s-shopifyql-metric-card'))
  // Download buttons and file cards ("Download the complete product table"). Only the nearest small container is
  // written, and link addresses are cut to their host and path so no query string or token is saved.
  const downloads = [...log.querySelectorAll('a[download], a[href^="blob:"], button, [role="button"], a')]
    .filter((el) => /download|csv|xlsx/i.test((el.textContent || '') + (el.getAttribute('aria-label') || '') + (el.getAttribute('download') || '')))
    .slice(0, 4)
    .map((el) => {
      const box = el.closest('[class*="Card"], [class*="File"], [class*="Attachment"], article, li') || el
      const d = dump(box)
      const href = el.getAttribute && el.getAttribute('href')
      return { clicked: { tag: el.tagName.toLowerCase(), download: el.getAttribute('download'), href: href ? href.split('?')[0].slice(0, 160) : null }, container: d }
    })
  const result = {
    downloads,
    url: location.pathname,
    count: cards.length,
    cards: cards.slice(0, 6).map((c) => dump(c)),
    overlays: overlays.slice(0, 2).map((o) => dump(o)),
  }
  const blob = new Blob([JSON.stringify(result, null, 1)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'sidekick-cards-dump.json'
  a.click()
  return `Found ${cards.length} card(s), ${overlays.length} open panel(s), ${downloads.length} download control(s). Saved sidekick-cards-dump.json`
})()
