# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics â€” the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room â†’ Main area, 180Â° wide angle
- front-door â†’ Entrance, motion-triggered

### SSH

- home-server â†’ 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.

## Stripe

- **Restricted key (server-side):** [REDACTED]
- **Publishable key:** [REDACTED]
- **Use cases:**
  1. Create Payment Links for setup fee (\-500 one-time)
  2. Create Subscription billing links (\-100/month maintenance)
- **API base:** https://api.stripe.com/v1
- **Payment Links endpoint:** POST /v1/payment_links
- **Prices endpoint:** POST /v1/prices (for subscriptions)
- **Products endpoint:** POST /v1/products

### Workflow
1. When Jason pitches a client, create a Stripe Payment Link for the setup fee
2. Return the URL to Jason to share with the client
3. For ongoing maintenance, create a recurring subscription price + link