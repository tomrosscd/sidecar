# Handoff

## Resume here (updated 26 November 2026, Claude Code, Opus 5.5)

- **Branch:** `main`. Extension version **2.2.0** (released as 2.2.0 instead of 2.1.2 because it adds features). Package: `zip -r sidecar-2.2.0.zip manifest.json background.js panel.html panel.css panel.js parser.js scraper.js prompts.js prompts-source.js prompts.json icons fonts assets vendor theme.js -x '*/README.md' '*.DS_Store'`.
- **Why:** the store copy of 2.1.1 predates the 19 to 20 October work on `main` (same version number), and Sidekick changed its markup in November.
- **Fixes:**
  - Prompt count: Sidekick dropped `data-message-role="user"`. User turns are now `[class*="UserMessage"][data-message-render-id]`, with text in a `variantUser` bubble. Both old and new selectors are kept.
  - Insert: the admin home page has its own `textarea[name="sidekickMessage"]`, which Insert filled instead of the chat. The one inside `#sidekick` now comes first.
  - Chart cards: Sidekick now often draws ShopifyQL results as bar charts. Rows are read from each bar's `aria-label` (`label: period value`). Line charts carry no values in the DOM, so the export notes that and points to the full-tables option.
  - Metric cards use a `####` heading so the Tables view names the sheet after the card.
  - Rescan button in the Tables view.
  - Virtualised chat: Sidekick now only mounts turns near the viewport (`[data-sk-virtualized-row]` inside `.Polaris-Scroll[role="list"]`; `[role="log"]` is gone). The scraper scrolls from the top, reads each mounted row and merges turns by the user message's render id. It waits for chart cards to draw bars (up to 2 s, once per line chart). A full scrape of a 5-prompt chat takes about 12 s.
  - Paragraphs are now `div._p_…`, not `<p>`, so all answer prose had been dropped. Read again.
  - Numbered section titles are one-item `<ol start="N">` lists; the start number is kept.
  - Tables view: a table with no heading is named after the short title line above it, else `P<n> <prompt>`. Sheet names are trimmed.
- **Also in this PR (second round):**
  - **Download everything (.zip)** in both Export views: the conversation `.md`, `<name>-tables.xlsx`, and `csv/NN-<table>.csv` per table (UTF-8 with BOM).
  - `.xlsx` cells are numbers where they read as one (`1,234`, `12.4%`, `$1,020.50`, `USD 0.00`) with matching formats. Dates, `320 / 0`, `N/A` and leading-zero codes stay text. The header row stays text.
  - Comparison bar charts: one column per period. The first version read the last number in the group label, so a two-period chart exported the previous period's value under every row.
  - Truncated card tables ("+N more") and unreadable charts link to the same ShopifyQL in Shopify Analytics (`/analytics/reports/explore?ql=`), which is what Sidekick's "See more" opens. The preview can drop columns as well as rows: the landing page by day card showed Day and Sessions only, and the report has Landing page path too.
  - Scan progress: the scraper messages the panel with the number of prompts read so far.
- **Panel end to end:** `scripts/e2e-panel.mjs` loads the extension in Playwright Chromium, opens the real panel and drives it against `scripts/fixtures/sidekick-nov-2026.html` (November 2026 Sidekick markup: virtualised rows, home-page textarea, chart, table, list cards). It covers Insert, scan progress, prompt count, Markdown content, Copy, Download .md, Latest Prompt, Tables view and its Rescan, .xlsx (sheets and number cells), Download everything (.zip contents) and Markdown Rescan: 33/33 passed on 2.2.0. Rerun it when Sidekick changes, after updating the fixture from the live page.
- **Accuracy check:** the "+N more" card rows matched Shopify's own report for the same query (total 320, 27 to 31 Oct all 0). Chart values matched Sidekick's text (United States 308, Australia 12; Desktop 319, Mobile 1 against 0). Zip and nested .xlsx unpack with `unzip` and read back with exceljs.
- **Verified:** all `scripts/*.test.mjs` pass. On the live 2026 Design Lab store, with the extension's own parser, scraper, table and Insert code run on the page (Claude in Chrome cannot click inside the side panel): a 5-prompt chat with bar charts, a line chart, a funnel card, a full-tables library prompt (Device and Channel Efficiency) and a text-only answer gave 5 exchanges, all prose and 13 tables, in both full-screen and side-panel Sidekick. Insert filled the Sidekick box, not the home-page box, in both layouts. The .xlsx builder output was checked locally (valid zip, unique escaped sheet names).
- **Not verified:** clicking through the real side panel (the new buttons, progress text), and a downloaded .xlsx opened in Excel. Not seen on Design Lab: pie or donut charts, stacked multi-metric charts, image or order cards, very long chats (15+ prompts).
- **Next step (Tom):** reload the unpacked copy from `~/Documents/SideMark` on this branch and check Export, Tables and Insert; then merge and publish 2.2.0.

## Previous (20 October 2026, Claude Code, Sonnet 5.5)

- **Branch and last commit:** `main`, `4246e6b`. Extension version in `manifest.json` is **2.1.1**. Not published to the Chrome Web Store by this change.
- **State:** `main` now holds the 2.1.x line (feed read from Cloudflare first, then GitHub Pages, then cached and bundled prompts; Product UI look) together with the local work that had not been pushed: Download All (.xlsx), the Insert fix for the new Sidekick HTML, custom date range inputs in the Prompts tab, and the changes below. The feed deploy from this push succeeded and the live feed is unchanged (`updated` 2026-10-05, 74 prompts).
- **New in this change:**
  - **Result cards are exported.** Sidekick shows some results as cards (a table with "5 rows" and "+N more", or a metric list such as a funnel). `parser.js` now reads them (including their shadow DOM) into a `####` heading plus a markdown table, with a note of how many rows the preview left out. A card is dropped when a plain table in the same answer already covers it (same columns, every row label, at least as many rows). Tests: `scripts/parser-cards.test.mjs` (needs jsdom, run from a folder where you ran `npm i jsdom`).
  - **"Return full tables in the reply"** in the Prompts tab, on by default, appends one sentence asking Sidekick for every row as a markdown table. The library prompts are unchanged. Tests: `scripts/prompts.test.mjs`.
  - Diagnostic scripts for when Shopify changes the markup: `scripts/dump-cards.js`, `scripts/probe-card-api.js`, `scripts/probe-card-query.js` (paste into the DevTools console on a Sidekick page).
- **Known limits:** a card only holds its first 5 rows, so rows beyond that are not in an export made from a card; asking for the table in the reply is the fix. A text-only answer may omit the ShopifyQL. Excel sheet names are cut at 31 characters.
- **Merge note:** the Product UI restyle replaced the earlier forest-green tweaks in `panel.css` (the top green border on the panel body stays removed).
- **Next step (Tom):** package and publish 2.1.1 if wanted (command in the earlier entry: zip the files the manifest needs). The 2.3.0 clean-up (was 2.2.0; drop the GitHub Pages address and its host permission) waits on Sidecar Web's move.
- **Verified:** validate-prompts, extension, build-site, prompts and parser-cards tests; `node scripts/build-site.mjs`; in Chromium, the five source checks (`scripts/e2e-extension.mjs`) and the full-tables switch. The card parser was checked against saved copies of real card structure, and a re-export from the live page was confirmed by Tom for the table and funnel cards.
- **Not verified:** the dedupe on the live page, and a store-installed copy.
