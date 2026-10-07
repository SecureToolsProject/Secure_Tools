# Repository workflow policy

## Protected branches

- `main` is production-only. `v2.2` is the active integration branch for the v2.2.0 development cycle.
- Never commit feature, fix, test, or chore work directly to `main` or `v2.2`.

## Development work

- Create short-lived `feat/*`, `fix/*`, `test/*`, or `chore/*` branches from `v2.2`.
- Sprint and routine development pull requests target `v2.2`, not `main`.
- After a successful merge, delete only the merged short-lived branch when cleanup is authorized.

## Commit messages

- Use exactly `<Gitmoji>[<Action>] <imperative subject>` for every human-authored commit. There is no space before `[Action]`, square brackets are mandatory, and exactly one space follows `]`.
- Use one fixed pair: `✨[Feat]`, `➕[Add]`, `🚀[Deploy]`, `✅[Test]`, `📈[Data]`, `🐛[Fix]`, `♻️[Refactor]`, `🔧[Config]`, `🚨[Hotfix]`, `⚙️[Chore]`, `🎉[Init]`, `📄[Docs]`, `🎀[Style]`, or `🚚[Rename]`.
- Write a concise imperative subject for one logical change. Split unrelated changes into separate commits.
- Plain Conventional Commit prefixes such as `feat:`, mismatched pairs such as `🐛[Feat]`, and spaced forms such as `✨ [Feat]` are prohibited.
- Good: `✨[Feat] Add Image to Text OCR`, `✅[Test] Cover OCR cancellation`, `📄[Docs] Document release workflow`.
- Bad: `feat: add OCR`, `✨ [Feat] Add OCR`, `✨[Fix] Add OCR`.
- Inspect recent conforming history if uncertain. Do not create a commit until its message satisfies this convention.
- Commit creation does not authorize merging; the merge-authority policy below still applies.

## Merge authority

- Creating a pull request and merging it are separate operations.
- An agent must not merge its own pull request automatically. Passing CI does not authorize a merge.
- Merge only when the user explicitly requests that specific merge after review. Never enable auto-merge without an explicit request.

## Production promotion

- Normal development reaches `main` only through a dedicated release or hardening pull request from `v2.2`.
- Creating the v2.2.0 tag or release requires separate explicit authorization after final verification.

## Hotfixes

- Production hotfixes use a dedicated `hotfix/*` branch and pull request into `main`.
- Never push a hotfix directly to `main`.
