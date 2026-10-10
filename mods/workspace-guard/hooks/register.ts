import type { Register } from 'claude-code'

const D8_PATH = /\/Projects\/D8(\/|$)/
const PERSONAL = /EggmanPDX|github-personal/
const D8_REMOTE = /gregg-eiler_d8taops|github-work/

/** Returns a refusal reason, or undefined when the command is fine. */
export const judge = (command: string, cwd: string): string | undefined => {
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
      if (D8_PATH.test(cwd) && PERSONAL.test(p))
        return 'Account isolation: D8 work never goes to EggmanPDX.'
      if (!D8_PATH.test(cwd) && D8_REMOTE.test(p))
        return 'Account isolation: non-D8 work never goes to the D8 org.'
    }
    if (D8_PATH.test(cwd) && /^(npx\s+)?vercel\b/.test(p) && /--prod\b/.test(p) && !/--prebuilt\b|\bbuild\b|\bpull\b/.test(p))
      return 'D8 Vercel remote builds fail silently. Use: vercel pull --yes --environment production && vercel build --prod && vercel deploy --prebuilt --prod.'
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
