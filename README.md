# claude-mods

Egg's Claude Code mods. Personal only: nothing here is for D8 work, and no D8 data lives in this repo.

**Scope: personal projects only.** Every mod is inert in D8 projects (any working directory under `.../Projects/D8/`): the guard judges nothing, the slash commands are not registered, and a run says it is off. Install at user scope and they work in all your personal projects (BGC, Egg, anything else) and stay out of D8.

- `workspace-guard`: refuses Bash commands that break the CLAUDE.md hard rules (bare `git push`, force-push to main, skipping git hooks, pushing personal work to the D8 org). Off in D8, so it does not protect D8 repos from a personal push; that check lives wherever D8 is enforced.
- `session-rituals`: `/park` (handoff to `memory/last_handoff.md` plus the fallback path, stages decisions for the Notion Decisions & Context Log, reply "log decisions"), `/resume`, `/ship` (pull --rebase, push -u origin <branch>, refuses any remote that is not EggmanPDX).
- `reflect`: `/reflect [focus]` reviews the session and appends to `memory/reflections.md`; reply "log it" to append to the matching Notion Build Tracker row.

## Install (user scope = every project)

In a terminal Claude Code session:

```
/plugin install workspace-guard --marketplace git@github-personal:EggmanPDX/claude-mods.git
/plugin install session-rituals --marketplace git@github-personal:EggmanPDX/claude-mods.git
/plugin install reflect --marketplace git@github-personal:EggmanPDX/claude-mods.git
```

Answer `y` to add the marketplace and pick the **user** scope, so the mods load in all projects, not one. The SSH alias `github-personal` reaches EggmanPDX; the `owner/repo` shorthand clones over HTTPS with the `gh` credential, which only holds the D8 account.

Check SSH first: `ssh -T git@github-personal` should greet `EggmanPDX`. After installing, restart Claude Code once; mods hot-reloaded in a session do not persist.

Test: `claude plugin test mods/<name>`
