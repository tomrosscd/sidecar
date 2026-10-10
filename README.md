<div align="center">
  <img src="assets/sidekick_icon.svg" width="64" height="64" alt="SideCar icon" />
  <h1>SideCar</h1>
  <p><strong>Shopify Sidekick chat, exported clean into Markdown — plus a built-in prompt library.</strong></p>
</div>

SideCar is a Chrome extension that lives in the side panel next to Shopify Sidekick. It can insert ready-made analysis prompts into Sidekick, and it can pull your open conversation and convert it to clean Markdown you can copy or download.

Everything runs locally. Nothing leaves your browser unless you copy or download it.

---

## Install

SideCar loads as an unpacked extension. No Chrome Web Store needed.

1. Download or clone this repo.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (toggle, top right).
4. Click **Load unpacked**.
5. Select the folder.
6. Pin SideCar to your toolbar.

After updating any files, reload the extension from that same page.

---

## Usage

Click the SideCar toolbar icon to open the side panel. It stays open alongside Sidekick while you work, instead of closing like a popup.

Two top-level modes:

### Prompts mode

Browse the prompt library. The prompts are loaded from `prompts.json` (see [The prompt data](#the-prompt-data)).

- **Timeframe / comparison:** choose a period (last 7–90 days, last quarter, last 6/12 months) and a comparison (previous period, same period last year, or none). These get substituted into the prompt text.
- **Category filter:** narrow by category (Acquisition, Analytics, BFCM, CRO, LTV, SEO, Strategy, Subscriptions, Tech, UX), each with a live count.
- **Search:** matches prompt titles and descriptions.
- Click a prompt to expand it. The built prompt shows with the timeframe highlighted in yellow and the comparison highlighted in green.
- **Insert:** writes the built prompt into the open Sidekick conversation's input box (focused, not sent). If Sidekick isn't open on the active tab, you'll see an inline message instead.
- **Copy:** copies the built prompt to your clipboard, regardless of what's open.

### Export mode

1. Open a Shopify admin tab with a Sidekick conversation active.
2. Switch to Export mode in the panel.
3. SideCar scans the page and shows your exchanges.

#### Choose what to export

Three modes at the top:

| Mode | What you get |
|---|---|
| Latest Prompt | The most recent exchange. Default. |
| All Prompts (N) | Every exchange in the conversation. |
| Custom | Pick individual exchanges from a checklist. |

#### Markdown vs Tables

- **Markdown:** the editable preview, with live word/token counts (token count is an estimate — characters ÷ 4).
- **Tables:** every Markdown table found in your current selection, labelled by its nearest heading (or prompt number if there's no heading). Each table has **Copy CSV** and **Download CSV**, with standard CSV escaping (quoted fields for commas/quotes/newlines, doubled internal quotes) and Markdown emphasis stripped from cell text.

#### Preview and export

- **Copy Markdown:** copies the preview to your clipboard.
- **Download .md:** saves a file as `sidekick-<title>-<date>.md`.
- **Rescan (↺):** re-scrapes the page. Good for picking up new questions or resetting edits you have made to the preview.

#### Reasoning steps

Off by default. Turn on "Include collapsed reasoning step labels" to add a one-line note for each collapsed reasoning group instead of skipping it.

#### Trim Sidekick follow-up questions

On by default. Sidekick often ends an answer with a sales-y offer ("Want me to build a Klaviyo segment...?"). This strips that trailing paragraph when it's the *only* thing after a real question mark and starts with a recognised offer phrase (Want me to / Would you like / Should I / Do you want / Let me know / I can also / Want to) — genuine content is never touched.

### Settings

Mode, timeframe, comparison, category, source, the reasoning toggle, and the trim-follow-ups toggle all persist via `chrome.storage.local` and restore the next time you open the panel.

---

## What gets converted

| Element | Output |
|---|---|
| Tables | GitHub-flavoured Markdown tables |
| Report cards | Bold link plus a fenced `shopifyql` code block with the decoded query |
| Metric cards | Query and inline values (best effort) |
| Collapsed reasoning steps | Skipped by default |

---

## How it works

| File | What it does |
|---|---|
| `panel.js` | Side panel controller: mode switching, prompts UI, export UI, scraper injection, Copy/Download, CSV export |
| `prompts.json` | The prompt library data. See [The prompt data](#the-prompt-data) |
| `prompts.js` | The DOM-free `buildPrompt`/`getCmpText` helpers (no prompt data) |
| `scripts/validate-prompts.mjs` | Checks `prompts.json`. Runs in CI on every change |
| `background.js` | MV3 service worker — opens the side panel on toolbar click |
| `scraper.js` | Runs inside the page, finds the Sidekick log, scrolls it fully, groups nodes into exchanges |
| `parser.js` | Handles all DOM-to-Markdown conversion and selector logic |

The scraper only runs when you switch to Export mode or rescan. There is no persistent content script.

### The prompt data

All prompts live in `prompts.json`. It is published at https://convert-sidecar-prompts.pages.dev/prompts.json (Cloudflare Pages builds `main` and validates the file first). Until it is switched off, the old GitHub Pages copy at https://tomrosscd.github.io/sidecar/prompts.json is still read as a fallback. Two things read it:

- **This extension** (`prompts-source.js` lists the addresses) fetches the live file when the panel opens, trying each address in order, caches it, and falls back to the copy bundled in the extension.
- **Sidecar Web** (https://tomrosscd.github.io/sidecar-web/, repo `tomrosscd/sidecar-web`) fetches it at build time. After changing `prompts.json`, rebuild Sidecar Web (see its [RELEASE.md](https://github.com/tomrosscd/sidecar-web/blob/main/RELEASE.md)).

Because installed extensions fetch the live file, **a bad edit reaches people straight away**. The extension rejects the whole file if any prompt is missing `slug`, `title`, `category`, `body`, or a `placeholders` array. Check every edit:

```sh
node scripts/validate-prompts.mjs
node --test scripts/validate-prompts.test.mjs
```

CI runs both on every pull request and push that touches `prompts.json`.

**Bump `updated` on every edit.** It records when the file last changed. The extension replaces its cached copy with any valid fetched file and redraws the list when the content differs, so even a same-day edit with the same number of prompts reaches installed copies.

**Shape (schema 2).** `schema`, `updated` (YYYY-MM-DD), `count` (must equal the number of prompts), `prompts[]`, and an optional `collections[]`.

| Prompt field | Needed? | Notes |
|---|---|---|
| `slug`, `title`, `category`, `body` | Yes | Non-empty text. `slug` is lower-case words joined by hyphens and unique. |
| `placeholders` | Yes | A list, `[]` if none. Every `[Bracketed]` token in `body` must be listed, and every listed one must appear in `body`. |
| `description`, `featured`, `recommended`, `followUp` | No | `followUp` is another prompt's slug, or `null`. |
| `whenToUse`, `caveats` | No | Text. |
| `useCases`, `dataSources` | No | Non-empty lists of text. |
| `level` | No | `beginner`, `intermediate` or `advanced`. |
| `visibility` | No | `public` or `internal`. Reserved for when login exists. Nothing reads it yet. |

`{{TF}}` and `{{CMP}}` in a body are filled with the timeframe and comparison. **Collections** are `{ slug, title, description, promptSlugs[] }`, an ordered list of prompts for one job, shown as workflows on Sidecar Web.

**Keep changes additive.** Older installed extensions only understand the original fields. They ignore extra fields and extra top-level keys, so adding is safe. Renaming or removing a field, or changing a required one, would break people who have not updated.

---

## If Shopify updates the DOM and scraping breaks

All CSS selectors are in the `SELECTORS` object at the top of `parser.js`. Start there.

Hashed class names like `_table_13sb5_185` are matched as substrings using `[class*="..."]` rather than exact strings. The hash changes on each deploy, so use that pattern when updating a selector.

If the Sidekick input selector changes, update the selectors in `insertIntoSidekick` in `panel.js`.

---

## Sharing with others

Zip the folder and have them follow the Install steps above. A Chrome Web Store listing is worth doing once it is ready for wider distribution.
