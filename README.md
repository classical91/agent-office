# Agent Office

A multi-page web app that acts as a personal "office" for AI agents — a place to capture ideas, manage agent memory, plan a calendar, and view an org chart of your AI team.

## Features

- **Dropbox / Mission Board** — capture notes, ideas, reminders, and tasks with subject, status, priority, and tags. Tap any note to open it in a full-screen reading view.
- **Memory** — per-agent memory entries that agents can reference across sessions.
- **Calendar** — calendar view with Google Calendar OAuth, recurring events, and quick-add.
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
| GET    | `/api/calendar/events`            | List calendar events             |
| POST   | `/api/calendar/events`            | Create an event                  |
| PATCH  | `/api/calendar/events/:id`        | Update an event                  |
| DELETE | `/api/calendar/events/:id`        | Delete an event                  |
| POST   | `/api/calendar/quick-add`         | Natural-language event entry     |
| GET    | `/api/config-files/:agent`        | Read an agent's config snapshot  |

## Deployment

Railway runs `node agent-office-deploy/dist/server.js` (see `railway.json`). The server serves the static pages and assets in `dist/` and exposes the `/api/*` endpoints above. Push to `master` to deploy.
