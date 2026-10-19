// Run: node --test scripts/prompts.test.mjs
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import assert from 'node:assert/strict'

// prompts.js is a classic script (no exports), so load it into a fresh context.
const context = vm.createContext({})
vm.runInContext(readFileSync(new URL('../prompts.js', import.meta.url), 'utf8') + '\nthis.buildPrompt = buildPrompt; this.NOTE = FULL_TABLES_NOTE', context)
const { buildPrompt, NOTE } = context

const prompt = { body: 'Show sessions for {{TF}}, compared to {{CMP}}.\n\nGive me a table.' }

test('leaves the prompt as it was when full tables are off, or the option is not given', () => {
  const plain = buildPrompt(prompt, 'last 30 days', 'prev')
  assert.equal(plain, 'Show sessions for the last 30 days, compared to the previous 30 days.\n\nGive me a table.')
  assert.equal(buildPrompt(prompt, 'last 30 days', 'prev', { fullTables: false }), plain)
})

test('adds the full-tables sentence once, after the prompt, when it is on', () => {
  const text = buildPrompt(prompt, 'last 30 days', 'prev', { fullTables: true })
  assert.ok(text.endsWith(NOTE))
  assert.equal(text.split(NOTE).length - 1, 1)
  assert.match(text, /Give me a table\.\n\nIf the answer includes tables/)
})

test('asks for every row, without truncation, and keeps the date placeholders filled in', () => {
  const text = buildPrompt(prompt, 'last 7 days', 'none', { fullTables: true })
  assert.match(text, /every row/)
  assert.match(text, /no "top N" cut-off/)
  assert.doesNotMatch(text, /\{\{/)
})
