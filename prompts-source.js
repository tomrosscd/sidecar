// Where the panel looks for the live prompt library, in order. Loaded before panel.js.
//
// The Cloudflare address comes first. It sends Access-Control-Allow-Origin: *, so the extension can read
// it without a host permission (adding one in an update disables the extension until users accept a
// warning). The GitHub Pages address stays as a fallback until it is switched off. The panel's cached
// and bundled copies still sit behind both, so a failed fetch never leaves it empty.
const PROMPTS_URLS = [
  'https://convert-sidecar-prompts.pages.dev/prompts.json',
  'https://tomrosscd.github.io/sidecar/prompts.json',
];

/** Returns the first payload from urls that fetches and passes isValid, or null if none does. */
async function fetchRemotePayload(urls, isValid, fetchFn = fetch) {
  for (const url of urls) {
    try {
      const res = await fetchFn(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      if (isValid(data)) return data;
    } catch (e) {}
  }
  return null;
}

/**
 * True when the fetched payload's content differs from the cached one. Compares the JSON text, not the
 * `updated` date or the prompt count, so a same-day correction with the same number of prompts still
 * reaches cached users.
 */
function payloadChanged(cached, fetched) {
  return !cached || JSON.stringify(cached) !== JSON.stringify(fetched);
}

if (typeof module !== 'undefined') module.exports = { PROMPTS_URLS, fetchRemotePayload, payloadChanged };
