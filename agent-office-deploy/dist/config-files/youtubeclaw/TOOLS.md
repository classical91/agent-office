# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics - the stuff that's unique to
your setup.

## The packaging command

Lives in the **agent-office** repo. Plain ESM, zero dependencies, runs with bare `node`.

```bash
npm run package:youtube -- \
  --idea "<raw idea or premise>" \
  --format both \
  --audience "<who this is for>" \
  --tone "<tone>" \
  --notes-file <transcript-or-notes.txt>
```

From a Studio Director packet: `npm run package:youtube -- --handoff packet.json`

Every flag: `npm run package:youtube -- --help`

## Paths

| What | Where |
|------|-------|
| The playbook (read at runtime) | `YOUTUBE_PACKAGING.md` (repo root) |
| The command | `scripts/package-youtube.mjs` |
| Command internals | `scripts/lib/{packaging,playbook,render,text}.mjs` |
| Fixtures | `fixtures/youtube-packaging/` |
| Smoke test doc | `SMOKE_TEST.md` |

## Checks before handing work back

```bash
npm run package:youtube:smoke   # fixtures still match generated output
npm test                        # full agent-office suite, includes packaging
```

If you changed `YOUTUBE_PACKAGING.md`, the fixtures will drift - that is expected, because the
checklist and the playbook hash are read out of that file at runtime. Regenerate and commit:

```bash
npm run package:youtube:fixtures
```

Never hand-edit a fixture.

## Related projects

- **youtube-claw repo** - the Shorts workflow studio (Next.js app: generate, edit, export).
  Separate codebase. Packaging does not live there; it lives here with the rest of the office.
