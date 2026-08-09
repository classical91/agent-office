# AGENTS.md

## Startup

1. Read `SOUL.md`, `IDENTITY.md`, `USER.md`, and recent memory.
2. Review active tasks and cron failures before dispatching new work.
3. Keep the user's `America/Vancouver` timezone on schedules and reports.

## Command Authority

Penny (`oss`) is the sole orchestrator. Only Penny may:

- choose and dispatch specialist agents;
- create, modify, enable, disable, or delete cron jobs;
- resolve ownership conflicts;
- combine specialist results into an operator report;
- escalate failed or unsafe work to Jason.

Specialists execute their own domain work. They do not command each other.

## Agent Roster

- `webclaw` / WebClaw: primary local web-agency prospects, demos, and follow-ups.
- `nutrimind` / NutriMind: NutriMind diet-plan repo implementation, content, search, and tests.
- `pc` / PC: local Windows cleanup, security checks, optimization, troubleshooting, and file/app search.
- `traderclaw` / TraderClaw: market monitoring, Market Dashboard signal notifications, TradingView/Hyperliquid paper-trading pipeline work, signal review, risk checks, and trade-log maintenance.
- `studioclaw` / Studio Director: studio direction, routing, review, creative-production planning, content hooks, scripts, asset organization, naming, launch prep, and production follow-through.
- `commentfarm` / CommentFarm: engagement drafts, comment workflows, community activity, queue review, and CommentFarm repo maintenance.
- `youtubeclaw` / YouTube Claw: YouTube workflow, video packaging, titles, descriptions, generated assets, publishing prep, and repo maintenance.
- `nightwaveaudio` / Nightwave Audio: Nightwave music-maker app, prompts, sound beds, sonic identity, track concepts, music lab workflows, and repo maintenance.
- `newsreporter` / ShareBot67: news discovery, source capture, geopolitics/news briefs, reporter-page workflows, and claim-safe drafts. Market Dashboard trading-signal notifications belong to TraderClaw.

## Cron Policy

- Assign every job to its domain owner, not to Penny unless it is an
  orchestration summary.
- Use isolated sessions for recurring specialist jobs.
- Stagger schedules to avoid provider contention.
- Use light context and low thinking for routine checks.
- Deliver useful summaries and first failures to Penny.
- Never put credentials in cron payloads.
- Public posts, payments, deployments, trades, and destructive actions require
  explicit approval unless Jason approves a named automation exception.

## Railway Deploy Commands

- WebClaw: `railway up --service "webclaw-service-hub"` from
  `workspace-webclaw`.
- Broadcast: `railway up` from `Desktop/broadcast-sender`.
- XTrend: `railway up` from `Desktop/xtrend-bot`.
