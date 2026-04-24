# MEMORY.md - Devin's Long-Term Memory

## Identity
- Name: Devin
- Role: Developer assistant + project overseer for Jason
- Agent ID: coder

## Jason
- Name: Jason, username: bloc888
- Timezone: America/Vancouver (PDT)
- First contact: Mon 2026-03-09

## Agent Roster
- **Devin (coder)** — me. Project overseer. Big picture, coordination, new builds.
- **TraderClaw (trader)** — Jason's trading bot agent. Owns the trading pipeline project. Let it work autonomously.
- **WebClaw (webclaw)** — AI web developer. Builds demo sites for local Nanaimo businesses, deploys live URLs for cold call pitches. Running on GPT-5.4 (openai/gpt-5.4).
- **X-Hunter (main)** — social/X agent. Monitors crypto Twitter, posts content, tracks @BitcoinMagazine/@CoinDesk etc.
- **Forge (dev)** — dev agent. General coding/development work.
- **Lyra (sora)** — Innerverse project agent. Creative/narrative work.
- **XBot (xbot)** — X posting bot. Auto-posts to @DiamondHands811.
- **Penny (oss)** — General utility agent. Runs on openai/gpt-5.4. Switched 2026-04-11 (was Gemma free, kept hitting rate limits).
- **Reaper (farmbot)** — CommentFarm operator. Runs on Gemma 4 26B MoE free (openrouter/google/gemma-4-26b-a4b-it:free). Lighter model, better rate limits. Switched 2026-04-08.
- **Swarm (codex)** — @codex87bot on Telegram. Renamed from Codex to Swarm 2026-04-11. Model: openai/gpt-4o-mini (switched from free models that kept rate-limiting).

## Role Division
- Devin oversees all projects, keeps the big picture
- TraderClaw handles the trading bot autonomously — don't interfere unless Jason asks
- WebClaw handles local business demo sites — don't interfere unless Jason asks
- Step in only when Jason explicitly asks for help on a specific project

## Active Projects

### youtube-claw / youtuber-claw (owner: Lyra/sora)
- GitHub: https://github.com/classical91/youtube-claw
- Live: https://youtube-claw-production.up.railway.app
- Railway Project ID: 0bf01e9b-2e87-4f0f-8aac-1ce785734e26
- Railway Service ID (app): f6e2707b-f4a6-4561-9755-be9a0650bf69
- Railway Service ID (postgres): 813d40ba-cd6d-461e-ad19-c17cd9f3fef9
- Stack: Next.js + Prisma + PostgreSQL on Railway
- Purpose: YouTube Shorts automation pipeline — generate content packages, Remotion video render, YouTube upload
- Status: Deployed. Remotion + YouTube API integration still TODO (Claude Code failed due to model error)
- TODO: Add OPENAI_API_KEY to Railway env vars, wire Lyra as the agent operator


### CommentFarm / FarmBot (owner: Reaper/farmbot)
- GitHub: https://github.com/classical91/commentfarm
- Frontend: https://commentfarm-production-fc8b.up.railway.app
- Farmbot API: https://farmbot-api-production.up.railway.app
- Stack: Next.js frontend + Fastify API + Prisma + Railway Postgres
- Purpose: Scheduled content engine — fetches X posts, ranks them, queues for review, posts to @DiamondHands811
- Admin token: d1d1ec5a81d349bc8e91e13e91adb4544a927282d7a4439782f85134a2c3937c
- Reaper (farmbot agent) is the operator — monitors jobs, queue, pipeline

### TraderClaw Trading Bot (owner: TraderClaw)
- Live at: https://traderclaw-production.up.railway.app
- Stack: Python/Flask on Railway, Bitget paper trading, Polymarket shadow bot
- Dashboard: mobile-first, 4 tabs (Portfolio, History, Screener, Checklist)
- Screener: BTC 1H/4H/1D, BTC.D, USDT.D with RSI divergence
- Telegram notifications wired to TraderClaw bot
- Original goal: TradingView Mindset-Aligned Trend Entry Pine Script -> webhook -> Hyperliquid testnet
- Status: Mostly built, TraderClaw working on remaining TODOs

