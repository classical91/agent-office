# SMOKE_TEST.md — YouTube packaging

One command, no API keys, no network, no tokens spent.

## 1. Run the smoke test

```bash
npm run package:youtube:smoke
```

It regenerates a package from `fixtures/youtube-packaging/sample-input.json` and compares
it to the checked-in fixtures. Expected output:

```text
ok   fixtures/youtube-packaging/sample-output.md matches freshly generated output
ok   fixtures/youtube-packaging/sample-output.json matches freshly generated output
```

Exit code `0` = pass. Exit code `1` = the generated package drifted from the fixture, and
the failure prints the first differing line.

The same comparison runs as part of the normal suite (`npm test` →
`tests/youtube-packaging.test.js`), so drift fails CI rather than waiting to be noticed.

Drift is expected whenever `YOUTUBE_PACKAGING.md` changes, because the review checklist and
the playbook hash are read out of that file at runtime. If the change was intentional:

```bash
npm run package:youtube:fixtures   # regenerate, then commit the fixture diff
```

Never hand-edit a fixture.

## 2. Package something new

```bash
npm run package:youtube -- \
  --idea "A 9-minute video about building OpenClaw specialist agents that turn vague ideas into finished workflows" \
  --format both \
  --audience "solo founders and automation builders" \
  --tone "practical, slightly cinematic, no hype"
```

Markdown goes to stdout. Add `--json` for the machine-readable payload, or write both:

```bash
npm run package:youtube -- \
  --input path/to/handoff.json \
  --out packages/my-video.md \
  --out-json packages/my-video.json
```

Full flag list: `npm run package:youtube -- --help`.

## 3. Studio Director handoff

Studio Director sends a packet; packaging consumes it directly. `--handoff` merges under
`--input`, and explicit flags override both.

```bash
npm run package:youtube -- --handoff path/to/sd-packet.json --out-json packages/sd-001.json
```

The response echoes `request.handoffId` and `request.from` so Studio Director and Penny can
match it to the request. Packet shape is documented in `YOUTUBE_PACKAGING.md` §9.

## 4. What a pass proves

- The playbook was read. `package.reviewChecklist.source` and the `playbook.sha256` in the
  payload come from `YOUTUBE_PACKAGING.md` at runtime — delete that file and packaging
  fails instead of producing an unreviewed package.
- All eight sections are present: titles, recommended title, thumbnails, description,
  pinned comment, Shorts, longform, review checklist. Sections that don't apply to the
  requested format are present and marked `applicable: false` with a reason.
- Output is deterministic for a given input plus `--now`, so it is diffable in review.

## 5. Verify the playbook dependency by hand

```bash
mv YOUTUBE_PACKAGING.md /tmp/ && npm run package:youtube -- --idea "test" --format short --audience "test"; mv /tmp/YOUTUBE_PACKAGING.md .
```

Expected: `error: Cannot package: YOUTUBE_PACKAGING.md not found ...`, exit code 1.

`tests/youtube-packaging.test.js` asserts the same thing against a scratch directory, so the
manual check is only needed when changing how the playbook is resolved.

## 6. Repo validation status (measured 2026-08-05)

| Command | Result |
| --- | --- |
| `npm run package:youtube:smoke` | passes |
| `npm test` | passes — 113/113, including the 4 packaging tests |

The command is plain ESM under `scripts/` with no dependencies, so it runs with bare `node`
and does not touch the office server, the calendar assets, or the `pg` dependency.

## 7. Where this lives, and why

Packaging is YouTube Claw's workflow, and YouTube Claw is an agent in this office — so the
playbook, the command, and the agent's config
(`agent-office-deploy/dist/config-files/youtubeclaw/`) all live here, together.

The **youtube-claw** repo is a different thing: the Next.js Shorts workflow studio that
generates, edits, and exports video. It does not carry the packaging command.
