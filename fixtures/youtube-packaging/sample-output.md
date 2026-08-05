# YouTube Package: A 9-minute video about building OpenClaw specialist agents that turn vague idea…

| Field | Value |
| --- | --- |
| Format | both |
| Audience | solo founders and automation builders |
| Tone | practical, slightly cinematic, no hype |
| Target runtime | 9 min |
| Source notes | supplied |
| Handoff | sd-2026-08-05-001 (from studio-director) |
| Playbook | YOUTUBE_PACKAGING.md @ a171f980ebde |
| Schema | 1.0.0 |
| Generated | 2026-08-05T00:00:00.000Z |

## 1. Title options

### Outcome

- Turn Vague Ideas Into Finished Workflows — *40 chars*
- From Vague Ideas to Finished Workflows — *38 chars*
- Build OpenClaw Specialist Agents, Start to Finish — *49 chars*
- The OpenClaw Specialist Agents Setup, End to End — *48 chars*

### System

- How to Build OpenClaw Specialist Agents — *39 chars*
- A Repeatable Way to Build OpenClaw Specialist Agents — *52 chars*
- The OpenClaw Agents Workflow, Step by Step — *42 chars*

### Curiosity

- What It Actually Takes to Build OpenClaw Specialist Agents — *58 chars*
- The OpenClaw Agents Part Nobody Explains — *40 chars*

### Contrarian

- You Don't Need More Tools to Build OpenClaw Specialist Agents — *61 chars, flags: over-60-chars, needs-source-check*
- OpenClaw Specialist Agents Without the Hype — *43 chars, flags: needs-source-check*

### Story

- What I Learned Trying to Build OpenClaw Specialist Agents — *57 chars, flags: needs-source-check*

## 2. Recommended title

**Turn Vague Ideas Into Finished Workflows**

Angle: outcome. Front-loads "Turn Vague Ideas", which is the specific thing solo founders and automation builders are searching for. 40 characters, so it survives mobile truncation. Keeps the requested no-hype register: no caps, no exclamation, no promise beyond the video.

## 3. Thumbnail concepts

### 1. Face-led: the person mid-decision

- **Layout:** Subject on the right third, shot from chest up, looking slightly off-camera toward the text. Text block stacked left, upper two-thirds, nothing in the bottom-right (timestamp overlay lands there).
- **Subject:** A single person at a desk mid-work on OpenClaw agents, screen glow on one side of the face, hands visible.
- **Text (<= 4 words):** Vague Ideas → Finished Workflows
- **Emotion:** Focused and slightly amused — a person who just figured something out, not a person shouting.
- **Contrast:** Warm key light on the subject against a desaturated cool background; text in near-white with a 2px dark outline so it holds over both.
- **Mobile readability:** Two text words only; at 168x94 px the face reads as a face and the arrow reads as direction. Squint test: subject silhouette and arrow survive, background detail does not — which is fine.

### 2. Artifact-led: show the thing itself

- **Layout:** The artifact fills the left 60% at a slight angle, text right-aligned in the remaining third, baseline centred vertically.
- **Subject:** The actual output of OpenClaw agents — the screen, doc, or board — cropped tight enough that one element is unambiguously readable.
- **Text (<= 4 words):** OpenClaw Agents
- **Emotion:** Curiosity through specificity: it looks like a real screenshot, not a stock render.
- **Contrast:** Single bright accent (one highlighted row/box) against an otherwise muted frame; the accent is the only saturated colour in the image.
- **Mobile readability:** One readable element plus two words. At thumbnail size the accent block is the anchor; everything else can blur without losing the message.

### 3. Before/after: the split frame

- **Layout:** Hard vertical split. Left panel = before state, right panel = after state, thin bright divider. Two-word label bottom-centre spanning the seam.
- **Subject:** Left: vague ideas. Right: finished workflows. Same framing on both sides so only the content changes.
- **Text (<= 4 words):** Ideas vs Workflows
- **Emotion:** Relief — the right panel is visibly calmer than the left.
- **Contrast:** Left panel cool and cluttered, right panel warm and clean; the divider is the brightest pixel in the frame.
- **Mobile readability:** Composition reads before the text does, so it works even when the label is illegible. Keep each panel to one dominant shape.

## 4. Description

```text
Vague ideas in, finished workflows out — here is the whole path, start to finish.

This video walks through building OpenClaw specialist agents for solo founders and automation builders. No theory detour: the setup, the decisions, and what breaks.

Covered in this video: A specialist agent is just a scoped role plus a playbook the agent has to read every run; The failure mode is starting from a blank prompt each time, which produces a different shape of output every run; The fix is a checked-in playbook file that the agent parses at runtime, so the standard and the output cannot drift apart.

Made for solo founders and automation builders who want the working version, not the pitch. Tone: practical, slightly cinematic, no hype.

CHAPTERS
0:00 Cold open: the result
0:43 Why this is hard
2:22 Build it: first pass
4:02 Where it breaks
5:41 What I would change
7:21 Recap and next step

If you build one of these, reply to the pinned comment with what you shipped — that is the only ask.

LINKS
<LINK: full written walkthrough>
<LINK: template or starter repo>
<LINK: related video>

#openclaw #aiagents #workflowautomation #specialist #agents
```

## 5. Pinned comment