### WebClaw Web Agency (owner: WebClaw)
- Business model: Build demo sites for local Nanaimo retail businesses, cold call pitch them
- Pricing: $300–500 setup + $50–100/month maintenance
- Workflow: Jason gives business info → WebClaw generates HTML → deploys live URL → Jason pitches on the spot
- Base template: Trail Appliances Nanaimo demo (pitch-ready HTML built)
- Demo file: C:\Users\JAson\.openclaw\workspace-coder\demos\trail-appliances\index.html
- Status: Agent live, template ready, deployment workflow TBD (Railway token scoped issue)

### Agent Office Dashboard
- File: C:\Users\JAson\.openclaw\workspace-coder\agent-office.html
- Served locally at: http://localhost:9000/agent-office.html
- 2D pixel-art office with all 7 agents as characters
- Live activity feed + status cards
- Currently simulated — not yet wired to real gateway data
- TODO: hook up to OpenClaw gateway API (localhost:18789) for real session status

### Agent Office Dropbox
- I have a personal dropbox with Jason in the Agent Office dashboard
- Use it to drop reminders, ideas, TODOs, and notes proactively
- URL: https://focused-creativity-production.up.railway.app
- Auth: passphrase-based session (cookie). Passphrase: Yarasect
- Login: POST /api/auth/login with { passphrase: "agentoffice2026" } → get session cookie
- Post drop: POST /api/drops with session cookie + { subject, priority (normal/high/urgent), content }
- Default subject: "Openclaw" (capital O) — use this for all drops until Jason says otherwise
- Storage: Postgres (durable, survives redeploys)

## OpenClaw Config
- Gateway: http://localhost:18789 (LAN: http://10.0.0.106:18789)
- Gateway auth token: c7e01df5cd37564b6a95108a4e42817e412b946a77496ebc
- Heartbeat: DISABLED globally (every: 0m) — was draining API

## Railway API Access
- Personal token: 12e63dcd-1d3e-4b61-a23f-bb728eace2d2
- Old token (dead): d4fcb474-3ee7-4996-882c-5e22da7cebc3
- Workspace ID: f616185e-ba7d-4c98-834c-f8cf5d4310a9 (classical91's Projects)
- API endpoint: https://backboard.railway.app/graphql/v2

## Railway Projects
| Project | URL | Railway Project ID |
|---|---|---|
| TraderClaw (trading bot) | https://traderclaw-production.up.railway.app | dc5c9acb-2c73-4a1c-b4c9-82a81e2efe9f |
| Market Dashboard (on-chain analytics) | https://market-dashboard-production-b2f4.up.railway.app | — |
| Dropbox API (focused-creativity) | https://focused-creativity-production.up.railway.app | — |
| Mission Control (agent dashboard) | https://mission-control-standalone-production.up.railway.app | 8da6b690-445e-4d54-832f-548c32cb8fad |

## GitHub Repos
_(Ask Jason to fill these in)_

## Telegram Bot Tokens
- coder (Devin): 8726891478:AAHq3zKDxMuXj1ijEsoddvus-vLuK-fHMvc
- trader (TraderClaw): 8606755179:AAH23uh64bc6SsUldE6X6fPyRvXGvAgEIik
- webclaw (WebClaw): 8595100593:AAHUIoVNyu2ArJ0tbaiaA8zXvas-h2eMkKI
- dev (Forge): 8706360462:AAFVYMhD45zPxIOeiO6A3Y6ZhldB19bLpHU
- sora (Lyra): 8564896217:AAFLdOFd-Z-_aqeJGpXBWunB7YzmklWLWi0
- xtrender (Xtrender): 8612735419:AAF-3q_Cwz37XAHo23Kh-hYOwLeO_8VZaRM

## Notes
- Jason uses Telegram to talk to all his agents
- n8n: Jason has it on Railway, not yet wired to me
- WebClaw model: openai/gpt-5.4
- All other agents: anthropic/claude-sonnet-4-6 (default)
- **Codex**: Jason uses the standalone Codex app — separate from OpenClaw, different workspace. Files don't auto-share between them.
