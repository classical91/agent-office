# YOUTUBE_PACKAGING.md

The packaging playbook for **YouTube Claw**. Every YouTube package this repo produces —
whether it came from a raw idea or a Studio Director handoff — follows this document.

This file is not decoration: `scripts/package-youtube.mjs` reads the
[Review Checklist](#review-checklist) out of this file at runtime and stamps the resulting
package with this file's content hash. If this file is missing or its checklist section is
empty, packaging fails loudly instead of silently shipping an unreviewed package.

---

## 1. When this playbook applies

- A raw idea or video premise arrives ("package this for YouTube: ...").
- Studio Director hands off a packet for a video that is scripted, shot, or already edited.
- An existing video needs a repackage (new titles/thumbnails after weak CTR).

Penny remains the only orchestrator. Studio Director routes work here. YouTube Claw packages
and hands the result back — it does not schedule, publish, or touch credentials.

---

## 2. Input contract

| Field | Required | Notes |
| --- | --- | --- |
| `idea` | yes | Raw idea or video premise, one or two sentences. |
| `format` | yes | `short`, `longform`, or `both`. |
| `audience` | yes | Who this is for, in their own words. Not a demographic bucket. |
| `tone` | no | Defaults to `practical, direct, no hype`. |
| `durationMinutes` | no | Longform target runtime. Drives the chapter grid. |
| `sourceNotes` | no | Transcript, outline, or notes. Used verbatim for evidence beats. |
| `keywords` | no | Search terms to keep in the title/description surface. |
| `handoff` | no | Studio Director packet (see §9). Merged under explicit fields. |

Precedence when both are present: explicit CLI flags > `handoff` packet fields > defaults.
Never invent an audience or a format. If either is missing, ask before packaging.

---

## 3. Output contract

Every package contains all eight sections, every time, in this order. Sections that do not
apply to the chosen format are still present and explicitly marked `not applicable` — a
missing section is a defect, not a shortcut.

1. **Title options** — 8–12, grouped by angle
2. **Recommended title** — one pick, with rationale
3. **Thumbnail concepts** — exactly 3
4. **Description** — hook, summary, CTA, links placeholder
5. **Pinned comment**
6. **Shorts cutdown plan** — when format is `short` or `both`
7. **Longform chapter outline** — when format is `longform` or `both`
8. **Review checklist** — copied live from §10 of this file

---

## 4. Titles

- Produce **8–12** options across **at least 4 distinct angles**. Angles in use:
  - `outcome` — the result the viewer gets
  - `curiosity` — an open loop, honest not clickbait
  - `contrarian` — the belief being corrected
  - `system` — the repeatable method or build
  - `story` — the lived, first-person version
- Target **≤ 60 characters**. Anything over 70 is flagged; mobile truncates it.
- Front-load the specific noun. The first 3 words carry the click.
- Numbers only when the number is real and in the video.
- No ALL CAPS words, no more than one `?` or `!` across the whole title.
- Do not promise anything the source notes don't support.

**Recommended title** must state *why*: which angle, what it front-loads, what it avoids.

---

## 5. Thumbnails

Exactly three concepts, and each one must specify:

- **Layout** — where subject and text sit, in words a designer can execute.
- **Subject** — the person or object, including framing and eyeline.
- **Text** — **≤ 4 words**, never a repeat of the title.
- **Emotion** — the readable expression or energy.
- **Contrast** — foreground/background separation and the palette.
- **Mobile readability** — what survives at 168×94 px, checked as a squint test.

The three concepts must be genuinely different bets (e.g. face-led, artifact-led,
before/after), not three shades of the same frame.

---

## 6. Description

Fixed shape:

1. **Hook** — 1–2 lines, the same promise as the title, no restated title.
2. **Summary** — 2–4 short paragraphs. What the video covers, who it's for.
3. **Chapters** — timestamps, when longform. `0:00` first, always.
4. **CTA** — one ask, not three.
5. **Links** — placeholder block only. **Never invent URLs.** Use `<LINK: label>` markers.
6. **Hashtags** — 3–5, lowercase, relevant.

Keep the first 150 characters self-contained; that's all the search snippet shows.

---

## 7. Pinned comment

One short comment that does one job: ask the question that makes the comment section
useful. Add the single most relevant link placeholder. No hashtags, no emoji walls.

---

## 8. Shorts cutdown plan

For `short` or `both`, plan **3 cutdowns**, each with:

- Source beat it comes from (or the source notes line it maps to)
- Hook line in the first **2 seconds**
- Beat-by-beat timing to a **≤ 45 s** total
- On-screen text per beat, ≤ 6 words a line
- Loop or CTA ending — say which
- The vertical framing note (subject in the safe middle third)

Shorts are not trailers for the longform. Each one must be complete on its own.

---

## 9. Longform chapter outline

For `longform` or `both`: chapters covering the target runtime, each with a timestamp, a
title (≤ 40 chars), and the promise the chapter pays off. First chapter starts at `0:00`
and is the cold open. Last chapter is the recap plus the single CTA.

### Studio Director handoff packet

Studio Director sends (all optional except `idea`):

```json
{
  "handoffId": "sd-2026-08-05-001",
  "from": "studio-director",
  "idea": "...",
  "format": "both",
  "audience": "...",
  "tone": "...",
  "durationMinutes": 9,
  "keywords": ["..."],
  "sourceNotes": "transcript or outline text",
  "constraints": ["no hype", "no fake numbers"]
}
```

The returned package echoes `handoffId` and `from` so Studio Director and Penny can match
the response to the request.

---

## 10. Review checklist

Copied verbatim into every generated package. Do not reword items casually — the script
parses `- [ ]` lines under the `###` groups below.

### Titles
- [ ] 8–12 options present, spread across 4+ distinct angles
- [ ] Recommended title is ≤ 60 characters
- [ ] Recommended title front-loads the specific noun, not a filler phrase
- [ ] No promise in the title that the source notes cannot support
- [ ] Rationale names the angle and what it avoids

### Thumbnail
- [ ] Exactly 3 concepts, each a genuinely different bet
- [ ] Every concept has layout, subject, text, emotion, contrast, mobile note
- [ ] Thumbnail text is ≤ 4 words and does not repeat the title
- [ ] Squint test passes at 168x94 px
- [ ] Title and thumbnail together say more than either one alone

### Description
- [ ] First 150 characters stand alone as a search snippet
- [ ] Hook does not restate the title verbatim
- [ ] Exactly one CTA
- [ ] Links are placeholders only — no invented URLs
- [ ] 3–5 lowercase hashtags

### Pinned comment
- [ ] Asks one answerable question
- [ ] Carries at most one link placeholder

### Shorts
- [ ] 3 cutdowns, each ≤ 45 seconds
- [ ] Hook lands inside the first 2 seconds
- [ ] Each cutdown works without the longform
- [ ] On-screen text lines are ≤ 6 words
- [ ] Vertical safe-area framing noted

### Longform
- [ ] Chapters cover the full target runtime
- [ ] First chapter is 0:00 and is a cold open
- [ ] Chapter titles are ≤ 40 characters
- [ ] Final chapter recaps and carries the CTA

### Handoff
- [ ] Format, audience, and tone match the request
- [ ] `handoffId` echoed when one was supplied
- [ ] No credentials, tokens, upload actions, or schedule changes in the package
- [ ] Package is complete: all 8 sections present, N/A sections marked explicitly

---

## 11. Hard limits

- No credentials, bot tokens, or API keys in a package — ever.
- No publishing, uploading, scheduling, or cron changes. Packaging stops at the document.
- No fabricated URLs, view counts, testimonials, or sponsor names.
- No claims the source notes do not support. Missing evidence is stated as missing.
