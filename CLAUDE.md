## Commits

Never add a `Co-Authored-By` line. 26 commits between 2026-09-12 and
2026-10-05 carry one against this rule, which is why it is written here and
not only in a private config: they stay as they are, since dropping them
means rewriting 42 commits and orphaning `ad6c17e`, the build the round-2
release pass is recorded against. New commits do not add more.

Ticket work goes on a `ticket/<number>` branch and reaches `main` through a
pull request. Push the branch when you make it: `ticket/53` sat finished and
unpushed for three weeks, so a later session treated the ticket as untouched
and implemented it a second time.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (`SimonOneNineEight/sprinkie`), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary — the five canonical role names used as-is. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
