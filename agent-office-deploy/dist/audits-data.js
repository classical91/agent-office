/* Structured audit history. Append new weekly records; preserve older entries. */
window.AUDITS = [
  {
    "id": "weekly-2026-11-01-farm-bot",
    "project": "FarmBot",
    "type": "Weekly repository audit",
    "auditedAt": "2026-11-01",
    "note": "At risk · selected X-link timed publishing restored and keyed queue-ID collision protection improved; persistent-storage and cross-path scheduling safeguards remain open.",
    "overallStatus": "At risk — production not verified",
    "repository": "classical91/farm-bot",
    "defaultBranch": "main",
    "commit": "5f13c5bd95b3af69b4dde406ec82b0b981a8a9ee",
    "scope": "25 accessible repositories inventoried. Focused source review of FarmBot main, recent X-link changes, queue persistence, identity and scheduling, authentication, tests, CI, and previous audit. Agent Office now owns audit data; Main Hub redirects /audits.html there. Live Railway database, credentials and publication receipts were not accessible.",
    "priorityRanking": [
      {
        "repository": "classical91/farm-bot",
        "priority": "P1",
        "reason": "Automated X/Telegram publishing and newly restored timed X-link intake; unresolved queue durability, identity and scheduling risks; seven commits on Oct 30 since the prior audited commit."
      },
      {
        "repository": "classical91/agent-office",
        "priority": "P1",
        "reason": "Production orchestration and security surface; Audit Log moved here Oct 29 and now owns audit history; latest CI passed."
      },
      {
        "repository": "classical91/market-dashboard",
        "priority": "P1",
        "reason": "Market-data integrity and Oct 30 change coupled to FarmClaw selected X-link timers."
      },
      {
        "repository": "classical91/main-hub",
        "priority": "P1",
        "reason": "Central dashboard and redirects to the Agent Office Audit Log; rapid Oct 29–31 feature changes."
      },
      {
        "repository": "classical91/flashcards",
        "priority": "P2",
        "reason": "Active Oct 31 UX changes; lower production blast radius than publishing/agent systems."
      },
      {
        "repository": "classical91/diet-plan",
        "priority": "P2",
        "reason": "Oct 25 supplement-calendar changes; check integration and data persistence in a future pass."
      },
      {
        "repository": "classical91/spirituality",
        "priority": "P2",
        "reason": "Oct 23 site-audit changes; follow up if deployment or checks regress."
      },
      {
        "repository": "classical91/traderclaw",
        "priority": "P2",
        "reason": "Trading automation is sensitive to data integrity; no new default-branch commit since Sep 18 in checked history."
      },
      {
        "repository": "classical91/webclaw-service-hub",
        "priority": "P2",
        "reason": "Service automation; lower recent activity in checked history."
      },
      {
        "repository": "classical91/Rank-Forge",
        "priority": "P3",
        "reason": "Older and limited activity; defer absent new deployment or failures."
      }
    ],
    "findings": {
      "critical": [],
      "high": [
        {
          "id": "FB-01-H1",
          "classification": "Verified code risk; production configuration requires verification",
          "summary": "General API still selects MemoryFarmbotRepository when getPrismaClient returns null, including missing DATABASE_URL or Prisma construction failure. /health always returns ok, /ready advertises a hard-coded memory adapter, and the API Railway healthcheck targets /health.",
          "evidence": "https://github.com/classical91/farm-bot/blob/main/services/farmbot-api/src/app.ts",
          "impact": "A misconfigured deployment can accept queue writes that disappear on restart without failing its configured healthcheck."
        },
        {
          "id": "FB-01-H2",
          "classification": "Verified remaining code path; production collision unconfirmed",
          "summary": "Keyed generic queue inserts now allocate a free ID and are covered by a real-Postgres collision test. However, createUiQueueItem without idempotencyKey still calls insertUiQueueItem, which uses upsert({where:{id}}) and can replace an unrelated existing row on ID reuse.",
          "evidence": "https://github.com/classical91/farm-bot/blob/main/services/farmbot-api/src/repositories/prisma-repository.ts",
          "impact": "Keyless callers with colliding IDs may overwrite a queued post or reset its dispatch state; scope depends on which active intake paths omit keys."
        }
      ],
      "medium": [
        {
          "id": "FB-01-M1",
          "classification": "Verified missing shared lock; concurrency outcome requires database test",
          "summary": "News-batch schedule holds 'news-schedule-manual'; newly restored X-link timed enqueue holds 'news-create-stories'; generic queue insertion holds neither. All book slots from the same manual lane, so simultaneous intakes can select overlapping dispatch times.",
          "evidence": "https://github.com/classical91/farm-bot/blob/main/services/farmbot-api/src/services/farmclaw-x-links.ts"
        },
        {
          "id": "FB-01-M2",
          "classification": "Likely cross-source duplication gap",
          "summary": "X-link intake now checks existing generic queue URLs and selected news batches, but NewsBatches.create checks other news batches and X-link receipts, not all generic queue URLs. Cross-source duplicate policy is asymmetric.",
          "evidence": "https://github.com/classical91/farm-bot/blob/main/services/farmbot-api/src/services/news-batches.ts"
        },
        {
          "id": "FB-01-M3",
          "classification": "Assumption requiring verification",
          "summary": "Actual Railway DATABASE_URL, applied migrations, dispatch worker ownership, X/Telegram credentials and end-to-end approval-to-delivery receipts could not be checked. A green CI run is not proof of production delivery.",
          "evidence": "https://github.com/classical91/farm-bot/blob/main/services/farmbot-api/railway.json"
        }
      ],
      "low": [
        {
          "id": "FB-01-L1",
          "classification": "Recommendation; performance unmeasured",
          "summary": "News batch list history uses per-batch transactions; measure latency before optimizing. No performance regression confirmed.",
          "evidence": "https://github.com/classical91/farm-bot/blob/main/services/farmbot-api/src/services/news-batches.ts"
        }
      ]
    },
    "brokenOrIncomplete": [
      "No live publishing outage verified. Production fail-closed storage and readiness are incomplete in source.",
      "Manual-lane slot allocation is not serialized across X-link, approved news-batch and generic queue paths.",
      "Cross-source duplicate protection and keyless queue identity handling remain incomplete."
    ],
    "previousFindings": [
      {
        "finding": "General queue memory fallback and misleading readiness",
        "status": "Still open",
        "detail": "app.ts still chooses MemoryFarmbotRepository when Prisma is unavailable; /health and /ready do not validate persistent storage."
      },
      {
        "finding": "Generic queue ID collision overwrite",
        "status": "Improved",
        "detail": "Keyed intake collision now allocates an unused ID, with a real-Postgres regression test. Keyless intake still uses upsert by caller-supplied ID."
      },
      {
        "finding": "Manual queue scheduling concurrency",
        "status": "Still open",
        "detail": "New X-link timed enqueue uses a different advisory lock from approved news-batch scheduling; generic queue insertion has neither."
      },
      {
        "finding": "Cross-batch news article duplicates",
        "status": "Improved",
        "detail": "Canonical cross-batch news check remains; X-link enqueue adds queue/receipt checks. Full cross-source symmetry is not established."
      },
      {
        "finding": "Retired FarmClaw direct queue helper",
        "status": "No longer relevant",
        "detail": "Legacy queue-x-link.mjs still rejects direct queueing; the new scoped /farmclaw/v1/x-links route is a different, reviewed timed-intake flow."
      },
      {
        "finding": "Approval receipt and queue integrity guards",
        "status": "Improved",
        "detail": "Database-backed approval checks and protected news-batch routes remain; no live Railway approval/delivery verification."
      }
    ],
    "fixedIssues": [
      "Keyed generic queue ID collision is addressed in source with free-ID allocation and a real-Postgres test (keyless case remains open).",
      "Selected FarmClaw X links again enter a timed queue through a scoped route with durable receipts; Oct 30 CI passed. Live delivery not independently verified.",
      "Audit Log ownership moved from Main Hub to Agent Office, and Main Hub now issues a redirect; all eight prior audit records remain in structured data."
    ],
    "outstandingIssues": [
      "Production API memory fallback and false-positive readiness",
      "Keyless generic queue ID collision overwrite",
      "Shared manual-lane scheduling lock across all intake paths",
      "Asymmetric cross-source URL deduplication",
      "Live Railway configuration and X/Telegram delivery smoke test"
    ],
    "recommendedFixes": [
      "1. Fail closed when production PostgreSQL is missing or unusable; implement a real /ready DB probe and point Railway healthcheck to /ready.",
      "2. Remove upsert-on-ID-collision for keyless generic queue creation; assign collision-safe server IDs or reject duplicates and test both keyed/keyless concurrent cases.",
      "3. Use one shared transaction-level manual-lane scheduling lock for generic queue, X-link timed enqueue and approved news batches; test simultaneous connections.",
      "4. Centralize canonical URL duplicate checks across news-batch, X-link and generic queue intakes with a documented retention window.",
      "5. Run a controlled production smoke test for durable queue after restart, migration status, timers, X publication and Telegram receipts."
    ],
    "quickWins": [
      "Add a test asserting /ready rejects memory mode in production.",
      "Add a keyless same-ID collision regression test before changing upsert behavior.",
      "Assert X-link and approved news-batch timers never overlap under concurrent Postgres writes."
    ],
    "thisWeeksFocus": [
      "Make production queue storage fail closed and readiness truthful.",
      "Finish keyless queue ID collision safety.",
      "Serialize all manual-lane scheduling paths and test concurrency."
    ],
    "safeToDefer": [
      "History-query optimization until measured latency justifies it.",
      "Cosmetic UI changes unrelated to queue reliability."
    ],
    "checks": [
      "FarmBot main CI succeeded on 2026-10-30 for commit 5f13c5bd (GitHub Actions run 41141939688); includes frontend and API checks with Postgres in CI.",
      "Agent Office master CI succeeded on 2026-10-29 for commit 52ff09d (GitHub Actions run 40912347985).",
      "Inspected FarmBot main and recent X-link changes; no new FarmBot tests or live Railway delivery checks were executed in this audit.",
      "Main Hub source redirects /audits.html to Agent Office; external live URL verification was unavailable."
    ],
    "references": [
      "https://github.com/classical91/farm-bot/actions/runs/41141939688",
      "https://github.com/classical91/farm-bot/blob/main/services/farmbot-api/src/app.ts",
      "https://github.com/classical91/farm-bot/blob/main/services/farmbot-api/src/repositories/prisma-repository.ts",
      "https://github.com/classical91/farm-bot/blob/main/services/farmbot-api/src/services/farmclaw-x-links.ts",
      "https://github.com/classical91/agent-office/blob/master/agent-office-deploy/dist/audits-data.js",
      "https://github.com/classical91/main-hub/blob/main/server.js"
    ]
  },
  {
    "id": "weekly-2026-10-25-farm-bot",
    "project": "FarmBot",
    "type": "Weekly repository audit",
    "auditedAt": "2026-10-25",
    "note": "At risk · cross-batch duplicate guard improved; production persistence and queue scheduling still need attention.",
    "overallStatus": "At risk — production not verified",
    "repository": "classical91/farm-bot",
    "defaultBranch": "main",
    "commit": "a22e7e6df4c9ff7b339a0755ec96b62cda397a78",
    "scope": "25 accessible repositories inventoried; focused source review of FarmBot, its recent changes, CI and previous findings. No live Railway credentials or production database access.",
    "priorityRanking": [
      {
        "repository": "classical91/farm-bot",
        "priority": "P1",
        "reason": "X/Telegram publishing, approval and queue durability; unresolved production-impact risks; 8 commits since Oct 18."
      },
      {
        "repository": "classical91/main-hub",
        "priority": "P1",
        "reason": "Central production dashboard, recent rapid changes and audit-history ownership."
      },
      {
        "repository": "classical91/agent-office",
        "priority": "P1",
        "reason": "Active scheduling/integration work and earlier security audit requiring follow-up."
      },
      {
        "repository": "classical91/market-dashboard",
        "priority": "P1",
        "reason": "Production market-data integrity and new Telegram routing changes."
      },
      {
        "repository": "classical91/spirituality",
        "priority": "P2",
        "reason": "Recent site audit and active feature development."
      },
      {
        "repository": "classical91/traderclaw",
        "priority": "P2",
        "reason": "Trading-related automation; no newer commit than Sep 18 in checked history."
      },
      {
        "repository": "classical91/webclaw-service-hub",
        "priority": "P2",
        "reason": "Service automation and agent guidance; last checked change Sep 18."
      },
      {
        "repository": "classical91/Rank-Forge",
        "priority": "P3",
        "reason": "Older activity; reassess when deployment or development resumes."
      }
    ],
    "findings": {
      "critical": [],
      "high": [
        {
          "id": "FB-25-H1",
          "classification": "Verified code risk; production configuration unverified",
          "summary": "General API silently falls back to nonpersistent memory when DATABASE_URL is missing or Prisma client initialization fails. /health still reports ok and /ready reports a hard-coded memory adapter, while Railway checks /health.",
          "evidence": "https://github.com/classical91/farm-bot/blob/main/services/farmbot-api/src/app.ts",
          "impact": "Queue data can disappear after restart if production is misconfigured; the healthcheck would not detect it."
        },
        {
          "id": "FB-25-H2",
          "classification": "Verified code risk; collision impact conditional",
          "summary": "Generic queue inserts without idempotency keys use an upsert keyed by a caller-supplied numeric ID. If two unrelated saves reuse an ID, the existing queue item can be overwritten rather than rejected.",
          "evidence": "https://github.com/classical91/farm-bot/blob/main/services/farmbot-api/src/repositories/prisma-repository.ts",
          "impact": "Possible lost or unexpectedly changed queued content; no production collision confirmed."
        }
      ],
      "medium": [
        {
          "id": "FB-25-M1",
          "classification": "Verified missing shared lock; runtime race likely",
          "summary": "News-batch scheduling takes an advisory lock, but generic manual queue insertion reads the same lane's latest slot and books a new one without that lock. Concurrent writes can reserve overlapping slots.",
          "evidence": "https://github.com/classical91/farm-bot/blob/main/services/farmbot-api/src/services/news-batches.ts"
        },
        {
          "id": "FB-25-M2",
          "classification": "Likely issue requiring integration test",
          "summary": "News-batch cross-batch URL checks query NewsBatch revisions, not independently created generic queue items; idempotency keys only protect retries of the same intake. Duplicate stories across intake paths remain possible.",
          "evidence": "https://github.com/classical91/farm-bot/blob/main/services/farmbot-api/src/services/news-batches.ts"
        },
        {
          "id": "FB-25-M3",
          "classification": "Assumption requiring verification",
          "summary": "Actual Railway DATABASE_URL, migration state, X/Telegram credentials, and complete approval-to-delivery behavior were not accessible for a live smoke test.",
          "evidence": "https://github.com/classical91/farm-bot/blob/main/services/farmbot-api/railway.json"
        }
      ],
      "low": [
        {
          "id": "FB-25-L1",
          "classification": "Recommendation; performance not measured",
          "summary": "NewsBatches.list reads up to 100 batches by launching a separate read transaction for each, which could become expensive as history grows.",
          "evidence": "https://github.com/classical91/farm-bot/blob/main/services/farmbot-api/src/services/news-batches.ts"
        }
      ]
    },
    "brokenOrIncomplete": [
      "No confirmed production publishing outage. Queue persistence, shared scheduling concurrency and cross-source URL deduplication are not fully guarded.",
      "The new news-batch cross-batch guard is present and database-tested, but a production approval-to-X/Telegram smoke test was not possible."
    ],
    "previousFindings": [
      {
        "finding": "Cross-batch news article duplicates",
        "status": "Improved",
        "detail": "Added canonical URL comparison, global advisory create lock and Postgres regression coverage on main; generic queue intake remains outside this check."
      },
      {
        "finding": "General queue memory fallback",
        "status": "Still open",
        "detail": "getPrismaClient may return null and buildApp selects MemoryFarmbotRepository."
      },
      {
        "finding": "Manual queue scheduling concurrency",
        "status": "Still open",
        "detail": "News scheduling uses an advisory lock, generic insertion does not."
      },
      {
        "finding": "Retired FarmClaw direct queue route",
        "status": "No longer relevant",
        "detail": "Prior review reported HTTP 410; not treated as an active issue."
      },
      {
        "finding": "Approval records and DB integrity guards",
        "status": "Improved",
        "detail": "Immutable approval/queue guard checks and database tests are present; deployment validation remains unverified."
      },
      {
        "finding": "Queue image reconciliation on retired route",
        "status": "No longer relevant",
        "detail": "Previous finding was tied to a retired intake path."
      }
    ],
    "fixedIssues": [
      "Previous cross-batch duplicate gap is partially fixed: validated/queued news batches now check canonical URLs under a database advisory lock.",
      "Postgres news-batch tests now cover duplicate selection and rejection followed by reuse."
    ],
    "outstandingIssues": [
      "Production memory fallback and false-positive healthcheck",
      "Generic queue ID collision overwrite risk",
      "Cross-path manual scheduling race",
      "Cross-source article deduplication and live deployment validation"
    ],
    "recommendedFixes": [
      "1. Fail closed in production when Postgres is missing/unavailable; make /ready check database connectivity and point Railway healthcheck at /ready.",
      "2. Replace generic queue upsert-on-ID-collision with insert-only or immutable-identity behavior; generate server-side IDs and add a real Postgres collision regression test.",
      "3. Use one shared transaction-level advisory lock for all manual-lane slot allocation paths; add a two-connection concurrency test.",
      "4. Extend canonical URL duplicate policy across independently created queue sources with a defined lookback/retention window.",
      "5. Run a controlled Railway smoke test: migrations, durable queue after restart, approval, X receipt and Telegram destination receipts."
    ],
    "quickWins": [
      "Check /v1/system or equivalent operator status for adapter=postgres and confirm DATABASE_URL is configured.",
      "Add a failing test proving two distinct generic saves cannot overwrite one queue ID.",
      "Assert /ready does not claim readiness with memory fallback in production."
    ],
    "thisWeeksFocus": [
      "Make production queue persistence fail closed and readiness truthful.",
      "Protect generic queue rows from accidental ID reuse.",
      "Serialize manual-lane scheduling and verify with concurrent Postgres tests."
    ],
    "safeToDefer": [
      "N+1 history read optimization until latency is measured.",
      "Cosmetic UI refactors unrelated to queue safety."
    ],
    "checks": [
      "FarmBot main CI completed successfully on 2026-10-24 for a22e7e6 (GitHub Actions run 40123879966).",
      "Reviewed default branch, 8-commit comparison since 784f359, repository source and existing Postgres tests.",
      "No new FarmBot tests executed locally; live Railway configuration and delivery not verified."
    ],
    "references": [
      "https://github.com/classical91/farm-bot/actions/runs/40123879966",
      "https://github.com/classical91/farm-bot/blob/main/services/farmbot-api/src/app.ts",
      "https://github.com/classical91/farm-bot/blob/main/services/farmbot-api/src/repositories/prisma-repository.ts",
      "https://github.com/classical91/farm-bot/blob/main/services/farmbot-api/src/services/news-batches.ts"
    ]
  },
  {
    "id": "weekly-2026-10-18-farm-bot",
    "project": "FarmBot",
    "type": "Weekly repository audit (previously reported)",
    "auditedAt": "2026-10-18",
    "note": "Prior audit summary: at risk; cross-batch duplicates, memory fallback, scheduling concurrency. Previously reported outside dashboard.",
    "overallStatus": "At risk (historical report)",
    "reportSource": "Prior weekly report; not previously committed to this dashboard.",
    "previousFindings": [
      {
        "finding": "Cross-batch news duplicates",
        "status": "Improved",
        "detail": "New guard confirmed on 2026-10-25."
      },
      {
        "finding": "Memory fallback",
        "status": "Still open",
        "detail": "Confirmed on 2026-10-25."
      },
      {
        "finding": "Scheduling concurrency",
        "status": "Still open",
        "detail": "Confirmed on 2026-10-25."
      }
    ]
  },
  {
    "id": "weekly-2026-10-11-farm-bot",
    "project": "FarmBot",
    "type": "Weekly repository audit (previously reported)",
    "auditedAt": "2026-10-11",
    "note": "Prior audit summary: duplicate intake, queue reconciliation and temporary-memory fallback. Previously reported outside dashboard.",
    "overallStatus": "At risk (historical report)",
    "reportSource": "Prior weekly report; not previously committed to this dashboard."
  },
  {
    "project": "Jason's Hub — Media & Trends",
    "type": "Page audit",
    "auditedAt": "2026-10-25T03:54:16Z",
    "note": "Full audit of media-trends.html; 20 findings, fixed in the same pass."
  },
  {
    "project": "Agent Office",
    "type": "Security audit",
    "auditedAt": "2026-09-16",
    "note": "Audit completed; remediation tracked separately."
  },
  {
    "project": "Market Dashboard / TraderClaw",
    "type": "Production data integrity audit",
    "auditedAt": "2026-08-30T02:02:39.735Z",
    "note": "Learning Journal recovery audit; investigation remained partial."
  },
  {
    "project": "Market Dashboard",
    "type": "Strategy parity audit",
    "auditedAt": "2026-08-21T04:42:28Z",
    "note": "Mindset v1 and TradingView parity audit completed."
  },
  {
    "project": "Multiple repositories",
    "type": "Unpublished work audit",
    "auditedAt": "2026-07-29T23:09:47Z",
    "note": "Reviewed local-only and uncommitted Codex work across repositories."
  }
];
