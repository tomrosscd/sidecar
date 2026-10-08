// Builds the Cloudflare Pages site into dist/. No dependencies. Run: node scripts/build-site.mjs
//
// Installed copies of the extension fetch prompts.json from the published site, so the build fails
// (and Cloudflare keeps serving the last good deploy) if the file does not validate.
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { validate } from './validate-prompts.mjs'

const HEADERS = `/*
  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet
  Access-Control-Allow-Origin: *
/prompts.json
  Cache-Control: no-store
  Content-Type: application/json; charset=utf-8
`
const ROBOTS = `User-agent: *
Disallow: /
`

/** Writes the site into outDir. Throws if prompts.json is missing or invalid. */
export function buildSite(rootDir, outDir) {
  const src = (name) => new URL(name, rootDir)
  const errors = validate(JSON.parse(readFileSync(src('prompts.json'), 'utf8')))
  if (errors.length > 0) throw new Error(`prompts.json has ${errors.length} problem(s):\n- ${errors.join('\n- ')}`)

  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })
  for (const name of ['prompts.json', 'privacy.html']) copyFileSync(src(name), new URL(name, outDir))
  writeFileSync(new URL('_headers', outDir), HEADERS)
  writeFileSync(new URL('robots.txt', outDir), ROBOTS)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    buildSite(new URL('../', import.meta.url), new URL('../dist/', import.meta.url))
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
  console.log('Built dist/')
}
