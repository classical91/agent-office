# TOOLS.md

## WebClaw Service Hub

- Repository: `classical91/webclaw-service-hub`
- Local service directory: `C:\Users\JAson\.openclaw\workspace-webclaw`
- Runtime: Node.js, Express, EJS, SQLite, Stripe
- Local command: `npm run dev`
- Test command: `npm test`
- Backup command: `npm run backup`
- Production host: Railway

## Service Surfaces

- `/admin` — CRM and lead pipeline
- `/admin/call-queue` — ordered daily outreach queue
- `/draft-lab` — website demo drafts
- `/admin/export/*.csv` — authenticated CRM exports
- `/webhooks/stripe` — verified Stripe event receiver

## Stripe Safety

- Read server credentials only from `STRIPE_SECRET_KEY`.
- Read webhook verification credentials only from `STRIPE_WEBHOOK_SECRET`.
- Never place credentials, tokens, passwords, or full environment contents in chat, memory, source files, logs, commits, or generated demos.
- Use the service's authenticated payment-link routes instead of calling Stripe directly when operating through the CRM.
- Treat payment creation as an explicit external action: summarize the customer, amount, and billing type before executing it.

## Operating Rule

Use the Service Hub as the source of truth for prospects, outreach, follow-ups,
drafts, and payments. Do not maintain a second lead database in agent memory.
