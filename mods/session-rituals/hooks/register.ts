import type { Register } from 'claude-code'

const FALLBACK = '.claude/projects/-Users-greggeiler/memory/last_handoff.md'

export const handoffPaths = (cwd: string, home: string): string[] => [
  `${cwd.replace(/\/$/, '')}/memory/last_handoff.md`,
  `${home.replace(/\/$/, '')}/${FALLBACK}`,
]

/** A branch /ship may push: named, not detached. */
export const isShippable = (branch: string): boolean =>
  branch !== '' && branch !== 'HEAD'

const D8_PATH = /\/Projects\/D8(\/|$)/
const D8_REMOTE = /gregg-eiler_d8taops|github-work/
const PERSONAL_REMOTE = /EggmanPDX|github-personal/

/** Refusal reason when the push remote belongs to the other account, else undefined. */
export const remoteVerdict = (cwd: string, url: string): string | undefined => {
  const isD8 = D8_PATH.test(cwd)
  if (isD8 && !D8_REMOTE.test(url))
    return `D8 workspace, but the remote is ${url || '(none)'}. D8 pushes go to gregg-eiler_d8taops only.`
  if (!isD8 && D8_REMOTE.test(url))
    return `Non-D8 workspace, but the remote is ${url}. Never push BGC/Egg work to the D8 org.`
  if (!isD8 && !PERSONAL_REMOTE.test(url))
    return `Remote ${url || '(none)'} is not EggmanPDX. Refusing to guess the account.`
  return undefined
}

const PARK_PROMPT = `Write a handoff for the next session, as a dense markdown block, no preamble. Sections: Where we left off · Decisions made · Blocked (and on whom) · Can be worked now · Next action (one). Cover only this session's work. Cite exact file paths and branch names. Invent nothing.

Then, last of all, a fenced \`\`\`json block for a Notion decision log: {"decisions": [{"decision": "short statement", "category": "Strategy|Messaging|Process|Client|Technical|People", "context": "why it was decided", "decidedBy": "Egg + Claude or solo call"}]}. Include only decisions actually made this session (max 5). Use an empty array when there are none.`

// Decisions & Context Log (Notion). The Morning Briefing page was retired, so /park logs here.
const DECISIONS_LOG = 'collection://d27124f4-d60e-4fa9-b8bc-738f07b175f0'
const CATEGORIES = ['Strategy', 'Messaging', 'Process', 'Client', 'Technical', 'People']

export type Decision = { decision: string; category: string; context: string; decidedBy: string }

/** The Notion "Workspace" option for a project path, or undefined when the path says nothing. */
export const workspaceFor = (cwd: string): string | undefined => {
  if (/\/Projects\/D8(\/|$)/.test(cwd)) return 'D8TAOPS'
  if (/\/Projects\/BGC(\/|$)/.test(cwd)) return 'BGC'
  if (/\/Projects\/Egg(\/|$)/.test(cwd)) return 'Personal'
  return undefined
}

/** Splits the reply into the handoff text and valid decisions (empty when absent or malformed). */
export const splitHandoff = (text: string): { handoff: string; decisions: Decision[] } => {
  const m = text.match(/```json\s*([\s\S]*?)```\s*$/)
  if (!m) return { handoff: text.trim(), decisions: [] }
  const handoff = text.slice(0, m.index).trim()
  try {
    const list = JSON.parse(m[1])?.decisions
    if (!Array.isArray(list)) return { handoff, decisions: [] }
    const decisions = list
      .filter((d: any) => d && typeof d.decision === 'string' && d.decision.trim() !== '')
      .slice(0, 5)
      .map((d: any) => ({
        decision: d.decision.trim(),
        category: CATEGORIES.includes(d.category) ? d.category : 'Process',
        context: typeof d.context === 'string' ? d.context.trim() : '',
        decidedBy: typeof d.decidedBy === 'string' && d.decidedBy.trim() ? d.decidedBy.trim() : 'Egg + Claude',
      }))
    return { handoff, decisions }
  } catch {
    return { handoff, decisions: [] }
  }
}

