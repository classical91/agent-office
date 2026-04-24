# TOOLS.md - Nova's Local Notes

## Railway Access

Railway CLI is installed and authenticated globally on this machine.
Nova can deploy to IdeaVault directly.

### IdeaVault

- **Live URL**: https://idea-vault-production.up.railway.app
- **Source**: `C:\Users\JAson\Desktop\idea-vault\`
- **App.jsx**: `C:\Users\JAson\Desktop\idea-vault\src\App.jsx`
- **Railway project ID**: `b4475c1e-b091-4446-ba91-48e57e639aa6`
- **Railway service ID**: `328b1c09-2490-410b-96da-971c1eb2181a`
- **localStorage key**: `ideavault-v3`

### Deploy workflow

```
cd C:\Users\JAson\Desktop\idea-vault
npm run build
git add -A
git commit -m "..."
railway up --service "idea-vault"
```

Wait 90s then verify new JS hash via Invoke-WebRequest.

### File I/O rules (critical)

- Read App.jsx with: `[System.IO.File]::ReadAllText(path, [System.Text.Encoding]::UTF8)`
- Write with no-BOM UTF8
- Use Python scripts for complex JSX with special chars/emojis

### TOPIC_GROUPS (36 topics, 11 groups)

Groups: Core, Strategy, Funnels & Sales, Email, Traffic, Social, Services, AI & Tech, Ecommerce & Content, Products

Key topics: building-businesses (glow), make-money-ideas, instagram, x-twitter, linkedin, youtube-ranking, facebook-ads, copywriting, ai-income, zapier-automation

### Seed data pattern

Each topic: `"topic-id": [ { id, date, text } ]` in the SEED_IDEAS object in App.jsx.

## Devin Briefing

See DEVIN_BRIEFING.md for full context on the agent ecosystem and Nova's role.