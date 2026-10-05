// Validates prompts.json. No dependencies. Run: node scripts/validate-prompts.mjs [path]
//
// prompts.json is fetched live by installed copies of the extension and read at build time by Sidecar Web
// (tomrosscd/sidecar-web), so a bad edit reaches users straight away. The rules are:
//   1. Everything the extension's isValidPayload() requires, because it rejects the WHOLE payload if any
//      prompt breaks them: slug, title, category and body are non-empty strings, placeholders is an array.
//   2. Rules Sidecar Web adds: unique slugs, followUp and collection slugs that exist, and so on.
//   3. Placeholder consistency: every declared [placeholder] is in the body, and every [Bracketed] token in
//      a body is declared, because the panel only shows input fields for declared ones.
// Extra fields are allowed, because the extension ignores them. Keep new fields optional.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const LEVELS = ['beginner', 'intermediate', 'advanced']
const VISIBILITY = ['public', 'internal']
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

const text = (v) => typeof v === 'string' && v.trim().length > 0
const textList = (v) => Array.isArray(v) && v.every(text)

/** Returns a list of problems (empty when valid). */
export function validate(data) {
  const errors = []
  const err = (where, msg) => errors.push(`${where}: ${msg}`)

  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['the file must be a JSON object']
  if (!Number.isInteger(data.schema) || data.schema < 1) err('schema', 'must be a whole number, 1 or more')
  if (!DATE.test(data.updated ?? '')) err('updated', 'must be a date like 2026-10-05')
  if (!Array.isArray(data.prompts)) return [...errors, 'prompts: must be an array']
  if (data.count !== data.prompts.length) err('count', `is ${data.count} but there are ${data.prompts.length} prompts`)

  const slugs = new Set()
  data.prompts.forEach((p, i) => {
    const where = `prompts[${i}]${text(p?.slug) ? ` (${p.slug})` : ''}`
    if (!p || typeof p !== 'object') return err(where, 'must be an object')
    // The extension's own rules.
    if (!text(p.slug)) err(where, 'slug must be a non-empty string')
    if (!text(p.title)) err(where, 'title must be a non-empty string')
    if (!text(p.category)) err(where, 'category must be a non-empty string')
    if (!text(p.body)) err(where, 'body must be a non-empty string')
    if (!Array.isArray(p.placeholders)) err(where, 'placeholders must be an array (use [] for none)')
    // Rules Sidecar Web adds.
    if (text(p.slug)) {
      if (!KEBAB.test(p.slug)) err(where, 'slug must be lower-case words joined by hyphens')
      if (slugs.has(p.slug)) err(where, 'duplicate slug')
      slugs.add(p.slug)
    }
    if (p.description !== undefined && !text(p.description)) err(where, 'description must be a non-empty string when present')
    for (const k of ['featured', 'recommended'])
      if (p[k] !== undefined && typeof p[k] !== 'boolean') err(where, `${k} must be true or false when present`)
    for (const k of ['whenToUse', 'caveats'])
      if (p[k] !== undefined && !text(p[k])) err(where, `${k} must be a non-empty string when present`)
    for (const k of ['useCases', 'dataSources'])
      if (p[k] !== undefined && !(textList(p[k]) && p[k].length > 0)) err(where, `${k} must be a non-empty list of text when present`)
    if (p.level !== undefined && !LEVELS.includes(p.level)) err(where, `level must be one of ${LEVELS.join(', ')}`)
    if (p.visibility !== undefined && !VISIBILITY.includes(p.visibility)) err(where, `visibility must be one of ${VISIBILITY.join(', ')}`)
    // Placeholder consistency.
    if (Array.isArray(p.placeholders) && text(p.body)) {
      if (!textList(p.placeholders)) err(where, 'placeholders must all be text')
      else {
        for (const t of p.placeholders) {
          if (!/^\[[^\]\n]+\]$/.test(t)) err(where, `placeholder "${t}" must look like [Name]`)
          else if (!p.body.includes(t)) err(where, `placeholder ${t} is not in the body`)
        }
        for (const t of new Set(p.body.match(/\[[^\]\n]+\]/g) ?? []))
          if (!p.placeholders.includes(t)) err(where, `the body has ${t} but placeholders does not list it, so the panel would show no field for it`)
      }
    }
  })

  data.prompts.forEach((p, i) => {
    if (p?.followUp === undefined || p.followUp === null) return // null means no follow-up
    const where = `prompts[${i}] (${p.slug})`
    if (!slugs.has(p.followUp)) err(where, `followUp "${p.followUp}" is not a prompt slug`)
    else if (p.followUp === p.slug) err(where, 'followUp points at itself')
  })

  if (data.collections !== undefined) {
    if (!Array.isArray(data.collections)) err('collections', 'must be an array when present')
    else {
      const seen = new Set()
      data.collections.forEach((c, i) => {
        const where = `collections[${i}]${text(c?.slug) ? ` (${c.slug})` : ''}`
        if (!c || typeof c !== 'object') return err(where, 'must be an object')
        if (!text(c.slug) || !KEBAB.test(c.slug)) err(where, 'slug must be lower-case words joined by hyphens')
        else if (seen.has(c.slug)) err(where, 'duplicate slug')
        else seen.add(c.slug)
        if (!text(c.title)) err(where, 'title must be a non-empty string')
        if (c.description !== undefined && !text(c.description)) err(where, 'description must be a non-empty string when present')
        if (!textList(c.promptSlugs) || c.promptSlugs.length === 0) err(where, 'promptSlugs must be a non-empty list of slugs')
        else {
          if (new Set(c.promptSlugs).size !== c.promptSlugs.length) err(where, 'promptSlugs repeats a slug')
          for (const s of c.promptSlugs) if (!slugs.has(s)) err(where, `"${s}" is not a prompt slug`)
        }
      })
    }
  }
  return errors
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = process.argv[2] ?? new URL('../prompts.json', import.meta.url)
  let data
  try {
    data = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    console.error(`Cannot read ${path}: ${e.message}`)
    process.exit(1)
  }
  const errors = validate(data)
  if (errors.length > 0) {
    console.error(`prompts.json has ${errors.length} problem${errors.length === 1 ? '' : 's'}:\n- ${errors.join('\n- ')}`)
    process.exit(1)
  }
  console.log(`prompts.json is valid: ${data.prompts.length} prompts, ${data.collections?.length ?? 0} collections, schema ${data.schema}`)
}