```text
Question for the solo founders and automation builders watching: what is the one step in OpenClaw agents you still do by hand? Tell me which step and I will cover it in the follow-up. Written version: <LINK: full written walkthrough>
```

## 6. Shorts cutdown plan

### short-1: The transformation (42s, ends on loop)

- **Source beat:** A specialist agent is just a scoped role plus a playbook the agent has to read every run.
- **Hook (first 2s):** Vague ideas to finished workflows — in one pass.
- **Framing:** Subject and all on-screen text inside the middle third; keep the bottom 20% clear of the caption bar.

| Time | On-screen text | Action |
| --- | --- | --- |
| 0:00-0:02 | Vague Ideas | Hard cut straight to the messy starting state. No intro, no name. |
| 0:02-0:12 | Here is the input | Show the raw input exactly as it arrives — unedited, unflattering. |
| 0:12-0:28 | One pass | Compress the middle of the longform to the three decisions that matter. |
| 0:28-0:38 | Finished Workflows | Reveal the finished output side by side with the opening frame. |
| 0:38-0:42 | Full build linked | Loop back to the opening frame so the replay is seamless. |

### short-2: The one mistake (40s, ends on cta)

- **Source beat:** The failure mode is starting from a blank prompt each time, which produces a different shape of output every run.
- **Hook (first 2s):** Most solo founders and automation builders get OpenClaw specialist agents wrong at exactly one step.
- **Framing:** Screen recordings zoomed to 150% so text is legible vertically; subject reaction inset top-right.

| Time | On-screen text | Action |
| --- | --- | --- |
| 0:00-0:02 | One step ruins it | Open on the failure state, mid-frame, already happening. |
| 0:02-0:14 | The wrong way | Show the common approach at speed, without mocking it. |
| 0:14-0:30 | The fix | Show the corrected step in real time so the difference is visible, not asserted. |
| 0:30-0:40 | Why it works | One sentence of reasoning — the mechanism, not the slogan. |

### short-3: The checklist (44s, ends on cta)

- **Source beat:** The fix is a checked-in playbook file that the agent parses at runtime, so the standard and the output cannot drift apart.
- **Hook (first 2s):** Four checks before you call OpenClaw specialist agents done.
- **Framing:** Static vertical frame, subject centred, text stacked at eye level so the count is always visible.

| Time | On-screen text | Action |
| --- | --- | --- |
| 0:00-0:02 | Four checks | Number on screen immediately; promise the count and keep it. |
| 0:02-0:12 | Check one | State it, show it, move on. No elaboration. |
| 0:12-0:22 | Check two | Same rhythm. The cadence is the retention device. |
| 0:22-0:32 | Check three | Same rhythm, slightly faster cut. |
| 0:32-0:44 | Check four | Land the last one and stop — no outro. |

## 7. Longform chapter outline

Target runtime: 9 minutes.

| Timestamp | Chapter | Promise |
| --- | --- | --- |
| 0:00 | Cold open: the result | Show the finished outcome in the first 30 seconds so the viewer knows what they are staying for. |
| 0:43 | Why this is hard | Name the real obstacle honestly, including the part most videos skip. |
| 2:22 | Build it: first pass | Walk the happy path end to end without cutting away from the mistakes. |
| 4:02 | Where it breaks | Show the failure the viewer will actually hit, and the fix. |
| 5:41 | What I would change | Give the honest limitations before the viewer finds them. |
| 7:21 | Recap and next step | Restate the through-line in three sentences and make the single ask. |

## 8. Review checklist

Source: `YOUTUBE_PACKAGING.md` @ a171f980ebde

**Titles**

- [ ] 8–12 options present, spread across 4+ distinct angles
- [ ] Recommended title is ≤ 60 characters
- [ ] Recommended title front-loads the specific noun, not a filler phrase
- [ ] No promise in the title that the source notes cannot support
- [ ] Rationale names the angle and what it avoids

**Thumbnail**

- [ ] Exactly 3 concepts, each a genuinely different bet
- [ ] Every concept has layout, subject, text, emotion, contrast, mobile note
- [ ] Thumbnail text is ≤ 4 words and does not repeat the title
- [ ] Squint test passes at 168x94 px
- [ ] Title and thumbnail together say more than either one alone

**Description**

- [ ] First 150 characters stand alone as a search snippet
- [ ] Hook does not restate the title verbatim
- [ ] Exactly one CTA
- [ ] Links are placeholders only — no invented URLs
- [ ] 3–5 lowercase hashtags

**Pinned comment**

- [ ] Asks one answerable question
- [ ] Carries at most one link placeholder

**Shorts**

- [ ] 3 cutdowns, each ≤ 45 seconds
- [ ] Hook lands inside the first 2 seconds
- [ ] Each cutdown works without the longform
- [ ] On-screen text lines are ≤ 6 words
- [ ] Vertical safe-area framing noted

**Longform**

- [ ] Chapters cover the full target runtime
- [ ] First chapter is 0:00 and is a cold open
- [ ] Chapter titles are ≤ 40 characters
- [ ] Final chapter recaps and carries the CTA

**Handoff**

- [ ] Format, audience, and tone match the request
- [ ] `handoffId` echoed when one was supplied
- [ ] No credentials, tokens, upload actions, or schedule changes in the package
- [ ] Package is complete: all 8 sections present, N/A sections marked explicitly
