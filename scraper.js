// scraper.js — injected into the active Shopify admin tab by popup.js.
//
// Finds the Sidekick conversation log, scrolls it fully to force lazy-rendered
// turns into the DOM, then groups nodes into exchanges for export.
// Finds the Sidekick conversation, forces any lazily-rendered turns to
// mount, then extracts exchanges by selecting user messages and answer
// articles together (so they come back in document order regardless of
// exact nesting) and interleaving them. Returns a single result object
// (the resolved value of the async IIFE below becomes the executeScript
// result).

(async function scrapeSidekick() {
  const origin = window.location.origin;
  const includeReasoningLabels = Boolean(window.__sidekickIncludeReasoning);

  const root = qsAny(document, SELECTORS.root);
  if (!root) {
    return { ok: false, error: 'not_found' };
  }

  const log = qsAny(root, SELECTORS.log) || qsAny(document, SELECTORS.log) || root;
  const scroller = qsAny(root, SELECTORS.scroller) || log;

  const title = getConversationTitle(root);
  const storeHandle = getStoreHandle(window.location.href);

  let exchanges;
  if (qs(root, SELECTORS.virtualRow)) {
    exchanges = await collectVirtualisedExchanges(root, scroller, origin, includeReasoningLabels);
  } else {
    await forceRenderAllTurns(scroller);
    stripNoise(log);
    exchanges = extractExchanges(log, origin, includeReasoningLabels);
  }

  return {
    ok: true,
    title,
    storeHandle,
    url: window.location.href,
    exchanges,
  };

  // -- helpers (scoped to this IIFE) ----------------------------------------

  // Sidekick unmounts turns that scroll out of view, so no single pass sees the whole chat. Step through the
  // scroller from the top, read every mounted row, and keep each turn once (keyed by its user message's render id,
  // keeping the longest capture, since cards fill in after they mount). Order is the order rows were first seen.
  async function collectVirtualisedExchanges(rootEl, scrollEl, pageOrigin, includeReasoning) {
    const byKey = new Map();
    const originalScrollTop = scrollEl.scrollTop;
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // A remounted result card redraws its chart or table a moment later. Wait (up to 3 s) until every mounted card
    // has drawn something, so its rows can be read.
    // An empty chart frame draws first and the bars about half a second later, so wait for rows, not just an svg.
    // A line chart never gets readable rows: remember it (by its query) after one timeout so it costs that once.
    const gaveUp = new Set();
    const cardKey = (card) => card.getAttribute('query') || '';
    const cardReady = (card) =>
      gaveUp.has(cardKey(card)) ||
      pierceShadowQueryFirst(card, 's-table, ul.list-container') ||
      readChartBarRows(card).length > 0;
    const waitForCards = async () => {
      let pending = qsa(rootEl, SELECTORS.metricCard).filter((card) => !cardReady(card));
      for (let waited = 0; waited < 2000 && pending.length; waited += 150) {
        // eslint-disable-next-line no-await-in-loop
        await wait(150);
        pending = pending.filter((card) => !cardReady(card));
      }
      pending.forEach((card) => gaveUp.add(cardKey(card)));
    };

    const readRows = () => {
      qsa(rootEl, SELECTORS.virtualRow).forEach((row) => {
        const userEl = qs(row, SELECTORS.userMessageRole);
        const key = (userEl && userEl.getAttribute(SELECTORS.userRenderId)) || `row:${cleanText(row.textContent).slice(0, 80)}`;
        stripNoise(row);
        const [exchange] = extractExchanges(row, pageOrigin, includeReasoning);
        if (!exchange) return;
        const previous = byKey.get(key);
        if (!previous || exchange.markdown.length > previous.markdown.length) byKey.set(key, exchange);
      });
    };

    scrollEl.scrollTop = 0;
    await wait(400);
    const step = Math.max(200, Math.floor(scrollEl.clientHeight * 0.6));
    for (let guard = 0; guard < 400; guard += 1) {
      // eslint-disable-next-line no-await-in-loop
      await waitForCards();
      readRows();
      if (scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 2) break;
      scrollEl.scrollTop += step;
      // eslint-disable-next-line no-await-in-loop
      await wait(250);
    }
    await waitForCards();
    readRows();
    scrollEl.scrollTop = originalScrollTop;

    const list = Array.from(byKey.values());
    return list.map((exchange, i) => ({ ...exchange, index: i + 1, isLatest: i === list.length - 1 }));
  }

  async function forceRenderAllTurns(logEl) {
    const originalScrollTop = logEl.scrollTop;
    const steps = 8;
    for (let i = 0; i <= steps; i += 1) {
      const target = (logEl.scrollHeight * i) / steps;
      logEl.scrollTop = target;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    logEl.scrollTop = originalScrollTop;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  function getConversationTitle(rootEl) {
    const titleButton = qs(rootEl, SELECTORS.conversationTitleButton);
    if (titleButton) {
      const heading = qs(titleButton, SELECTORS.conversationTitleHeading);
      const text = cleanText((heading || titleButton).textContent);
      if (text) return text;
    }
    const fallbackHeading = qs(rootEl, SELECTORS.headerHeadingFallback);
    if (fallbackHeading) {
      const text = cleanText(fallbackHeading.textContent);
      if (text) return text;
    }
    return 'Sidekick conversation';
  }

  function getStoreHandle(url) {
    const match = /\/store\/([^/?#]+)/.exec(url);
    return match ? match[1] : '';
  }

  function getReasoningLabel(groupEl) {
    const labelEl = qs(groupEl, SELECTORS.reasoningGroupLabel);
    const text = labelEl ? cleanText(labelEl.textContent) : cleanText(groupEl.textContent);
    return text;
  }

  // Select user messages and answer articles together so they come back in
  // document order, then interleave them into exchanges. This does not
  // assume the answer is nested inside the user turn, nor any fixed
  // sibling/depth relationship between the two — only that they appear in
  // the log in document order, which the live Sidekick DOM guarantees.
  function extractExchanges(logEl, pageOrigin, includeReasoning) {
    // Sidekick dropped data-message-role in Nov 2026; user turns are now
    // [class*="UserMessage"][data-message-render-id]. Keep the old one too.
    const userSelector = SELECTORS.userMessageRole;
    const articleSelector = '[data-item-type="content"] article';
    const groupSelector = '[data-item-type="group"]';

    const selectorParts = [userSelector, articleSelector];
    if (includeReasoning) selectorParts.push(groupSelector);

    const nodes = logEl.querySelectorAll(selectorParts.join(', '));

    // Quick self-check: confirms both user turns and answer articles were
    // actually found in the live DOM (rather than e.g. selector mismatch
    // silently returning zero of one kind).
    const userCount = logEl.querySelectorAll(userSelector).length;
    const articleCount = logEl.querySelectorAll(articleSelector).length;
    console.log('[Sidekick→Markdown] matched user nodes:', userCount, '| article nodes:', articleCount);

    const exchanges = [];
    let current = null;

    nodes.forEach((node) => {
      if (node.matches(userSelector)) {
        if (current) exchanges.push(current);
        const promptEl = qs(node, SELECTORS.userMessageContent);
        current = { userPrompt: cleanText((promptEl || node).textContent), parts: [] };
        return;
      }

      if (includeReasoning && node.matches(groupSelector)) {
        if (!current) current = { userPrompt: '', parts: [] };
        const label = getReasoningLabel(node);
        if (label) current.parts.push(`_${label}_`);
        return;
      }

      // Otherwise this is an answer <article> matched via articleSelector.
      if (!current) current = { userPrompt: '', parts: [] };
      const markdown = articleToMarkdown(node, pageOrigin);
      if (markdown && markdown.trim()) current.parts.push(markdown.trim());
    });

    if (current) exchanges.push(current);

    return exchanges.map((exchange, i) => ({
      index: i + 1,
      userPrompt: exchange.userPrompt,
      markdown: collapseBlankLines(exchange.parts.join('\n\n')).trim() || '_(no assistant response captured)_',
      isLatest: i === exchanges.length - 1,
    }));
  }
})();
