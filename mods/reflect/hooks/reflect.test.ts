import { test, expect } from 'claude-code/testing'
import { reflectPath, reflectionEntry, buildPrompt, splitReflection, hasNotionContent, notionDirective, isD8 } from './register'

test('reflect is off in D8 projects', () => {
  expect(isD8('/Users/g/Projects/D8/app')).toBe(true)
  expect(isD8('/Users/g/Projects/Egg/odin')).toBe(false)
})

const reply = (json: string) => `Section text.\n\nQ1 ...\n\n\`\`\`json\n${json}\n\`\`\``

test('splits the json payload off the human text', () => {
  const { body, payload } = splitReflection(reply('{"learned":" Evals ","reusableSteps":"1. Do x","skillCandidate":true}'))
  expect(body).not.toMatch(/json/)
  expect(body).toMatch(/^Section text\./)
  expect(payload).toEqual({ learned: 'Evals', reusableSteps: '1. Do x', skillCandidate: true })
})

test('missing or malformed json yields no payload and keeps the text', () => {
  expect(splitReflection('just prose').payload).toBeNull()
  const bad = splitReflection(reply('{not json'))
  expect(bad.payload).toBeNull()
  expect(bad.body).toMatch(/^Section text\./)
  expect(splitReflection(reply('null')).payload).toBeNull()
})

test('wrong-typed fields are coerced to empty/false', () => {
  const { payload } = splitReflection(reply('{"learned":5,"skillCandidate":"yes"}'))
  expect(payload).toEqual({ learned: '', reusableSteps: '', skillCandidate: false })
  expect(hasNotionContent(payload)).toBe(false)
})

test('directive gates on confirmation, appends, and carries the project', () => {
  const d = notionDirective({ learned: 'L', reusableSteps: '', skillCandidate: false }, 'odin')
  expect(d).toMatch(/Do NOT write anything until the user confirms/)
  expect(d).toMatch(/APPEND/)
  expect(d).toMatch(/Never create a row/)
  expect(d).toMatch(/"odin"/)
  expect(d).toMatch(/collection:\/\/0f387ca1-18a0-4cee-8c01-19e37ee75719/)
})

test('path is the project memory file', () => {
  expect(reflectPath('/p/app/')).toBe('/p/app/memory/reflections.md')
})

test('entry is timestamped and trimmed', () => {
  expect(reflectionEntry('2026-10-10 17:00', '  hi \n')).toBe('\n## Reflection — 2026-10-10 17:00\n\nhi\n')
})

test('prompt carries focus only when given', () => {
  expect(buildPrompt('')).not.toMatch(/Focus especially/)
  expect(buildPrompt('tool creep')).toMatch(/Focus especially on: tool creep/)
})
