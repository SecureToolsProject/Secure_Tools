# Repository workflow policy

## Protected branches

- `main` is production-only. `v2.1` is the active integration branch for the v2.1.0 development cycle.
- Never commit feature, fix, test, or chore work directly to `main` or `v2.1`.

## Development work

- Create short-lived `feat/*`, `fix/*`, `test/*`, or `chore/*` branches from `v2.1`.
- Sprint and routine development pull requests target `v2.1`, not `main`.
- After a successful merge, delete only the merged short-lived branch when cleanup is authorized.

## Merge authority

- Creating a pull request and merging it are separate operations.
- An agent must not merge its own pull request automatically. Passing CI does not authorize a merge.
- Merge only when the user explicitly requests that specific merge after review. Never enable auto-merge without an explicit request.

## Production promotion

- Normal development reaches `main` only through a dedicated release or hardening pull request from `v2.1`.
- Creating the v2.1.0 tag or release requires separate explicit authorization after final verification.

## Hotfixes

- Production hotfixes use a dedicated `hotfix/*` branch and pull request into `main`.
- Never push a hotfix directly to `main`.
