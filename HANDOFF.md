# Handoff

## Resume here

- **Branch:** `extension-2-1-0` ([PR #5](https://github.com/tomrosscd/sidecar/pull/5)), last commit is the one that adds this file on top of `c3778c0` (cache every valid fetched payload).
- **State:** extension 2.1.0 is ready for review. It reads the prompt library from `https://convert-sidecar-prompts.pages.dev/prompts.json` first, then the GitHub Pages address, then the cached and bundled copies. The panel now replaces its cache with any valid fetched payload and redraws when the content differs, so same-day corrections with the same prompt count reach installed copies. `permissions` and `host_permissions` are unchanged. Not published.
- **Next step:** review and merge PR #5, package 2.1.0 (command in the PR description) and publish it. Then merge [PR #7](https://github.com/tomrosscd/sidecar/pull/7), which makes the site build fail on any non-public prompt or collection.
- **Blockers:** none for the code. The store listing's privacy policy address should point at the Cloudflare one if it still points at `github.io`.
- **Verified:** `node --test scripts/*.test.mjs` and `node scripts/validate-prompts.mjs` pass. The real `loadPromptsData` ran in Node against stubbed storage and `fetch` for: same-day same-count edit, identical payload, Cloudflare blocked, both blocked with a cache, both blocked with no cache, invalid payload.
- **Not verified:** a hand test in unpacked Chrome (side panel, DevTools request blocking, Network panel showing the Cloudflare address).
