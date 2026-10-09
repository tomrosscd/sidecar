// Builds the Cloudflare Pages site into dist/. No dependencies. Run: node scripts/build-site.mjs
//
// Installed copies of the extension fetch prompts.json from the published site, so the build fails
// (and Cloudflare keeps serving the last good deploy) if the file does not validate.
//
// The site is reachable without sign-in, so it may only ever hold public-safe prompts. The build also
// fails if any prompt or collection has a `visibility` other than `public`. The schema treats a missing
// `visibility` as public (it is optional), so a missing one is allowed.
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

/** Problems that stop a prompt or collection being published on the public site. */
export function publicFeedErrors(data) {
  const errors = []
  for (const [kind, items] of [['prompts', data.prompts], ['collections', data.collections]])
    (Array.isArray(items) ? items : []).forEach((item, i) => {
      if (item?.visibility !== undefined && item.visibility !== 'public')
        errors.push(`${kind}[${i}] (${item.slug}): visibility is ${JSON.stringify(item.visibility)}, but the public feed only publishes "public" items`)
    })
  return errors
}

/** Writes the site into outDir. Throws if prompts.json is missing or invalid. */
export function buildSite(rootDir, outDir) {
  const src = (name) => new URL(name, rootDir)
  const data = JSON.parse(readFileSync(src('prompts.json'), 'utf8'))
  const errors = [...validate(data), ...publicFeedErrors(data)]
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
