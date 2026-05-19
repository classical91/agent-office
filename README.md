# Agent Office

A single-page web app that acts as a personal "office" for AI agents — a place to capture ideas, manage agent memory, plan a calendar, and view an org chart of your AI team.

## Features

- **Dropbox** — capture notes, ideas, reminders, and tasks with subject, status, priority, and tags. Tap any note to open it in a full-screen reading view.
- **Memory** — per-agent memory entries that agents can reference across sessions.
- **Calendar** — calendar view with Google Calendar OAuth, recurring events, and quick-add.
- **Org chart** — a visual layout of the agent team.
- **Office view** — a "room" view with each agent's avatar and current status.

## Tech stack

- Single-file HTML/JS/CSS frontend (no framework, no build step)
- Plain Node.js HTTP server (no Express)
- Postgres for persistence (via `pg`)
- Deployed on Railway

## Project structure

```
agent-office.html             # Source HTML (edit this)
agent-office-deploy/
  agent-office.html           # Synced copy
  dist/
    index.html                # Served HTML (must stay in sync with the source)
    server.js                 # Node HTTP server
    calendar-view.{js,css}    # Calendar module
    config-files/             # Per-agent config snapshots
railway.json                  # Railway deployment config
package.json                  # Node dependencies + start script
```

> **Important:** when editing the frontend, update **both** `agent-office.html` and `agent-office-deploy/dist/index.html`. Railway serves the file inside `dist/`.

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

Railway runs `node agent-office-deploy/dist/server.js` (see `railway.json`). The server reads `dist/index.html` for the frontend and exposes the `/api/*` endpoints above. Push to `master` to deploy.
