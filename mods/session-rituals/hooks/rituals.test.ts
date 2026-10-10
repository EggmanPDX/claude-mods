import { test, expect } from 'claude-code/testing'
import { handoffPaths, isShippable, remoteVerdict, workspaceFor, splitHandoff, decisionsDirective, isD8 } from './register'

const reply = (json: string) => `# Handoff body\n\nNext: x\n\n\`\`\`json\n${json}\n\`\`\``

test('workspace comes from the project path', () => {
  expect(workspaceFor('/Users/g/Projects/BGC/site')).toBe('BGC')
  expect(workspaceFor('/Users/g/Projects/Egg/odin')).toBe('Personal')
  expect(workspaceFor('/home/user/claude-config')).toBeUndefined()
})

test('splitHandoff strips the json and keeps valid decisions', () => {
  const { handoff, decisions } = splitHandoff(
    reply('{"decisions":[{"decision":" Use Build Tracker ","category":"Technical","context":"Log retired","decidedBy":"Egg + Claude"},{"decision":""},{"decision":"B","category":"Nonsense"}]}'),
  )
  expect(handoff).not.toMatch(/json/)
  expect(handoff).toMatch(/^# Handoff body/)
  expect(decisions).toHaveLength(2)
  expect(decisions[0]).toEqual({ decision: 'Use Build Tracker', category: 'Technical', context: 'Log retired', decidedBy: 'Egg + Claude' })
  expect(decisions[1]).toEqual({ decision: 'B', category: 'Process', context: '', decidedBy: 'Egg + Claude' })
})

test('splitHandoff survives missing, malformed, and empty json', () => {
  expect(splitHandoff('plain handoff').decisions).toEqual([])
  expect(splitHandoff(reply('{oops')).decisions).toEqual([])
  expect(splitHandoff(reply('{"decisions":[]}')).decisions).toEqual([])
  expect(splitHandoff(reply('{"decisions":"no"}')).decisions).toEqual([])
  expect(splitHandoff(reply('{oops')).handoff).toMatch(/^# Handoff body/)
})

test('splitHandoff caps at five decisions', () => {
  const many = Array.from({ length: 8 }, (_, i) => ({ decision: `d${i}` }))
  expect(splitHandoff(reply(JSON.stringify({ decisions: many }))).decisions).toHaveLength(5)
})

test('directive gates on "log decisions", dedupes, and never invents a workspace', () => {
  const d = [{ decision: 'X', category: 'Process', context: '', decidedBy: 'Egg + Claude' }]
  const a = decisionsDirective(d, 'Personal', '2026-10-10')
  expect(a).toMatch(/Do NOT write anything until the user replies "log decisions"/)
  expect(a).toMatch(/skip duplicates/)
  expect(a).toMatch(/Workspace = "Personal"/)
  expect(a).toMatch(/d27124f4-d60e-4fa9-b8bc-738f07b175f0/)
  expect(decisionsDirective(d, undefined, '2026-10-10')).toMatch(/leave unset/)
})

test('ship only pushes to the personal account', () => {
  expect(remoteVerdict('git@github-personal:EggmanPDX/x.git')).toBeUndefined()
  expect(remoteVerdict('https://github.com/EggmanPDX/x.git')).toBeUndefined()
  expect(remoteVerdict('git@github-work:gregg-eiler_d8taops/x.git')).toMatch(/D8 org/)
  expect(remoteVerdict('https://gitlab.com/x/y.git')).toMatch(/not EggmanPDX/)
  expect(remoteVerdict('')).toMatch(/\(none\)/)
})

test('the mod is off in D8 projects', () => {
  expect(isD8('/Users/g/Projects/D8/app')).toBe(true)
  expect(isD8('/Users/g/projects/d8')).toBe(true)
  expect(isD8('/Users/g/Projects/Egg/app')).toBe(false)
  expect(isD8('/Users/g/Projects/D8_Tools_Personal')).toBe(false)
})

test('handoff paths: project first, fallback second', () => {
  expect(handoffPaths('/p/app/', '/home/u')).toEqual([
    '/p/app/memory/last_handoff.md',
    '/home/u/.claude/projects/-Users-greggeiler/memory/last_handoff.md',
  ])
})

test('ship refuses detached HEAD', () => {
  expect(isShippable('HEAD')).toBe(false)
  expect(isShippable('')).toBe(false)
  expect(isShippable('main')).toBe(true)
})
