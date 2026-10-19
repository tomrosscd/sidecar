# Handoff

## Resume here (updated 20 October 2026, Claude Code, Sonnet 5.5)

- **Branch and last commit:** `main`, `4246e6b`. Extension version in `manifest.json` is **2.1.1**. Not published to the Chrome Web Store by this change.
- **State:** `main` now holds the 2.1.x line (feed read from Cloudflare first, then GitHub Pages, then cached and bundled prompts; Product UI look) together with the local work that had not been pushed: Download All (.xlsx), the Insert fix for the new Sidekick HTML, custom date range inputs in the Prompts tab, and the changes below. The feed deploy from this push succeeded and the live feed is unchanged (`updated` 2026-10-05, 74 prompts).
- **New in this change:**
  - **Result cards are exported.** Sidekick shows some results as cards (a table with "5 rows" and "+N more", or a metric list such as a funnel). `parser.js` now reads them (including their shadow DOM) into a `####` heading plus a markdown table, with a note of how many rows the preview left out. A card is dropped when a plain table in the same answer already covers it (same columns, every row label, at least as many rows). Tests: `scripts/parser-cards.test.mjs` (needs jsdom, run from a folder where you ran `npm i jsdom`).
  - **"Return full tables in the reply"** in the Prompts tab, on by default, appends one sentence asking Sidekick for every row as a markdown table. The library prompts are unchanged. Tests: `scripts/prompts.test.mjs`.
  - Diagnostic scripts for when Shopify changes the markup: `scripts/dump-cards.js`, `scripts/probe-card-api.js`, `scripts/probe-card-query.js` (paste into the DevTools console on a Sidekick page).
- **Known limits:** a card only holds its first 5 rows, so rows beyond that are not in an export made from a card; asking for the table in the reply is the fix. A text-only answer may omit the ShopifyQL. Excel sheet names are cut at 31 characters.
- **Merge note:** the Product UI restyle replaced the earlier forest-green tweaks in `panel.css` (the top green border on the panel body stays removed).
- **Next step (Tom):** package and publish 2.1.1 if wanted (command in the earlier entry: zip the files the manifest needs). The 2.2.0 clean-up (drop the GitHub Pages address and its host permission) waits on Sidecar Web's move.
- **Verified:** validate-prompts, extension, build-site, prompts and parser-cards tests; `node scripts/build-site.mjs`; in Chromium, the five source checks (`scripts/e2e-extension.mjs`) and the full-tables switch. The card parser was checked against saved copies of real card structure, and a re-export from the live page was confirmed by Tom for the table and funnel cards.
- **Not verified:** the dedupe on the live page, and a store-installed copy.
