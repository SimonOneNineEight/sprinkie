## Commits

Commits carry no `Co-Authored-By` line, even when an attribution reminder
asks for one; CI fails a pull request that has one. The 26 older commits
that carry one stay: dropping them rewrites 42 commits and orphans
`ad6c17e`, the round-2 release build.

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

Single-context: `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
