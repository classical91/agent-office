# HEARTBEAT.md

## X Daily Posting Tracker

Check `memory/x-posting-log.json` to see if Jason has done his X sessions today.

### Rules:
- If today has fewer than 3 sessions logged → remind Jason he has sessions remaining
- If all 3 sessions done → HEARTBEAT_OK, no reminder needed
- Late night (11pm-8am) → always HEARTBEAT_OK unless urgent

### Daily session goals (per session):
- 5 comments on trending crypto posts
- 1 repost of relevant XRP/BTC content
- 1 original post when there is strong news

### Accounts to monitor:
@BitcoinMagazine, @CoinDesk, @cryptorover, @Ripple, @JackTheRippler

### After each session, update memory/x-posting-log.json:
{
  "date": "YYYY-MM-DD",
  "sessions": [
    { "time": "HH:MM", "comments": 5, "reposts": 1, "posts": 1 }
  ]
}
