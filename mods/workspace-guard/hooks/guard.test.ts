import { test, expect } from 'claude-code/testing'
import { judge, isD8 } from './register'

const d8 = '/home/u/Projects/D8/app'
const egg = '/home/u/Projects/Egg/app'

test('judge rules in personal projects', () => {
  expect(judge('git push', egg)).toMatch(/Bare/)
  expect(judge('git pull --rebase && git push -u origin main', egg)).toBeUndefined()
  expect(judge('git push --force origin main', egg)).toMatch(/force-push/)
  expect(judge('git commit --no-verify -m x', egg)).toMatch(/no-verify/)
  expect(judge('git push git@github-work:gregg-eiler_d8taops/x.git main', egg)).toMatch(/isolation/)
  expect(judge('git push git@github-personal:EggmanPDX/x.git main', egg)).toBeUndefined()
})

test('the guard is off in D8 projects, whatever the command', () => {
  expect(isD8(d8)).toBe(true)
  expect(isD8('/home/u/projects/d8/app')).toBe(true)
  expect(isD8(egg)).toBe(false)
  for (const cmd of ['git push', 'git commit --no-verify -m x', 'git push --force origin main', 'vercel --prod'])
    expect(judge(cmd, d8)).toBeUndefined()
})

test('no false positive on prose', () => {
  expect(judge('cat > README.md <<EOF\nnotes on --no-verify\nEOF', '/x')).toBeUndefined()
})
