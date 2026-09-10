# OpenClaw Agents Office

A multi-page web app that acts as the command center for OpenClaw agents, tasks, routes, rollups, memory, planning, and the org chart of Jason's AI team.

## Ownership and command model

**Penny (`oss`) is the sole OpenClaw orchestrator and the owner of Agent Office operations.** Jason gives goals to Penny; Penny selects and dispatches the appropriate specialists, monitors execution, manages approvals and failures, and returns one coherent result. Specialists execute their own domain work and report status/results back to Penny. They do not command one another, change cron schedules, or bypass approval boundaries.

The 3D office is intended to be an operational view of that system, not a decorative simulation. Agent state, workflow stages, blocked items, Mission Control, project assignment, and the activity feed should reflect real OpenClaw data whenever the gateway exposes it. A visual element must be labelled as configured or unavailable when live data/control is not available; the UI must not invent execution, cost, or completion events.

## Features

- **Dropbox / Mission Board** — capture notes, ideas, reminders, and tasks with subject, status, priority, and tags. Tap any note to open it in a full-screen reading view. Every drop is saved under a title no other drop is using — a second "Weekly review notes" is stored as "Weekly review notes (2)" — so no two rows in the list are indistinguishable.
- **Reminders** — its own two-field panel on the Dropbox page (what to be reminded about, and when) for things you are putting down for later rather than tasks you are working, reached from the **Reminders** item under Planning Tools in the side menu. It comes back when it is due.
- **Phone inbox** — a token-authenticated API for iOS Shortcuts: send a note or reminder to the Dropbox from your phone, and pull back whatever has come due. See [Phone inbox](#phone-inbox--ios-shortcuts).
- **Memory** — per-agent memory entries that agents can reference across sessions.
- **Calendar** — a Google Calendar-backed control surface for the office: agent/project metadata on every block, live run status, an Agent Assistant drawer, agent-timeline filters, and a scored scheduling policy instead of first-available-slot. It opens in **Focus Mode** — the chrome steps aside so the grid gets the whole viewport, and the sidebar is one tap away in the focus rail. See [Focus Mode](#focus-mode).
- **Planning Mode** — the weekly planning checklist you keep by hand, and the list CoachClaw reads before it builds the week. Ticking an item asks CoachClaw to find time for it; it does not mean the item is done, which is a separate state. Unticked items stay on the list and out of the week. See [Planning Mode](#planning-mode).
- **Countdowns** — everything with a clock on it in one page: deadlines, goals, work shifts, weekly routines and trading dates, grouped into Today / This Week / Later alongside what is next on the Google Calendar. Every card carries the time left, the category and the next action. See [Countdowns](#countdowns-1).
- **Streaks** — every day you kept a habit up, plotted on a month grid and a year strip. Each streak carries a type (Health, Deep Work, Avoid, …) and a colour, the calendar can be filtered down to one streak or one type, and a day is marked from the day itself or from the streak's **Mark today** button. See [Streaks](#streaks-1).
- **Visitors** — who is on your websites right now, what they are reading, and whether they have been before. One tracker script goes on any site you run; nothing is looked up against any outside service. See [Visitors](#visitors-1).
- **Org chart** — a visual layout of the agent team.
- **Office view** — a live operational room where clicking an agent opens its task, model, workspace, authority, state, and available controls. Penny opens Mission Control; appearance editing remains available from the inspector.
- **Penny execution bridge** — Mission Control goals are claimed by the authenticated desktop relay, run in a dedicated Penny session through the local OpenClaw gateway, delivered to Jason in Telegram, and written back to the Agent Office Outbox. Stale claims recover after 20 minutes; cron is not required for normal execution.
- **Build safeguards** — code, configuration, infrastructure, scheduled-task, and deployment goals pause after read-only inspection. Penny sends the exact proposed scope to Jason and the Outbox shows **Approve build**. Only that authenticated approval requeues the same Penny session. Approved work must fetch current GitHub `main`/`master`, verify repo/remote/branch/dirty state, preserve unrelated work in a clean branch or worktree, test, commit, and push the tested source. Deployment remains separately approval-gated unless it was explicitly included.
- **AI Landscape** — a tracker page for the AI model/tooling landscape.
- **Project Rooms** — per-project overview with linked tasks, repo/deploy links, and next actions.
- **Agent Registry** — a directory of configured agents.
- **Resets** — countdown cards for tracked reset times.
- **Settings** — app-level configuration.
- **YouTube packaging** — one command that turns a video idea, or a Studio Director handoff packet, into a complete YouTube package: titles, thumbnail concepts, description, pinned comment, Shorts cutdowns, longform chapters, and a review checklist. Deterministic and offline. This is the workflow the YouTube Claw agent runs. See [YouTube packaging](#youtube-packaging-youtube-claw).

## Tech stack

- Multi-page HTML/JS/CSS frontend: every nav item is its own static HTML page sharing one CSS file and one JS bundle (no framework, no build step)
- A design system in `shared.css`: colour, spacing, radius, type and state tokens, plus `.ao-*` component classes (page, card, button, chip, badge, dot, field, well, modal) that the pages compose instead of writing inline styles
- Plain Node.js HTTP server (no Express)
- Postgres for persistence (via `pg`)
- Deployed on Railway

## Project structure

```
agent-office-deploy/
  dist/
    index.html                # Office view, served at "/"
    org-chart.html            # Org Chart page
    memory.html                # Memory page
    planning.html              # Planning Mode page
    calendar.html              # Calendar page
    resets.html                # Resets page
    ai-landscape.html          # AI Landscape page
    streaks.html               # Streaks page
    countdowns.html            # Countdowns page
    mission-board.html         # Mission Board (Dropbox) page
    project-rooms.html         # Project Rooms page
    agent-registry.html        # Agent Registry page
    visitors.html              # Visitors page
    settings.html               # Settings page
    shared.css                 # Design system + shared chrome/nav/view styles for all pages above
    app-shared.js              # Shared JS: agent/office data, office canvas+SVG rendering,
                                #   view-switching, nav helpers, Dropbox/Memory/Settings/Resets logic
    workspace-systems.css      # Extra styles for Mission Board / Project Rooms / Agent Registry
    mission-board.js           # Mission Board-only logic
    streaks.{js,css}           # Streaks-only logic and styles
    countdowns.js              # Countdown arithmetic shared by the API and the roll-up (server-side)
    countdowns-page.js         # Countdowns page-only logic
    countdowns.css             # Countdowns-only styles
    project-rooms.js           # Project Rooms-only logic
    agent-registry.js          # Agent Registry-only logic
    calendar-view.{js,css}     # Calendar-only logic
    calendar-view-base.js      # Calendar renderer (states, lanes, agent badges)
    calendar-agent-assistant.js # Agent Assistant drawer
    calendar-agent-meta.js     # Agent Office event metadata + run lifecycle
    calendar-scheduling.js     # Scheduling preferences, slot scoring, NL parsing
    planning.js                # Planning Mode records and the CoachClaw brief (server-side)
    planning-page.js           # Planning Mode page-only logic
    planning.css               # Planning Mode-only styles
    calendar-google-sync.js    # Incremental Google sync (sync tokens, paging, 410 recovery)
    reminder-time.js           # Parses "tomorrow 9am" / "in 2h" into reminder timestamps
    ai-landscape.{js,css}      # AI Landscape-only logic
    visitors.{js,css}          # Visitors dashboard
    visit-tracker.js           # The script you paste on a tracked site
    sharebot-newsroom.js       # Reads Market Dashboard newsroom health server-side
    office-control-center.js   # Agent inspector + Mission Control panel (incl. ShareBot67 health)
    server.js                  # Node HTTP server
    config-files/              # Placeholder only; local agent files are not deployed
YOUTUBE_PACKAGING.md          # The YouTube packaging playbook (read at runtime)
SMOKE_TEST.md                 # How to smoke-test packaging
scripts/
  package-youtube.mjs         # The packaging command (plain ESM, no dependencies)
  lib/                        # packaging.mjs, playbook.mjs, render.mjs, text.mjs
fixtures/
  youtube-packaging/          # Sample input + committed output (markdown and JSON)
railway.json                  # Railway deployment config
package.json                  # Node dependencies + start script
```

Each page pulls in `shared.css` + `app-shared.js` plus only the extra CSS/JS it needs. Navigating between pages is a real browser navigation (plain `<a href>` links), not client-side view-switching — `switchView()` in `app-shared.js` still does the in-page activation/render work for whichever single view that page contains.

The topbar and sidebar are the same on every page, so they are generated into
each one from `scripts/shell/` rather than maintained by hand:

```bash
npm run sync:shell         # write the shell into every page
npm run sync:shell:check   # fail if any page has drifted
```

Edit `scripts/shell/shell.html` (topbar + sidebar), `scripts/shell/boot.html`
(the pre-paint theme and sidebar-state restore) or
`scripts/shell/stylesheet.html` (the `shared.css` build every page loads), then
re-run it — never the copies inside the pages. Which sidebar row is highlighted
is worked out from the URL by `markActiveNav()`, so no page marks its own.

> **Note:** `agent-office-deploy/dist/` is the canonical frontend served by the application.

## Running locally

```bash
npm install
PORT=3000 npm start
```

Then open <http://localhost:3000>.

## Tests

```bash
npm test
```

`tests/` covers the Google OAuth flow and passphrase gating, the canonical sync
status and calendar states, event metadata round-trips (including through
Google's extended properties), the agent run lifecycle, the scheduling policy
and slot scoring, natural-language plan preview/commit, the incremental
Google sync state machine, reminder-time parsing, the streaks API (the
passphrase gate, how a run is built and broken, repeated marks, day ranges,
rejected dates, and deleting a streak with its days), the countdowns API and
its arithmetic (which occurrence is next, the Today/This Week/Later split,
weekend-skipping for trading and weekday routines, and what the evening
roll-up is allowed to nag about), and the phone inbox
(token auth and throttling, the JSON/form/plain-text/query ways of sending a
drop, the due scopes, done/snooze, and that a reminder set on the phone shows
up in the web Dropbox).

`tests/shell-consistency.test.js` covers the shared app shell: that every page
carries the topbar and sidebar exactly as `scripts/shell/` defines them, that
they all load the same build of `shared.css`, that no page hardcodes its own
active nav row (`markActiveNav()` in `app-shared.js` works that out from the
URL), and that every sidebar row has the `data-icon` the compact rail needs.
Run `npm run sync:shell` when it fails.

`tests/sharebot-newsroom.test.js` covers the ShareBot67 newsroom adapter against
a fake Market Dashboard: that a configured upstream normalizes, that the
dashboard key goes up and never comes back down — including from an upstream
that echoes it in its own error body — that each way the read can fail gets its
own state instead of a hopeful blank, that a redirect is never followed, that no
request parameter can choose the upstream, and that the Office session still
guards it. `tests/sharebot-newsroom-ui.test.js` runs the panel in Chromium
across healthy, running, degraded, failed and unavailable states, checks the
latest error appears, that no report content or credential is on screen, that
the only control is a re-read, and that it fits a 375px phone with nothing
scrolling sideways.

`tests/youtube-packaging.test.js` covers the packaging command: that the
committed fixtures still match freshly generated output, that `--check` reports
drift instead of quietly rewriting the fixture, and that the playbook really is
a runtime dependency — a missing `YOUTUBE_PACKAGING.md`, or one with no review
checklist in it, fails the run instead of emitting an unreviewed package.

`calendar-google-sync.js` takes its HTTP call as an injected function, so
`tests/calendar-google-sync.test.js` drives the whole state machine against a
scripted fake Google: token reuse, delta merges, cancellations, pagination, an
expired (410) token forcing a full resync, and a transient 5xx leaving a good
token alone.

### UI smoke tests

Every test above talks to the server over HTTP. `tests/ui-smoke.test.js` is the
only one that runs the pages, in a real Chromium, against a real server: it
opens every page in `dist/` and fails on an uncaught exception or on any asset
the page asked this server for and did not get, then walks the Dropbox — folder
wall, opening a folder, search across folders, pinning, the list layout, saving
a note, opening one, and the Reminders lane. On its first run it found a page
that could never be unlocked — `memory.html` raised the passphrase gate without
shipping the modal that asks for it, so the gate threw on a null. The
consolidated Office login has since replaced that gate everywhere; the test
that walks a login on a page which is not the Dropbox is what stays behind.

They need a browser:

```bash
npx playwright-core install chromium   # once
npm test
```

Without one they skip, so a checkout with no browser still gets a green suite —
except under `CI=true`, where a missing browser means the install step regressed
and the tests would otherwise vanish silently, so it fails instead. If your
Chromium came from somewhere else — a distro package, a sandbox image — point
`SMOKE_CHROMIUM_PATH` at it.

Outbound requests are blocked during the run, so the suite is hermetic and
offline-safe. That is worth knowing for another reason: `shared.css` opens with
an `@import` of Google Fonts, which sits on the render path of every page. With
the CDN unreachable, `DOMContentLoaded` measured 12.8s per page.

## API

All endpoints return JSON.

| Method | Path                              | Purpose                          |
| ------ | --------------------------------- | -------------------------------- |
| GET    | `/api/session`                    | Get the current session          |
| POST   | `/api/session`                    | Start a session                  |
| DELETE | `/api/session`                    | End the session                  |
| GET    | `/api/drops`                      | List notes                       |
| POST   | `/api/drops`                      | Create a note                    |
| PATCH  | `/api/drops/:id`                  | Update a note                    |
| DELETE | `/api/drops/:id`                  | Delete a note                    |
| GET    | `/api/shortcuts/setup`            | Phone inbox setup state (session-authed) |
| POST   | `/api/shortcuts/drops`            | Send a note/reminder from the phone |
| GET    | `/api/shortcuts/drops`            | Pull drops, by default the due reminders |
| POST   | `/api/shortcuts/drops/:id/done`   | Mark a pulled item done          |
| POST   | `/api/shortcuts/drops/:id/snooze` | Push a reminder out              |
| GET    | `/api/shortcuts/status`           | Due/upcoming counts and the next reminder |
| GET    | `/api/shortcuts/countdowns`       | The top countdowns as text, for the evening roll-up |
| GET    | `/api/shortcuts/reset-timers`     | The Countdown Timers on `/resets.html`, as text or JSON |
| GET    | `/api/reset-timers`               | The stored Countdown Timers (session-authed) |
| PUT    | `/api/reset-timers`               | Replace the stored Countdown Timers (session-authed) |
| GET    | `/api/planning`                   | The planning checklist and its counts (session-authed) |
| POST   | `/api/planning`                   | Add a planning item (session-authed) |
| PATCH  | `/api/planning/:id`               | Edit, tick, untick or complete a planning item (session-authed) |
| DELETE | `/api/planning/:id`               | Delete a planning item (session-authed) |
| GET    | `/api/planning/brief`             | The ticked items, shaped for the scheduler (session-authed) |
| GET    | `/api/memories`                   | List memory entries              |
| POST   | `/api/memories`                   | Create a memory entry            |
| PATCH  | `/api/memories/:id`               | Update a memory entry            |
| DELETE | `/api/memories/:id`               | Delete a memory entry            |
| GET    | `/api/streaks`                    | Streaks with their counts, plus the marked days |
| POST   | `/api/streaks`                    | Create a streak                  |
| PATCH  | `/api/streaks/:id`                | Rename, retype, recolour or archive a streak |
| DELETE | `/api/streaks/:id`                | Delete a streak and its days     |
| PUT    | `/api/streaks/:id/days/:day`      | Mark a day as kept               |
| DELETE | `/api/streaks/:id/days/:day`      | Clear a marked day               |
| GET    | `/api/countdowns`                 | Countdowns and upcoming events, grouped Today / This Week / Later |
| POST   | `/api/countdowns`                 | Create a countdown               |
| PATCH  | `/api/countdowns/:id`             | Edit, pin or archive a countdown |
| DELETE | `/api/countdowns/:id`             | Delete a countdown               |
| GET    | `/api/countdowns/rollup`          | The top countdowns only, as JSON or `?format=text` |
| GET    | `/api/happy-hour`                 | Today's Happy Hour deal, phase and countdown (open) |
| POST   | `/api/visits/track`               | Record a page view or a still-here ping (public) |
| GET    | `/api/visits/summary`             | Live visitors, totals, top pages and referrers |
| DELETE | `/api/visits`                     | Delete every recorded page view  |
| GET    | `/api/calendar/status`            | Check Google Calendar connection (public: lock state only) |
| GET    | `/api/calendar/oauth/start`        | Start Google OAuth authorization (session-authenticated) |
| GET    | `/api/calendar/oauth/callback`     | Complete Google OAuth (public: Google redirects here) |
| DELETE | `/api/calendar/oauth/connection`   | Disconnect the stored account (session-authenticated) |
| GET    | `/api/calendar/events`            | List calendar events (session-authenticated) |
| POST   | `/api/calendar/events`            | Create an event (session-authenticated) |
| PATCH  | `/api/calendar/events/:id`        | Update an event (session-authenticated) |
| DELETE | `/api/calendar/events/:id`        | Delete an event (session-authenticated) |
| POST   | `/api/calendar/events/:id/run`    | Drive a block's agent run (session-authenticated) |
| GET    | `/api/calendar/agent-timeline`    | Agent work grouped by agent (session-authenticated) |
| GET    | `/api/calendar/preferences`       | Read scheduling preferences (session-authenticated) |
| PUT    | `/api/calendar/preferences`       | Update scheduling preferences (session-authenticated) |
| POST   | `/api/calendar/schedule/suggest`  | Scored candidate slots (session-authenticated) |
| POST   | `/api/calendar/schedule/plan`     | Preview a natural-language plan (session-authenticated) |
| POST   | `/api/calendar/schedule/commit`   | Create the previewed blocks (session-authenticated) |
| POST   | `/api/calendar/quick-add`         | Natural-language event entry (session-authenticated) |
| GET    | `/api/config-files/:agent`        | Read snapshots only from a private runtime CONFIG_FILES_DIR (session-authenticated) |
| GET    | `/api/orchestration/goals`        | List Penny goals and Outbox results (session-authenticated) |
| POST   | `/api/orchestration/goals`        | Queue a goal for Penny (session-authenticated) |
| GET    | `/api/sharebot/newsroom-health`   | ShareBot67's live newsroom health, read server-side from Market Dashboard (session-authed) |
| POST   | `/api/orchestration/goals/claim`  | Atomically claim the next goal (gateway-token authenticated) |
| PATCH  | `/api/orchestration/goals/:id`    | Complete/fail a claimed goal (gateway-token authenticated) |

### The calendar as an agent control surface

The calendar is not only a view of Google Calendar; every block can carry Agent
Office metadata, launch work, report live status, and keep its result.

**Sync status.** `/api/calendar/status` returns one canonical object —
`configured`, `connected`, `accountEmail`, `lastSyncedAt`, `syncState`, `error`
(the older `googleConfigured` / `tokenValid` keys are still returned for
compatibility). `syncState` is one of `unconfigured`, `disconnected`,
`auth-error`, `healthy`. `/api/calendar/events` adds an explicit
`calendarState`: `disconnected`, `local-only`, `connected-empty`,
`connected-with-events` or `sync-error`, so a connected but empty calendar can
never be confused with a broken sync. No demo events are ever seeded.

**Event metadata** (`agent-office-deploy/dist/calendar-agent-meta.js`). Events
accept a `meta` object with `agentId`, `projectId`, `taskId`, `eventKind`,
`priority`, `executionMode`, `movable`, `estimatedDuration`, `prepMinutes`,
`followUpMinutes`, `requiredInputs`, `expectedOutput`, `runStatus` and
`resultUrl`. It is written to Google `extendedProperties.private` (prefixed
`ao*`) and mirrored into a local mapping table keyed by event id; the local
table is authoritative, so a failed Google write cannot lose a run's status.

**Run lifecycle.** `POST /api/calendar/events/:id/run` takes an `action` of
`schedule`, `start`, `progress`, `needs_input`, `complete`, `fail` or `reset`.
Each transition updates the block *and* the agent record (status, current task
and project, heartbeat), enforces the concurrent-run cap, and writes a summary
into agent memory when a run finishes.

**Scheduling policy** (`agent-office-deploy/dist/calendar-scheduling.js`).
Working hours, sleep, commitments, lunch, meeting buffers, minimum focus
length, deep-work windows and the maximum number of concurrent agent runs are
configurable. Candidate slots are scored rather than taken first-fit:

```
slotScore = urgency + preferredTime + projectPriority + dependencyReadiness
          - interruptionCost - contextSwitchCost - conflictRisk
```

Every suggestion returns its own score breakdown, its reasons, and any
warnings.

**Agent Assistant.** One floating button opens a bottom sheet on mobile and a
right-hand drawer on desktop, with "What should I do next?", "Schedule my
highest-priority task", "Protect two hours for Agent Office", "Prepare me for
my next meeting" and "Show conflicts and overdue work", plus a
natural-language field that previews a plan before anything is created.

## Countdowns

**Countdowns** in the side menu is the "how long have I got" page. A calendar
event answers *what is happening at 2pm*; a streak answers *did I keep it up
today*; a countdown answers *how long until the thing, and what do I do next
about it*. That last question is why every card carries a **next action** and
why nothing here has an end time.

**A countdown** is a title, a date and time, a **category**, a **repeat rule**,
a next action and an optional note. The categories are Deadline, Goal, Work
Shift, Routine, Trading and Personal, each with its own colour. The repeat rules
are One-off, Daily, Weekdays, Weekly, Every 2 weeks and Monthly — so a weekly
routine like the Instagram download review is entered once and rolls itself
forward, a biweekly routine rolls every 14 days, and a monthly one on the 31st
clamps to the last day of a short month rather than skidding into the next.

**Today / This Week / Later.** Every card lands in one of three sections. Today
is anything due before midnight; This Week is the next seven days, counted from
today rather than to Sunday, so "this week" on a Friday still means a week.
Overdue work is not a fourth section — it sits at the top of Today, in red,
where it cannot be scrolled past. A one-off that has passed stays overdue until
it is dealt with; only a repeating countdown rolls itself forward.

**The calendar half.** When Google Calendar is connected, upcoming events are
drawn as cards in the same three sections, so a work shift on the calendar and a
deadline you typed in are read together. Events are marked with a dashed edge
and link out to the Calendar rather than being editable here, because the
calendar owns them. An event that has started but not finished reads as
*happening now*, not as late. If Google is not connected, or the sync fails,
the page says so and still shows your own countdowns.

**Weekends and trading.** Trading countdowns never land on a Saturday or a
Sunday — a repeating one skips a closed market and moves to Monday. On the
weekend itself, and for any trading card pointing at one, the card goes quiet:
dimmed, never marked urgent, and left out of the roll-up. It stays on the page,
because knowing it is there is not the same as being pushed to act on it. The
Weekdays repeat rule does the same for Mon–Fri routines.

**The evening roll-up.** `GET /api/countdowns/rollup?format=text` returns the
top cards as plain text, and `/api/shortcuts/countdowns` serves the same thing
behind the phone-inbox token, so an evening Shortcut can paste them straight
into a note:

```
Countdowns — Sat, Aug 8
• Ship the countdowns page (overdue 11 hrs 20 mins ago) → Deploy from the pushed branch
• Instagram download review (20 hrs 39 mins — Sun, Aug 9 8:00 PM) → Clear the downloads folder
• Quarterly tax filing (3 days 17 hrs — Wed, Aug 12 5:00 PM) → Gather receipts
```

The roll-up takes what is due today or this week (plus anything pinned), and
skips the quiet trading cards. `?limit=` sets how many, up to 20.

**Where the numbers come from.** All of it — which occurrence is next, the time
left, the section, whether a card is urgent — is worked out on the server in
`countdowns.js`, so a phone and a browser agree. The page re-counts only the
"time left" label between refreshes so the clock keeps moving.

**Access.** Reading is open, like the calendar the page shows alongside the
cards. Adding, editing and deleting sit behind the same `DROPS_PASSPHRASE` as
the Dropbox and share its session cookie.

### Countdown Timers and Pushcut

`/resets.html` is the other half of the page: personal reset timers — usage
windows, backups, a haircut — each with an optional Pushcut webhook that fires
when it lands. They are separate records from the countdowns above and follow a
separate workflow; the two share the screen and nothing else.

```
resets.html  →  /api/reset-timers  →  ┬─ /api/shortcuts/reset-timers  →  iPhone Shortcut
                (persistent store)    └─ server-side timer processor   →  Pushcut  →  iPhone
```

#### Happy Hour

One card on `/resets.html` is not a timer you set: the Happy Hour countdown
knows the week's deals and rewrites itself as the day moves through the window.

```
2:30 PM  heads-up     3:00 PM  opens     6:00 PM  closes     after 6  tomorrow's deal
   upcoming    →    starting    →      open      →                tomorrow
```

That schedule lives in `happy-hour.js`, which is loaded two ways on purpose:
`resets.html` pulls it in with a `<script>` tag ahead of `resets.js`, and
`server.js` `require()`s it. It used to live inside `resets.js`, where only the
page could reach it — but Main Hub's Daily Dashboard shows the same meal and the
same countdown, and a second copy of the deal table in another repository would
be wrong the first week a deal changed.

`GET /api/happy-hour` serves it:

```json
{
  "now": "2026-09-10T01:05:39.913Z",
  "timezone": "America/Vancouver",
  "phase": "tomorrow",
  "meal": "Fresh Appetizers",
  "deal": "50% off Fresh Appetizers",
  "dayName": "Thursday",
  "targetAt": "2026-09-10T21:30:00.000Z",
  "remainingMs": 73460087
}
```

The route is open, like `/api/countdowns` — this is a grocery flyer, not a
personal record. It reads nothing from the reset-timer store, which stays behind
the passphrase.

**The Pushcut list is what the page opens on.** Every countdown carries a
**Pushcut** tick box, and the **Show** dropdown opens on **Pushcut**: the cards
you keep on the phone are the list, and everything else — reference dates,
holidays, the subscription rows — is one switch to **All timers** away. The tick
is a label on the card and nothing more. It does not decide whether a
notification is sent: that is still the webhook URL and the server's processor,
so a ticked card with no webhook is quiet, and an unticked card with one still
fires. A timer stored before the box existed opens ticked when it has a webhook,
because that is what it already was.

**The notification is the server's job.** It used to be the browser's: the page
fired the webhook itself, which meant nothing arrived unless the page happened
to be open, and `no-cors` meant even then nothing could tell whether Pushcut had
taken it. The server now walks the stored timers every 45 seconds
(`RESET_TIMER_INTERVAL_MS`) and sends what has landed, over an ordinary HTTPS
request whose status code it can read. The page is a client of that service —
it draws the list and keeps the **Test webhook** button, which is still a
browser-side one-off.

**A notification is sent once.** "Sent" is recorded against the reset time it
was sent for (`firedForResetAt`), not as a boolean, so a Railway restart
re-reads the same record and stays quiet. Nothing is marked delivered until
Pushcut answers 2xx: a failure leaves the occurrence armed, records what went
wrong, and is retried on a backoff that starts at five minutes and doubles up
to two hours. A repeating timer advances to its next occurrence only after a
successful send, and is re-armed for it; a one-off stays expired with the send
on its record.

**The webhook URL is a credential.** Its query string is the Pushcut secret, so
it is never in a Shortcuts response, never in a log line — failures are logged
by timer name and webhook host — and never in a stored error message. It lives
in the timer record behind the passphrase, which is where the page needs it.

**Delivery goes to Pushcut and nowhere else.** The webhook URL also decides
where the server makes an outbound request to, so it is checked against an
allowlist of one host — `https://api.pushcut.io` — before a socket is opened.
Anything else (loopback, a private address, a `*.railway.internal` service,
another site, plain `http://`, a non-HTTP scheme) fails with
`Webhook destination is not allowed.` without a request being made: the
occurrence stays armed, the card keeps its URL, and the message names no
destination. The page applies the same rule while the URL is still on screen,
so a webhook the server would refuse cannot be saved. Tests run their own
stand-in server on loopback and have to ask for it —
`RESET_TIMER_ALLOW_LOOPBACK_WEBHOOKS` must carry the acknowledgement verbatim,
it widens delivery to loopback and nothing more, and any deployed host ignores
it and logs that it did.

**Two devices, one list.** Timers carry an `updatedAt`, and the page merges by
id, newest version per record, rather than taking the server's array wholesale.
Both sides keep timers only they have seen, and a deletion is a tombstone that
travels with the record instead of an absence the other side would undo.

## Focus Mode

**Focus Mode** is one behaviour shared by every page: the topbar, the sidebar,
the activity panel and the status bar step aside, the page takes the whole
viewport, and a small **focus rail** appears in the top-left corner with two
controls — ☰ opens the sidebar, ⛶ leaves focus. It is the `ao-focus` class on
`<html>`; `shared.css` owns what it looks like and `app-shared.js` owns when it
is on.

**The sidebar is not gone in focus, it is a drawer.** The ☰ on the rail opens
the same drawer the phone hamburger opens — same markup, same scrim, same
handlers — so there is one navigation system in the app rather than a second
one for focused pages. Tapping a row navigates, tapping the scrim or pressing
Escape closes it.

**Which pages open in focus** is a per-page default plus whatever you last
chose on that page. A page declares its default with `data-focus-default="on"`
on its `<html>` tag; the Calendar is the page that does, because a week grid is
worth every pixel of width it can get. Leaving focus on the Calendar is
remembered for the Calendar and changes nothing anywhere else, and the same the
other way round — the key is `ao-focus:<pathname>` in `localStorage`. The
pre-paint boot script in every page's `<head>` reads both before first paint, so
a focused page never flashes its chrome on the way in.

**On a phone** the sidebar is already a drawer and the topbar is the only chrome
there is, so focus is the difference between a calendar with a title bar over it
and a calendar with the screen. The rail is how you get the menu back either
way.

This replaced the Calendar's own arrangement, which hid the topbar and sidebar
with a stylesheet of its own and had no way of showing them again — that page
was the only one in the app you could not navigate away from without the
browser's Back button.

## Planning Mode

**Planning Mode** is the weekly planning checklist: the list of things you want
to get done in the coming week, kept by hand, and the list CoachClaw reads
before it builds a schedule. It is not the Calendar and it is not a to-do list.

**A tick is a request, not a result.** Ticking an item asks CoachClaw to find
time for it this week. **Done** is a separate control and a separate field:
ticking *Workout* on a Sunday for a session you intend to do on Wednesday must
not tell the app you have already worked out. The two states are stored
separately (`schedule_this_week` and `completed`), and nothing in the app reads
one for the other. Completing an item does clear its scheduling request — the
request has been satisfied — and un-completing it does not put it back; that is
a deliberate tick.

**Unticked items are kept.** An item you do not want in this week stays on the
list under *Kept for later*, out of the schedule and out of the way, until a
week you do want it in. Deleting is the only thing that removes an item.

**What an item can carry.** Adding one takes a title and nothing else, which is
what makes the list usable on a Sunday night. **Edit** opens the rest: how long
it takes, a priority, preferred days, a preferred time (a clock time, or
Morning / Afternoon / Evening) and notes. Everything but the title is optional —
an item with no duration is scheduled as an hour, and the brief says so rather
than pretending it was told.

**The handoff.** `GET /api/planning/brief` is what CoachClaw reads: the ticked,
unfinished items, each with a `request` that
`calendar-scheduling.js`'s `suggestSlots()` takes as-is, plus the preferred days
and the preferred window resolved to clock times. Unticked and completed items
are not in it. The page shows the same brief under *What CoachClaw reads*, so
what the scheduler will be given is visible before it is given.

**Where this sits in the weekly build.** The page lists the whole flow, of which
steps 2 and 6's inputs are what Planning Mode owns:

1. Work schedule — the days and hours you are at work.
2. This checklist — every ticked item, with its duration, priority and
   preferred times.
3. Existing commitments — calendar events, scheduled tasks, anything fixed.
4. Free time — realistic windows around all of that, not every empty minute.
5. The week — ticked items placed into those windows.
6. Your review — accept it, move something, or send an item back to this list.

Steps 3 to 5 are `calendar-scheduling.js`, which already models working hours,
sleep, lunch, meeting buffers, recovery time and deep-work windows, and scores
candidate slots rather than taking the first that fits. Step 1 (reading a photo
of a work schedule) and step 6 (the proposal-and-review screen) are not built
yet; the checklist and the brief are the bridge they will plug into.

## Streaks

**Streaks** in the side menu is a calendar that only answers one question:
which days did I keep this up? It is deliberately not the Calendar — nothing
on it is scheduled, nothing has a start or end time, and no agent is attached.
A day is either kept or it is not, and the month grid exists so that a run of
kept days reads as a run.

**A streak** is one thing you are keeping up: a name, a **type**, a colour and
an optional note about what counts. The types are Habit, Health, Deep Work,
Learning, Creative, Money, Avoid (for the ones you are breaking) and Other,
each with its own colour, and **Custom** takes any label you like. A streak can
be archived when you are done with it, which hides it without losing its
history, and deleting one takes its days with it.

**Marking a day.** *Mark today* on a streak's card is the daily button. Tapping
any day on the grid opens that day and lists every streak in view with a check
you can toggle, so a day missed on the phone can be filled in later, with a
note if you want one. Days ahead of today cannot be marked.

**Filtering.** The two dropdowns above the calendar narrow it to one streak or
to one type. With several streaks in view each day carries a coloured dot per
streak kept; with exactly one in view the whole cell takes that streak's colour,
so the run shows as a band. Underneath, a year strip plots the same days a week
per column.

**The counts.** Current run, longest ever, total days and last day are worked
out on the server, so `/api/streaks` gives a phone the same numbers the page
shows. A run is allowed to end on yesterday as well as today: a day you have not
finished is not a day you have missed, so a streak only breaks once a full day
has gone by unmarked.

Streaks sit behind the same `DROPS_PASSPHRASE` as the Dropbox and share its
session cookie, so unlocking either one unlocks the other.

## Visitors

**Visitors** in the side menu answers the question a shop dashboard's live view
answers: is anyone on the site right now, what are they reading, and have they
been before. It works across every site you point at it, not just this one.

**How a visit is counted.** `visit-tracker.js` is a small script you paste on a
site. On each page load it posts one row — the page, its title, the page that
linked there, the screen size — to `POST /api/visits/track`, and then pings
every 30 seconds while the tab is visible so the live list can let someone drop
off when they leave. The endpoint is open by necessity (the browsers reporting
in are strangers), returns nothing at all, and is capped per address.

**What identifies a visitor.** A random id the browser generates about itself
and keeps in that site's own `localStorage`, plus a per-tab session id in
`sessionStorage`. That is the whole mechanism. The id is meaningless outside
the `visits` table, is never matched against anything, and is what makes
*first time* and *been before* possible. A browser with storage switched off,
or with Do Not Track set, is simply not tracked.

**What it deliberately does not do.** No geolocation, no reverse DNS, no
IP-to-company lookup, no third-party requests, no fingerprinting. An IP address
is stored on the row so odd traffic can be told apart from real traffic, and
nothing consults it. Nothing here can put a name to a visitor, and that is the
intended ceiling — not a limitation to be lifted later.

**Adding a site.** The *Track another site* panel gives you the exact snippet
with this deployment's host filled in:

```html
<script src="https://your-agent-office-host/visit-tracker.js" defer></script>
```

Paste it before `</body>`. The site appears in the filter on its first visitor;
no configuration or registration step. Single-page sites are handled — a
`pushState` that changes the URL counts as the next page view.

**Retention.** Page views are kept for 90 days and then deleted on an hourly
sweep. Set `VISITS_RETENTION_DAYS` to change that. *Delete all visits* on the
page clears everything immediately.

Bots are filtered by user agent, though the real filter is that the tracker is
a script — most crawlers never run it.

**In Settings.** A **Website Visitors** panel on the Settings page carries the
control side of this: whether anyone is on the sites right now, a seven-day
snapshot, which sites are reporting in, the tracker snippet with a copy button,
and the delete-everything button. The Visitors page is for reading; Settings is
for setting it up and turning it off.

The dashboard sits behind the same `DROPS_PASSPHRASE` as the Dropbox and shares
its session cookie. Only the tracking endpoint is public.

## OpenClaw gateway status

"Is the gateway on my machine running?" has two answers depending on where this
server is, and Settings uses whichever one applies.

**Same machine.** The server asks the gateway directly. It has no CORS rules and
no mixed-content rules, and — the part that matters — it can *read* the reply,
so it can tell OpenClaw apart from anything else on that port. This needs no
setup: point **Local Gateway** at the gateway (default `http://localhost:18789`)
and press **Check Local Gateway**.

**Deployed.** A server in a container cannot reach your desk; `localhost` there
is the container. So the machine reports in instead. Run the heartbeat on the
machine OpenClaw runs on:

```bash
OFFICE_URL=https://your-office.up.railway.app \
GATEWAY_TOKEN=the-same-string-the-server-has \
node scripts/openclaw-heartbeat.js
```

Set `GATEWAY_TOKEN` on the server to the same random string (16+ characters).
The script asks the local gateway what is running, posts it every 30 seconds,
claims queued Mission Control goals, launches Penny through `openclaw agent`,
delivers Penny's response to Jason's Telegram, and writes it to the Outbox. It
stays quiet when the gateway is down — a beat older than 90 seconds reads as
offline, so the light goes red on its own. `HEARTBEAT_ONCE=1` sends one and
exits, which is the quickest way to prove the token works.

**Why the browser cannot do this.** It used to try, and that was the bug. A
cross-origin `no-cors` probe returns an *opaque* response: it resolves for a
404, for a 500, and for any unrelated server on that port. It could only ever
report "something answered" — so pointing it at Agent Office's own port showed
a confident green. Over HTTPS it is worse than useless, because a page served
from Railway cannot reach a plain-`http` localhost address at all.

**What you get.** A green light means reached-and-identified, amber means
something answered but never claimed to be a gateway, red means nothing is
there. Underneath, an endpoint report lists every path tried with its status
code and body shape, and which one returned the agents — so an unknown gateway
API becomes a configured one by reading it. Agents shown are only ever the ones
the gateway actually reported; an empty list says so rather than inventing rows.

| Method | Path                     | Purpose                                    |
| ------ | ------------------------ | ------------------------------------------ |
| GET    | `/api/gateway/status`    | Probe result, heartbeat state, agents      |
| POST   | `/api/gateway/heartbeat` | The gateway machine reporting in (token)   |

## ShareBot67 newsroom health

ShareBot67's newsroom — the scheduled market/news reports — runs in the
**Market Dashboard**, not here. Agent Office knew nothing about it: the office
feed beside ShareBot67 is scripted context, and "ShareBot67 smoke check passed"
says exactly the same thing on a morning the newsroom failed at 4am.

Clicking ShareBot67 in the office now shows a compact panel of real state:

```
ShareBot67 Newsroom
  Health                  Healthy / Running / Degraded / Failed / No runs yet / Unavailable
  Agent route             Verified / Warning / Failed
  Last successful cycle   timestamp
  Last attempt            status · timestamp
  Next expected cycle     timestamp
  Generation              X / Y sections
  Delivery                X successful · Y failed
  Latest error            when there is one
```

**Why the browser cannot fetch this itself.** Market Dashboard's
`GET /api/newsroom/health` requires an admin key, and a key in page JavaScript
is a published key. So this server reads it — with the key in a header, server
to server — and hands the browser a normalized summary. The key never reaches
the page, and neither does anything else: the normalizer is a whitelist of
operational fields, so no report text can arrive through this panel even if the
upstream response grows a field carrying it.

**Configuration.** Both are needed; with either missing the panel says which:

- `MARKET_DASHBOARD_URL` — the dashboard's base URL, e.g.
  `https://market-dashboard-production-xxxx.up.railway.app`. Any path on it is
  discarded: this names a host, not a route. **A deployed host must use HTTPS**
  (plain HTTP is allowed only against loopback, for running both apps on one
  machine).
- `MARKET_DASHBOARD_ADMIN_API_KEY` — the dashboard's `ADMIN_API_KEY`. On that
  side it opens `/api/newsroom/health` and nothing else: not cycle detail, not
  preflight, and no route that can generate or send anything.
- `MARKET_DASHBOARD_TIMEOUT_MS` — optional, defaults to `6000`, clamped to
  1–20s.

**What it does not do.** It is read-only and has no Run, Retry, Deliver or
Telegram control, because it reports on a service that publishes to real
channels and nothing on this screen should be able to make that happen. It also
never claims health it does not have: a newsroom that is unconfigured, rejecting
this server's key, unreachable, timing out, answering with something that is not
health JSON, or returning a server error each reads as its own state, and the
unavailable panel says in as many words that this is *not* evidence the
newsroom is healthy.

The target comes from server configuration and only from there — no request
parameter picks a host — and redirects are not followed, so a moved endpoint
cannot forward the key to another origin.

Panel polling is 45 seconds, skipped entirely while the tab is hidden, with one
request in flight at a time and a manual **Refresh** for the impatient.

| Method | Path                            | Purpose                                  |
| ------ | ------------------------------- | ---------------------------------------- |
| GET    | `/api/sharebot/newsroom-health` | Normalized newsroom health (session)     |

Covered by `tests/sharebot-newsroom.test.js` (the adapter and its boundary) and
`tests/sharebot-newsroom-ui.test.js` (the panel, including phone width).

### Verifying it in production

Every test above runs against a fake Market Dashboard, so none of it is
evidence about the real one. After deploying, with a logged-in session:

```bash
curl -s "$OFFICE_URL/api/sharebot/newsroom-health" -H "cookie: agent_office_session=…" | jq '.state, .health, .agent_route'
```

- `"state": "ok"` means this server reached the dashboard and was accepted.
- `"not_configured"` names the missing variable.
- `"auth_error"` means `MARKET_DASHBOARD_ADMIN_API_KEY` does not match the
  dashboard's `ADMIN_API_KEY`.
- `"unreachable"` / `"upstream_error"` are about the dashboard, not this app.

Then open the panel and confirm from the browser's network tab that the only
request is to this server's own `/api/sharebot/newsroom-health` — nothing
addressed to the dashboard, and no key in any response body.

`agent_route.verified` stays `false` until `NEWSROOM_AGENT_PREFLIGHT_URL` is
configured on the dashboard. That is honest, not broken: an unverified route is
an unknown one. The dashboard's `docs/newsroom-401-verification.md` carries the
full checklist, including the read-only check for the August 11
`HTTP 401: User not found`.

## Phone inbox / iOS Shortcuts

The Dropbox web UI is behind a passphrase and a session cookie, which a phone
Shortcut cannot hold. `/api/shortcuts/*` is the same Dropbox behind a static
bearer token instead: one endpoint to drop something in from the phone, one to
pull back whatever has come due, and two to clear or push out a reminder.

### Setup

1. Generate a token: `openssl rand -base64 24` (16 characters minimum — the
   server refuses to serve the phone inbox with anything shorter).
2. Set `SHORTCUTS_TOKEN` to it on Railway and redeploy.
3. Open **Settings → Phone Inbox** in the app. It shows whether the inbox is on
   and the exact URLs to paste into Shortcuts. The token itself is never
   displayed there — it lives only in the environment and on your phone.

The token is deliberately separate from `DROPS_PASSPHRASE`: it sits in plain
text on the phone, so losing it should not hand over the web session too.
Rotate it by changing `SHORTCUTS_TOKEN`.

Authenticate with **any** of these — a header is preferred, since a token in a
URL ends up in proxy and server logs:

```
Authorization: Bearer <SHORTCUTS_TOKEN>
X-Shortcuts-Token: <SHORTCUTS_TOKEN>
?token=<SHORTCUTS_TOKEN>
```

### Reminder times

`remind` (aliases: `remind_at`, `when`, `due`) accepts what you would actually
type on a phone. Times are read in the server's timezone (`APP_TIMEZONE`).

| You send                | You get                              |
| ----------------------- | ------------------------------------ |
| `in 90m`, `2h`, `3 days`, `1h 30m` | that far from now         |
| `tomorrow`, `friday`, `next week`  | that day at 9:00am        |
| `tomorrow 9am`, `friday at 17:30`  | that day at that time     |
| `tonight`, `noon`, `evening`       | 8:00pm / 12:00pm / 6:00pm |
| `6pm`, `18:15`                     | the next time it is that  |
| `2026-09-01T12:00:00Z`, `2026-09-01` | exactly that (a bare date is 9:00am local) |
| empty, `none`                      | no reminder — a plain drop |

A drop sent with a time is filed under the **Reminder** subject; one sent
without lands in **Inbox**. Either way it is an ordinary drop, visible and
editable in the web Dropbox.

### Sending from the phone

`POST /api/shortcuts/drops` takes the note as JSON (`text`), as a form field,
as a plain-text body, or as query parameters — whichever is least work in the
Shortcut you are building. Optional fields: `title`, `remind`, `subject`,
`project`, `agent`, `tags`, `priority`, `status`, `url`.

```bash
curl -X POST 'https://your-app.up.railway.app/api/shortcuts/drops' \
  -H 'X-Shortcuts-Token: <token>' \
  -H 'Content-Type: application/json' \
  -d '{"text":"Call the bank about the transfer","remind":"tomorrow 9am"}'
```

**Shortcut: "Drop it"** (add to the share sheet so you can send a link, a
selection, or a photo caption straight in)

1. Shortcut settings → **Show in Share Sheet**, accepts *Text* and *URLs*.
2. **Text** → `Shortcut Input` (so anything shared becomes the note).
3. **Ask for Input** → Text, prompt "Remind me when? (blank = no reminder)".
4. **Get Contents of URL**
   - URL: `https://your-app.up.railway.app/api/shortcuts/drops`
   - Method: `POST`
   - Headers: `X-Shortcuts-Token` = your token
   - Request Body: `JSON` → `text` = the Text from step 2, `remind` = the
     Provided Input from step 3
5. **Show Notification** → `Title` from the response (optional).

Add it to the Home Screen or say "Hey Siri, Drop it" and the note is in the
Dropbox before you have put the phone down.

### Pulling it back

`GET /api/shortcuts/drops` returns the due reminders by default. `due=` picks
the scope:

| `due=`     | Returns                                              |
| ---------- | ---------------------------------------------------- |
| `now`      | reminders whose time has arrived (the default)       |
| `today`    | everything due by the end of today                   |
| `upcoming` | reminders still ahead                                |
| `all`      | every open reminder                                  |
| `any`      | the whole open Dropbox, reminders first              |

`limit=` caps the list (default 25, max 100) and `format=text` returns a plain
list instead of JSON, which a Shortcut can show or speak without any parsing:

```
2 items
• Call the bank about the transfer — 40m overdue
• Renew the domain — in 3h
```

**Shortcut: "What did I put down?"**

1. **Get Contents of URL**
   - URL: `https://your-app.up.railway.app/api/shortcuts/drops?due=now&format=text`
   - Method: `GET`
   - Headers: `X-Shortcuts-Token` = your token
2. **Show Result** (or **Speak Text**, or **Show Notification**).

Run it from a Home Screen widget, or attach it to a **Personal Automation** —
"Every day at 8:00am" — and the phone reads out whatever came due overnight.

**Shortcut: the evening roll-up.** `GET /api/shortcuts/countdowns?limit=5` uses
the same token and returns the top countdowns as text, so an evening automation
can append them to whatever roll-up it already builds. `format=json` returns the
same selection as objects. See [Countdowns](#countdowns-1).

**Shortcut: the Countdown Timers.**
`GET /api/shortcuts/reset-timers?limit=5&format=text` returns the timers from
`/resets.html` behind the same token, soonest first:

```
3 active timers
• Claude Usage Reset — 2h 14m
• Codex Usage Reset — 1 Day & 3h
• Haircut — 5 Days
```

`state=` picks which timers (`active`, the default, then `paused`, `expired`,
`completed`, `all`), `limit=` how many. Drop `format=text` for JSON: each item
carries `id`, `title`, `reset_at`, `remaining_ms`, `remaining`, `repeat_days`
and `status`. The Pushcut webhook URL is never among them.

Set the URL up in Shortcuts as **Get Contents of URL** → Method `GET`, one
header `X-Shortcuts-Token` = your token → **Show Result**. The exact URL is on
**Settings → Phone Inbox** as `reset_timers_url`.

There is also a no-Shortcut version: bookmark
`/mission-board.html?reminder=due` on the phone's Home Screen and the Dropbox
opens filtered to what has come due. The same filter is a dropdown on the
Dropbox page ("Due Now" / "Has Reminder"), and "Reminder Time" is a sort
option.

### In the browser

**Reminders** — the **Reminders** item under Planning Tools in the side menu, or
`/mission-board.html?view=ios` — is its own screen, meant for the phone: two
fields (what to be reminded about, and when) and nothing else. No notes, no
filters, no list; the panel stays open after saving and says when the reminder
is due, because there is no list to watch it land in. It saves an ordinary drop
under the **Reminder** subject, so the phone inbox and the Due Now filter pick
it up. The same panel is available on the Dropbox itself from the toolbar
button of that name.

Opening a note on the Dropbox gives you the note: title, when it was written,
and the text. **Edit** reveals the status control; archive, done and delete sit
at the bottom.

Both capture panels open from their toolbar button. On screens narrower than
768px the new-task form starts closed too, so the Dropbox opens on the list
rather than on a full screen of empty fields; **New Task** toggles it.

For a Shortcut that lets you tick items off, drop `format=text` and work with
the JSON instead: **Get Dictionary Value** `items` → **Repeat with Each** →
show `title` → and on confirmation call
`POST /api/shortcuts/drops/<id>/done` or
`POST /api/shortcuts/drops/<id>/snooze?for=1h`. Every item also carries a
`url` that opens that drop in the web Dropbox.

## YouTube packaging (YouTube Claw)

Turns a raw idea — or a Studio Director handoff packet — into a complete YouTube package:
title options, recommended title, thumbnail concepts, description, pinned comment, Shorts
cutdowns, longform chapters, and the review checklist. Deterministic and offline: no API
keys, no network calls, no publishing.

This is YouTube Claw's workflow, and YouTube Claw is an agent in this office, so the
offline packaging scripts live here. Local agent configuration stays on the OpenClaw host
and is not copied into the deploy artifact.
The separate **youtube-claw** repo is the Next.js Shorts workflow studio — a different
codebase, and not where packaging runs.

```bash
npm run package:youtube -- \
  --idea "A 9-minute video about building OpenClaw specialist agents that turn vague ideas into finished workflows" \
  --format both \
  --audience "solo founders and automation builders" \
  --tone "practical, slightly cinematic, no hype"
```

| Flag | Meaning |
| --- | --- |
| `--idea` | Raw idea or video premise (required, unless supplied via `--input`/`--handoff`). |
| `--format` | `short`, `longform`, or `both` (required). |
| `--audience` | Who the video is for (required). |
| `--tone` | Defaults to `practical, direct, no hype`. |
| `--duration` | Longform target runtime in minutes; drives the chapter grid. |
| `--notes` / `--notes-file` | Source notes or transcript. |
| `--keywords` | Comma-separated search terms. |
| `--input` / `--handoff` / `--stdin` | Request JSON or a Studio Director handoff packet. |
| `--out` / `--out-json` / `--json` | Write markdown / write JSON / print JSON. |
| `--now` / `--check` / `--quiet` | Pin the timestamp / compare against fixtures / silence stdout. |

Full list: `npm run package:youtube -- --help`.

The standard lives in [`YOUTUBE_PACKAGING.md`](./YOUTUBE_PACKAGING.md) — the command reads
the review checklist out of that file at runtime and stamps each package with the playbook's
content hash, so a package can never claim a standard it wasn't built against. If the
playbook is missing, packaging fails instead of emitting an unreviewed package.

The command is plain ESM with no dependencies, so it runs with bare `node` and is
independent of the office server.

Smoke test (one command, no tokens spent):

```bash
npm run package:youtube:smoke
```

The same check runs inside `npm test`. See [`SMOKE_TEST.md`](./SMOKE_TEST.md) for the
fixtures, the Studio Director handoff flow, and current validation status.

## Deployment

Railway runs `node agent-office-deploy/dist/server.js` (see `railway.json`). The server serves the static pages and assets in `dist/` and exposes the `/api/*` endpoints above. Push to `master` to deploy.

Dropbox-related variables:

- `DROPS_PASSPHRASE` / `DROPS_PASSPHRASE_HASH` — gates the web Dropbox and the
  calendar; **required on any deployed host** (see below)
- `SHORTCUTS_TOKEN` — enables the phone inbox; 16 characters minimum, and the
  server logs `Phone inbox: on` at startup once it is set
- `APP_TIMEZONE` — the timezone reminder phrases like "tomorrow 9am" are read
  in (defaults to `America/Vancouver`)
- `RESET_TIMER_INTERVAL_MS` — how often the server checks whether a Countdown
  Timer has landed and needs its Pushcut webhook sent (defaults to `45000`;
  `0` turns server-side delivery off). Nothing else is needed to switch this
  on: the webhook URLs already live on the timers.
- `MARKET_DASHBOARD_URL` / `MARKET_DASHBOARD_ADMIN_API_KEY` — the Market
  Dashboard the ShareBot67 newsroom panel reads, and the key it reads with. Both
  stay on the server; neither reaches the browser. HTTPS is required on a
  deployed host. See [ShareBot67 newsroom health](#sharebot67-newsroom-health).
- `MARKET_DASHBOARD_TIMEOUT_MS` — optional timeout for that read (default
  `6000`, clamped to 1–20s).
- `RESET_TIMER_ALLOW_LOOPBACK_WEBHOOKS` — **local testing only.** Set to
  `yes-allow-loopback-webhooks-for-local-tests` it lets the timer processor
  deliver to `127.0.0.1` / `localhost` as well as Pushcut, which is how the test
  suite drives its own stand-in server. Any other value does nothing, and a
  deployed host (`NODE_ENV=production` or any `RAILWAY_*` marker) refuses it and
  says so at startup.

**The passphrase is not optional in a deployment.** Every route holding personal
data — the whole calendar and the config-file reader included — goes through one
default-deny guard. With no passphrase configured it answers `503`, rather than
serving the data, on any host that looks deployed: `NODE_ENV=production`, or any
`RAILWAY_*` marker. Only an undeployed developer machine may run without one,
and it says so at startup (`Agent Office auth: off`). A deployed host with the
passphrase missing logs `Agent Office auth: NOT CONFIGURED` — look for that line
first if the app comes up answering `503` to everything.

**Guessing the passphrase is rate-limited.** Five wrong attempts from one
address buy a five-minute timeout, during which even the correct passphrase is
refused. A successful login clears the count. This is the same treatment the
phone inbox gives a bad token.

### Database TLS

The connection's TLS policy is decided per host and announced at startup as
`Dropbox storage TLS: …`:

- `*.railway.internal` — encrypted but not verified. The connection never leaves
  Railway's private network and the certificate is self-signed by design, so
  there is no public CA that could vouch for it.
- anything else — **verified**. A database reachable from the open internet has
  to prove who it is; encryption alone stops a listener but not an impostor.
- `localhost` / `127.0.0.1` — no TLS, as before.

Two escape hatches for a public host that cannot be verified as-is:

- `PGSSLROOTCERT` — path to the CA certificate to verify against. Prefer this.
- `PGSSL_ALLOW_SELF_SIGNED=true` — skip verification. The startup line then says
  `UNVERIFIED`, on purpose.

### Google Calendar OAuth

Enable the Google Calendar API and create a Google OAuth web client. Configure these Railway variables:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `PUBLIC_APP_URL` — the deployed app origin, without a trailing slash
- `GOOGLE_REDIRECT_URI` — optional; defaults to `${PUBLIC_APP_URL}/api/calendar/oauth/callback`
- `CALENDAR_TOKEN_ENCRYPTION_KEY` — optional dedicated encryption secret; otherwise the Google client secret derives the encryption key

Add the callback URL as an exact authorized redirect URI in the Google OAuth client. Calendar v2 then provides the user-facing **Connect Google Calendar** action. Refresh tokens are encrypted before being stored in PostgreSQL; local development falls back to the ignored `dist/.app-settings.json` file.
