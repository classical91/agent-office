# Agent Office

A multi-page web app that acts as a personal "office" for AI agents — a place to capture ideas, manage agent memory, plan a calendar, and view an org chart of your AI team.

## Features

- **Dropbox / Mission Board** — capture notes, ideas, reminders, and tasks with subject, status, priority, and tags. Tap any note to open it in a full-screen reading view. Every drop is saved under a title no other drop is using — a second "Weekly review notes" is stored as "Weekly review notes (2)" — so no two rows in the list are indistinguishable.
- **Dropbox iOS** — its own two-field panel on the Dropbox page (what to be reminded about, and when) for things you are putting down for later rather than tasks you are working, reached from the Dropbox side-menu item of the same name. It comes back when it is due.
- **Phone inbox** — a token-authenticated API for iOS Shortcuts: send a note or reminder to the Dropbox from your phone, and pull back whatever has come due. See [Phone inbox](#phone-inbox--ios-shortcuts).
- **Memory** — per-agent memory entries that agents can reference across sessions.
- **Calendar** — a Google Calendar-backed control surface for the office: agent/project metadata on every block, live run status, an Agent Assistant drawer, agent-timeline filters, and a scored scheduling policy instead of first-available-slot.
- **Org chart** — a visual layout of the agent team.
- **Office view** — a "room" view with each agent's avatar and current status.
- **AI Landscape** — a tracker page for the AI model/tooling landscape.
- **Project Rooms** — per-project overview with linked tasks, repo/deploy links, and next actions.
- **Agent Registry** — a directory of configured agents.
- **Resets** — countdown cards for tracked reset times.
- **Settings** — app-level configuration.
- **Prompt Builder** — a standalone page (`/prompt-builder.html`) for assembling structured, reusable prompts with a live preview, saved-prompt library, search, and JSON import/export.

## Tech stack

- Multi-page HTML/JS/CSS frontend: every nav item is its own static HTML page sharing one CSS file and one JS bundle (no framework, no build step)
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
    calendar.html              # Calendar page
    resets.html                # Resets page
    ai-landscape.html          # AI Landscape page
    mission-board.html         # Mission Board (Dropbox) page
    project-rooms.html         # Project Rooms page
    agent-registry.html        # Agent Registry page
    settings.html               # Settings page
    prompt-builder.html        # Prompt Builder (fully standalone, own styles/scripts)
    shared.css                 # Shared chrome/nav/view styles for all pages above
    app-shared.js              # Shared JS: agent/office data, office canvas+SVG rendering,
                                #   view-switching, nav helpers, Dropbox/Memory/Settings/Resets logic
    workspace-systems.css      # Extra styles for Mission Board / Project Rooms / Agent Registry
    mission-board.js           # Mission Board-only logic
    project-rooms.js           # Project Rooms-only logic
    agent-registry.js          # Agent Registry-only logic
    calendar-view.{js,css}     # Calendar-only logic
    calendar-view-base.js      # Calendar renderer (states, lanes, agent badges)
    calendar-agent-assistant.js # Agent Assistant drawer
    calendar-agent-meta.js     # Agent Office event metadata + run lifecycle
    calendar-scheduling.js     # Scheduling preferences, slot scoring, NL parsing
    calendar-google-sync.js    # Incremental Google sync (sync tokens, paging, 410 recovery)
    reminder-time.js           # Parses "tomorrow 9am" / "in 2h" into reminder timestamps
    ai-landscape.{js,css}      # AI Landscape-only logic
    server.js                  # Node HTTP server
    config-files/              # Per-agent config snapshots
railway.json                  # Railway deployment config
package.json                  # Node dependencies + start script
```

Each page pulls in `shared.css` + `app-shared.js` plus only the extra CSS/JS it needs. Navigating between pages is a real browser navigation (plain `<a href>` links), not client-side view-switching — `switchView()` in `app-shared.js` still does the in-page activation/render work for whichever single view that page contains.

> **Note:** the repo also has two pre-existing single-page copies of the old monolithic UI — root `agent-office.html` and `agent-office-deploy/agent-office.html`. Neither is referenced by `server.js` or any build/deploy step, and they were already out of sync with `dist/index.html` before this multi-page split. They're left as-is; treat `agent-office-deploy/dist/` as the only frontend that's actually served.

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
Google sync state machine, reminder-time parsing, and the phone inbox
(token auth and throttling, the JSON/form/plain-text/query ways of sending a
drop, the due scopes, done/snooze, and that a reminder set on the phone shows
up in the web Dropbox).

`calendar-google-sync.js` takes its HTTP call as an injected function, so
`tests/calendar-google-sync.test.js` drives the whole state machine against a
scripted fake Google: token reuse, delta merges, cancellations, pagination, an
expired (410) token forcing a full resync, and a transient 5xx leaving a good
token alone.

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
| GET    | `/api/memories`                   | List memory entries              |
| POST   | `/api/memories`                   | Create a memory entry            |
| PATCH  | `/api/memories/:id`               | Update a memory entry            |
| DELETE | `/api/memories/:id`               | Delete a memory entry            |
| GET    | `/api/calendar/status`            | Check Google Calendar connection |
| GET    | `/api/calendar/oauth/start`        | Start Google OAuth authorization |
| GET    | `/api/calendar/oauth/callback`     | Complete Google OAuth             |
| DELETE | `/api/calendar/oauth/connection`   | Disconnect the stored account     |
| GET    | `/api/calendar/events`            | List calendar events             |
| POST   | `/api/calendar/events`            | Create an event                  |
| PATCH  | `/api/calendar/events/:id`        | Update an event                  |
| DELETE | `/api/calendar/events/:id`        | Delete an event                  |
| POST   | `/api/calendar/events/:id/run`    | Drive a block's agent run        |
| GET    | `/api/calendar/agent-timeline`    | Agent work grouped by agent      |
| GET    | `/api/calendar/preferences`       | Read scheduling preferences      |
| PUT    | `/api/calendar/preferences`       | Update scheduling preferences    |
| POST   | `/api/calendar/schedule/suggest`  | Scored candidate slots           |
| POST   | `/api/calendar/schedule/plan`     | Preview a natural-language plan  |
| POST   | `/api/calendar/schedule/commit`   | Create the previewed blocks      |
| POST   | `/api/calendar/quick-add`         | Natural-language event entry     |
| GET    | `/api/config-files/:agent`        | Read an agent's config snapshot  |

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

There is also a no-Shortcut version: bookmark
`/mission-board.html?reminder=due` on the phone's Home Screen and the Dropbox
opens filtered to what has come due. The same filter is a dropdown on the
Dropbox page ("Due Now" / "Has Reminder"), and "Reminder Time" is a sort
option.

### In the browser

**Dropbox iOS** — the **Dropbox iOS** item under Dropbox in the side menu, or
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

## Deployment

Railway runs `node agent-office-deploy/dist/server.js` (see `railway.json`). The server serves the static pages and assets in `dist/` and exposes the `/api/*` endpoints above. Push to `master` to deploy.

Dropbox-related variables:

- `DROPS_PASSPHRASE` / `DROPS_PASSPHRASE_HASH` — gates the web Dropbox
- `SHORTCUTS_TOKEN` — enables the phone inbox; 16 characters minimum, and the
  server logs `Phone inbox: on` at startup once it is set
- `APP_TIMEZONE` — the timezone reminder phrases like "tomorrow 9am" are read
  in (defaults to `America/Vancouver`)

### Google Calendar OAuth

Enable the Google Calendar API and create a Google OAuth web client. Configure these Railway variables:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `PUBLIC_APP_URL` — the deployed app origin, without a trailing slash
- `GOOGLE_REDIRECT_URI` — optional; defaults to `${PUBLIC_APP_URL}/api/calendar/oauth/callback`
- `CALENDAR_TOKEN_ENCRYPTION_KEY` — optional dedicated encryption secret; otherwise the Google client secret derives the encryption key

Add the callback URL as an exact authorized redirect URI in the Google OAuth client. Calendar v2 then provides the user-facing **Connect Google Calendar** action. Refresh tokens are encrypted before being stored in PostgreSQL; local development falls back to the ignored `dist/.app-settings.json` file.
