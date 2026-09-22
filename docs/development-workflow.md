# Development workflow

Secure Tools separates product versions from Sprint numbers. A Sprint is a bounded unit of work within a product development cycle; it does not create a version, tag, or release by itself. Sprint 16B, for example, belongs to the v2.1.0 development cycle.

## Branch roles

- `main` is the production branch. Routine development does not target it.
- `v2.1` is the integration branch for the v2.1.0 cycle.
- Short-lived `feat/*`, `fix/*`, `test/*`, and `chore/*` branches start from `v2.1` and return through pull requests into `v2.1`.
- Direct feature or fix commits to `main` or `v2.1` are prohibited.

```text
main (production)
  ↑
release PR after hardening
  ↑
v2.1 (integration)
  ↑
Sprint PRs
  ↑
feat/* fix/* test/* chore/*
```

## Sprint delivery

1. Update local `v2.1` from `origin/v2.1`.
2. Create a short-lived branch from that exact integration state.
3. Commit and validate only the Sprint’s intended changes.
4. Open a pull request into `v2.1` and wait for required CI.
5. Treat review and merge as a separate step. An agent does not merge its own pull request or enable auto-merge unless the user explicitly authorizes that specific action.
6. After a successful merge and verification, remove the merged short-lived branch when branch cleanup is authorized.

## Production release

After the v2.1.0 scope is integrated, complete release hardening and final verification on `v2.1`. Promote it through a dedicated `v2.1` → `main` pull request. Only after that pull request is explicitly reviewed and merged may a separately authorized task create the v2.1.0 tag and release.

## Hotfixes

Urgent production fixes use a dedicated `hotfix/*` branch and pull request into `main`. They are never pushed directly. After production verification, carry the correction back into the active integration line as needed through an appropriate pull request.

## Enforced pull request policy

CI permits routine `feat/*`, `fix/*`, `test/*`, and `chore/*` pull requests into `v2.1`. Pull requests into `main` pass the branch-policy gate only when the head is exactly `v2.1` or a dedicated `hotfix/*` branch. The repository protects both long-lived branches with required pull requests, the existing `Validate static tools` check, resolved review conversations, blocked force pushes, and blocked deletion. Because the repository currently has one maintainer, an approving-review count is not required; explicit merge authorization remains mandatory.
