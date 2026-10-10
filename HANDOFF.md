# Handoff

## Resume here (updated 11 October 2026, Claude Code, Sonnet 5.5)

- **Brief:** `convert-platform/docs/briefs/01-sidecar-prompts-host.md`. M1, M2 and M3 are merged: [#5](https://github.com/tomrosscd/sidecar/pull/5) (extension 2.1.0 with the same-day cache fix), [#6](https://github.com/tomrosscd/sidecar/pull/6) (README rebuild note), [#7](https://github.com/tomrosscd/sidecar/pull/7) (the build rejects any prompt or collection that is not public).
- **Branch and last commit:** `main`, `0edb6b1` (#7).
- **State:** the Cloudflare feed at `https://convert-sidecar-prompts.pages.dev/prompts.json` deployed from `main` and checked: HTTP 200, `Access-Control-Allow-Origin: *`, `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`, `updated` 2026-10-05, 74 prompts. The privacy page is live with the Cloudflare wording. Extension 2.1.0 is in the repo but **not published**.
- **Next step (Tom):** package 2.1.0 and publish it to the Chrome Web Store (unlisted). Package with:
  `zip -r sidecar-2.1.0.zip manifest.json background.js panel.html panel.css panel.js parser.js scraper.js prompts.js prompts-source.js prompts.json icons fonts assets -x '*/README.md' '*.DS_Store'`
  (run from the repo root on an up-to-date `main`; 26 files). In the listing, set the privacy policy address to `https://convert-sidecar-prompts.pages.dev/privacy` if it still points at `tomrosscd.github.io/sidecar/privacy.html`.
- **Later (2.2.0, not started):** drop the old GitHub Pages address and the `github.io` host permission, after 2.1.0 has reached people and Sidecar Web no longer reads from GitHub Pages. Removing a permission does not trigger a warning.
- **Blockers:** none for the code. The README still names the old Sidecar Web address (`tomrosscd.github.io/sidecar-web`); Sidecar Web has moved, so update that line when its new address is settled.
- **Verified:** `node scripts/validate-prompts.mjs`; `node --test` on validate-prompts (7), extension (10) and build-site (8); `node scripts/build-site.mjs`; a fresh-context review of each PR found no blocking problems; the live feed headers and privacy page above; the zip lists 26 files, has version 2.1.0, and holds every file `panel.html` loads. `scripts/e2e-extension.mjs` (Playwright, run by hand, not in CI) passed five checks in Chromium: Cloudflare first, fallback to GitHub Pages, bundled when both are blocked, a same-day same-count edit reaching a cached profile, and the cache shown when both are blocked.
- **Not verified:** the zip installed from the Web Store, the real side panel UI, the live Cloudflare feed fetched from inside the installed extension.
- **Rollback of the feed:** Cloudflare Pages, project `convert-sidecar-prompts`, Deployments, previous successful production deployment, "Rollback to this deployment".
