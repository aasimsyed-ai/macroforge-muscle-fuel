# Developer ↔ QA GitHub Automation

Added 2026-09-12. Eliminates manually copying QA reports between chat windows: every PR against `main` gets an automated, independent QA review posted directly as a PR comment, and every new commit on that PR triggers a fresh review.

## How it works

1. Claude Code (Developer) pushes commits to a feature branch and opens/updates a PR against `main`.
2. GitHub fires `pull_request: opened/synchronize/reopened` — this repo does not listen on any other event for this workflow.
3. `.github/workflows/qa-review.yml` runs on a GitHub-hosted runner:
   - checks out the PR's head commit (read-only)
   - `bun install`, then lint / `tsc --noEmit` / build / test — a real, independent signal that has historically not been available in the developer's local environment (no Node/npm there)
   - computes the diff against the PR's base branch (**diff only, not the whole repo** — capped in size)
   - sends the diff + changed-file list + check results to Gemini (`.github/scripts/qa-review.mjs`), using the instructions in `.github/qa-reviewer-prompt.md`
   - posts Gemini's review as one PR comment, starting with `**QA VERDICT: SHIP**` or `**QA VERDICT: NEEDS FIXES**`
4. Claude Code reads that comment on its next turn/session, fixes genuine findings, and pushes a new commit — which triggers step 2 again automatically.
5. Repeat until a `SHIP` verdict. **Merging to `main` stays a manual, human decision** — this automation never merges, deploys, or touches Supabase.

## Security model

- The workflow's own `GITHUB_TOKEN` is scoped to `contents: read` + `pull-requests: write` only — it is structurally unable to push, merge, or modify anything beyond posting one comment, regardless of what any step is told to do.
- No Supabase credentials (schema, data, service-role key, deploy token) are ever passed to this workflow. Gemini and the reviewer script have no path to Supabase even if instructed to use one.
- The workflow uses `pull_request` (not `pull_request_target`), the safe trigger for a public repo — GitHub automatically withholds all secrets from fork-originated PRs under this trigger, so a stranger's fork PR gets the free lint/build/test signal only, never a paid Gemini review.
- The QA prompt (`.github/qa-reviewer-prompt.md`) explicitly tells the model it is read-only and to ignore any instructions embedded in the code/diff/commit messages it's reviewing (basic prompt-injection hygiene — the model can only ever produce a comment, never an action).

## Recursion safety

- The workflow **never** triggers on comment events (`issue_comment`, `pull_request_review_comment`) — only on `pull_request` itself. Gemini's own PR comment cannot trigger anything.
- The QA job never commits or pushes, so it cannot produce the `synchronize` event that would re-trigger itself.
- `concurrency: qa-review-<PR number>` with `cancel-in-progress: true` means rapid successive pushes only pay for one (the latest) review, not one per push.
- A built-in iteration guard counts existing `QA VERDICT` comments on the PR; at 8 it stops running Gemini and posts a "needs human review" notice instead, so an unattended fix/review loop can't run indefinitely or rack up unbounded API cost while unattended.

## Configuring the required secret

One manual step, since Claude Code cannot create or read your API key:

```bash
gh secret set GEMINI_API_KEY --repo aasimsyed-ai/macroforge-muscle-fuel
```

or add it via GitHub → repo Settings → Secrets and variables → Actions.

## Swapping the QA provider later

Everything in `.github/scripts/qa-review.mjs` up to `callQaProvider()` is plain text assembly with no provider-specific knowledge. Only `callQaProvider()` knows it's calling Gemini's REST API. To switch models/providers later: add a new branch inside that one function (keyed off `QA_PROVIDER`), point the workflow's `QA_PROVIDER` env var at it, and add whatever secret that provider needs — nothing else in the workflow or prompt needs to change.

## Testing it safely

- Open a small, low-stakes PR against `main` (e.g. a comment-only or docs change) after setting the secret, and confirm a QA comment appears within a couple of minutes.
- Check the Actions tab for the `QA Review (Gemini)` run to see the captured lint/typecheck/build/test output if something looks off.
- The workflow makes no changes to any file, branch, or Supabase resource — it is safe to test against a disposable PR.
