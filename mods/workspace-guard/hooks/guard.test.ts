import { test, expect } from 'claude-code/testing'
import { judge } from './register'

test('judge rules', () => {
  const d8 = '/home/u/Projects/D8/app'
  const egg = '/home/u/Projects/Egg/app'
  expect(judge('git push', egg)).toMatch(/Bare/)
  expect(judge('git pull --rebase && git push -u origin main', egg)).toBeUndefined()
  expect(judge('git push --force origin main', egg)).toMatch(/force-push/)
  expect(judge('git commit --no-verify -m x', egg)).toMatch(/no-verify/)
  expect(judge('git push git@github-personal:EggmanPDX/x.git main', d8)).toMatch(/isolation/)
  expect(judge('git push git@github-work:gregg-eiler_d8taops/x.git main', egg)).toMatch(/isolation/)
  expect(judge('vercel --prod', d8)).toMatch(/prebuilt|Vercel/)
  expect(judge('vercel deploy --prebuilt --prod', d8)).toBeUndefined()
  expect(judge('vercel --prod', egg)).toBeUndefined()
})

test('no false positive on prose', () => {
  expect(judge('cat > README.md <<EOF\nnotes on --no-verify\nEOF', '/x')).toBeUndefined()
})
