# Agent Office

A multi-page web app that acts as a personal "office" for AI agents — a place to capture ideas, manage agent memory, plan a calendar, and view an org chart of your AI team.

## Features

- **Dropbox / Mission Board** — capture notes, ideas, reminders, and tasks with subject, status, priority, and tags. Tap any note to open it in a full-screen reading view.
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
and slot scoring, and natural-language plan preview/commit.

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

## Deployment

Railway runs `node agent-office-deploy/dist/server.js` (see `railway.json`). The server serves the static pages and assets in `dist/` and exposes the `/api/*` endpoints above. Push to `master` to deploy.

### Google Calendar OAuth

Enable the Google Calendar API and create a Google OAuth web client. Configure these Railway variables:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `PUBLIC_APP_URL` — the deployed app origin, without a trailing slash
- `GOOGLE_REDIRECT_URI` — optional; defaults to `${PUBLIC_APP_URL}/api/calendar/oauth/callback`
- `CALENDAR_TOKEN_ENCRYPTION_KEY` — optional dedicated encryption secret; otherwise the Google client secret derives the encryption key

Add the callback URL as an exact authorized redirect URI in the Google OAuth client. Calendar v2 then provides the user-facing **Connect Google Calendar** action. Refresh tokens are encrypted before being stored in PostgreSQL; local development falls back to the ignored `dist/.app-settings.json` file.
