import type { Register } from 'claude-code'

// Personal tooling: this mod does nothing in D8 projects (work), by design.
const D8_PATH = /\/Projects\/D8(\/|$)/i
const D8_REMOTE = /gregg-eiler_d8taops|github-work/

export const isD8 = (cwd: string): boolean => D8_PATH.test(cwd)

/** Returns a refusal reason, or undefined when the command is fine. Never judges in D8. */
export const judge = (command: string, cwd: string): string | undefined => {
  if (isD8(cwd)) return undefined
  const parts = command.split(/&&|\|\||;|\n/).map(s => s.trim())

  for (const p of parts) {
    if (/^git\s/.test(p) && /--no-verify\b/.test(p))
      return 'Never skip hooks (--no-verify) without an explicit ask.'
    if (/^git\s+push\b/.test(p)) {
      const force = /\s(-f|--force)(\s|$)/.test(p) || /\s\+\S+/.test(p)
      if (force && /\b(main|master)\b/.test(p))
        return 'Never force-push to main/master.'
      if (p.replace(/^git\s+push/, '').trim() === '')
        return 'Bare `git push` is banned. Use `git pull --rebase && git push -u origin <branch>`.'
      if (D8_REMOTE.test(p))
        return 'Account isolation: personal work never goes to the D8 org.'
    }
  }
  return undefined
}

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const reason = judge(e.command, await $.session.cwd())
    return reason ? { deny: `${$.plugin.name}: ${reason}` } : next(e)
  }).catch(($, e, next) =>
    next.called ? next(e) : { deny: `${$.plugin.name}: guard failed, refusing to be safe.` },
  )
}
