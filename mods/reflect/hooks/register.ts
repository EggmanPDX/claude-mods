import type { Register } from 'claude-code'

// Build Tracker data source (Notion). The AI Curriculum Log DB was retired 2026-07-14;
// capture now lands in Build Tracker's What I Learned / Reusable Steps.
const BUILD_TRACKER = 'collection://0f387ca1-18a0-4cee-8c01-19e37ee75719'

// Personal tooling: this mod does nothing in D8 projects (work), by design.
export const isD8 = (cwd: string): boolean => /\/Projects\/D8(\/|$)/i.test(cwd)

export type NotionPayload = {
  learned: string
  reusableSteps: string
  skillCandidate: boolean
}

export const reflectPath = (cwd: string): string =>
  `${cwd.replace(/\/$/, '')}/memory/reflections.md`

export const reflectionEntry = (stamp: string, text: string): string =>
  `\n## Reflection — ${stamp}\n\n${text.trim()}\n`

export const buildPrompt = (focus: string): string =>
  `Review this session as a direct peer, not a cheerleader. No flattery, no preamble. Be brief. Sections, each a few lines at most; write "none" rather than padding:

1. Worked / didn't — what moved the work, what wasted time.
2. Outsourced thinking — decisions the user should have owned but handed to you. Quote the moment.
3. Gaps — flaws in the user's logic or plan that went unflagged.
4. Tool creep — any tool or library outside the locked stack (Claude, Claude Code, Supabase, Vercel, GitHub, React/Vite/Tailwind, TypeScript) and how the existing stack could do it.
5. Skill candidates — any workflow done twice or more, or manual work AI could handle.
6. Curriculum — a concept worth learning, with an Integrate / Learn / Skip call.
7. Next step — one only.

Cover only this session. Invent nothing; cite files, branches and commands exactly.${focus ? `\nFocus especially on: ${focus}` : ''}

End with three questions: Q1 goes deeper, Q2 challenges an assumption, Q3 opens a new angle.

Then, last of all, a fenced \`\`\`json block with exactly these keys, for a Notion log:
{"learned": "<=3 sentences: only items you called Integrate or Learn in section 6, else empty string>", "reusableSteps": "numbered manual steps, written for someone else to follow, for any workflow from section 5; else empty string", "skillCandidate": true or false}`

/** Splits the model's reply into the human text and the Notion payload (null when absent or malformed). */
export const splitReflection = (text: string): { body: string; payload: NotionPayload | null } => {
  const m = text.match(/```json\s*([\s\S]*?)```\s*$/)
  if (!m) return { body: text.trim(), payload: null }
  const body = text.slice(0, m.index).trim()
  try {
    const j = JSON.parse(m[1])
    if (typeof j !== 'object' || j === null) return { body, payload: null }
    return {
      body,
      payload: {
        learned: typeof j.learned === 'string' ? j.learned.trim() : '',
        reusableSteps: typeof j.reusableSteps === 'string' ? j.reusableSteps.trim() : '',
        skillCandidate: j.skillCandidate === true,
      },
    }
  } catch {
    return { body, payload: null }
  }
}

export const hasNotionContent = (p: NotionPayload | null): p is NotionPayload =>
  p !== null && (p.learned !== '' || p.reusableSteps !== '')

/** Hidden note for the model: log only after the user confirms, append-only, never create rows. */
export const notionDirective = (p: NotionPayload, project: string): string =>
  `/reflect produced a Notion log for the Build Tracker (data source ${BUILD_TRACKER}). Do NOT write anything until the user confirms (e.g. "log it"). On confirmation:
1. Query the Build Tracker for the row whose "Build Name" matches the project folder "${project}" (case-insensitive, partial match is fine).
2. If exactly one row matches, update it with the Notion MCP: APPEND to "What I Learned" and "Reusable Steps" (keep the existing text, add a dated line, never overwrite). Set "Skill Status" to "Candidate" only if skillCandidate is true AND it is currently "Not Evaluated" or empty.
3. If zero or several rows match, list the candidates and ask which row. Never create a row.
4. Skip any field whose value below is empty. Then report exactly what was written.
Payload: ${JSON.stringify(p)}`

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    if (isD8(e.cwd)) return next(e)
    await $.command.register({
      name: 'reflect',
      description: 'Review the session: outsourced thinking, gaps, skill candidates',
      argumentHint: '[focus]',
    })
    return next(e)
  })

  on('command.run', { command: 'reflect' }, async ($, e) => {
    if (isD8(await $.session.cwd())) return { text: 'reflect is off in D8 projects (personal tooling only).' }
    const r = await $.model.fork({ prompt: buildPrompt(e.args.trim()) })
    if (!r.isAnswered)
      return { text: r.reason === 'nothing-to-fork' ? 'Nothing to reflect on yet.' : `Reflect failed: ${r.reason}.` }

    const { body, payload } = splitReflection(r.text)
    const cwd = await $.session.cwd()
    const path = reflectPath(cwd)
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
    await $.process.run(['mkdir', '-p', path.replace(/\/[^/]+$/, '')])
    const prior = (await $.fs.exists(path)) ? await $.fs.read(path) : '# Reflections\n'
    await $.fs.write(path, prior + reflectionEntry(stamp, body))

    const project = cwd.replace(/\/$/, '').split('/').pop() ?? ''
    const notion = hasNotionContent(payload)
    return {
      text: `${body}\n\nLogged to ${path}${notion ? '\nNotion: reply "log it" to append to the Build Tracker.' : ''}`,
      ...(notion ? { context: [notionDirective(payload, project)] } : {}),
    }
  }).catch(() => ({ text: 'Reflect failed unexpectedly. Nothing was written.' }))
}
