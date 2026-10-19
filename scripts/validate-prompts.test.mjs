// Run: node --test scripts/validate-prompts.test.mjs
import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { validate } from './validate-prompts.mjs'

const real = () => JSON.parse(readFileSync(new URL('../prompts.json', import.meta.url), 'utf8'))
const prompt = (o = {}) => ({ slug: 'a', title: 'A', category: 'C', body: 'Over {{TF}}', placeholders: [], ...o })
const file = (prompts, extra = {}) => ({ schema: 2, updated: '2026-10-05', count: prompts.length, prompts, ...extra })
const problems = (data) => validate(data).join('\n')

test('the real prompts.json is valid', () => assert.deepEqual(validate(real()), []))

test('accepts optional fields and collections', () => {
  const data = file([prompt({ whenToUse: 'x', useCases: ['y'], level: 'beginner' }), prompt({ slug: 'b', followUp: 'a' })], {
    collections: [{ slug: 'c', title: 'C', promptSlugs: ['a', 'b'] }],
  })
  assert.deepEqual(validate(data), [])
})

test('rejects what the extension would reject', () => {
  for (const k of ['slug', 'title', 'category', 'body']) assert.match(problems(file([prompt({ [k]: '' })])), new RegExp(k))
  assert.match(problems(file([prompt({ placeholders: undefined })])), /placeholders must be an array/)
})

test('allows followUp null, meaning none', () => assert.deepEqual(validate(file([prompt({ followUp: null })])), []))

test('rejects duplicate slugs, a wrong count and a bad followUp', () => {
  assert.match(problems(file([prompt(), prompt()])), /duplicate slug/)
  assert.match(problems({ ...file([prompt()]), count: 5 }), /count/)
  assert.match(problems(file([prompt({ followUp: 'zzz' })])), /followUp/)
  assert.match(problems(file([prompt({ followUp: 'a' })])), /itself/)
})

test('checks placeholders against the body', () => {
  assert.match(problems(file([prompt({ placeholders: ['[Name]'] })])), /not in the body/)
  assert.match(problems(file([prompt({ body: 'Use [Name]', placeholders: [] })])), /does not list it/)
  assert.deepEqual(validate(file([prompt({ body: 'Use [Name]', placeholders: ['[Name]'] })])), [])
})

test('checks optional field types and collections', () => {
  assert.match(problems(file([prompt({ level: 'expert' })])), /level/)
  assert.match(problems(file([prompt({ useCases: [] })])), /useCases/)
  assert.match(problems(file([prompt({ featured: 'yes' })])), /featured/)
  assert.match(problems(file([prompt()], { collections: [{ slug: 'c', title: 'C', promptSlugs: ['x'] }] })), /not a prompt slug/)
  assert.match(problems(file([prompt()], { collections: [{ slug: 'c', title: 'C', promptSlugs: [] }] })), /promptSlugs/)
})