/** Hidden note for the model: log only after the user says "log decisions". */
export const decisionsDirective = (decisions: Decision[], workspace: string | undefined, date: string): string =>
  `/park produced ${decisions.length} decision(s) for the Decisions & Context Log (data source ${DECISIONS_LOG}). Do NOT write anything until the user replies "log decisions". On confirmation, with the Notion MCP:
1. For each decision, first search the log for an existing entry with the same "Decision" title; skip duplicates.
2. Create one page per remaining decision. Properties: Decision (title), Category, Context, "Decided By", Workspace${workspace ? ` = "${workspace}"` : ' (leave unset, the project path did not say; ask the user if it matters)'}, Date = ${date}. Leave Source and Tags empty.
3. Report exactly which entries were created and which were skipped as duplicates.
Decisions: ${JSON.stringify(decisions)}`

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'park', description: 'Save a handoff to memory/last_handoff.md', argumentHint: '[note]' })
    await $.command.register({ name: 'resume', description: 'Read the last handoff and report state' })
    await $.command.register({ name: 'ship', description: 'git pull --rebase && git push -u origin <branch>' })
    return next(e)
  })

  on('command.run', { command: 'park' }, async ($, e) => {
    const r = await $.model.fork({ prompt: e.args ? `${PARK_PROMPT}\nExtra note from the user: ${e.args}` : PARK_PROMPT })
    if (!r.isAnswered)
      return { text: r.reason === 'nothing-to-fork' ? 'Nothing to park yet.' : `Park failed: ${r.reason}.` }

    const cwd = await $.session.cwd()
    const home = (await $.process.run(['printenv', 'HOME'])).stdout.trim()
    const iso = new Date().toISOString()
    const stamp = iso.slice(0, 16).replace('T', ' ')
    const { handoff, decisions } = splitHandoff(r.text)
    const body = `# Handoff — ${stamp}\n\n${handoff}\n`
    const written: string[] = []
    for (const path of handoffPaths(cwd, home)) {
      await $.process.run(['mkdir', '-p', path.replace(/\/[^/]+$/, '')])
      await $.fs.write(path, body)
      written.push(path)
    }
    const hasDecisions = decisions.length > 0
    return {
      text: `Parked. Handoff saved:\n${written.join('\n')}${hasDecisions ? `\nNotion: ${decisions.length} decision(s) ready. Reply "log decisions" to add them to the Decisions & Context Log.` : ''}`,
      ...(hasDecisions ? { context: [decisionsDirective(decisions, workspaceFor(cwd), iso.slice(0, 10))] } : {}),
    }
  })

  on('command.run', { command: 'resume' }, async $ => {
    const cwd = await $.session.cwd()
    const home = (await $.process.run(['printenv', 'HOME'])).stdout.trim()
    for (const path of handoffPaths(cwd, home)) {
      if (await $.fs.exists(path)) {
        const text = await $.fs.read(path)
        return {
          text: `Resuming from ${path}`,
          context: [`Last handoff (${path}). Report: where we left off, what's blocked, what can be worked now.\n\n${text}`],
        }
      }
    }
    return { text: 'No handoff found. Nothing to resume.' }
  }).catch(() => ({ text: 'Resume failed while reading the handoff.' }))

  on('command.run', { command: 'ship' }, async $ => {
    const branch = (await $.process.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim()
    if (!isShippable(branch)) return { text: 'Not on a branch (detached HEAD). Not shipping.' }

    const url = (await $.process.run(['git', 'remote', 'get-url', '--push', 'origin'])).stdout.trim()
    const refusal = remoteVerdict(await $.session.cwd(), url)
    if (refusal) return { text: `Not shipping. ${refusal}` }

    const pull = await $.process.run(['git', 'pull', '--rebase', 'origin', branch])
    const isNewBranch = pull.exitCode !== 0 && /couldn't find remote ref/.test(pull.stderr)
    if (pull.exitCode !== 0 && !isNewBranch)
      return { text: `Pull --rebase failed, not pushing:\n${(pull.stderr || pull.stdout).trim()}` }

    const push = await $.process.run(['git', 'push', '-u', 'origin', branch])
    const out = (push.stderr + push.stdout).trim()
    return { text: push.exitCode === 0 ? `Shipped ${branch}.\n${out}` : `Push failed:\n${out}` }
  })
}
