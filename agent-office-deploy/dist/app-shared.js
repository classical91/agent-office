// Populate SVG roster panel
(function() {
  const roster = [
    {name:'Penny', role:'Sole Orchestrator', color:'#f59e0b'},
    {name:'WebClaw', role:'Web Agency Specialist', color:'#3b82f6'},
    {name:'NutriMind', role:'Nutrition App Specialist', color:'#22c55e'},
    {name:'PC', role:'Windows Workstation Specialist', color:'#10b981'},
    {name:'Studio Director', role:'Studio Routing Lead', color:'#8b5cf6'},
    {name:'Nightwave Audio', role:'Audio Specialist', color:'#06b6d4'},
    {name:'YouTube Claw', role:'YouTube Packaging', color:'#ef4444'},
    {name:'CommentFarm', role:'Engagement Specialist', color:'#84cc16'},
    {name:'ShareBot67', role:'News and Trends', color:'#f97316'},
  ];
  const el = document.getElementById('svg-roster');
  if (el) {
    el.innerHTML = roster.map(a => `
      <div class="roster-row">
        <div class="roster-dot" style="--entity-color:${a.color};"></div>
        <div>
          <div class="roster-name">${a.name}</div>
          <div class="roster-role">${a.role}</div>
        </div>
      </div>`).join('');
  }
})();
// ─── AGENT DATA ───────────────────────────────────────────────
const AGENTS = [
  {
    id: 'oss',
    name: 'Penny',
    emoji: 'P',
    color: '#f59e0b',
    role: 'Sole Orchestrator',
    model: 'GPT-5.5',
    authority: 'command',
    memory: true,
    workspace: 'workspace-oss',
    repo: 'OpenClaw orchestration',
    desc: "Jason's command agent. Owns delegation, cron governance, routing, delivery, failure handling, and operator communication.",
    tasks: [
      'Routing Jason requests',
      'Checking OpenClaw gateway health',
      'Coordinating specialist agents',
      'Reviewing active memory',
      'Maintaining the agent roster',
      'Preparing operator reports',
    ],
    feed: [
      'PC agent added to OpenClaw roster',
      'OpenClaw active roster synced',
      'Gateway health check passed',
      'Delegation allow-list verified',
      'Agent Office registry refresh complete',
    ]
  },
  {
    id: 'webclaw',
    name: 'WebClaw',
    emoji: 'W',
    color: '#3b82f6',
    role: 'Web Agency Specialist',
    model: 'GPT-5.4',
    authority: 'specialist',
    memory: true,
    workspace: 'workspace-webclaw',
    repo: 'WebClaw agency work',
    desc: 'Primary specialist for local WebClaw prospects, demos, follow-ups, and service-hub implementation.',
    tasks: [
      'Building local business demos',
      'Preparing WebClaw follow-ups',
      'Updating service-hub code',
      'Reviewing prospect notes',
      'Testing landing pages',
      'Drafting client-ready copy',
    ],
    feed: [
      'WebClaw remains active under Penny',
      'Local prospect workflow is ready',
      'Demo-site implementation queue checked',
      'Service hub project linked',
      'Follow-up context available in memory',
    ]
  },
  {
    id: 'nutrimind',
    name: 'NutriMind',
    emoji: 'N',
    color: '#22c55e',
    role: 'Nutrition App Specialist',
    model: 'GPT-5.4',
    authority: 'specialist',
    memory: true,
    workspace: 'workspace-nutrimind',
    repo: 'diet-plan',
    desc: 'Diet-plan repo specialist for the NutriMind nutrition app, content, search index, planner tests, keto planning profile, and repo maintenance.',
    tasks: [
      'Maintaining diet-plan repo',
      'Planning keto grocery meals',
      'Updating nutrition content',
      'Checking search index coverage',
      'Running planner tests',
      'Keeping meal guidance practical',
    ],
    feed: [
      'NutriMind Telegram bot configured',
      'Keto planning profile ready for memory',
      'Diet-plan repo ownership assigned',
      'Search/content scope documented',
      'Telegram allow-list restricted to Jason',
    ]
  },
  {
    id: 'pc',
    name: 'PC',
    emoji: 'PC',
    color: '#10b981',
    role: 'Windows Workstation Specialist',
    model: 'GPT-5.4',
    authority: 'specialist',
    memory: true,
    workspace: 'workspace-pc',
    repo: 'local Windows PC',
    desc: 'Local Windows PC specialist for cleanup audits, security checks, optimization, troubleshooting, file/app search, and approved maintenance.',
    tasks: [
      'Auditing disk usage',
      'Reviewing startup items',
      'Checking Windows security posture',
      'Finding local files and apps',
      'Spotting performance issues',
      'Preparing safe cleanup plans',
    ],
    feed: [
      'PC workspace created',
      'Local maintenance scope documented',
      'Destructive actions require approval',
      'Security and cleanup checklist ready',
      'Windows troubleshooting profile active',
    ]
  },
  {
    id: 'studioclaw',
    name: 'Studio Director',
    emoji: 'SD',
    color: '#8b5cf6',
    role: 'Studio Routing Lead',
    model: 'GPT-5.5',
    authority: 'specialist',
    memory: true,
    workspace: 'workspace-studios',
    repo: 'OpenClaw studio direction',
    desc: 'Studio department lead under Penny. Intakes studio requests, chooses the right specialist, reviews handoffs, tracks status, and keeps public output approval-gated.',
    tasks: [
      'Triaging studio requests',
      'Routing to production specialists',
      'Building handoff packets',
      'Reviewing specialist output',
      'Tracking studio status labels',
      'Reporting clean results to Penny',
    ],
    feed: [
      'Studio Director routing playbook shipped',
      'Penny remains command center',
      'YouTube, CommentFarm, Nightwave Audio, ShareBot67, and WebClaw smoke checks passed',
      'Public output approval gates confirmed',
      'Internal ID remains studioclaw',
    ]
  },
  {
    id: 'nightwaveaudio',
    name: 'Nightwave Audio',
    emoji: 'NA',
    color: '#06b6d4',
    role: 'Audio Specialist',
    model: 'GPT-5.5',
    authority: 'specialist',
    memory: true,
    workspace: 'music-maker',
    repo: 'Nightwave music-maker',
    desc: 'Nightwave music/audio production and app specialist for prompts, sound-bed concepts, sonic direction, track workflows, and music-maker maintenance.',
    tasks: [
      'Drafting music prompts',
      'Shaping track concepts',
      'Planning sound beds',
      'Reviewing sonic direction',
      'Maintaining music-maker workflows',
      'Reporting audio job status',
    ],
    feed: [
      'Nightwave Audio route verified',
      'Telegram account wired as nightwaveaudio',
      'Smoke ping passed',
      'Music-maker workspace assigned',
      'Reports through Studio Director and Penny',
    ]
  },
  {
    id: 'youtubeclaw',
    name: 'YouTube Claw',
    emoji: 'YT',
    color: '#ef4444',
    role: 'YouTube Packaging Specialist',
    model: 'GPT-5.5',
    authority: 'specialist',
    memory: true,
    workspace: 'youtube-claw',
    repo: 'YouTube Claw',
    desc: 'Turns video ideas and assets into ready-to-review YouTube packages with titles, thumbnail direction, descriptions, tags, chapters, scripts, and publishing prep.',
    tasks: [
      'Writing title sets',
      'Drafting thumbnail briefs',
      'Preparing descriptions',
      'Building tag lists',
      'Outlining chapters',
      'Packaging Shorts and longform videos',
    ],
    feed: [
      'YouTube Claw smoke check passed',
      'Packaging workflow assigned',
      'Publishing prep remains approval-gated',
      'Studio Director handoff ready',
      'Workspace linked',
    ]
  },
  {
    id: 'commentfarm',
    name: 'CommentFarm',
    emoji: 'CF',
    color: '#84cc16',
    role: 'Engagement Specialist',
    model: 'GPT-5.5',
    authority: 'specialist',
    memory: true,
    workspace: 'commentfarm',
    repo: 'CommentFarm',
    desc: 'Drafts concise, platform-aware engagement comments, replies, hooks, and review queues for Jason studio workflows.',
    tasks: [
      'Drafting comments',
      'Preparing reply options',
      'Building engagement hooks',
      'Reviewing comment queues',
      'Matching platform tone',
      'Keeping public activity approval-gated',
    ],
    feed: [
      'CommentFarm smoke check passed',
      'Engagement drafting scope assigned',
      'Studio routing handoff ready',
      'Review queues documented',
      'Workspace linked',
    ]
  },
  {
    id: 'newsreporter',
    name: 'ShareBot67',
    emoji: 'NR',
    color: '#f97316',
    role: 'News and Trend Specialist',
    model: 'GPT-5.5',
    authority: 'specialist',
    memory: true,
    workspace: 'market-dashboard',
    repo: 'Market dashboard reporter',
    desc: 'Turns market and news topics into sourced, claim-safe briefs, trend picks, content angles, and reporter-page workflow improvements without publishing or making market calls.',
    tasks: [
      'Capturing source links',
      'Writing claim-safe briefs',
      'Finding trend angles',
      'Preparing reporter-page updates',
      'Checking market context',
      'Avoiding market calls',
    ],
    feed: [
      'ShareBot67 smoke check passed',
      'Claim-safe brief scope assigned',
      'Market-dashboard workspace linked',
      'Publishing remains approval-gated',
      'Studio Director handoff ready',
    ]
  }
];

// ??? ROOM GEOMETRY & WORKSTATIONS ─────────────────────────────
// Every agent owns one tile and stays on it — this is an office, not a wander
// sim. The block below is generated from the room itself so the two can never
// disagree about how big the floor is or where the desks are.
// <<<BEGIN GENERATED ROOM GEOMETRY>>>
// Written by agent-office-deploy/inject_room.js from dist/room-builder.js.
// DO NOT EDIT BY HAND — change the room builder and re-run:
//   node agent-office-deploy/inject_room.js
//
// These are `let`, not `const`: build mode rebuilds the room in the browser
// when it is resized, and applyRoomGeometry() reassigns them to match.

// Tile grid the room SVG was drawn with. Tiles are addressed 0..gridW-1 across
// and 0..gridH-1 deep; anything outside that is off the floor.
const OFFICE_SCENE = {
  gridW: 12,
  gridH: 9,
};

// The room is drawn in viewBox coords:
//   tile (gx, gy) top point = (550 + (gx - gy) * 36, 295 + (gx + gy) * 18)
//   tile rhombus is 72 wide x 36 tall; centre = top + (0, 18)
// Agent <div>s are positioned in CSS px, so viewBox -> CSS px is
// (clientWidth / SVG_VB_W) after subtracting the viewBox origin.
let SVG_VB_X = 206;
let SVG_VB_Y = 186;
let SVG_VB_W = 786;
let SVG_VB_H = 497;
let SVG_OX = 550;   // viewBox x of tile (0,0) top
let SVG_OY = 295;   // viewBox y of tile (0,0) top
let SVG_HW = 36;    // half tile width  (viewBox)
let SVG_HH = 18;    // half tile height (viewBox)

// One whole tile per agent: the tile directly in front of that agent's desk.
// In *front* of the desk, because agents are DOM nodes layered over the room
// SVG and would otherwise paint straight over the desk they sit at.
let AGENT_STATIONS = {
  oss:        { gx:  5, gy: 1, facing: 'N' },
  webclaw:    { gx:  1, gy: 4, facing: 'W' },
  nutrimind:  { gx:  8, gy: 5, facing: 'N' },
  pc:         { gx: 10, gy: 5, facing: 'N' },
  studioclaw: { gx:  7, gy: 1, facing: 'N' },
};
// <<<END GENERATED ROOM GEOMETRY>>>

// Hot-desks for anyone added to AGENTS without a station of their own, so a new
// agent stands somewhere sensible instead of stacking on top of a colleague.
const SPARE_STATIONS = [
  { gx: 7, gy: 1, facing: 'N' },
  { gx: 8, gy: 1, facing: 'N' },
  { gx: 2, gy: 4, facing: 'W' },
  { gx: 2, gy: 6, facing: 'W' },
  { gx: 11, gy: 5, facing: 'N' },
  { gx: 7, gy: 5, facing: 'N' },
];

function clampStation(station) {
  return {
    // A tile only exists for 0..gridW-1 / 0..gridH-1; clamping here is what
    // keeps a mistyped station on the floor instead of out past the wall.
    gx: Math.max(0, Math.min(OFFICE_SCENE.gridW - 1, Math.round(station.gx))),
    gy: Math.max(0, Math.min(OFFICE_SCENE.gridH - 1, Math.round(station.gy))),
    facing: station.facing || 'S',
  };
}

const tileKey = (station) => `${station.gx},${station.gy}`;

// Hot-desks were handed out by `index % SPARE_STATIONS.length`, which takes no
// account of who is already standing there — StudioClaw owns tile (7,1) and
// YouTube Claw was being assigned the very same tile, so the two rendered
// straight through each other. Claiming desks in one pass, skipping tiles that
// are already spoken for, gives every agent a tile of their own.
function assignStations(agents) {
  const taken = new Set(
    agents.map(agent => AGENT_STATIONS[agent.id]).filter(Boolean).map(tileKey)
  );
  return agents.map(agent => {
    const own = AGENT_STATIONS[agent.id];
    if (own) return clampStation(own);
    const free = SPARE_STATIONS.find(station => !taken.has(tileKey(station))) || SPARE_STATIONS[0];
    taken.add(tileKey(free));
    return clampStation(free);
  });
}

const INITIAL_STATIONS = assignStations(AGENTS);

let agentState = AGENTS.map((agent, index) => {
  const station = INITIAL_STATIONS[index];
  return {
    ...agent,
    station,
    pos: { gx: station.gx, gy: station.gy },
    currentTask: agent.tasks[0],
    status: 'active',
    // The Habbo sprites are all standing poses, so agents stand at their
    // workstation. Drawing the chair prop under a standing sprite just reads as
    // a dark blob around their feet.
    lookState: { pose: 'stand', facing: station.facing, motion: 'typing' },
    availableAt: 0,
  };
});

let openClawGatewayReachable = null;
let feedItems = [];
let feedCount = 0;

// ─── AGENT DATA ───────────────────────────────────────────────
const HABBO_SPRITES = {
  'devin': 'data:image/png;base64,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',
  'fatherclaw': 'data:image/png;base64,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',
  'rig': 'data:image/png;base64,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',
  'nova': 'data:image/png;base64,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',
  'penny': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABuCAYAAACXzxWYAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAFf0lEQVR4nO2cX4hUVRzHf0PSgxu4pQwqG2sWrIhBbhpqEFgvQcIWUtKLRQUrUflSa9hzFlsv/SEUJEqWwiJiwQchzKdQtLaHQhSyWlpyGVxZl1SKYpvvaX/Xs8dzZ+bOnt+ZczvnA8P9M3fu3O/3/H7n370ziyhykgEUOckAipxkAEVOMoAiJxlAkZMMoMhJBlDkJAMocpIBFDnJAIqcZABFTjKAIicZ0IHvnG3wXoU848uATPTJd57JPWjT7g91c7yY4cOA2UaidfTjNDNEjZA2oGXxJvy5OSPETJA0oG3xOjiHpAlSBjgRz0iakJpBgXM6LX1GKgpSBFCJkIiCUhkgQTKASkA97NVSonIN3gCIlxDOBG0AxL/x7Ba6+7n31PYPB190/h0iBozXLlNvdYkScPi17Wq9XV569ysaGRmhwcHB0qRAZcfrX6iRXJEL5jy3fQ7ipRBPgVZymEMdpQ1soS5VD0gZgI7KLBXAFuofvTxAXV1d//9KkAWaob7m9qXi3y1pQAXdVlSCRTBLG1Eg2RQGEQEAeW8TKR0F0gaoFqHd0uOWAVEghZcI4H4BL1vh7G9TSnjZIwBkUfD9T5NqRysm6MJhxtNvj2bnc3lxXuuAR7f0NazQWCiXvC58bi7A+TWJT4vzCgtnIXkVnimUj0P6SCA6Lb75yaFs48Snw9l6IxP4fR2Ir6dRdl4qwYyQEr94yTK1cfXyxRsOYBOaDZZ08duGDtK1mUt0bP+QMxNEZoUhvnrHOvrn77/opkU3q53Yt2n38LzS1cPd1mHSSp04mm65bTk9tGvYmQmuDcjEA4iHCbhokGcCyKvgWDhHk2vEW4E8E0AjI0zh+DzOw+uuosClAfNKX8dmAmAjdGwlzp/Tse1rB+9jAf3C9VaCaSbcNR0ZDEHYH5cmG+a1D/GgY6PBdgWO7ttJA3sPObuOYIbDrYA+gGu8GFD75UfVE0TN7SK0kT6uEDcAFwvxXOFhe6Em1Js/coW4AbZu8EJp1nkqglMDOMyBr1p8obg0QE2Fc3iyEaHjPAU+fmWA+nqW1sPzPyNsnZ2QEKsDrudp2JEgXgkiIp56a5RCpVQdIQmSARQ5pTHAZfdXJ3gDWDj3L17dcb/Tm6XBGmAKZ9bf5baHGZwBpvBV/Q/Sst619O2X76ttzBSj9F3dKAnGAFP4hsdeUMuL42fo6nSND1Pdbe1eQXDT4qobXIS8EmewDhN0XIkHTmeFi9zHtwnHHKFt+AwTfh37mjfDvTvc6F6+PgEK8bZQX9xdtRowl/+l+slMBqeEWZuboQ4417GEGT5wbgC30ecmpjLxaLvfPPwNrejbQLeuXK3E6XmtVXIq1DkqfODUAIhmMAJkI/BgBAwACHG89NLn0j5z/DNau/WJ0kZApS5aPRBhM0LHvCFiCvYlHrhOAVVRmUYgLZDzf16ZsX7Ip2ATyUdllRGxT4hkaREqXh6To4IPTvskmLFAp0gGUHmI+8fT9w48T9+NfhDfb4d5ImT6ws8i5w/WABZ+530P04kjh2hiYoIe30V0/tRRp3+t4eU/RIocjPEAgPDP9+9T65u37VTL60bsZSPCmxFqFy5x5DrCfdX6rUooMI3Ae3gdO7AnqOcE20IP9Xqp0oVzp+vD5o1qH0QCNoK3wfTkuJPv92YAxvmYD2Aa5Dj9fvY0rVyzURnRvbz3BuEwyRVeDIDI7hWr0YzN29ckx9U+m9gjnxygnp4eqlYXPor0YsC1mSn1Qn6DAjlOtVpNmQLBvNSEl6MS5BK754FH1HaRHM8p5eB/MKFT6e/vV03h2NhYZgRXdi3keKn/SotRIvKMMHGZ483w3QxajZDM8WZ0qh8wz4i8933Q6Y6Q9z9QNOm0AR0negP+BdpUpGZQV4C2AAAAAElFTkSuQmCC',
  'traderclaw': 'data:image/png;base64,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',
  'webclaw': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABuCAYAAACXzxWYAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAHtElEQVR4nO1cO29jRRQeo2iVl5IoSoISKaGI0EKRggVRIMR/oKBC0CAU0dAv1Vakp0G0S6j4CXSUK1iKCMEKpSAUCUmUl/JSHlz8Df6uTo5nbMc+c32N/UnWfczc6/m+OefM0x5yfY6BAK7PMRDA9TkGArg+x0AA1+cYCOD6HAMBXJ9jIIDrcwwEcH2OgQAFf19W/VRciVC0ACBfKhGKEEASzpqkF47UAmTLy8tuc3MzJzk/P++2t7d5XZdeNKwFkDXsCY2OjrrJyUl3fHyc4TgzM+POz8/99crKij/vJqwF0LWaA2T39/f9OURZWlry5PGhQC282xwpXKAC8hCBBFHrIM/aB5iGD8WQgEgARau5jX+/ZWEtBchrEORRcJIAOZyTMM75AZhX5uFzNXfBpQykZiJYCOCJgzQJyNqW5AFNEtfaMigM04CNjQ0SL50F+ALB7OHLsiblOYloIF1ai06LxIlSWUAObdaAtgCZl/nkc0zT+SEgPkgT1tAxzAVgwaULyHQtEO+HzuW1dC9hDR2LYCVAJmOA9mcZDENBkJD+HwNdCXlFU9u2EGYWoH1ZkpZ5eC+UX6fzXIommkUcSmMBHropk/4vIz0hA6PsJGny8lk+gzyqs9VWM2kmgK5VHnVHSB51a6HjA4MeoNNwDbfjeS0wAveyimSDIW0NIXFkO88Ax2cB2ZIQ0moiHaV7wVQA3fYD0ndljTM9FAdwL9Z6yPsWvcQkAgChtl13kkLHUCzQgtAK6EqdjBNMY0AMUpTQGKEW0e/kla4j3YRH+YwrQTNYQS2wKxwbCFWjtr+HSRHtKjBlPB/qO4Asn8G7O/F5DTMLQOEB3fvjPeKfZ1+7l97+zJ/X5g38PQD3KQJIgjSOfAbXsIaaACYwE4A1KBEb5EjC+j7vSdI4np2dubGxsbrv6BTmzaCsbYgSEoaQhGP3aP4gL0UR84odwVKACgYoKBz9VtY0zVkjZA28B7DmZR4VADtCUgsAWOhGrQTyrH3yjvv8qx/+u/Hr07o8SiiuL3QM80lRzv7eFyC/vr7uVldXc7I/PX2cm37ou5wBClkZCvm6Tr+oHkFe4tFrSy41kswK0wpA+rfvn/ibkVqsg84HK8B7Wn3+vijN6vBI1e9DJFNbQSoBKpzAfP2DJ23XHt0GVpAKKS0gj9Qv/vzbPXzl5fzYCp7/vuWJ96oFED5SV60ggxX8+PwPf7MVESRxiPHWx2t33mmFQmPAp++/2zCgkShrXhJv1pK0i+TL4/oGicQCnibKfHCfFEgpQDY1NeVPjo6O7iQ0EoHpEiCPYMr3urKuDAlki4uLbm9vz83NzbmJiYk6whQB/YRGMUGSxzsrlYrb2toq58pQDRlIo6Czs7Nud3fXi4Al8JgIADtMEqLW/fNZluXnViKY7xAB2eHhYX9BETgkjokAxALcwsKCGxoa8kLiXdZI3gpABLiAFgFoJASJAyBPUQkrKzDdICFrXyIkAhCqdUmc8wehd1qh0H4AhrYkJYXQYB4IlxqFCoCa5VxBbGITpIsgnpfJdQkQ4uTkJJh2c3OTu0FqlGY4TIA84gXECYlQDXxR12kHhQhweXmZR3IESiBW+wQXTSgChDk8PDQvWyECaPLNQNKh3WXWSC4Aap9gr7BZ7QMQ4fr62p9PT097CyDgBlYoPAaEOjUESMqVpJGREf8BGBMwwMLgymp4XLgAjcgDocAna98ahQsAl5AikBwivy+QEgD5ZTC0RlctgCYPckW1+xqma4NV/86atdG0gGbk2RlC3pS/KTCXnRE6JgQtAORC22eZzhYAQCtwcHCQxErM3/jzt1+4Nx4uRiO0jAGSEGqc95Hn4uLCf4Bmu0c7QTLH4/j+lxd/uTc/+jK/H2oFZPMXCnr/qyCoW4G8IFWCrHVNVl6zD2CFrvcDOPiBz4fIE5xZ/ubxh6aLpV23ABBm1zhEXk+pv/foVdPydN0CfCEaEB8fH/fPcAMlF1utFkq6bgEaJM7NkcgvusJ+wVWsFZRuWtw3gY0QI69rXOaXI0rAijxgOivcyjq+tgBJHK4QGvgg/+npKS/Luzrcylo+yYdMPSZAzf975pejd6BdImbqAMn39KQo22j0AEkebffq2nf+HBMaICf9WtY6TD32G8MUMBUApAl0fykENkZAAMzugKzs9/tC1Gob1gGBetUCKlXSfvk2JMSdL1XkNOEi5wZS/HzeaSHgFvD529vbcCG6NBnivzvRe3MhMDyWo8GyIfkuMVpDWVGE7Znt7E6B0q0NFo2BAK7P0UsCJPmvodILwImQ2ppguf9CwxIkjvUFTJlh3hCfnZ0dd3V1VeqNkh2Bo0XUOHeK8Eg8ePDATISi/kytKeR/inCPMWqbkBsleKy5RGn2CYaQ1WormkGbOsBRof7/AQmr9cLCXADjfG52ACRxgKYOgFxIhBQoTADu7ND3WOvaz5lfikA0sqj7IrkALCyjOMFVZP2PEPqPF7RoQOx3CO0guQAsLMA9fjgiNoQCG4E0xg/5DkAQL38rQDOGeWsiRMy/aT2Bmu6ZjpAvKHtw0udJDrWswTQRN5JtHi4qCNYJQbTg40l3Tnfjb3Vlnz7oFpY+3gzd6grnxKQYofTUKMNYoKt/slwGAbqKfwFcb1im3wtpCwAAAABJRU5ErkJggg==',
  'xhunter': 'data:image/png;base64,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',
  'swarm': 'data:image/png;base64,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',
  'reaper': 'data:image/png;base64,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',
  'lyra': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABuCAYAAACXzxWYAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAFeUlEQVR4nO2cT2hcVRTGz4CLQBYuCqOLSCQ2aRG6aCAS4io2QQWh4kCKuKgYIQT8g7RCIOtgoIqohbhQsRIXDXTRlUqiWQniIl0IUpMaDMmiDmQhLpLd9H3XnMfN630z8yb33LnPe38wvD/z5s37vnvO/ffezCMUONEACpxoAAVONIACJxpAgRMNoMCJBlDgRAMocKIBFDjRAAqcaAAFTjSAAicaQIETDejCdzaavFchx7gyIBX9yydv5B40+u5XujlOzHBhQKOZaB39OM0MUSOkDWhbfBb+3JERYiZIGtCxeB2cQ9IEKQOsiGckTYjNoMA5rZY+IxUFMQKoREhEQakMkCAaQCUgCXu1lKhcvTcA4iWEM14bAPEfTI/RuTc/U9u/ffG29e8QMWCn/g/1Vx9VAm7O19R6p7zz6SotLy/TzMxMaVKgcmnhlhrJFblgznPT5yBeCvEUaCeHOdRR2sAU6lL1gJQB6Kg0qACmUP/66kXq7e39/1eCLDAb6mefOCX+3ZIGVNBtRSVYhGxpIwokm0IvIgAg700ipaNA2gDVInRaetwyIAqkcBIB3C/gZTvc3d1XwsseASCNgjv37qsd7ZigC4cZr394Oz2fzYtzWge8PHamaYXGQrnkdeFHcwHWr0l8WpxXWDgLyavwskL5OKSPBKLT4qurq+nG5ORkut7MBH5fB+KTNErPSyWYEVLi+/v71cbOzs5DB7AJrQZLuviDgwPa3d2loaEhayaIzApD/MTEBB0eHlJPT4/aiX2jSRTopauHu6nDpJU6cTQNDg7S5uamNRNsG5CKBxAPE3DRIM8EkFfBsXCOJtuItwJ5JoBmRmSF4/M4D6/bigKbBhwrfR2TCWBUqxgZU4nz53RM+zrB+VhAv3C9lWBaCbdNVwZDELa1tdU0r12IB10bDXYqsFKpUKNRaK6lKd4Mh9sBfQDbODFgbW1N9QRRc9sIbaSPLcQNwMVCPFd42D6pCUnzR7YQN8DUDT4prTpPRbBqAIc5cFWLnxSbBqipcA5PNsJ3rKfAjfcv0pm+U2memjo7PiFWB6R5auju+oR4JYiIuHztNvlKqTpCEkQDKHBKY4DN7q+O9wawcG5W5y49a/VmqbcGZIUz508/bvV7vDMgK3x2dpbGx8dpampKbWOmGKVv60aJNwZkha+srKjl+vo6bW9v82Gqu63dK/BuWlx1g4uQV+IM1mGCji3xwOqscJH7+CbhmCM0DZ9hwtLSEm/6e3e42b18fQIU4k2hPjAwYDTgKP9L9ZOZFE6JbG2eDXXAuY4lzHCBdQO4jf5jbz8Vj7Z78ebPVKvVaGRkRInT81qr5FSoc1S4wKoBEM1gBMhG4MEIGAAQ4njppc+lPTc3R4uLi6WNgEoiWk3Ym4zQyd4QyQp2JR7YTgFVUWWNQFog5+v1uvFDLgVnkXxUVhkR+oRImha+4uQxOSr44LRLvBkLdItoAJWHsH88/cJbC/T99fnwfjvMEyF///m7yPm9NYCFn3/xNfrhxse0t7dH08n2ne++tfrXGk7+Q6TIwRgPAAj/cuGKWn/+8ntq+Z8RV2h6/iM2wr8ZoU7hEkeuI9zPXXhFCQVZI/AeXt9crXn1nGBH6KGelCrd+/UnOv3Mc2ofRAI2grdB/a+7Vr7fmQEY52M+gGmS44kJPyYmXFBGVJ88+5BwmGQLJwZA5GNPPU23rs8f29cix9U+k9iVz69RX18fVavVE1+bEwP+3b+vXshvUCDH1RAa0QHBvNSEl6MS5BIbe+lVtV0kx3NK2fsfTOhUhoeHVVO4sbGRGsGVXRs5Xuq/0mKUiDwjstjM8Va4bgaNRkjmeCu61Q84ZkTe+y7odkfI+R8oZum2AV0neAMeAKSHpsUgPQOeAAAAAElFTkSuQmCC',
  'xbot': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABuCAYAAACXzxWYAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAFXklEQVR4nO2cPUhkVxTHz0AKwSLFgqQwCBKdNCkiCLKpBK03oLgIQkKyIArZgCQgpg4REoQkhQghJCDIihZbK1gFAoJbpEl0EfwogrBFKu0m8z94Hte3dz7eeM+d+/beHwzzvubN+//vOffrzZu3KHKSARQ5yQCKnGQARU4ygCInGUCRkwygyEkGUOQkAyhykgEUOckAipxkAEVOMoAiJxnQhe+sNdlXIc/4MiAT/eePnzU8aOzLX01zvJjhw4BaM9Em5nGGGapGaBvQtvg88rlbI9RM0DSgY/EmOIemCVoGOBEvaJqQmkGFczotfUErClIEUInQiIJSGaBBMoBKQD3s+V2jcg3eAIjXEC4EbQDEf/f5Q/rgyc+8/tcvXzj/DhUDzq7+o4G+t1nAs2+meLlTnv60R5ubmzQ/P1+aFKg8/naXR3JFLljy3PY5iNdCPQXayWEJdZQ2sIW6Vj2gZQA6KjUqgC3Uf/vqEfX29r75laAIzIf6++8+UP9uTQMq6LaiEixCvrQRBZpNYRARAJD3NpHaUaBtALcInZaetAyIAi28RID0C+S9Hf6+eMXCyx4BIIuCFy//5Q3tmGAKhxmf/vA8O5/Li/NaB3z8sNq0QhOhUvKm8Nu5AOfXpD4tLgsiXIQ0qvDyQuU4pI8GqtPie3t72crk5GS23MwE2W8C8fU0ys5LJZgRYvEDAwO8cnZ29toBYkKrwZIp/vr6mi4uLmh4eNiZCSqzwhA/MTFBNzc31NPTwxuxbaweBWbpmuFu6zAZpU4STUNDQ3R8fOzMBNcGZOIBxMMEXDRoZAJoVMGJcIkm16i3Ao1MAM2MyAvH53EeWXYVBS4NuFP6JjYTwJhRMQq2EpfPmdi2dYL3sYB54WYrIbQS7pquDIYg7OTkpGle+xAPujYa7FRgpVKhWq3QXEtTghkOtwP6AK7xYsD+/j73BFFzuwhtpI8r1A3AxUK8VHhYv68J9eaPXKFugK0bfF9adZ6K4NQACXPgqxa/Ly4N4KlwCU8xInScp8DvXz+iav+DLE9tnZ2QUKsDsjy1dHdDQr0SRER88v1zCpVSdYQ0SAZQ5JTGAJfdX5PgDRDh0qwuP/7I6c3SYA3ICxc+fO8dp98TnAF54QsLCzQ+Pk4zMzO8jplilL6rGyXBGJAXvr29ze8HBwd0enoqh3F327hXENy0OHeDi9CoxAUswwQTV+KB01nhIvfxbcIxR2gbPsOE9fV1WQ337nCze/nmBCjE20J9cHDQasBt/pfqkZkMSYl8bZ4PdSC5jneY4QPnBkgb/c/lq0w82u7VZ3/Q1NQUjY6Osjgzr41KjkNdosIHTg2AaAEjQDECP4yAAQAhjpdZ+lLay8vLtLq6WtoIqNRF84S9zQiT/A2RvGBf4oHrFOCKKm8E0gI5f3V1Zf2QT8F5NH8qy0bEPiGSpUWoePmZHBX84bRPghkLdItkAJWHuB+e3traotnZ2fieHZaJkMPDQ5XzB2uACF9aWuIu8uXlJa+vra05/WsNL/8hUuRgiAUQPjc3x8sYH8g+bMOzRbdGhDcj1ClS4sh1hDueH9rY2OBteSOwD69qtRrU7wQ7wgz1eqnS7u4uD5uBPEQlRpgPVR0dHTn5fm8GYJwvwkCTHKednR2anp7m40dGRl4TDpNc4cUAiMRESL0Zu7OtRY7zNpvYlZUV6u/vZ6PuixcDzs/P+YX8BgVynIfQiA4Ilve+vj45dTkqQSmxxcVFXi+S44ZYk+AfmDCp1POYm0KIEiOksmsjx0v9V1oCi2hkRB6XOd4K382g1QjNHG9Ft/oBd4xotN8H3e4Ief8DxTzdNqDrRG/A/yhCqpM7Y+mBAAAAAElFTkSuQmCC',
  'guardian': 'data:image/png;base64,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',
  'jason': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABuCAYAAACXzxWYAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAHtklEQVR4nO2cXWgcVRiGv4ixtsXmx0BF14Qo2harTW1REEFKbgQvgqhXYm9EgghS8KoKpRQ0V4UiiHhb45V60QtBkF7onaVtUqm0sWhJDEIgzU+ljTXgmvd03+Xbs2dmf+ac2dnMPjCd7szZ6bzv+b7vnPnp3is5p2OA5JyOAZJzOgZIzukYIDmnY4DknI4BknM6BkjO6RggOadjgOScVhtQ3Fi6WnkCrTKgWFq3VDxI2wAjfGBgQBYXF+tur/BuWJoGFIeGhuTWrVsUTzHFqC/AqO3bt8vs7Kxu75W0DDDiV1ZWZHV1tbwNf4yMjFQ0XF5eLpvERQKmSmoRQPHs1b6+vvK++fl5s01Fh2m3vr5Ow4IVyzQMKPb09Eh3d7cgCgDFQzhEAhgEIBw4akSQeuDTgNjKjh4G6GUsFA5gjqZQKJhFg9QgpZrgBa8RgHyenp52FjX2sIbCaQ5gdLAWaKNU/fCWDj4N6IJ4FjWEN4kQUQHrgk4LMjw8bNaqQHqrCd5T4Pr16xUbe3t7y8KQ16gHNtgO0SyUbMPvAooHpXmEFxN8GVA1zEEEBeDkITBKGNDfYxscLy51fODLgK6NwmQigEYAiudnV48y3CmcEcDvMPz5HeAypVm8FkEtHieuK7ct3iUQIIVogs59DY6FKPCRBt5SAMWP+a9DVEcDoHhXzwKIAzABx3OFOwomljqvJ2LxYUCFeOLq5SjxLG6EJgAtkhMqtNdDZxKSGmCKH8PWzn+dq7ZQ/dnVk6UQl//OfV7eds9z71aYgH+vVHuaToMkBpiiFzUr02GtCx57X4vXIgGEAns7PtMEHSVJSGKA7XrFDJAC0VuIBrv3gUs8cG3TRE2mmsHrKMCwR09DOK/+7Cpu53wtHBHRtXFsc5GVNA28Xw1COAywp7OkVu/bQHxEO2NC0mhI5X4Aexwn20juQvzE2y/I2lOHzeetv562m9S8q1QL7wZgeNLVn+lAGg3/9z/9QSYnJ2V8fDwuYloyClShcx29ras2TbANIcxzYAuF+FB4vRxGMeJdn1qgODK/GerobUN1qNdVL5ohtXuCSA3e4+N9QT0BcoX6+dNHTbtQ4oFvA0wUuK757Ss4XQsgcE2qQ/3Z3YMSmmARABMQ2le+Pi573jhecSMEPY8o0GlA7N5GFMQMhYkJYYAZn1kLIF4XQ8DPvAMMMMS5RIaOAu8GFAqFor4fyEigaGJ/dsH9iIJQeDdgQ7wZk121gOlA4sL64tU5I7ztIkBhUkFv+OniNWNCPWjhMOPg4YnyccUjoYfBiqnqO6++GFvQKJQ9r4XXkzLNENqAcgRQOIVEFTxXrQAzswv6mJl8MGJTfP7lj2Txr8sy8PBe+fn7j8s74kzgfg3Eo3bgeHfWVmT6x88y+WBEUxx56b3YBjQBNWHX0M7Idlo82LK1V3BsXyaEMMCIx4kC9D6iAAJckx6Gu6s4csSgeMJj+8C3ARXiSS0TQFSBe/yZMed2X1GQ2sWQbQKImwIDtFtemDHftfEVBV4fjrp6X6NNuDb1beTdX4B9B0c/kD8ufychSf01OZoAIBC4wp/iH9v7ijHrif2vBTmflrwniLCGMPYujdBQPKAJg7tHkfdVRTEJLX1TlAJdYc59+jPbYS6QxRpQF+hJl7h6QLulhavy9/K8WXyQigE3l2blyrnJxKF7c3nOrB/oK5gI+P2XM4nPLbgBCFeKd/V+I+zou3uFiDrgi9RSAEYA9CKFNAojoNbkqRFSM2Du6lkZeOTppsWDJN+NIr2ZYEm8jwjwiVcD7qytxg5PScSDzEfAlq09puKDHf3VT4g2ewR04eqMQx2N0Gz6CAC888O7N5rNHgGGC19+KPt3PeoconIRAYRj9dTMn3LgrU/M33MRAXHkKgJcJI0A4vNhaVtFwPmzJ6seryWlLSIAwgmfNqsHJYlIzYBmxFP44K5RmZs5i7/iDnCRzwoki88FMAS6oPh6TKDwJ/e/btarNypfxPYlHni9Kxz3HL8e8bZw0vPgsCzMXeDH7D4drvUsP0q8Fm73Nvht6hus2vM/TkalBLCF/3P77nuGWN+/rU/SwLsBHKMxA6T4L46+KeMTJ6vaMtQpHCDU7RQIiVcDIJpg+ksj8GLE+MRX0v/QHum+b5vZj7wm7G1UelT8do2Arg3R5oUIlxEa+6aJLTgt8cD7i5L4wzYCabFz8ICs/3vb+aU0BduEKoJlI3B5zKvBLBL8JSlGQ1ZJYypspq+SUVr9Mzotp2OA5Jx2MiDID6lk3oDShZAcO3ZMTpw44f0XqDJrAIUvLS3JqVOn5MiRI2Y5dOiQXLp0KfNvijZN6c6P6XEIpnisyb59+7yZkMrvCNXTiD0OIB6gt8mZM3ffBhkbGyuvSymR6Rcli6XeimxghzrYEGZMgEgIx0LhhIYkJbUUwHU+LoeJFg4Y6gDiXCaEIDUDSlW8aht73c5zttcmkLiIapTgBvBkWcVJf3+/WWthDHUd7rZpgDXCta9RghvAkwUQjZDHGrXBVdgI9rF+6GMAJTz7owDDGOFtCyFR+c3ocfR020yEzIlyBqdznuLQyzbcp+pG2/+gYpURpI4cD/rDq2nPBCuMAK608JnjtWjVVLgsTJvh2h+aLFwL5PKHlTPD/9CA2F+3nu1JAAAAAElFTkSuQmCC',
};

const officesvg = document.getElementById('officesvg');
const officeArea = officesvg ? officesvg.parentElement : document.getElementById('view-office');
const canvas = {
  get width() { return officesvg ? officesvg.clientWidth || SVG_VB_W : SVG_VB_W; },
  get height() { return officesvg ? officesvg.clientHeight || SVG_VB_H : SVG_VB_H; }
};
const ctx = null; // SVG mode - no canvas context

// The sprite canvas sits at bottom:8px inside a standing avatar and the
// sprite's feet land on the canvas bottom, so the feet are ~8px above the
// avatar's own bottom edge. The projection shifts down by that much so the feet
// plant on the tile rather than hovering over it.
const AGENT_FOOT_OFFSET_PX = 8;

function getOfficeMetrics(width = canvas.width, height = canvas.height) {
  const scale = width / SVG_VB_W;
  const tileW = 2 * SVG_HW * scale;
  const tileH = 2 * SVG_HH * scale;
  const originX = (SVG_OX - SVG_VB_X) * scale;
  const originY = (SVG_OY + SVG_HH - SVG_VB_Y) * scale; // tile (0,0) center, CSS px
  const iso = (gx, gy, z = 0) => ({
    x: originX + (gx - gy) * tileW / 2,
    y: originY + (gx + gy) * tileH / 2 - z,
  });
  return {
    width,
    height,
    tileW,
    tileH,
    originX,
    originY,
    gridW: OFFICE_SCENE.gridW,
    gridH: OFFICE_SCENE.gridH,
    scale,
    iso,
  };
}

// Habbo's camera is orthographic: an avatar is exactly the same size wherever
// it stands and only its stacking order changes with depth. The room does
// scale with the viewport though, so the avatars scale with it — and with it
// only — which is what keeps a character one tile wide at every window size.
function agentScale(metrics) {
  return metrics.scale;
}

function projectAgentPosition(agent, metrics = getOfficeMetrics(officeArea.clientWidth, officeArea.clientHeight)) {
  const point = metrics.iso(agent.pos.gx, agent.pos.gy, 0);
  const depth = Math.max(0, Math.min(1, (agent.pos.gx + agent.pos.gy) / (metrics.gridW + metrics.gridH)));
  const scale = agentScale(metrics);
  // iso() returns the centre of the tile, which is where a Habbo avatar's feet
  // go. The avatar is scaled from its bottom edge and its feet sit
  // AGENT_FOOT_OFFSET_PX above that edge, so push the element down by the
  // scaled offset to land the feet on the tile centre.
  return { x: point.x, y: point.y + AGENT_FOOT_OFFSET_PX * scale, depth, scale };
}

function resizeCanvas() {
  drawOffice();
}

function drawOffice() { /* SVG mode: rendering handled by renderAgents() */ }

function applyAgentDepth(el, projected) {
  el.style.setProperty('--agent-scale', projected.scale.toFixed(3));
  // Deeper into the room = drawn first, so agents nearer the camera overlap
  // the ones behind them.
  el.style.setProperty('--agent-z', String(100 + Math.round(projected.depth * 100)));
  el.style.filter = 'drop-shadow(0 1px 5px rgba(0,0,0,0.35))';
}

function getAgentLook(agent) {
  const looks = {
    devin: {
      skin: '#f1c8a1', hair: '#47311f', shirt: '#2563eb', pants: '#111827', chair: '#475569', pose: 'stand', facing: 'S', accessory: 'glasses'
    },
    traderclaw: {
      skin: '#9f6a43', hair: '#151515', shirt: '#16a34a', pants: '#14532d', chair: '#166534', pose: 'seated', facing: 'SE', accessory: 'beard'
    },
    webclaw: {
      skin: '#e4b78f', hair: '#2a2a2a', shirt: '#3b82f6', pants: '#1e293b', chair: '#2563eb', pose: 'seated', facing: 'SW', accessory: 'glasses'
    },
    xhunter: {
      skin: '#8e5c3b', hair: '#111827', shirt: '#14b8a6', pants: '#111827', chair: '#0891b2', pose: 'stand', facing: 'W', accessory: 'headset'
    },
    nova: {
      skin: '#dba77d', hair: '#9a3412', shirt: '#f97316', pants: '#431407', chair: '#ea580c', pose: 'seated', facing: 'NE'
    },
    lyra: {
      skin: '#f0c2ab', hair: '#7c3aed', shirt: '#a855f7', pants: '#312e81', chair: '#7c3aed', pose: 'stand', facing: 'SE'
    },
    xbot: {
      skin: '#d8ab8b', hair: '#ec4899', shirt: '#ec4899', pants: '#4a044e', chair: '#db2777', pose: 'stand', facing: 'S', accessory: 'headset'
    },
    guardian: {
      skin: '#9c6b49', hair: '#334155', shirt: '#475569', pants: '#020617', chair: '#334155', pose: 'stand', facing: 'W', accessory: 'beard'
    },
    fatherclaw: {
      skin: '#b88564', hair: '#e2e8f0', shirt: '#6366f1', pants: '#111827', chair: '#4338ca', pose: 'seated', facing: 'S', accessory: 'glasses'
    },
    rig: {
      skin: '#e0b090', hair: '#1a1a2e', shirt: '#10b981', pants: '#064e3b', chair: '#059669', pose: 'seated', facing: 'NE', accessory: 'glasses'
    },
  };
  const base = looks[agent.id] || {
    skin: '#d9ab89', hair: '#334155', shirt: agent.color, pants: '#1f2937', chair: agent.color, pose: 'stand', facing: 'S'
  };
  return {
    ...base,
    ...(agent.lookState || {}),
  };
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(clean.slice(i, i + 2), 16));
}

function shadeHex(hex, amount = 0) {
  const [r, g, b] = hexToRgb(hex);
  const mix = (v) => amount >= 0 ? v + (255 - v) * amount : v * (1 + amount);
  return `rgb(${Math.max(0, Math.min(255, Math.round(mix(r))))}, ${Math.max(0, Math.min(255, Math.round(mix(g))))}, ${Math.max(0, Math.min(255, Math.round(mix(b))))})`;
}

// Agents that never got a sprite of their own borrow one, so the room reads as
// a single cast instead of a few Habbo avatars next to some loose pixel art.
const SPRITE_ALIASES = {
  oss: 'penny',
  nutrimind: 'nova',
  pc: 'rig',
  studioclaw: 'lyra',
  nightwaveaudio: 'xhunter',
  youtubeclaw: 'devin',
  commentfarm: 'swarm',
  newsreporter: 'traderclaw',
  forge: 'rig',
  command: 'jason',
};

// The sprites are 64x110 PNGs. The canvas backing store used to be 26x36, which
// threw away most of the source pixels — faces came out as mush — before CSS
// scaled the result back up. The buffer below keeps the CSS box's 52:72 aspect
// (so nothing is stretched) while being large enough to hold a sprite at 1:1.
const SPRITE_NATIVE_W = 64;
const SPRITE_NATIVE_H = 110;
const SPRITE_BUFFER_W = 78;
const SPRITE_BUFFER_H = 108;

// The avatar studio's composited characters are off by default: the room keeps
// the original sprites unless an explicit preview URL requests the studio art.
// Do not honor the former browser-local opt-in here: PR #134 saved that flag
// automatically, so keeping it would leave those browsers on the rejected look
// even after the UI change was reverted.
const STUDIO_AVATARS = false;

function studioAvatarsEnabled() {
  try {
    const override = new URLSearchParams(location.search).get('avatars');
    if (override === 'studio') return true;
    if (override === 'sprites') return false;
  } catch (e) { /* no URL or storage access — fall through to the default */ }
  return STUDIO_AVATARS;
}

// Loading the sprite sheets is async, so the first paint has nothing to draw.
// Kick the load off once and repaint when it lands.
let studioAvatarsRequested = false;
function ensureStudioAvatars() {
  if (studioAvatarsRequested || !window.AgentAvatars) return;
  studioAvatarsRequested = true;
  window.AgentAvatars.ready().then(() => renderAgents()).catch(() => { /* fall back to sprites */ });
}

function drawPixelAgent(canvasEl, look, agent) {
  if (!canvasEl) return;
  const agentId = agent ? agent.id : null;
  const customAvatar = agent && agent.lookState && agent.lookState.avatar;

  // Preferred path once approved: the studio's compositor, which covers every
  // agent — including the four who have no sprite of their own and otherwise
  // come out of the fallback below as a stack of coloured boxes.
  const avatars = window.AgentAvatars;
  if (avatars && agentId && avatars.DEFAULT_LOOKS[agentId] && (studioAvatarsEnabled() || customAvatar)) {
    ensureStudioAvatars();
    if (avatars.assetsReady) {
      avatars.drawAvatar(canvasEl, { ...avatars.DEFAULT_LOOKS[agentId], ...customAvatar });
      return;
    }
  }

  const aliased = agentId && SPRITE_ALIASES[agentId];
  const spriteKey = [agentId, aliased].find(key => key && HABBO_SPRITES[key]) || null;

  if (spriteKey) {
    // Use real Habbo sprite
    const c = canvasEl.getContext('2d', { willReadFrequently: true });
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, canvasEl.width, canvasEl.height);
    const img = new Image();
    img.onload = () => {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, canvasEl.width, canvasEl.height);
      // Fit to the buffer without distorting, and never magnify past 1:1 —
      // upscaling here would only cost detail when CSS scales it again.
      const scale = Math.min(canvasEl.width / img.width, canvasEl.height / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const x = Math.round((canvasEl.width - w) / 2);
      const y = canvasEl.height - h;
      c.drawImage(img, x, y, w, h);
    };
    img.src = HABBO_SPRITES[spriteKey];
    return;
  }

  // Fallback: original pixel art renderer. It was drawn for a 26x36 buffer, so
  // scale its coordinate space up to whatever the buffer is now.
  const c = canvasEl.getContext('2d', { willReadFrequently: true });
  c.imageSmoothingEnabled = false;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, canvasEl.width, canvasEl.height);
  c.setTransform(canvasEl.width / 26, 0, 0, canvasEl.height / 36, 0, 0);
  const bx = (x, y, w, h, color) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
  const sk = look.skin || '#f1c8a1';
  const hr = look.hair || '#334155';
  const sh = look.shirt || '#3b82f6';
  const pnt = look.pants || '#1f2937';
  bx(8, 2, 10, 10, sk);
  bx(6, 12, 14, 10, sh);
  bx(8, 22, 5, 8, pnt);
  bx(13, 22, 5, 8, pnt);
  bx(5, 2, 16, 5, hr);
}

// ─── HABBO ROOM STATUS BAR ────────────────────────────────────
function updateRoomStatusBar() {
  if (typeof agentState === 'undefined') return;
  const online = openClawGatewayReachable === false
    ? 0
    : agentState.filter(a => a.status !== 'offline').length;
  // #office-online-top used to be here too. It was a hardcoded "13" in the
  // office header that nothing kept current; the Online tile in the operations
  // summary replaced it.
  const el = document.getElementById('room-online-count');
  if (el) el.textContent = online;
  renderTopAgentState();
  renderOpsSummary();
}
let _roomTickerIdx = -1;
function cycleRoomTicker() {
  const el = document.getElementById('room-task-ticker');
  if (!el || typeof agentState === 'undefined') return;
  if (openClawGatewayReachable === false) {
    el.textContent = 'OpenClaw gateway disconnected';
    return;
  }
  const active = agentState.filter(a => a.currentTask && a.status !== 'offline');
  if (!active.length) { el.textContent = '—'; return; }
  _roomTickerIdx = (_roomTickerIdx + 1) % active.length;
  const a = active[_roomTickerIdx];
  el.textContent = a.name + ': ' + a.currentTask;
}
function roomComingSoon(name) {
  let t = document.getElementById('room-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'room-toast';
    t.style.cssText = 'position:fixed; left:50%; bottom:32px; transform:translateX(-50%); background:#111827; color:#f1f5f9; border:1px solid #334155; border-radius:10px; padding:10px 16px; font-size:13px; z-index:9999; box-shadow:0 8px 24px rgba(0,0,0,0.4); transition:opacity 0.3s; pointer-events:none;';
    document.body.appendChild(t);
  }
  t.textContent = name + ' is coming next 🚧';
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2200);
}
try {
  updateRoomStatusBar();
  cycleRoomTicker();
  setInterval(() => { updateRoomStatusBar(); cycleRoomTicker(); }, 3000);
} catch (e) { /* agentState not ready yet */ }

// ─── BUILD MODE: FLOOR & WALL STYLING ─────────────────────────────
// The room SVG paints its tiles and wallpaper through CSS custom properties
// (see gen_room.js), so restyling the room is just setting variables on :root
// — no re-render, and it survives the room being regenerated.
const ROOM_STYLE_KEY = 'office-room-style';

const FLOOR_PRESETS = [
  { id: 'violet', name: 'Violet', base: '#7B6FA0' },
  { id: 'slate',  name: 'Slate',  base: '#6B7280' },
  { id: 'ocean',  name: 'Ocean',  base: '#4A7A96' },
  { id: 'moss',   name: 'Moss',   base: '#5F7F63' },
  { id: 'sand',   name: 'Sand',   base: '#C0A578' },
  { id: 'ash',    name: 'Ash',    base: '#41415A' },
];

const WALL_PRESETS = [
  { id: 'lilac',  name: 'Lilac',  base: '#C8B8E8' },
  { id: 'bone',   name: 'Bone',   base: '#DED8CC' },
  { id: 'mint',   name: 'Mint',   base: '#B4D8C8' },
  { id: 'sky',    name: 'Sky',    base: '#B4CCE8' },
  { id: 'rose',   name: 'Rose',   base: '#E4C0C8' },
  { id: 'carbon', name: 'Carbon', base: '#5A5A6E' },
];

// One picked colour drives the whole surface: the checker's second tile, the
// grid lines, and the right-hand wall (which catches less light than the left).
function floorVars(base) {
  return {
    '--tile-a': base,
    '--tile-b': shadeHex(base, -0.10),
    '--tile-line': shadeHex(base, -0.28),
    // The rug is a patch of the floor, so it is derived from the same colour —
    // a fixed purple clashed with every floor preset that was not violet.
    '--rug-fill': shadeHex(base, -0.55),
    '--rug-line': shadeHex(base, 0.22),
  };
}

function wallVars(base) {
  return {
    '--wall-a': base,
    '--wall-b': shadeHex(base, -0.07),
    '--wall-ra': shadeHex(base, -0.10),
    '--wall-rb': shadeHex(base, -0.17),
    '--wall-shade': shadeHex(base, -0.32),
  };
}

const ROOM_MAX = { gridW: 20, gridH: 16 };

function roomDefaults() {
  const d = (window.OfficeRoom && window.OfficeRoom.DEFAULTS) || { gridW: 12, gridH: 9 };
  return {
    floor: FLOOR_PRESETS[0].base,
    wall: WALL_PRESETS[0].base,
    gridW: d.gridW,
    gridH: d.gridH,
  };
}

function loadRoomStyle() {
  const base = roomDefaults();
  try {
    const saved = JSON.parse(localStorage.getItem(ROOM_STYLE_KEY) || '{}');
    return {
      floor: saved.floor || base.floor,
      wall: saved.wall || base.wall,
      gridW: Number.isFinite(saved.gridW) ? saved.gridW : base.gridW,
      gridH: Number.isFinite(saved.gridH) ? saved.gridH : base.gridH,
    };
  } catch (e) {
    return base;
  }
}

function applyRoomStyle(style, persist = true) {
  const root = document.documentElement;
  Object.entries({ ...floorVars(style.floor), ...wallVars(style.wall) })
    .forEach(([name, value]) => root.style.setProperty(name, value));
  if (persist) {
    try { localStorage.setItem(ROOM_STYLE_KEY, JSON.stringify(style)); } catch (e) { /* private mode */ }
  }
}

let roomStyle = loadRoomStyle();
applyRoomStyle(roomStyle, false);

// ─── ROOM SIZE ────────────────────────────────────────────────────
// Resizing re-runs the same generator the build step uses, then swaps in the
// new SVG and re-points the projection at it. The smallest grid the layout
// still fits on comes back from the generator, so the controls clamp
// themselves instead of second-guessing where the furniture is.
let roomMinSize = { gridW: 1, gridH: 1 };
let roomSizeError = '';

function applyRoomGeometry(geometry, stations) {
  OFFICE_SCENE.gridW = geometry.GW;
  OFFICE_SCENE.gridH = geometry.GH;
  SVG_OX = geometry.OX;
  SVG_OY = geometry.OY;
  SVG_HW = geometry.HW;
  SVG_HH = geometry.HH;
  SVG_VB_X = geometry.viewBox.x;
  SVG_VB_Y = geometry.viewBox.y;
  SVG_VB_W = geometry.viewBox.w;
  SVG_VB_H = geometry.viewBox.h;
  roomMinSize = { gridW: geometry.gridW, gridH: geometry.gridH };

  AGENT_STATIONS = stations.reduce((map, s) => {
    map[s.agent] = { gx: s.gx, gy: s.gy, facing: s.facing };
    return map;
  }, {});
  AGENT_STATIONS.oss = { gx: 5, gy: 1, facing: 'N' };
  AGENT_STATIONS.webclaw = { gx: 1, gy: 4, facing: 'W' };
  AGENT_STATIONS.nutrimind = { gx: 8, gy: 5, facing: 'N' };
  AGENT_STATIONS.pc = { gx: 10, gy: 5, facing: 'N' };
  AGENT_STATIONS.studioclaw = { gx: 7, gy: 5, facing: 'N' };
  const restationed = assignStations(agentState);
  agentState.forEach((agent, index) => {
    agent.station = restationed[index];
    agent.pos = { gx: agent.station.gx, gy: agent.station.gy };
  });
}

function rebuildRoom() {
  if (!officesvg || !window.OfficeRoom) return false;
  let room;
  try {
    room = window.OfficeRoom.buildRoom({ gridW: roomStyle.gridW, gridH: roomStyle.gridH });
  } catch (err) {
    // The generator refuses layouts that would put furniture or an agent off
    // the floor. Surface that instead of leaving a half-drawn room.
    roomSizeError = (err.problems && err.problems[0]) || err.message;
    return false;
  }
  roomSizeError = '';
  officesvg.setAttribute('viewBox', `${room.geometry.viewBox.x} ${room.geometry.viewBox.y} ${room.geometry.viewBox.w} ${room.geometry.viewBox.h}`);
  officesvg.innerHTML = room.svg;
  applyRoomGeometry(room.geometry, room.stations);
  renderAgents();
  // A taller room leaves the old scroll position part-way down it, which cuts
  // off the back wall, so re-centre on the new size.
  officeHasAutoCentered = false;
  centerOfficeView(true);
  const label = document.getElementById('room-grid-label');
  if (label) label.textContent = `${room.geometry.GW} × ${room.geometry.GH}`;
  return true;
}

// Only pays the cost of a rebuild when the saved size differs from the one the
// build step baked into the page. Either way the layout's minimum size is
// recorded, so the size steppers know where to stop.
function rebuildRoomIfResized() {
  if (!window.OfficeRoom) return false;
  if (roomStyle.gridW === OFFICE_SCENE.gridW && roomStyle.gridH === OFFICE_SCENE.gridH) {
    try {
      const probe = window.OfficeRoom.buildRoom({ gridW: roomStyle.gridW, gridH: roomStyle.gridH });
      roomMinSize = { gridW: probe.geometry.gridW, gridH: probe.geometry.gridH };
    } catch (e) { /* leave the recorded minimum alone */ }
    return false;
  }
  return rebuildRoom();
}

function setRoomStyle(part, value) {
  roomStyle = { ...roomStyle, [part]: value };
  applyRoomStyle(roomStyle);
  renderBuildPanel();
}

function setRoomSize(part, value) {
  const max = ROOM_MAX[part];
  const min = roomMinSize[part] || 1;
  const next = Math.max(min, Math.min(max, Math.round(value)));
  if (next === roomStyle[part]) return;
  const previous = roomStyle[part];
  roomStyle = { ...roomStyle, [part]: next };
  if (rebuildRoom()) {
    applyRoomStyle(roomStyle);
  } else {
    roomStyle = { ...roomStyle, [part]: previous };
    rebuildRoom();
  }
  renderBuildPanel();
}

function resetRoomStyle() {
  roomStyle = roomDefaults();
  applyRoomStyle(roomStyle);
  rebuildRoom();
  renderBuildPanel();
}

// The Build panel's controls. Only a preset's own colour is inline now — the
// swatch's size, its selected ring and the row around it live in shared.css.
function buildSwatchRow(label, presets, part, current) {
  const swatches = presets.map(p => {
    const active = p.base.toLowerCase() === current.toLowerCase();
    return `<button type="button" class="room-swatch${active ? ' is-active' : ''}" title="${p.name}" aria-label="${p.name}" aria-pressed="${active}"
      onclick="setRoomStyle('${part}', '${p.base}')" style="--swatch:${p.base};"></button>`;
  }).join('');

  return `<div class="room-build-row">
    <span class="room-build-label">${label}</span>
    <div class="room-swatches">${swatches}</div>
    <label class="room-build-custom">
      Custom
      <input type="color" class="room-color-input" value="${current}" oninput="setRoomStyle('${part}', this.value)">
    </label>
  </div>`;
}

function buildStepper(label, part, value) {
  const min = roomMinSize[part] || 1;
  const max = ROOM_MAX[part];
  // :disabled carries the dimmed look, so the disabled state is stated once.
  const btn = (delta, glyph, disabled) => `<button type="button" class="room-step" aria-label="${glyph === '−' ? 'Decrease' : 'Increase'} ${label}"
    ${disabled ? 'disabled' : ''} onclick="setRoomSize('${part}', ${value + delta})">${glyph}</button>`;
  return `<div class="room-stepper">
    <span class="room-build-note">${label}</span>
    ${btn(-1, '−', value <= min)}
    <span class="room-step-value">${value}</span>
    ${btn(1, '+', value >= max)}
  </div>`;
}

function renderBuildPanel() {
  const panel = document.getElementById('room-build-panel');
  if (!panel || panel.hidden) return;
  const sizeRow = window.OfficeRoom
    ? `<div class="room-build-row room-build-row--size">
        <span class="room-build-label">Size</span>
        ${buildStepper('Width', 'gridW', roomStyle.gridW)}
        ${buildStepper('Depth', 'gridH', roomStyle.gridH)}
        <span class="room-build-note">min ${roomMinSize.gridW} × ${roomMinSize.gridH}, max ${ROOM_MAX.gridW} × ${ROOM_MAX.gridH}</span>
      </div>`
    : '';
  const error = roomSizeError
    ? `<div class="room-build-error">${escHTML(roomSizeError)}</div>`
    : '';
  panel.innerHTML =
    buildSwatchRow('Floor', FLOOR_PRESETS, 'floor', roomStyle.floor) +
    buildSwatchRow('Walls', WALL_PRESETS, 'wall', roomStyle.wall) +
    sizeRow + error +
    `<div class="room-build-foot">
      <span class="room-build-note">Saved to this browser.</span>
      <button type="button" class="ao-btn ao-btn--sm" onclick="resetRoomStyle()">Reset</button>
    </div>`;
}

function toggleBuildPanel() {
  const panel = document.getElementById('room-build-panel');
  const btn = document.getElementById('room-build-btn');
  if (!panel) return;
  panel.hidden = !panel.hidden;
  if (btn) btn.setAttribute('aria-expanded', String(!panel.hidden));
  renderBuildPanel();
}

// Below this room scale a name chip is wider than the tile it sits on, so the
// chips are dropped rather than left to pile up on top of each other.
const COMPACT_ROOM_SCALE = 0.62;

function renderAgents() {
  document.querySelectorAll('.agent-char').forEach(el => el.remove());

  const metrics = getOfficeMetrics(officeArea.clientWidth, officeArea.clientHeight);
  officeArea.classList.toggle('room-compact', metrics.scale < COMPACT_ROOM_SCALE);

  agentState.forEach(agent => {
    const el = document.createElement('div');
    el.className = 'agent-char';
    el.id = 'agent-' + agent.id;
    el.dataset.agentId = agent.id;
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', `Customize ${agent.name}`);

    // Name chip only: thirteen agents at adjacent desks means thirteen
    // overlapping labels, and the task text is already on every agent's card in
    // the status bar and in the room ticker.
    el.innerHTML = `
      <div class="agent-label">
        <div class="agent-status-dot"></div>
        <div class="agent-label-text">
          <strong>${agent.name}</strong>
        </div>
      </div>
      <div class="agent-avatar">
        <div class="agent-shadow"></div>
        <div class="agent-chair"></div>
        <canvas class="agent-pixel" width="${SPRITE_BUFFER_W}" height="${SPRITE_BUFFER_H}"></canvas>
      </div>
    `;

    officeArea.appendChild(el);
    syncAgentElement(agent);
  });
}

let officeHasAutoCentered = false;

function centerOfficeView(force = false) {
  if (officeHasAutoCentered && !force) return;
  const officeView = document.getElementById('view-office');
  if (!officeView) return;

  officeView.scrollLeft = Math.max(0, Math.round((officeArea.scrollWidth - officeView.clientWidth) / 2));
  officeView.scrollTop = Math.max(0, Math.round((officeArea.scrollHeight - officeView.clientHeight) * 0.08));
  officeHasAutoCentered = true;
}

// ─── STATUS BAR ───────────────────────────────────────────────
// The topbar's live count. The label used to be a bare text node edited in
// place, which meant the markup and the code had to agree on where the words
// ended; it has its own element now, and the dot's colour is a class.
function renderTopAgentState() {
  const count = document.getElementById('onlineCount');
  if (!count) return;
  const chip = document.getElementById('agent-state-chip') || count.parentElement;
  const dot = chip ? chip.querySelector('.ao-dot, .online-dot') : null;
  const label = document.getElementById('onlineLabel');
  const suffix = count.nextSibling;

  const setLabel = (text) => {
    if (label) label.textContent = text;
    else if (suffix && suffix.nodeType === Node.TEXT_NODE) suffix.textContent = ' ' + text;
  };
  const setDot = (modifier) => {
    if (!dot) return;
    dot.className = dot.classList.contains('online-dot') ? 'online-dot' : `ao-dot ao-dot--${modifier}`;
    dot.style.background = dot.classList.contains('online-dot') ? `var(--state-${modifier})` : '';
  };

  if (openClawGatewayReachable === false) {
    count.textContent = '';
    setLabel('Gateway disconnected');
    if (chip) chip.title = 'The OpenClaw local gateway is not reachable from this browser.';
    setDot('blocked');
    return;
  }

  const activeCount = agentState.filter(a => a.status !== 'offline').length;
  count.textContent = activeCount;
  setLabel(openClawGatewayReachable === true ? 'gateway agents' : 'agents configured');
  if (chip) {
    chip.title = openClawGatewayReachable === true
      ? 'OpenClaw local gateway is reachable from this browser.'
      : 'Configured agents. Gateway has not been checked yet.';
  }
  setDot(openClawGatewayReachable === true ? 'active' : 'offline');
}

function agentDisplayStatus(agent) {
  return openClawGatewayReachable === false ? 'offline' : agent.status;
}

// ─── AGENT STATE VOCABULARY ───────────────────────────────────
// One set of names for what an agent is doing, used by the status cards, the
// dots in the room and the operations summary, so the same agent is never
// described two different ways on the same screen.
//   working  — has a task in hand
//   idle     — online, nothing assigned
//   blocked  — wants to work and cannot; today that means the gateway is down
//   offline  — not running
const AGENT_STATE = {
  working: { label: 'Working', dot: 'dot-active', css: 'is-active', color: 'var(--state-active)' },
  idle:    { label: 'Idle',    dot: 'dot-idle',   css: 'is-idle',   color: 'var(--state-idle)' },
  blocked: { label: 'Blocked', dot: 'dot-blocked', css: 'is-blocked', color: 'var(--state-blocked)' },
  offline: { label: 'Offline', dot: 'dot-offline', css: 'is-offline', color: 'var(--state-offline)' },
};

function agentOperationalState(agent) {
  // A dead gateway blocks the whole floor: the agents are configured and
  // willing, nothing can reach them.
  if (openClawGatewayReachable === false) return 'blocked';
  if (agent.status === 'active') return 'working';
  if (agent.status === 'offline') return 'offline';
  return 'idle';
}

function agentStateMeta(agent) {
  return AGENT_STATE[agentOperationalState(agent)] || AGENT_STATE.offline;
}

function agentDisplayTask(agent) {
  return openClawGatewayReachable === false ? 'Gateway disconnected' : agent.currentTask;
}

function renderStatusBar() {
  const bar = document.getElementById('statusbar');
  if (!bar) return;
  bar.innerHTML = agentState.map(agent => {
    const state = agentStateMeta(agent);
    return `
    <div class="status-card ${state.css}" title="${escAttr(agent.name)} — ${state.label}">
      <div class="status-card-avatar" style="--entity-color:${agent.color};">
        ${agent.emoji}
      </div>
      <div class="status-card-info">
        <div class="status-card-name">${agent.name}</div>
        <div class="status-card-task">${agentDisplayTask(agent)}</div>
      </div>
      <div class="status-card-state">
        <div class="status-dot ${state.dot}"></div>
        <div class="status-card-state-label">${state.label}</div>
      </div>
    </div>
  `;
  }).join('');
  renderTopAgentState();
  renderOpsSummary();
}

// ─── OPERATIONS SUMMARY ───────────────────────────────────────
// The strip above the room. Counts come from the same agentState the office
// draws; the queue and the next action come from the Dropbox API, which needs
// an unlocked session — when it is locked the two tiles say so instead of
// showing a made-up zero.
let opsQueue = { loaded: false, available: false, open: 0, next: null };

function opsAgentCounts() {
  const counts = { working: 0, idle: 0, blocked: 0, offline: 0 };
  agentState.forEach(agent => { counts[agentOperationalState(agent)] += 1; });
  counts.online = counts.working + counts.idle;
  return counts;
}

// "Open" is everything still on the board: archived work is done with, and a
// reminder that has not come due yet is not asking for anything today.
function opsIsOpenDrop(drop) {
  return (drop.status || 'inbox') !== 'archived';
}

async function refreshOpsQueue() {
  if (!document.getElementById('ops-summary')) return;
  try {
    const drops = await loadDrops();
    if (drops === null) {
      opsQueue = { loaded: true, available: false, open: 0, next: null };
    } else {
      const open = drops.filter(opsIsOpenDrop);
      const next = open
        .map(drop => ({ drop, reminder: dropReminderInfo(drop) }))
        .filter(entry => entry.reminder)
        .sort((a, b) => a.reminder.at - b.reminder.at)[0] || null;
      opsQueue = { loaded: true, available: true, open: open.length, next };
    }
  } catch {
    // A failed fetch is not an empty queue — say nothing rather than zero.
    opsQueue = { loaded: true, available: false, open: 0, next: null };
  }
  renderOpsSummary();
}

function opsNextAction() {
  if (openClawGatewayReachable === false) {
    return { text: 'Reconnect the OpenClaw gateway', meta: 'Every agent is blocked until it answers', tone: 'alert' };
  }
  if (!opsQueue.loaded) return { text: 'Checking the board…', meta: '', tone: '' };
  if (!opsQueue.available) return { text: 'Unlock the Dropbox to see what is next', meta: 'Session locked', tone: '' };
  if (opsQueue.next) {
    const { drop, reminder } = opsQueue.next;
    return {
      text: drop.title || drop.content || 'Untitled',
      meta: reminder.relative,
      tone: reminder.due ? 'alert' : '',
    };
  }
  if (opsQueue.open) return { text: 'Nothing scheduled', meta: `${opsQueue.open} open on the board`, tone: '' };
  return { text: 'Board is clear', meta: 'No open items', tone: '' };
}

function renderOpsSummary() {
  const el = document.getElementById('ops-summary');
  if (!el) return;

  const counts = opsAgentCounts();
  const next = opsNextAction();
  const queueValue = opsQueue.loaded && !opsQueue.available ? '—' : opsQueue.open;
  const queueNote = opsQueue.loaded
    ? (opsQueue.available ? 'On the board' : 'Dropbox locked')
    : 'Loading…';

  const metric = (opts) => `
    <${opts.href ? 'a' : 'div'} class="ops-metric ${opts.tone || ''}"${opts.href ? ` href="${opts.href}"` : ''} title="${escAttr(opts.title || opts.label)}">
      <span class="ops-metric-label"><span class="ao-dot ao-dot--${opts.dot}"></span>${opts.label}</span>
      <span class="ops-metric-value">${opts.value}</span>
      <span class="ops-metric-note">${escHTML(opts.note)}</span>
    </${opts.href ? 'a' : 'div'}>`;

  el.innerHTML = [
    metric({
      label: 'Online', dot: 'active', value: counts.online, note: `${agentState.length} on the roster`,
      title: 'Agents reachable right now',
    }),
    metric({
      label: 'Working', dot: 'active', value: counts.working, note: counts.idle + ' idle',
      title: 'Agents with a task in hand',
    }),
    metric({
      label: 'Blocked', dot: 'blocked', value: counts.blocked, note: counts.blocked ? 'Needs attention' : 'All clear',
      tone: counts.blocked ? 'is-alert' : '', title: 'Agents that cannot work right now',
    }),
    metric({
      label: 'Queued', dot: 'queued', value: queueValue, note: queueNote,
      href: '/mission-board.html', title: 'Open items on the Mission Board',
    }),
    `<a class="ops-metric ops-next ${next.tone === 'alert' ? 'is-alert' : ''}" href="/mission-board.html?reminder=due" title="Next thing that needs you">
      <span class="ops-metric-label"><span class="ao-dot ao-dot--${next.tone === 'alert' ? 'blocked' : 'queued'}"></span>Next action</span>
      <span class="ops-next-value">${escHTML(next.text)}</span>
      <span class="ops-next-meta">${next.meta ? `<span class="ao-badge ${next.tone === 'alert' ? 'ao-badge--danger' : ''}">${escHTML(next.meta)}</span>` : ''}</span>
    </a>`,
  ].join('');
}

// ─── ACTIVITY FEED ────────────────────────────────────────────
function addFeedItem(agent, msg) {
  feedCount++;
  const now = new Date();
  const time = 'just now';

  const item = document.createElement('div');
  item.className = 'feed-item';
  item.innerHTML = `
    <div class="feed-item-top">
      <div class="feed-avatar" style="--entity-color:${agent.color};">
        ${agent.emoji}
      </div>
      <span class="feed-name" style="--entity-color:${agent.color};">${agent.name}</span>
      <span class="feed-tag">${agent.role}</span>
    </div>
    <div class="feed-msg">${msg}</div>
    <div class="feed-time">${time}</div>
  `;

  const list = document.getElementById('feedList');
  list.insertBefore(item, list.firstChild);

  // Keep max 30 items
  while (list.children.length > 30) list.removeChild(list.lastChild);

  feedCount = list.children.length;
  document.getElementById('feedCount').textContent = feedCount;
}

// ─── AUTO-UPDATE LOOP ─────────────────────────────────────────
function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function syncAgentElement(agent) {
  const el = document.getElementById('agent-' + agent.id);
  if (!el) return;

  const look = getAgentLook(agent);
  const projected = projectAgentPosition(agent);
  el.style.left = projected.x + 'px';
  el.style.top = projected.y + 'px';

  const labelName = el.querySelector('.agent-label strong');
  if (labelName) labelName.textContent = agent.name;

  const avatar = el.querySelector('.agent-avatar');
  if (avatar) {
    const classes = ['agent-avatar'];
    if (look.pose === 'seated') classes.push('seated');
    if (look.motion) classes.push(`motion-${look.motion}`);
    avatar.className = classes.join(' ');
    avatar.style.setProperty('--chair', look.chair);
    avatar.style.setProperty('--skin', look.skin || '#f1c8a1');
    avatar.style.setProperty('--skin-light', shadeHex(look.skin || '#f1c8a1', 0.22));
    avatar.style.setProperty('--hair', look.hair || '#334155');
    avatar.style.setProperty('--hair-light', shadeHex(look.hair || '#334155', 0.28));
    avatar.style.setProperty('--shirt', look.shirt || '#3b82f6');
    avatar.style.setProperty('--shirt-light', shadeHex(look.shirt || '#3b82f6', 0.32));
    avatar.style.setProperty('--pants', look.pants || '#1f2937');
    avatar.style.setProperty('--pants-light', shadeHex(look.pants || '#1f2937', 0.22));
  }

  const dot = el.querySelector('.agent-status-dot');
  if (dot) {
    // Same vocabulary as the status cards and the summary above the room.
    const state = agentStateMeta(agent);
    dot.style.background = state.color;
    dot.title = state.label;
  }

  applyAgentDepth(el, projected);
  drawPixelAgent(el.querySelector('.agent-pixel'), look, agent);
}

// Nobody leaves their desk: a tick only swaps the task an agent is working on
// and the little animation that goes with it.
function updateAgentTask(agent) {
  const now = Date.now();
  if (agent.availableAt && now < agent.availableAt) return false;

  const nextTask = randomFrom(agent.tasks);
  const isIdleTask = nextTask.toLowerCase().includes('idle');

  agent.currentTask = nextTask;
  agent.status = isIdleTask ? 'idle' : (Math.random() > 0.18 ? 'active' : 'idle');
  agent.pos = { gx: agent.station.gx, gy: agent.station.gy };
  agent.lookState = {
    pose: 'stand',
    facing: agent.station.facing,
    motion: isIdleTask ? 'reading' : (Math.random() > 0.3 ? 'typing' : 'monitoring'),
    ...(agent.lookState && agent.lookState.avatar ? { avatar: agent.lookState.avatar } : {}),
  };
  agent.availableAt = now + 2600 + Math.round(Math.random() * 2600);

  syncAgentElement(agent);
  return true;
}

function tick() {
  if (openClawGatewayReachable === false) {
    renderStatusBar();
    renderAgents();
    return;
  }
  const available = agentState.filter(agent => !agent.availableAt || Date.now() >= agent.availableAt);
  if (!available.length) return;

  const desired = Math.max(1, Math.min(available.length, Math.random() > 0.55 ? 3 : 2));
  const selected = [];
  while (selected.length < desired) {
    const candidate = randomFrom(available);
    if (!selected.includes(candidate)) selected.push(candidate);
  }

  selected.forEach(agent => {
    if (updateAgentTask(agent) && Math.random() > 0.38) {
      addFeedItem(agent, randomFrom(agent.feed));
    }
  });

  renderStatusBar();

  renderTopAgentState();
}

// ─── CLOCK ────────────────────────────────────────────────────
function updateClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString('en-CA', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
}

// updateClock() was defined but never called, so the topbar sat on its
// literal --:--:-- placeholder forever. This script tag is at the end of
// <body>, so #clock already exists by now.
updateClock();
setInterval(updateClock, 1000);

// ─── VIEW SWITCHER ────────────────────────────────────────────
const VIEW_HANDLERS = {
  office: { enter: () => { resizeCanvas(); renderAgents(); centerOfficeView(); } },
  org: { focus: false }
};
VIEW_HANDLERS.resets = { enter: () => { if (window.AOResets) window.AOResets.init(); } };
VIEW_HANDLERS.settings = { enter: () => { if (window.SETTINGS) window.SETTINGS.load(); } };

window.SETTINGS = (() => {
  const GW_LOCAL_KEY = 'ao-gateway-local';
  const GW_LAN_KEY   = 'ao-gateway-lan';
  const THEME_KEY    = 'ao-theme';
  const SETTING_API  = '/api/settings/';
  const DEFAULT_LOCAL_GATEWAY = 'http://localhost:18789';
  const CLEARED_SUFFIX = '-cleared';
  let localGatewayState = { reachable: null, url: DEFAULT_LOCAL_GATEWAY, checkedAt: null };
  let gatewayCheckInFlight = null;

  // A theme is just an accent. shared.css derives every surface from it.
  const THEMES = {
    dark:     { label: 'Dark',     accent: '#6366f1' },
    midnight: { label: 'Midnight', accent: '#10b981' },
    ocean:    { label: 'Ocean',    accent: '#38bdf8' },
    crimson:  { label: 'Crimson',  accent: '#ef4444' },
    forest:   { label: 'Forest',   accent: '#22c55e' },
    amber:    { label: 'Amber',    accent: '#f59e0b' },
  };

  // Mirrors the derivations in shared.css :root, for the picker previews.
  const surface = {
    wash:   (a) => `color-mix(in srgb, ${a} 3%, #0e1013)`,
    panel:  (a) => `color-mix(in srgb, ${a} 5%, #15181c)`,
    border: (a) => `color-mix(in srgb, ${a} 10%, #23282f)`,
  };

  function applyTheme(name) {
    const t = THEMES[name] || THEMES.dark;
    document.documentElement.style.setProperty('--accent', t.accent);
    localStorage.setItem(THEME_KEY, name);
    const grid = document.getElementById('settings-theme-grid');
    if (grid) renderThemePicker(grid, name);
  }

  function renderThemePicker(grid, active) {
    active = active || localStorage.getItem(THEME_KEY) || 'dark';
    grid.innerHTML = Object.entries(THEMES).map(([key, t]) => {
      const on = key === active;
      const a = t.accent;
      // The three dots preview the page, panel and accent this theme derives,
      // so their colours are genuinely data. Everything else is a class.
      return `<button class="theme-swatch${on ? ' is-active' : ''}" style="--swatch-accent:${a}; --swatch-panel:${surface.panel(a)}; --swatch-border:${surface.border(a)};" onclick="SETTINGS.applyTheme('${key}')" aria-pressed="${on}">
        <span class="theme-swatch-dots">
          <span class="theme-swatch-dot" style="background:${surface.wash(a)};"></span>
          <span class="theme-swatch-dot" style="background:${surface.panel(a)};"></span>
          <span class="theme-swatch-dot" style="background:${a}; border-color:${a};"></span>
        </span>
        <span class="theme-swatch-name">${escHTML(t.label)}</span>
        <span class="theme-swatch-state">${on ? '✓ Active' : ''}</span>
      </button>`;
    }).join('');
  }

  function settingClearedKey(key) {
    return key + CLEARED_SUFFIX;
  }

  function isSettingCleared(key) {
    try {
      return localStorage.getItem(settingClearedKey(key)) === '1';
    } catch (_) {
      return false;
    }
  }

  async function getSetting(key) {
    if (isSettingCleared(key)) return '';
    try {
      const response = await fetch(SETTING_API + encodeURIComponent(key), { credentials: 'same-origin' });
      if (!response.ok) throw new Error('settings unavailable');
      const data = await response.json();
      return typeof data.value === 'string' ? data.value : '';
    } catch (_) {
      return localStorage.getItem(key) || '';
    }
  }

  async function setSetting(key, value) {
    if (value) {
      localStorage.setItem(key, value);
      localStorage.removeItem(settingClearedKey(key));
    } else {
      localStorage.removeItem(key);
      localStorage.setItem(settingClearedKey(key), '1');
    }
    try {
      const method = value ? 'PUT' : 'DELETE';
      const options = {
        method,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      };
      if (value) options.body = JSON.stringify({ value });
      const response = await fetch(SETTING_API + encodeURIComponent(key), options);
      return response.ok;
    } catch (_) {
      return false;
    }
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  // Only ever what the gateway actually said. An empty list is a real answer -
  // it means the gateway did not tell us about any agents - and saying so is
  // more use than five invented rows that go green together.
  function renderGatewayAgents(agents, note) {
    const el = document.getElementById('settings-gateway-agents');
    if (!el) return;
    const rows = Array.isArray(agents) ? agents : [];
    if (!rows.length) {
      el.innerHTML = `<div class="gw-agents-empty">${escapeHtml(note || 'No agents reported. Check the gateway below.')}</div>`;
      return;
    }
    el.innerHTML = rows.map(agent => {
      const status = agent.status || 'unknown';
      // The gateway's own words for a state, mapped onto the app's four.
      const dot = status === 'running' || status === 'active' || status === 'reachable' ? 'active'
        : status === 'failed' || status === 'offline' ? 'blocked'
          : 'offline';
      const sourceLine = `${agent.source || 'OpenClaw gateway'}${agent.model ? ' / ' + agent.model : ''}`;
      return `<div class="ao-well gw-agent">
        <div class="gw-agent-head">
          <div class="gw-agent-name">${escapeHtml(agent.name || agent.id)}</div>
          <div class="ao-dot ao-dot--${dot}" title="${escapeHtml(status)}"></div>
        </div>
        <div class="gw-agent-role">${escapeHtml(agent.role || 'OpenClaw Agent')}</div>
        <div class="gw-agent-source">${escapeHtml(sourceLine)}</div>
      </div>`;
    }).join('');
  }

  // The Gateway Agents panel is about OpenClaw's agents, so it is filled from
  // the gateway check rather than from this app's own agent registry.
  async function loadGatewayAgents() {
    await checkGateway();
  }

  function gatewayBaseUrl(kind) {
    if (kind === 'local' && isSettingCleared(GW_LOCAL_KEY)) return '';
    if (kind === 'lan' && isSettingCleared(GW_LAN_KEY)) return '';
    const saved = gatewayUrl(kind);
    return saved || (kind === 'local' ? DEFAULT_LOCAL_GATEWAY : '');
  }

  function setGatewayStatus(state, message, url) {
    // 'partial' stays unknown rather than true: something answered, but the
    // rest of the app should not start calling agents live on that basis.
    openClawGatewayReachable = state === 'online' ? true : state === 'offline' ? false : null;
    renderStatusBar();
    if (document.getElementById('officesvg')) renderAgents();
    const dot = document.getElementById('settings-gateway-dot');
    const label = document.getElementById('settings-gateway-state');
    const endpoint = document.getElementById('settings-gateway-endpoint');
    // The dot speaks the same state vocabulary as the rest of the app.
    const modifier = state === 'online' ? 'active'
      : state === 'offline' ? 'blocked'
        : state === 'partial' ? 'idle'
          : 'offline';
    if (dot) {
      dot.className = `ao-dot ao-dot--${modifier}`;
      dot.title = message;
    }
    if (label) label.textContent = message;
    if (endpoint) endpoint.textContent = url || DEFAULT_LOCAL_GATEWAY;
  }

  // What the server found, endpoint by endpoint. This is the part that turns
  // "it doesn't work" into something you can act on: which paths answered,
  // with what, and which one had the agents.
  function renderGatewayProbe(status) {
    const el = document.getElementById('settings-gateway-probe');
    if (!el) return;

    const lines = [];
    const heartbeat = status.heartbeat || {};
    if (heartbeat.received) {
      lines.push(heartbeat.fresh
        ? `Heartbeat: ${heartbeat.host || 'a machine'} reported in ${heartbeat.age_seconds}s ago.`
        : `Heartbeat: last beat was ${heartbeat.age_seconds}s ago — older than ${status.heartbeat_stale_seconds}s, so it counts as gone.`);
    } else if (heartbeat.configured) {
      lines.push('Heartbeat: GATEWAY_TOKEN is set, but nothing has reported in yet.');
    } else {
      lines.push('Heartbeat: not set up. Only needed when Agent Office cannot reach the gateway itself.');
    }

    const probe = status.probe || {};
    const rows = (probe.endpoints || []).map(endpoint => {
      const answer = endpoint.status
        ? `${endpoint.status} · ${endpoint.shape}${endpoint.agents ? ` · ${endpoint.agents} agents` : ''}`
        : endpoint.shape;
      // 2xx answered, anything else with a status is odd, no status at all is dead.
      const tone = endpoint.status >= 200 && endpoint.status < 300 ? 'ok' : endpoint.status ? 'warn' : 'bad';
      return `<div class="gw-probe-row">
        <code class="gw-probe-path">${escapeHtml(endpoint.path)}</code>
        <span class="gw-probe-answer is-${tone}">${escapeHtml(answer)}</span>
      </div>`;
    }).join('');

    el.innerHTML = `<div class="gw-probe-note">${escapeHtml(lines.join(' '))}</div>`
      + (probe.attempted
        ? `<div class="gw-probe-note">Probed from the server at <code>${escapeHtml(probe.url)}</code>:</div>${rows}`
        : '');
  }

  function gatewayStatusMessage(status) {
    const probe = status.probe || {};
    const heartbeat = status.heartbeat || {};

    if (status.source === 'probe') {
      return status.agents.length
        ? `Up. The server reached it and it reported ${status.agents.length} agent(s).`
        : 'Something is answering at that address, but it did not return an agent list. Check the endpoint report below.';
    }
    if (status.source === 'heartbeat') {
      return `Up. ${heartbeat.host || 'The gateway machine'} reported in ${heartbeat.age_seconds}s ago.`;
    }
    return probe.error
      ? `Not running, or not reachable from the server. ${probe.error}`
      : 'Not running, or not reachable from the server.';
  }

  function applyGatewayStatus(status) {
    const probe = status.probe || {};
    localGatewayState = { reachable: status.alive, url: probe.url || '', checkedAt: Date.now() };

    // Reached but unidentifiable is its own answer: something is on that port,
    // but nothing has shown it is OpenClaw. Amber, not a green light.
    const state = !status.alive ? 'offline'
      : status.source === 'probe' && !status.agents.length ? 'partial'
        : 'online';

    setGatewayStatus(state, gatewayStatusMessage(status), probe.url || gatewayBaseUrl('local'));
    renderGatewayAgents(status.agents, status.alive
      ? 'The gateway is up but did not report any agents. The endpoint report below shows what it did return.'
      : 'The gateway is not reachable, so there are no agents to show.');
    renderGatewayProbe(status);
    return status.alive;
  }

  // The check runs on the server, not here. A browser cannot do this job: a
  // cross-origin probe comes back opaque, so it resolves for a 404 and for any
  // unrelated server on that port, and over HTTPS it cannot reach a plain-http
  // localhost address at all.
  async function checkGateway(options = {}) {
    if (gatewayCheckInFlight) return gatewayCheckInFlight;
    const silent = Boolean(options.silent);
    const input = document.getElementById('settings-gateway-local');
    const typed = input ? input.value.trim() : '';
    gatewayCheckInFlight = (async () => {
      if (!silent) setGatewayStatus('checking', 'Checking the OpenClaw gateway...', typed || gatewayBaseUrl('local'));

      try {
        const query = typed ? `?url=${encodeURIComponent(typed)}` : '';
        const response = await fetch(`/api/gateway/status${query}`, { credentials: 'same-origin' });
        if (response.status === 401) {
          setGatewayStatus('checking', 'Unlock the Dropbox to check the gateway.', typed || gatewayBaseUrl('local'));
          renderGatewayAgents([], 'Unlock the Dropbox to see the gateway agents.');
          return false;
        }
        if (!response.ok) throw new Error(`status ${response.status}`);
        return applyGatewayStatus(await response.json());
      } catch (error) {
        setGatewayStatus('offline', `Could not ask the server to check the gateway: ${error.message}`, typed || gatewayBaseUrl('local'));
        renderGatewayAgents([], 'The gateway could not be checked.');
      }
      return false;
    })();
    try {
      return await gatewayCheckInFlight;
    } finally {
      gatewayCheckInFlight = null;
    }
  }

  // Gateway links across the app carry data-gateway="local"|"lan". The href in the
  // markup is the default; a URL saved in Settings overrides it. That is the only
  // way to reach a gateway whose LAN address is not the hardcoded one.
  function gatewayUrl(kind) {
    let raw;
    try {
      raw = localStorage.getItem(kind === 'lan' ? GW_LAN_KEY : GW_LOCAL_KEY);
    } catch { return ''; }
    raw = (raw || '').trim();
    if (!raw) return '';
    return /^https?:\/\//i.test(raw) ? raw : 'http://' + raw;
  }

  function applyGatewayLinks(root) {
    (root || document).querySelectorAll('[data-gateway]').forEach(el => {
      // Remember the markup's href once, so clearing the setting restores it.
      if (el.dataset.gatewayDefault === undefined) {
        el.dataset.gatewayDefault = el.getAttribute('href') || '';
      }
      const kind = el.getAttribute('data-gateway');
      const saved = gatewayUrl(kind);
      const cleared = kind === 'local' ? isSettingCleared(GW_LOCAL_KEY) : isSettingCleared(GW_LAN_KEY);
      el.setAttribute('href', saved || (cleared ? '#' : el.dataset.gatewayDefault));
      if (cleared && !saved) el.setAttribute('title', 'Gateway disconnected in Settings');
    });
  }

  async function load() {
    const [local, lan] = await Promise.all([
      getSetting(GW_LOCAL_KEY),
      getSetting(GW_LAN_KEY),
    ]);
    if (local) localStorage.setItem(GW_LOCAL_KEY, local); else localStorage.removeItem(GW_LOCAL_KEY);
    if (lan) localStorage.setItem(GW_LAN_KEY, lan); else localStorage.removeItem(GW_LAN_KEY);
    const inpLocal = document.getElementById('settings-gateway-local');
    const inpLan   = document.getElementById('settings-gateway-lan');
    if (inpLocal) inpLocal.value = local || '';
    if (inpLan)   inpLan.value   = lan   || '';
    applyGatewayLinks();
    const grid = document.getElementById('settings-theme-grid');
    if (grid) renderThemePicker(grid);
    loadGatewayAgents();
    checkGateway();
    loadShortcuts();
    loadVisitors();
  }

  // The phone inbox is configured on the server (SHORTCUTS_TOKEN), so all the
  // Settings page can do is report whether it is on and hand over the URLs to
  // paste into Shortcuts. The token itself is never sent back here.
  async function loadShortcuts() {
    const wrap = document.getElementById('settings-shortcuts');
    if (!wrap) return;

    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    try {
      const response = await fetch('/api/shortcuts/setup', { headers: { Accept: 'application/json' } });
      if (response.status === 401) {
        set('settings-shortcuts-state', 'Unlock the Dropbox first, then reload this page.');
        return;
      }
      const setup = await response.json();
      if (!response.ok) {
        set('settings-shortcuts-state', setup.error || 'Could not read the phone inbox settings.');
        return;
      }

      set('settings-shortcuts-state', setup.configured
        ? 'On. Use the header below as the token on your phone.'
        : setup.token_present
          ? `Off — SHORTCUTS_TOKEN is shorter than ${setup.min_token_length} characters.`
          : 'Off — set SHORTCUTS_TOKEN on the server to a long random string.');
      set('settings-shortcuts-send', setup.send_url);
      set('settings-shortcuts-pull', setup.pull_text_url);
      set('settings-shortcuts-header', setup.header);
    } catch {
      set('settings-shortcuts-state', 'Could not reach the server.');
    }
  }

  // Website visitors. Settings shows the shape of it - is anyone there, which
  // sites are reporting in, how to add one, and the button that deletes the
  // lot. The reading is on /visitors.html; this is the control panel for it.
  function trackerSnippet() {
    return `<script src="${location.origin}/visit-tracker.js" defer><\/script>`;
  }

  async function loadVisitors() {
    const wrap = document.getElementById('settings-visitors');
    if (!wrap) return;

    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    set('settings-visitors-snippet', trackerSnippet());

    try {
      const response = await fetch('/api/visits/summary?days=7', { headers: { Accept: 'application/json' } });
      if (response.status === 401) {
        set('settings-visitors-state', 'Unlock the Dropbox first, then reload this page.');
        set('settings-visitors-snapshot', '');
        set('settings-visitors-sites', '—');
        return;
      }

      const summary = await response.json();
      if (!response.ok) {
        set('settings-visitors-state', summary.error || 'Could not read the visitor stats.');
        return;
      }

      const totals = summary.totals || {};
      const sites = summary.all_sites || [];

      set('settings-visitors-state', totals.live
        ? `${totals.live} ${totals.live === 1 ? 'person is' : 'people are'} on your sites right now.`
        : sites.length
          ? 'Nobody on the sites right now.'
          : 'No visits recorded yet — paste the snippet below on a site to start.');

      set('settings-visitors-snapshot', totals.pageviews
        ? `Last 7 days: ${totals.visitors} visitors · ${totals.pageviews} page views · ${totals.new} first-time, ${totals.returning} been before.`
        : '');

      set('settings-visitors-sites', sites.length ? sites.join(', ') : 'None yet.');
      set('settings-visitors-retention', `Page views are kept for ${summary.retention_days} days and then deleted automatically.`);
    } catch {
      set('settings-visitors-state', 'Could not reach the server.');
    }
  }

  async function copyTrackerSnippet(btn) {
    try {
      await navigator.clipboard.writeText(trackerSnippet());
      if (btn) {
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = 'Copy snippet'; }, 2000);
      }
    } catch {
      // Clipboard access is refused often enough that this is a real fallback.
      prompt('Copy the tracker snippet:', trackerSnippet());
    }
  }

  async function clearVisits(btn) {
    if (!confirm('Delete every recorded page view from every site? This cannot be undone.')) return;
    try {
      const response = await fetch('/api/visits', { method: 'DELETE' });
      if (response.status === 401) {
        alert('Unlock the Dropbox first, then try again.');
        return;
      }
      if (!response.ok) throw new Error('request failed');
      if (btn) {
        btn.textContent = 'Deleted';
        setTimeout(() => { btn.textContent = 'Delete all'; }, 2000);
      }
      loadVisitors();
    } catch {
      alert('Could not delete the recorded visits.');
    }
  }

  async function saveGateway() {
    const local = (document.getElementById('settings-gateway-local').value || '').trim();
    const lan   = (document.getElementById('settings-gateway-lan').value   || '').trim();
    const [savedLocal, savedLan] = await Promise.all([
      setSetting(GW_LOCAL_KEY, local),
      setSetting(GW_LAN_KEY, lan),
    ]);
    applyGatewayLinks();
    checkGateway();
    const msg = document.getElementById('settings-gateway-msg');
    if (msg) {
      msg.textContent = savedLocal && savedLan ? 'Saved.' : (!local && !lan ? 'Cleared for this browser.' : 'Saved locally.');
      msg.hidden = false;
      setTimeout(() => { msg.hidden = true; }, 2000);
    }
  }

  function clearKey(key, btn) {
    if (!confirm('Clear "' + key + '" from localStorage?')) return;
    localStorage.removeItem(key);
    if (btn) { btn.textContent = 'Cleared'; btn.disabled = true; setTimeout(() => { btn.textContent = 'Clear'; btn.disabled = false; }, 2000); }
  }

  function clearAll() {
    if (!confirm('Wipe ALL local data for Agent Office? This cannot be undone.')) return;
    localStorage.clear();
    location.reload();
  }

  return {
    load, saveGateway, clearKey, clearAll, applyTheme, loadShortcuts, applyGatewayLinks, checkGateway,
    loadVisitors, copyTrackerSnippet, clearVisits,
  };
})();

// Apply saved theme immediately so there's no flash on load
(function() { const t = localStorage.getItem('ao-theme'); if (t && window.SETTINGS) window.SETTINGS.applyTheme(t); })();

// Keep the office signal tied to the local OpenClaw gateway, even when the
// Settings page is not open.
(function startGatewayHeartbeat() {
  if (!window.SETTINGS || typeof window.SETTINGS.checkGateway !== 'function') return;
  const run = () => window.SETTINGS.checkGateway({ silent: true }).catch(() => {});
  window.addEventListener('load', run, { once: true });
  setInterval(run, 15000);
})();

let currentView = 'office';

function switchView(view, navEl) {
  closeMobileNav();
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  // Pages call this with document.querySelector('.nav-item.active'), which is
  // null now that the sidebar no longer hand-marks its own row — so fall back
  // to working the highlight out from the URL.
  if (navEl) navEl.classList.add('active');
  else markActiveNav();
  const handler = VIEW_HANDLERS[view];
  if (handler && typeof handler.enter === 'function') handler.enter();
  currentView = view;
}

// ─── INIT ─────────────────────────────────────────────────────
if (document.getElementById('officesvg')) {
  window.addEventListener('resize', () => {
    officeHasAutoCentered = false;
    resizeCanvas();
    renderAgents();
    centerOfficeView(true);
  });
  resizeCanvas();
  // Rebuilds the room only when a saved size differs from the one the build
  // step baked in; otherwise it just records the layout's minimum size so the
  // build panel's steppers know where to stop.
  if (!rebuildRoomIfResized()) renderAgents();
}
centerOfficeView(true);
renderStatusBar();

// Kick off loops (demo tick disabled — real activity only)
let tickInterval = null;
function startTickLoop() {
  if (!tickInterval) tickInterval = setInterval(tick, 3500);
}
function stopTickLoop() {
  if (!tickInterval) return;
  clearInterval(tickInterval);
  tickInterval = null;
}

window.AOResets = (() => {
  const STORAGE_KEY = 'agent-office-per-card-countdowns-v2';
  let initialized = false;
  let intervalId = null;
  let newResetAt = '';
  let pickerDate = new Date();
  let selectedPickerDate = new Date();
  let cards = [];

  function tomorrowAt(hour = 9) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  }

  function nextWeekAt(hour = 9) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  }

  function nextShareBotCycle() {
    const now = new Date();
    const d = new Date();
    d.setHours(8, 0, 0, 0);
    const base = new Date(2026, 7, 9, 8, 0, 0, 0);
    while (d < now || ((d - base) / 86400000) % 2 !== 0) {
      d.setDate(d.getDate() + 1);
      d.setHours(8, 0, 0, 0);
    }
    return d;
  }

  function offsetIso(date, minutes) {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() + minutes);
    return d.toISOString();
  }

  function daysFromNowIso(days, hour = 9) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    return d.toISOString();
  }

  function codexUsageResetIso() {
    return new Date(2026, 7, 15, 13, 28, 0, 0).toISOString();
  }

  function claudeUsageResetIso() {
    return new Date(2026, 7, 14, 14, 59, 0, 0).toISOString();
  }

  function randomId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'reset-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }

  function loadCards() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return ensureDefaultCards(parsed);
      } catch (err) {}
    }
    return ensureDefaultCards([
      {
        id: randomId(),
        title: 'Claude Code Usage Reset',
        resetAt: nextWeekAt(9),
        webhookUrl: '',
        fired: false,
        message: 'Example: resets next week.'
      },
      {
        id: randomId(),
        title: 'Codex Usage Reset',
        resetAt: tomorrowAt(9),
        webhookUrl: '',
        fired: false,
        message: 'Example: resets tomorrow.'
      }
    ]);
  }

  function ensureShareBotCards(inputCards) {
    const nextCycle = nextShareBotCycle();
    const shareBotCards = [
      {
        id: 'sharebot-report-crypto-economics',
        title: 'ShareBot Report 1 - Crypto, Stocks, Economics',
        resetAt: nextCycle.toISOString(),
        webhookUrl: '',
        fired: false,
        message: 'Starts at the next 8:00 AM PDT ShareBot cycle.'
      },
      {
        id: 'sharebot-report-geopolitics',
        title: 'ShareBot Report 2 - Geopolitics',
        resetAt: offsetIso(nextCycle, 20),
        webhookUrl: '',
        fired: false,
        message: 'Estimated start after Report 1 posts.'
      },
      {
        id: 'sharebot-report-cycle-complete',
        title: 'ShareBot Full Cycle - Estimated Complete',
        resetAt: offsetIso(nextCycle, 40),
        webhookUrl: '',
        fired: false,
        message: 'Estimated completion window for both reports.'
      }
    ];
    const cardsById = new Map((inputCards || []).map(card => [card.id, card]));
    shareBotCards.slice().reverse().forEach(card => {
      const existing = cardsById.get(card.id);
      if (existing) {
        existing.title = card.title;
        existing.resetAt = card.resetAt;
        existing.message = card.message;
        existing.fired = false;
      } else {
        inputCards.unshift(card);
      }
    });
    return inputCards;
  }

  function ensurePersonalRoutineCards(inputCards) {
    const routineCards = [
      {
        id: 'routine-beard-mustache-face-7d',
        title: 'Trim Beard + Mustache + Face',
        resetAt: daysFromNowIso(7),
        webhookUrl: '',
        fired: false,
        message: 'Repeats every 7 days.'
      },
      {
        id: 'routine-haircut-14d',
        title: 'Haircut',
        resetAt: daysFromNowIso(14),
        webhookUrl: '',
        fired: false,
        message: 'Repeats every 2 weeks.'
      },
      {
        id: 'routine-bedsheets-carpet-14d',
        title: 'Clean Bedsheets + Carpet',
        resetAt: daysFromNowIso(14),
        webhookUrl: '',
        fired: false,
        message: 'Repeats every 2 weeks.'
      }
    ];
    const cardsById = new Map((inputCards || []).map(card => [card.id, card]));
    routineCards.slice().reverse().forEach(card => {
      const existing = cardsById.get(card.id);
      if (existing) {
        existing.title = card.title;
        existing.message = card.message;
        if (!existing.resetAt || new Date(existing.resetAt).getTime() <= Date.now()) {
          existing.resetAt = card.resetAt;
          existing.fired = false;
        }
      } else {
        inputCards.unshift(card);
      }
    });
    return inputCards;
  }

  function ensureCodexUsageResetCard(inputCards) {
    const card = {
      id: 'codex-usage-reset-2026-08-15-1328',
      title: 'Codex Usage Reset',
      resetAt: codexUsageResetIso(),
      webhookUrl: '',
      fired: false,
      message: 'Resets Aug 15, 2026 at 1:28 PM.'
    };
    const existing = inputCards.find(item => item.id === card.id);
    if (existing) {
      existing.title = card.title;
      existing.resetAt = card.resetAt;
      existing.message = card.message;
      existing.fired = false;
    } else {
      inputCards.unshift(card);
    }
    return inputCards;
  }

  function ensureClaudeUsageResetCard(inputCards) {
    const card = {
      id: 'claude-usage-reset-2026-08-14-1459',
      title: 'Claude Usage Reset',
      resetAt: claudeUsageResetIso(),
      webhookUrl: '',
      fired: false,
      message: 'Resets Friday, Aug 14, 2026 at 2:59 PM.'
    };
    const existing = inputCards.find(item => item.id === card.id);
    if (existing) {
      existing.title = card.title;
      existing.resetAt = card.resetAt;
      existing.message = card.message;
      existing.fired = false;
    } else {
      inputCards.unshift(card);
    }
    return inputCards;
  }

  function ensureDefaultCards(inputCards) {
    return ensureClaudeUsageResetCard(ensureCodexUsageResetCard(ensurePersonalRoutineCards(ensureShareBotCards(inputCards))));
  }

  function saveCards() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatLocalInput(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fromLocalInput(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }

  function remaining(resetAt) {
    const target = new Date(resetAt).getTime();
    const diff = Math.max(0, target - Date.now());
    return {
      total: diff,
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000)
    };
  }

  function render() {
    const wrap = document.getElementById('reset-cards');
    if (!wrap) return;
    wrap.innerHTML = '';

    cards.forEach(card => {
      const r = remaining(card.resetAt);
      const reached = r.total <= 0;
      const el = document.createElement('section');
      el.className = 'reset-card';
      el.innerHTML = `
        <div class="reset-card-head">
          <div>
            <div class="reset-card-title">${escapeHtml(card.title)}</div>
            <div class="reset-card-time">Target: ${new Date(card.resetAt).toLocaleString()}</div>
          </div>
          <div class="reset-chip">${reached ? 'Reset window reached' : 'Counting down'}</div>
        </div>
        <div class="reset-timer">
          <div class="reset-unit"><div class="reset-num">${r.days}</div><div class="reset-label">Days</div></div>
          <div class="reset-unit"><div class="reset-num">${r.hours}</div><div class="reset-label">Hours</div></div>
          <div class="reset-unit"><div class="reset-num">${r.minutes}</div><div class="reset-label">Mins</div></div>
          <div class="reset-unit"><div class="reset-num">${r.seconds}</div><div class="reset-label">Secs</div></div>
        </div>
        <input class="resets-input" value="${escapeHtml(card.title)}" onchange="AOResets.updateCard('${card.id}', 'title', this.value)" />
        <input class="resets-input" type="datetime-local" value="${formatLocalInput(card.resetAt)}" onchange="AOResets.updateCard('${card.id}', 'resetAt', AOResets.fromLocalInput(this.value))" />
        <input class="resets-input" placeholder="Paste this card's Pushcut webhook URL" value="${escapeHtml(card.webhookUrl || '')}" onchange="AOResets.updateCard('${card.id}', 'webhookUrl', this.value)" />
        <div class="reset-row">
          <button type="button" class="resets-btn" onclick="AOResets.testWebhook('${card.id}')">Test Pushcut</button>
          <button type="button" class="resets-btn" onclick="AOResets.clearWebhook('${card.id}')">Clear Webhook</button>
          <button type="button" class="resets-btn danger" onclick="AOResets.deleteCard('${card.id}')">Delete</button>
        </div>
        <div class="reset-message">${escapeHtml(card.message || '')}</div>
      `;
      wrap.appendChild(el);
      if (reached && !card.fired && card.webhookUrl) fireWebhook(card.id, true);
    });
  }

  function init() {
    if (!initialized) {
      cards = loadCards();
      setupTimeSelects();
      initialized = true;
    }
    render();
    if (!intervalId) intervalId = setInterval(render, 1000);
  }

  function setupTimeSelects() {
    const hour = document.getElementById('reset-picker-hour');
    const minute = document.getElementById('reset-picker-minute');
    if (!hour || !minute || hour.options.length) return;
    for (let h = 0; h < 24; h++) {
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = String(h).padStart(2, '0') + ':00';
      hour.appendChild(opt);
    }
    for (let m = 0; m < 60; m += 5) {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = String(m).padStart(2, '0');
      minute.appendChild(opt);
    }
  }

  function tomorrowAtDate(hour = 9) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(hour, 0, 0, 0);
    return d;
  }

  function openNewPicker() {
    init();
    const base = newResetAt ? new Date(newResetAt) : tomorrowAtDate(9);
    pickerDate = new Date(base);
    selectedPickerDate = new Date(base);
    document.getElementById('reset-picker-hour').value = selectedPickerDate.getHours();
    document.getElementById('reset-picker-minute').value = Math.round(selectedPickerDate.getMinutes() / 5) * 5;
    renderCalendar();
    document.getElementById('reset-date-picker-modal').classList.add('open');
  }

  function closePicker() {
    const modal = document.getElementById('reset-date-picker-modal');
    if (modal) modal.classList.remove('open');
  }

  function changePickerMonth(direction) {
    pickerDate.setMonth(pickerDate.getMonth() + direction);
    renderCalendar();
  }

  function renderCalendar() {
    const grid = document.getElementById('reset-calendar-grid');
    const label = document.getElementById('reset-picker-month-label');
    if (!grid || !label) return;
    grid.innerHTML = '';
    const month = pickerDate.getMonth();
    const year = pickerDate.getFullYear();
    label.textContent = pickerDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
      const div = document.createElement('div');
      div.className = 'reset-day-name';
      div.textContent = day;
      grid.appendChild(div);
    });
    const startDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < startDay; i++) {
      const blank = document.createElement('button');
      blank.type = 'button';
      blank.className = 'resets-btn reset-day-btn blank';
      blank.textContent = '.';
      grid.appendChild(blank);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const btn = document.createElement('button');
      const thisDate = new Date(year, month, day);
      btn.type = 'button';
      btn.className = 'resets-btn reset-day-btn';
      btn.textContent = day;
      if (
        selectedPickerDate &&
        thisDate.getFullYear() === selectedPickerDate.getFullYear() &&
        thisDate.getMonth() === selectedPickerDate.getMonth() &&
        thisDate.getDate() === selectedPickerDate.getDate()
      ) {
        btn.classList.add('selected');
      }
      btn.onclick = () => {
        selectedPickerDate = new Date(year, month, day);
        renderCalendar();
      };
      grid.appendChild(btn);
    }
  }

  function applyPicker() {
    const hour = Number(document.getElementById('reset-picker-hour').value);
    const minute = Number(document.getElementById('reset-picker-minute').value);
    selectedPickerDate.setHours(hour, minute, 0, 0);
    newResetAt = selectedPickerDate.toISOString();
    document.getElementById('reset-new-time-label').textContent = selectedPickerDate.toLocaleString();
    closePicker();
  }

  function addCard() {
    init();
    const titleInput = document.getElementById('reset-new-title');
    const title = titleInput.value.trim() || 'Custom API Reset';
    cards.push({
      id: randomId(),
      title,
      resetAt: newResetAt || tomorrowAt(9),
      webhookUrl: '',
      fired: false,
      message: 'New countdown added.'
    });
    titleInput.value = '';
    newResetAt = '';
    document.getElementById('reset-new-time-label').textContent = 'No time selected';
    saveCards();
    render();
  }

  function updateCard(id, key, value) {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    card[key] = value;
    if (key === 'resetAt') {
      card.fired = false;
      card.message = 'Reset time updated. Webhook firing re-armed.';
    } else if (key === 'webhookUrl') {
      card.message = value ? 'Webhook URL saved locally.' : 'Webhook URL removed.';
    } else {
      card.message = 'Card updated.';
    }
    saveCards();
    render();
  }

  function deleteCard(id) {
    cards = cards.filter(c => c.id !== id);
    saveCards();
    render();
  }

  function clearWebhook(id) {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    card.webhookUrl = '';
    card.message = 'Webhook cleared.';
    saveCards();
    render();
  }

  async function testWebhook(id) {
    await fireWebhook(id, false);
  }

  async function fireWebhook(id, auto) {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    if (!card.webhookUrl) {
      card.message = 'No Pushcut webhook URL set for this card.';
      saveCards();
      render();
      return;
    }
    try {
      card.message = auto ? 'Reset reached - firing webhook...' : 'Testing webhook...';
      saveCards();
      await fetch(card.webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({
          title: card.title,
          resetAt: card.resetAt,
          event: auto ? 'countdown_reached_zero' : 'manual_test'
        })
      });
      card.fired = auto ? true : card.fired;
      card.message = auto ? 'Webhook fired when countdown reached zero.' : 'Webhook test sent.';
    } catch (err) {
      card.message = 'Webhook failed. Check the URL or browser/network permissions.';
    }
    saveCards();
    render();
  }

  return {
    init,
    openNewPicker,
    closePicker,
    changePickerMonth,
    applyPicker,
    addCard,
    updateCard,
    deleteCard,
    clearWebhook,
    testWebhook,
    fromLocalInput
  };
})();

const AGENT_DESCRIPTIONS = Object.fromEntries(
  AGENTS.map(agent => [agent.id, {
    name: agent.name,
    role: agent.role,
    model: agent.model,
    memory: agent.memory,
    desc: agent.desc,
    workspace: agent.workspace,
    repo: agent.repo,
    authority: agent.authority,
  }])
);

// The agent-info panel this fills lives in the old monolithic
// agent-office.html and was never carried into the split pages, so on the Org
// Chart every card click threw on the first missing element. Bail out when
// there is no panel to fill: a click is a no-op rather than an exception.
function showAgentInfo(id) {
  closeMobileNav();
  const info = AGENT_DESCRIPTIONS[id];
  if (!info) return;
  const panel = document.getElementById('agent-info-panel');
  if (!panel) return;

  const setText = (elId, value) => {
    const el = document.getElementById(elId);
    if (el) el.textContent = value;
  };
  setText('agent-info-name', info.name);
  setText('agent-info-role', info.role);
  setText('agent-info-model', '\u26a1 ' + (info.model || ''));
  setText('agent-info-desc', info.desc);

  const memEl = document.getElementById('agent-info-memory');
  if (memEl) {
    memEl.innerHTML = info.memory
      ? '<span class="agent-info-mem is-on">\u25cf</span> Memory enabled'
      : '<span class="agent-info-mem">\u25cb</span> No memory (stateless)';
  }

  panel.hidden = false;
  const nav = document.querySelector('.nav');
  if (nav) nav.scrollTop = 99999;
}


function renderOrgChart() {
  const orgView = document.getElementById('view-org');
  if (!orgView) return;
  const command = AGENTS.find(agent => agent.authority === 'command') || AGENTS[0];
  const specialists = AGENTS.filter(agent => agent.id !== command.id);
  const memoryBadge = agent => agent.memory
    ? '<span class="org-tag org-tag-green">Memory</span>'
    : '<span class="org-tag">Stateless</span>';
  const orgCard = (agent, wide = false) => `
    <div class="org-card org-card--striped ${wide ? 'org-card-wide glow-indigo' : 'glow-blue'}" onclick="showAgentInfo('${agent.id}')" style="--entity-color:${agent.color};">
      <div class="org-card-inner">
        <div class="org-avatar">${agent.emoji}</div>
        <div class="org-body">
          <div class="org-name">${escHTML(agent.name)}</div>
          <div class="org-title">${escHTML(agent.role)} \u00b7 ${escHTML(agent.model)}</div>
          <div class="org-desc">${escHTML(agent.desc || '')}</div>
          <div class="org-tags">
            <span class="org-tag org-tag-indigo">${escHTML(agent.authority || 'agent')}</span>
            ${memoryBadge(agent)}
            <span class="org-tag org-tag-blue">${escHTML(agent.workspace || 'workspace')}</span>
          </div>
        </div>
      </div>
      <div class="org-cta">VIEW AGENT \u2192</div>
    </div>`;
  orgView.innerHTML = `
    <div class="org-page">
      <div class="org-section-label"><div class="line"></div><div class="text">OPENCLAW COMMAND</div><div class="line"></div></div>
      <div class="org-row-center">${orgCard(command, true)}</div>
      <div class="org-connector-v"></div><div class="org-connector-fork"></div>
      <div class="org-section-label"><div class="line"></div><div class="text">SPECIALIST AGENTS</div><div class="line"></div></div>
      <div class="org-row-2 org-row-2--wide">${specialists.map(agent => orgCard(agent)).join('')}</div>
      <div class="org-flow-divider"><div class="line"></div><div class="org-flow-label">shared registry feeds office, chart, and memory</div><div class="line"></div></div>
      <div class="org-section-label"><div class="line"></div><div class="text">MEMORY LINKS</div><div class="line"></div></div>
      <div class="org-row-3">
        ${AGENTS.map(agent => `
          <div class="org-card org-card--striped" onclick="window.location.href='/memory.html'" style="--entity-color:${agent.color};">
            <div class="org-card-inner">
              <div class="org-avatar">${agent.emoji}</div>
              <div class="org-body">
                <div class="org-name">${escHTML(agent.name)}</div>
                <div class="org-title">${agent.memory ? 'Memory bank enabled' : 'No durable memory'}</div>
                <div class="org-desc">${escHTML(agent.repo || agent.workspace || 'OpenClaw agent')}</div>
                <div class="org-tags">${memoryBadge(agent)}<span class="org-tag org-tag-teal">${escHTML(agent.id)}</span></div>
              </div>
            </div>
            <div class="org-cta">OPEN MEMORY ?</div>
          </div>`).join('')}
      </div>
    </div>`;
}


function getNavState() {
  try { return JSON.parse(localStorage.getItem('nav-collapsed-state')) || {}; } catch { return {}; }
}
function saveNavState(state) { localStorage.setItem('nav-collapsed-state', JSON.stringify(state)); }

function toggleNav(labelEl) {
  const wrap = labelEl.nextElementSibling;
  if (!wrap) return;
  const section = labelEl.textContent.trim().replace(/\s*▾$/, '');
  const isOpen = wrap.style.maxHeight && wrap.style.maxHeight !== '0px';
  const state = getNavState();
  if (isOpen) {
    wrap.style.maxHeight = wrap.scrollHeight + 'px';
    requestAnimationFrame(() => { wrap.style.maxHeight = '0px'; });
    labelEl.classList.add('collapsed');
    state[section] = true;
  } else {
    wrap.style.maxHeight = wrap.scrollHeight + 'px';
    wrap.addEventListener('transitionend', () => { if (!labelEl.classList.contains('collapsed')) wrap.style.maxHeight = 'none'; }, { once: true });
    labelEl.classList.remove('collapsed');
    state[section] = false;
  }
  saveNavState(state);
}

// Sub-menus nested under a nav item (Office → Memory, Org Chart, …).
// The row itself stays a link; only the chevron opens and closes the sub-menu.
function setNavSubOpen(parentEl, open, animate) {
  const sub = parentEl.parentElement && parentEl.parentElement.querySelector('.nav-sub');
  if (!sub) return;
  const chevron = parentEl.querySelector('.nav-sub-chevron');
  parentEl.classList.toggle('collapsed', !open);
  if (chevron) chevron.setAttribute('aria-expanded', String(open));
  if (!animate) {
    sub.style.maxHeight = open ? 'none' : '0px';
    return;
  }
  if (open) {
    sub.style.maxHeight = sub.scrollHeight + 'px';
    sub.addEventListener('transitionend', () => {
      if (!parentEl.classList.contains('collapsed')) sub.style.maxHeight = 'none';
    }, { once: true });
  } else {
    sub.style.maxHeight = sub.scrollHeight + 'px';
    requestAnimationFrame(() => { sub.style.maxHeight = '0px'; });
  }
}

function toggleNavSub(e, chevronEl) {
  if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
  // Don't follow the parent link, and don't let the mobile nav close on us.
  e.preventDefault();
  e.stopPropagation();
  const parentEl = chevronEl.closest('.nav-item-parent');
  if (!parentEl) return;
  const open = parentEl.classList.contains('collapsed');
  setNavSubOpen(parentEl, open, true);
  const state = getNavState();
  state['sub:' + (parentEl.dataset.navSub || 'nav')] = !open;
  saveNavState(state);
}

// Which nav row is highlighted is read off the URL rather than written into
// each page's markup. The sidebar is copied into thirteen pages; when every
// copy also had to hand-mark its own row, the copies drifted (index.html and
// memory.html disagreed on both the label and the order of the Office
// sub-menu). Now the markup is identical everywhere and this decides.
function navItemPath(href) {
  const url = new URL(href, location.origin);
  return { path: url.pathname === '/index.html' ? '/' : url.pathname, params: url.searchParams };
}

function markActiveNav() {
  const here = location.pathname === '/index.html' ? '/' : location.pathname;
  const isIosView = new URLSearchParams(location.search).get('view') === 'ios';

  document.querySelectorAll('.nav .nav-item').forEach(item => {
    const href = item.getAttribute('href');
    // Rows that leave the app (AI Portal, My Websites) are never "where you
    // are", and neither are the pure-button rows.
    if (!href || /^https?:/i.test(href)) { item.classList.remove('active'); return; }

    const target = navItemPath(href);
    let active = target.path === here;
    // Dropbox and Reminders are the same page told apart by ?view=ios.
    if (active && target.path === '/mission-board.html') {
      active = (target.params.get('view') === 'ios') === isIosView;
    }
    item.classList.toggle('active', active);
  });
}

// ─── SIDEBAR COMPACT RAIL ─────────────────────────────────────
// Collapsing to icons is a preference, so it is restored before first paint by
// the inline script in each page's <head>; this only keeps the two in step.
const NAV_COMPACT_KEY = 'ao-nav-compact';

function navCompactPreferred() {
  try { return localStorage.getItem(NAV_COMPACT_KEY) === '1'; } catch { return false; }
}

function applyNavCompact(compact) {
  document.documentElement.classList.toggle('nav-compact', compact);
  const btn = document.getElementById('nav-collapse-btn');
  if (btn) {
    btn.setAttribute('aria-expanded', String(!compact));
    btn.title = compact ? 'Expand sidebar' : 'Collapse sidebar';
    const label = btn.querySelector('.nav-collapse-label');
    if (label) label.textContent = compact ? 'Expand' : 'Collapse';
  }
  const nav = document.querySelector('.nav');
  if (nav) nav.setAttribute('aria-label', compact ? 'Primary (compact)' : 'Primary');
  // In the rail the label is gone, so the row's own tooltip is the only thing
  // naming it.
  document.querySelectorAll('.nav .nav-item, .nav .nav-link').forEach(item => {
    if (!item.dataset.navTitle) {
      const text = (item.querySelector('.nav-item-label') || item).textContent.trim();
      if (text) item.dataset.navTitle = text;
    }
    if (compact && item.dataset.navTitle) item.setAttribute('title', item.dataset.navTitle);
    else if (item.dataset.navTitle) item.removeAttribute('title');
  });
}

function toggleNavCompact() {
  const compact = !document.documentElement.classList.contains('nav-compact');
  try { localStorage.setItem(NAV_COMPACT_KEY, compact ? '1' : '0'); } catch {}
  applyNavCompact(compact);
  // The office is sized to its column, so it has to be re-measured.
  if (typeof officeHasAutoCentered !== 'undefined' && document.getElementById('officesvg')) {
    setTimeout(() => { resizeCanvas(); renderAgents(); }, 260);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  markActiveNav();
  applyNavCompact(navCompactPreferred());
  if (document.getElementById('ops-summary')) {
    renderOpsSummary();
    refreshOpsQueue();
    // The board changes from a phone or a Shortcut, not just from here.
    setInterval(refreshOpsQueue, 120000);
  }
  const state = getNavState();
  document.querySelectorAll('.nav-item-parent').forEach(parentEl => {
    const sub = parentEl.parentElement && parentEl.parentElement.querySelector('.nav-sub');
    if (!sub) return;
    // Open by default; always reveal the page you're on, otherwise honour the saved choice.
    const hasActiveChild = !!sub.querySelector('.nav-item.active');
    const open = hasActiveChild || state['sub:' + (parentEl.dataset.navSub || 'nav')] !== true;
    setNavSubOpen(parentEl, open, false);
  });
  document.querySelectorAll('.nav-label').forEach(labelEl => {
    const wrap = labelEl.nextElementSibling;
    if (!wrap || !wrap.classList.contains('nav-items-wrap')) return;
    const section = labelEl.textContent.trim().replace(/\s*▾$/, '');
    const collapsed = state[section] !== false;
    if (collapsed) {
      wrap.style.maxHeight = '0px';
      labelEl.classList.add('collapsed');
    } else {
      wrap.style.maxHeight = 'none';
      labelEl.classList.remove('collapsed');
    }
  });
  if (window.SETTINGS) window.SETTINGS.applyGatewayLinks();
  const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (!isLocalHost) {
    document.querySelectorAll('[data-dev-only="true"]').forEach(el => el.remove());
  }
});

// ─── PANEL COLLAPSE ───────────────────────────────────────────────────────────
let feedPanelOpen = false;

// Both toggles used to paint their own colours inline, which is why the "on"
// accent was a hardcoded indigo that ignored the chosen theme. The state is a
// class now and shared.css owns what it looks like.
function setToggleButton(id, on) {
  const btn = document.getElementById(id);
  if (!btn) return null;
  btn.classList.toggle('is-on', on);
  btn.setAttribute('aria-pressed', String(on));
  return btn;
}

function toggleFeedPanel() {
  feedPanelOpen = !feedPanelOpen;
  document.querySelector('.layout').classList.toggle('feed-collapsed', !feedPanelOpen);
  setToggleButton('feed-toggle-btn', feedPanelOpen);
}

let focusMode = false;

function setFocusMode(enabled) {
  focusMode = enabled;
  const layout = document.querySelector('.layout');
  layout.classList.toggle('nav-collapsed', focusMode);
  layout.classList.toggle('feed-collapsed', focusMode || !feedPanelOpen);
  setToggleButton('focus-btn', focusMode);
}

// ─── MOBILE NAV ───────────────────────────────────────────────────────────────
function updateFocusButtonLabel() {
  const btn = document.getElementById('focus-btn');
  if (!btn) return;
  btn.textContent = focusMode ? '⛶ Exit Focus' : '⛶ Focus';
}

const _baseSetFocusMode = setFocusMode;
setFocusMode = function(enabled) {
  _baseSetFocusMode(enabled);
  updateFocusButtonLabel();
};

document.addEventListener('DOMContentLoaded', updateFocusButtonLabel);

function toggleFocusMode() {
  setFocusMode(!focusMode);
}

function setMobileNavOpen(open) {
  const nav = document.querySelector('.nav');
  const overlay = document.getElementById('mobile-overlay');
  if (nav) nav.classList.toggle('mobile-open', open);
  if (overlay) overlay.classList.toggle('is-open', open);
  const toggle = document.querySelector('.mobile-nav-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', String(open));
}

function toggleMobileNav() {
  const nav = document.querySelector('.nav');
  setMobileNavOpen(!(nav && nav.classList.contains('mobile-open')));
  // Other sections are always-visible headings; the My Websites & Projects dropdown keeps its own state.
}
function closeMobileNav() {
  setMobileNavOpen(false);
}
// Close nav when a nav-item is tapped on mobile
document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', () => {
    if (window.innerWidth <= 768) closeMobileNav();
  });
});

// ─── DROPBOX ─────────────────────────────────────────────────────────────────
const DROPS_API = '/api/drops';
const DROPS_SESSION_API = '/api/session';
let _dropsCache = null;
let dropsAuthState = { configured: false, authenticated: false, checked: false };

async function requestJson(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch (e) { data = null; }
  if (!response.ok) {
    const err = new Error((data && data.error) || `Request failed (${response.status})`);
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function refreshDropboxAuthState() {
  try {
    const status = await requestJson(DROPS_SESSION_API);
    dropsAuthState = { ...status, checked: true };
  } catch (error) {
    dropsAuthState = { configured: false, authenticated: false, checked: true };
    throw error;
  }
  return dropsAuthState;
}

function showPassphraseModal() {
  return new Promise((resolve) => {
    const modal = document.getElementById('passphrase-modal');
    const input = document.getElementById('passphrase-input');
    const errorEl = document.getElementById('passphrase-error');
    const submitBtn = document.getElementById('passphrase-submit');
    const cancelBtn = document.getElementById('passphrase-cancel');

    errorEl.hidden = true;
    errorEl.textContent = '';
    input.value = '';
    modal.hidden = false;
    setTimeout(() => input.focus(), 100);

    function cleanup() {
      modal.hidden = true;
      submitBtn.removeEventListener('click', onSubmit);
      cancelBtn.removeEventListener('click', onCancel);
      input.removeEventListener('keydown', onKeydown);
    }
    function onSubmit() {
      const val = input.value;
      if (!val) { input.focus(); return; }
      cleanup();
      resolve(val);
    }
    function onCancel() { cleanup(); resolve(null); }
    function onKeydown(e) {
      if (e.key === 'Enter') onSubmit();
      if (e.key === 'Escape') onCancel();
    }

    submitBtn.addEventListener('click', onSubmit);
    cancelBtn.addEventListener('click', onCancel);
    input.addEventListener('keydown', onKeydown);
  });
}

function showPassphraseError(message) {
  const modal = document.getElementById('passphrase-modal');
  const errorEl = document.getElementById('passphrase-error');
  const input = document.getElementById('passphrase-input');
  errorEl.textContent = message;
  errorEl.hidden = false;
  input.value = '';
  modal.hidden = false;
  setTimeout(() => input.focus(), 100);
}

async function ensureDropsSession(interactive = true) {
  let status;
  try {
    status = dropsAuthState.checked ? dropsAuthState : await refreshDropboxAuthState();
  } catch (error) {
    if (interactive) alert(error.message || 'Could not reach the Dropbox auth endpoint.');
    return false;
  }

  if (!status.configured) {
    if (interactive) alert('Dropbox auth is not configured on the server. Set DROPS_PASSPHRASE_HASH or DROPS_PASSPHRASE.');
    return false;
  }

  if (status.authenticated) return true;
  if (!interactive) return false;

  const passphrase = await showPassphraseModal();
  if (passphrase == null) return false;

  try {
    await requestJson(DROPS_SESSION_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase }),
    });
    dropsAuthState = { configured: true, authenticated: true, checked: true };
    return true;
  } catch (error) {
    showPassphraseError(error.message || 'Incorrect passphrase. Try again.');
    return false;
  }
}

async function toggleDropboxAccess() {
  let status;
  try {
    status = dropsAuthState.checked ? dropsAuthState : await refreshDropboxAuthState();
  } catch (error) {
    alert(error.message || 'Could not reach the Dropbox auth endpoint.');
    return;
  }

  if (status.authenticated) {
    await requestJson(DROPS_SESSION_API, { method: 'DELETE' }).catch(() => null);
    dropsAuthState = { configured: status.configured, authenticated: false, checked: true };
    _dropsCache = null;
    dropboxState.drops = [];
    renderDropbox();
    return;
  }

  if (await ensureDropsSession(true)) {
    const drops = await loadDrops();
    if (drops !== null) { dropboxState.drops = drops; }
    renderDropbox();
  }
}

async function loadDrops() {
  try {
    const drops = await requestJson(DROPS_API);
    _dropsCache = Array.isArray(drops) ? drops : [];
    return _dropsCache;
  } catch (error) {
    if (error.status === 401) {
      dropsAuthState = { ...dropsAuthState, authenticated: false, checked: true };
      return null;
    }
    throw error;
  }
}

function handleDropboxRequestError(error, fallbackMessage) {
  if (error.status === 401) {
    dropsAuthState = { ...dropsAuthState, authenticated: false, checked: true };
    _dropsCache = null;
    dropboxState.drops = [];
    renderDropbox();
    alert('Dropbox session expired. Unlock it again to continue.');
    return;
  }
  alert(error.message || fallbackMessage);
}

// ─── Dropbox state & rendering ───────────────────────────────────────────────

const dropboxState = {
  drops: [],
  selectedId: null,
  view: 'table',
  filters: {
    search: '',
    subject: '',
    status: '',
    priority: '',
    project: '',
    reminder: '',
    sort: 'updated_desc',
  },
};

// ─── Reminders ───────────────────────────────────────────────────────────────
// A drop with a remind_at is something the user put down for later. The server
// parses "tomorrow 9am" into a timestamp (dist/reminder-time.js); the client
// only has to say how far away it is.

function dropReminderInfo(drop, now = Date.now()) {
  if (!drop || !drop.remind_at) return null;
  const at = new Date(drop.remind_at);
  if (Number.isNaN(at.getTime())) return null;

  const delta = at.getTime() - now;
  const abs = Math.abs(delta);
  // Rounded, not floored: something 2h59m away is "in 3h", not "in 2h".
  let span;
  if (abs < 60000) span = 'now';
  else if (abs < 3600000) span = `${Math.round(abs / 60000)}m`;
  else if (abs < 86400000) span = `${Math.round(abs / 3600000)}h`;
  else span = `${Math.round(abs / 86400000)}d`;

  return {
    at,
    due: delta <= 0,
    label: dropFormatShortDate(drop.remind_at),
    relative: span === 'now' ? 'due now' : delta >= 0 ? `in ${span}` : `${span} overdue`,
  };
}

function dropReminderBadge(drop) {
  const reminder = dropReminderInfo(drop);
  if (!reminder) return '';
  return `<span class="dbadge dbadge-remind${reminder.due ? ' dbadge-remind-due' : ''}" title="${escAttr(reminder.at.toLocaleString())}">⏰ ${escHTML(reminder.relative)}</span>`;
}

async function enterDropboxView() {
  if (!await ensureDropsSession(true)) return;
  const drops = await loadDrops();
  if (drops !== null) {
    dropboxState.drops = drops;
    const params = new URLSearchParams(location.search);
    const taskId = params.get('task');
    if (taskId) dropboxState.selectedId = taskId;
    // /mission-board.html?reminder=due is the no-Shortcut way to pull the
    // Dropbox from a phone: bookmark it and it opens on what has come due.
    const reminder = params.get('reminder');
    if (reminder === 'due' || reminder === 'has') {
      dropboxState.filters.reminder = reminder;
      const select = document.getElementById('drop-filter-reminder');
      if (select) select.value = reminder;
    }
    // Reminders is the iOS project lane. A capture URL can still open the
    // phone-friendly reminder form, but the normal view shows the iOS list.
    if (params.get('view') === 'ios') {
      dropboxState.filters.project = 'iOS';
      document.getElementById('dropbox-view')?.classList.add('ios-mode');
    }
    if (params.get('capture') === 'reminder') {
      document.getElementById('dropbox-view')?.classList.add('ios-capture-mode');
      document.getElementById('dropbox-reminder-capture')?.classList.remove('is-collapsed');
      document.getElementById('reminder-content')?.focus();
    }
    renderDropbox();
  }
}

// Shared by both filter implementations (this one and the Mission Board's) so
// "Due now" means the same thing on either view.
function applyReminderFilter(items, reminder) {
  if (reminder === 'due') return items.filter(drop => (dropReminderInfo(drop) || {}).due);
  if (reminder === 'has') return items.filter(drop => Boolean(drop.remind_at));
  return items;
}

function compareReminders(a, b) {
  const left = a.remind_at ? new Date(a.remind_at).getTime() : Infinity;
  const right = b.remind_at ? new Date(b.remind_at).getTime() : Infinity;
  return left - right;
}

function getFilteredDrops() {
  let items = [...dropboxState.drops];
  const { search, subject, status, reminder, sort } = dropboxState.filters;
  const iosMode = Boolean(document.getElementById('dropbox-view')?.classList.contains('ios-mode'));

  if (search) {
    const q = search.toLowerCase();
    items = items.filter(drop =>
      [drop.title, drop.subject, drop.project, drop.content, ...(drop.tags || []), ...(drop.links || [])]
        .join(' ').toLowerCase().includes(q)
    );
  }

  if (subject) items = items.filter(drop => (drop.subject || '') === subject);
  if (status)  items = items.filter(drop => (drop.status  || '') === status);
  items = items.filter(drop => iosMode ? (drop.project || '') === 'iOS' : (drop.project || '') !== 'iOS');
  items = applyReminderFilter(items, reminder);

  items.sort((a, b) => {
    if (sort === 'remind_asc') return compareReminders(a, b);
    if (sort === 'updated_asc') return new Date(a.updated_at) - new Date(b.updated_at);
    if (sort === 'title_asc') return (a.title || '').localeCompare(b.title || '');
    return new Date(b.updated_at) - new Date(a.updated_at);
  });

  return items;
}

function renderDropbox() {
  populateSubjectFilter();
  if (dropboxState.view === 'table') renderDropTable();
  else renderDropCards();
  renderDetailPanel();
}

function populateSubjectFilter() {
  const select = document.getElementById('drop-filter-subject');
  if (!select) return;
  const current = dropboxState.filters.subject;
  const subjects = [...new Set(dropboxState.drops.map(d => d.subject).filter(Boolean))].sort();
  select.innerHTML = '<option value="">All Subjects</option>' +
    subjects.map(s => `<option value="${escAttr(s)}">${escHTML(s)}</option>`).join('');
  const resolved = subjects.includes(current) ? current : '';
  select.value = resolved;
  dropboxState.filters.subject = resolved;
  const subjectEl = document.getElementById('drop-subject');
  if (subjectEl && document.activeElement !== subjectEl) {
    subjectEl.value = resolved;
  }
}

function dropBadge(text, type) {
  if (!text) return '';
  return `<span class="dbadge dbadge-${escAttr(type)}">${escHTML(String(text))}</span>`;
}

function dropFormatDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function dropFormatShortDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

function renderDropTable() {
  const wrap = document.getElementById('dropbox-table-wrap');
  if (!wrap) return;
  const items = getFilteredDrops();
  const iosMode = Boolean(document.getElementById('dropbox-view')?.classList.contains('ios-mode'));

  if (!dropboxState.drops.length) {
    wrap.innerHTML = '<div class="drop-empty"><div class="drop-empty-title">Dropbox is clear.</div><div class="drop-empty-copy">Save your first drop using the form above.</div></div>';
    return;
  }
  if (!items.length) {
    wrap.innerHTML = '<div class="drop-empty"><div class="drop-empty-title">No drops match.</div><div class="drop-empty-copy">Try adjusting the filters.</div></div>';
    return;
  }

  wrap.innerHTML = `
    <table class="dropbox-table">
      <thead><tr>
        ${iosMode ? '<th>Title</th><th>Reminder</th><th>Updated</th>' : '<th>Title</th><th>Subject</th><th>Project</th><th>Tags</th><th>Updated</th>'}
      </tr></thead>
      <tbody>
        ${items.map(drop => `
          <tr data-drop-id="${escAttr(drop.id)}" class="${drop.id === dropboxState.selectedId ? 'selected' : ''}">
            ${iosMode
              ? `<td>${escHTML(drop.title || 'Untitled drop')}</td><td>${dropReminderBadge(drop)}</td><td>${dropFormatDate(drop.updated_at || drop.date)}</td>`
              : `<td>${escHTML(drop.title || 'Untitled drop')}</td><td>${dropBadge(drop.subject, 'subject')}</td><td>${escHTML(drop.project || '-')}</td><td>${(drop.tags || []).slice(0, 3).map(t => dropBadge(t, 'tag')).join(' ')}</td><td>${dropFormatDate(drop.updated_at || drop.date)}</td>`}
          </tr>`).join('')}
      </tbody>
    </table>`;

  wrap.querySelectorAll('tr[data-drop-id]').forEach(row => {
    row.addEventListener('click', () => {
      dropboxState.selectedId = row.dataset.dropId;
      renderDropbox();
    });
  });
}
function renderDropCards() {
  const wrap = document.getElementById('dropbox-cards-wrap');
  if (!wrap) return;
  const items = getFilteredDrops();
  const iosMode = Boolean(document.getElementById('dropbox-view')?.classList.contains('ios-mode'));

  if (!items.length) {
    wrap.innerHTML = '<div class="drop-empty"><div class="drop-empty-title">No drops match.</div><div class="drop-empty-copy">Try adjusting the filters.</div></div>';
    return;
  }

  wrap.innerHTML = items.map(drop => {
    const preview = (drop.content || '').replace(/\s+/g, ' ').trim();
    const hasMeta = drop.status || (!iosMode && drop.subject) || drop.remind_at || (drop.tags || []).length > 0;
    return `
    <article class="drop-card ${drop.id === dropboxState.selectedId ? 'selected' : ''}" data-drop-id="${escAttr(drop.id)}">
      <div class="drop-card-header">
        <h3 class="drop-card-title">${escHTML(drop.title || 'Untitled drop')}</h3>
        <span class="drop-card-date">${dropFormatShortDate(drop.updated_at || drop.date)}</span>
      </div>
      ${preview ? `<p class="drop-card-preview">${escHTML(preview)}</p>` : ''}
      ${hasMeta ? `<div class="drop-card-meta">
        ${dropReminderBadge(drop)}
        ${dropBadge(drop.status, 'status')}
        ${iosMode ? '' : dropBadge(drop.subject, 'subject')}
        ${(drop.tags || []).slice(0, 2).map(t => dropBadge(t, 'tag')).join('')}
      </div>` : ''}
    </article>`;
  }).join('');

  wrap.querySelectorAll('[data-drop-id]').forEach(card => {
    card.addEventListener('click', () => {
      dropboxState.selectedId = card.dataset.dropId;
      renderDropbox();
    });
  });
}

function openNoteView(drop) {
  const view   = document.getElementById('view-dropbox');
  const listEl = document.getElementById('dropbox-view');
  if (!view || !listEl || !drop) return;
  const iosMode = listEl.classList.contains('ios-mode');

  listEl.style.display = 'none';
  document.getElementById('note-view-section')?.remove();

  const backlinks = dropboxState.drops.filter(other =>
    other.id !== drop.id &&
    (other.links || []).some(link => link.toLowerCase() === (drop.title || '').toLowerCase())
  );

  const metaParts = [];
  if (drop.remind_at) metaParts.push(dropReminderBadge(drop));
  if (!iosMode && drop.subject) metaParts.push(dropBadge(drop.subject, 'subject'));
  if (drop.status)  metaParts.push(dropBadge(drop.status, 'status'));
  if (drop.project) metaParts.push(`<span class="drop-meta-project">${escHTML(drop.project)}</span>`);

  const linksHtml = (drop.links || []).length
    ? `<div class="drop-detail-section-label">Links</div><div class="drop-detail-links-list">${drop.links.map(l => `<span class="drop-detail-link-item">${escHTML(l)}</span>`).join('')}</div>`
    : '';
  const backlinksHtml = backlinks.length
    ? `<div class="drop-detail-section-label">Backlinks</div><div class="drop-detail-links-list">${backlinks.map(b => `<span class="drop-detail-link-item">${escHTML(b.title || '')}</span>`).join('')}</div>`
    : '';
  const tagsHtml = (drop.tags || []).length
    ? `<div class="drop-detail-section-label">Tags</div><div class="detail-tags">${drop.tags.map(t => dropBadge(t, 'tag')).join(' ')}</div>`
    : '';

  const section = document.createElement('section');
  section.id = 'note-view-section';
  section.style.cssText = 'width:100%;max-width:720px;margin:0 auto;padding:24px 20px 60px;box-sizing:border-box;';
  section.innerHTML = `
    <div class="drop-detail">
      <button class="drop-detail-back" id="drop-detail-back">← Notes</button>
      <div class="drop-detail-header">
        <h2 class="drop-detail-title">${escHTML(drop.title || 'Untitled drop')}</h2>
        <div class="drop-detail-meta-row">
          <span>${dropFormatDate(drop.updated_at || drop.date)}</span>
          ${metaParts.length ? `<span class="sep">·</span>${metaParts.join('<span class="sep"> </span>')}` : ''}
        </div>
      </div>
      <div class="drop-detail-content">${escHTML(drop.content || '')}</div>
      ${tagsHtml}${linksHtml}${backlinksHtml}
      <div class="detail-actions">
        <button id="toggle-done-btn" class="btn btn-secondary">${drop.done ? 'Restore' : 'Archive'}</button>
        <button id="delete-drop-btn" class="btn btn-danger">Delete</button>
      </div>
    </div>`;

  view.appendChild(section);
  view.scrollTop = 0;

  section.querySelector('#drop-detail-back').addEventListener('click', () => {
    dropboxState.selectedId = null;
    section.remove();
    listEl.style.display = '';
    renderDropbox();
  });

  section.querySelector('#toggle-done-btn').addEventListener('click', async () => {
    try {
      await requestJson(`${DROPS_API}/${drop.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !drop.done }),
      });
      const drops = await loadDrops();
      if (drops !== null) { dropboxState.drops = drops; }
      section.remove();
      listEl.style.display = '';
      renderDropbox();
    } catch (error) {
      handleDropboxRequestError(error, 'Failed to update drop.');
    }
  });

  section.querySelector('#delete-drop-btn').addEventListener('click', async () => {
    if (!confirm('Delete this drop?')) return;
    try {
      await requestJson(`${DROPS_API}/${drop.id}`, { method: 'DELETE' });
      dropboxState.selectedId = null;
      const drops = await loadDrops();
      if (drops !== null) { dropboxState.drops = drops; }
      section.remove();
      listEl.style.display = '';
      renderDropbox();
    } catch (error) {
      handleDropboxRequestError(error, 'Failed to delete drop.');
    }
  });
}

// A note is a page of its own, never a side panel: with one selected the list
// steps aside and the note takes the screen.
function renderDetailPanel() {
  const drop = dropboxState.drops.find(d => d.id === dropboxState.selectedId);
  if (drop) { openNoteView(drop); return; }
  document.getElementById('note-view-section')?.remove();
  const listEl = document.getElementById('dropbox-view');
  if (listEl) listEl.style.display = '';
}

async function saveDrop() {
  if (!await ensureDropsSession(true)) return;

  const payload = {
    title:    document.getElementById('drop-title').value,
    subject:  document.getElementById('drop-subject').value,
    category: document.getElementById('drop-subject').value,
    project:  document.getElementById('drop-project').value,
    agent:    document.getElementById('drop-agent') ? document.getElementById('drop-agent').value : '',
    tags:     document.getElementById('drop-tags').value,
    // Priority is off the Dropbox, but the API still requires one and old
    // drops keep whatever they were saved with.
    priority: 'normal',
    status:   document.getElementById('drop-status').value,
    content:  document.getElementById('drop-content').value,
  };

  try {
    await requestJson(DROPS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    clearDropForm();
    collapseCapture('dropbox-quick-capture', 'is-collapsed');
    const drops = await loadDrops();
    if (drops !== null) { dropboxState.drops = drops; }
    renderDropbox();
  } catch (error) {
    handleDropboxRequestError(error, 'Failed to save drop.');
  }
}

// ─── Reminders capture ─────────────────────────────────────────────────────
// Its own panel, its own two fields: what to be reminded about, and when. It
// saves an ordinary drop under the Reminder subject, so the phone inbox and
// the Due Now filter pick it up like any other reminder.

function toggleCapture(id, collapsedClass, focusId) {
  const panel = document.getElementById(id);
  if (!panel) return;
  const opened = panel.classList.toggle(collapsedClass) === false;
  if (opened && focusId) document.getElementById(focusId)?.focus();
}

function collapseCapture(id, collapsedClass) {
  document.getElementById(id)?.classList.add(collapsedClass);
}

async function saveReminder() {
  if (!await ensureDropsSession(true)) return;

  const contentEl = document.getElementById('reminder-content');
  const whenEl = document.getElementById('reminder-when');
  const content = (contentEl?.value || '').trim();
  const when = (whenEl?.value || '').trim();

  if (!content) {
    alert('What should the reminder say?');
    contentEl?.focus();
    return;
  }
  if (!when) {
    alert('When should this come back? Try "tomorrow 9am", "in 2h", or "friday".');
    whenEl?.focus();
    return;
  }

  try {
    const saved = await requestJson(DROPS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        // Without a title the server falls back to the subject, and every
        // reminder would be called "Reminder".
        title: (content.split('\n').find(Boolean) || content).slice(0, 120),
        subject: '',
        category: 'Reminder',
        project: 'iOS',
        status: 'inbox',
        priority: 'normal',
        remind_at: when,
      }),
    });
    contentEl.value = '';
    whenEl.value = '';

    // On the Reminders screen there is no list to watch it land in, so the
    // panel says so itself and stays open for the next one.
    if (isIosCaptureView()) {
      const info = dropReminderInfo(saved);
      showReminderSaved(info ? `Saved — reminding you ${info.relative}.` : 'Saved.');
      contentEl.focus();
    } else {
      collapseCapture('dropbox-reminder-capture', 'is-collapsed');
    }

    const drops = await loadDrops();
    if (drops !== null) { dropboxState.drops = drops; }
    renderDropbox();
  } catch (error) {
    handleDropboxRequestError(error, 'Failed to save the reminder.');
  }
}

function isIosCaptureView() {
  return Boolean(document.getElementById('dropbox-view')?.classList.contains('ios-mode'));
}

function showReminderSaved(message) {
  const note = document.getElementById('reminder-saved-note');
  if (!note) return;
  note.textContent = message;
  note.classList.remove('is-collapsed');
  clearTimeout(showReminderSaved._timer);
  showReminderSaved._timer = setTimeout(() => note.classList.add('is-collapsed'), 6000);
}

function clearDropForm() {
  ['drop-title', 'drop-project', 'drop-tags', 'drop-content'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const subjectEl = document.getElementById('drop-subject');
  if (subjectEl) subjectEl.value = dropboxState.filters.subject || '';
  const s = document.getElementById('drop-status');
  if (s) s.value = 'idea';
}

// ─── Dropbox event listeners ──────────────────────────────────────────────────

if (document.getElementById('save-drop-btn')) {
  document.getElementById('save-drop-btn').addEventListener('click', async () => {
    try { await saveDrop(); } catch (err) { alert(err.message); }
  });

  document.getElementById('clear-drop-btn').addEventListener('click', clearDropForm);

  // The form stays out of the way until this is pressed, on every screen size,
  // so the page opens on the notes rather than on a column of empty fields.
  document.getElementById('new-drop-btn').addEventListener('click', async () => {
    if (!await ensureDropsSession(true)) return;
    toggleCapture('dropbox-quick-capture', 'is-collapsed', 'drop-title');
  });

  document.getElementById('save-reminder-btn')?.addEventListener('click', () => {
    saveReminder().catch(err => alert(err.message));
  });

  document.getElementById('cancel-reminder-btn')?.addEventListener('click', () => {
    document.getElementById('reminder-content').value = '';
    document.getElementById('reminder-when').value = '';
    // On the Reminders screen the panel is the page, so Cancel only clears.
    if (!isIosCaptureView()) collapseCapture('dropbox-reminder-capture', 'is-collapsed');
  });

  document.getElementById('reminder-when')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveReminder().catch(err => alert(err.message));
  });

  document.getElementById('drop-search').addEventListener('input', e => {
    dropboxState.filters.search = e.target.value.trim();
    renderDropbox();
  });

  document.getElementById('drop-filter-subject').addEventListener('change', e => {
    dropboxState.filters.subject = e.target.value;
    const subjectEl = document.getElementById('drop-subject');
    if (subjectEl) subjectEl.value = e.target.value;
    renderDropbox();
  });

  document.getElementById('drop-filter-status').addEventListener('change', e => {
    dropboxState.filters.status = e.target.value;
    renderDropbox();
  });

  document.getElementById('drop-sort').addEventListener('change', e => {
    dropboxState.filters.sort = e.target.value;
    renderDropbox();
  });

  document.getElementById('drop-filter-reminder')?.addEventListener('change', e => {
    dropboxState.filters.reminder = e.target.value;
    renderDropbox();
  });

  // Only does anything on a phone: the button is hidden on wide screens,
  // where every filter is on show already.
  document.getElementById('drop-filters-toggle')?.addEventListener('click', e => {
    const more = document.getElementById('dropbox-filters-more');
    if (!more) return;
    const open = more.classList.toggle('is-collapsed-mobile') === false;
    e.currentTarget.setAttribute('aria-expanded', String(open));
    e.currentTarget.textContent = open ? 'Fewer filters' : 'More filters';
  });

  document.getElementById('dropbox-view-list').addEventListener('click', () => {
    dropboxState.view = 'table';
    document.getElementById('dropbox-table-wrap').classList.remove('hidden');
    document.getElementById('dropbox-cards-wrap').classList.add('hidden');
    document.getElementById('dropbox-view-list').classList.add('active');
    document.getElementById('dropbox-view-detail').classList.remove('active');
    renderDropTable();
  });

  document.getElementById('dropbox-view-detail').addEventListener('click', () => {
    dropboxState.view = 'cards';
    document.getElementById('dropbox-table-wrap').classList.add('hidden');
    document.getElementById('dropbox-cards-wrap').classList.remove('hidden');
    document.getElementById('dropbox-view-list').classList.remove('active');
    document.getElementById('dropbox-view-detail').classList.add('active');
    renderDropCards();
  });
}

function escAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}


function escHTML(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// View lifecycle hooks - switchView() runs enter() for the view being opened.
// Views never change focus/nav layout; that stays under the user's control.
VIEW_HANDLERS.dropbox    = { enter: () => enterDropboxView() };
VIEW_HANDLERS.projects   = { enter: () => { if (window.ProjectRooms) ProjectRooms.render(); } };
VIEW_HANDLERS.agents     = { enter: () => { if (window.AgentRegistry) AgentRegistry.render(); } };
VIEW_HANDLERS.memory     = { enter: () => { if (typeof MEM !== 'undefined') MEM.render(); } };
VIEW_HANDLERS['calendar-v3'] = { enter: () => { if (window.CAL) window.CAL.render(); } };
VIEW_HANDLERS.office     = { enter: null };
VIEW_HANDLERS.org        = { enter: () => renderOrgChart() };
if (document.getElementById('view-org')) renderOrgChart();


// ─── MEMORY MODULE ───────────────────────────────────────────────────────────
const MEM = (() => {
  const API = '/api/memories';
  let activeAgent = 'all';
  let _cache = null;
  let _editingId = null;

  async function ensureAuth() {
    if (typeof ensureDropsSession === 'function') {
      return await ensureDropsSession(true);
    }
    return true;
  }

  async function load() {
    try {
      const r = await fetch(API, { credentials: 'same-origin' });
      if (!r.ok) return _cache || [];
      const data = await r.json();
      _cache = Array.isArray(data) ? data : [];
      return _cache;
    } catch { return _cache || []; }
  }

  // An agent's colour reaches a chip as --chip-color; the shape and the
  // selected treatment are .ao-chip's business, in shared.css.
  function agentChip(agent, { selected, onclick }) {
    return `<button class="ao-chip${selected ? ' is-active' : ''}" data-agent="${agent.id}"
      style="--chip-color:${agent.color};" onclick="${onclick}">${agent.emoji} ${escHTML(agent.name)}</button>`;
  }

  function selectFormAgent(id) {
    document.getElementById('mem-agent').value = id;
    document.querySelectorAll('#mem-agent-tabs .ao-chip').forEach(b => {
      b.classList.toggle('is-active', b.dataset.agent === id);
    });
  }

  function openForm() {
    const form = document.getElementById('mem-form');
    form.hidden = false;
    document.getElementById('mem-content').focus();
  }

  function showForm() {
    _editingId = null;
    const tabs = document.getElementById('mem-agent-tabs');
    const preselect = activeAgent !== 'all' ? activeAgent : AGENTS[0].id;
    tabs.innerHTML = AGENTS.map(a =>
      agentChip(a, { selected: a.id === preselect, onclick: `MEM.selectFormAgent('${a.id}')` })
    ).join('');
    document.getElementById('mem-agent').value = preselect;
    document.getElementById('mem-content').value = '';
    openForm();
  }

  function hideForm() {
    _editingId = null;
    document.getElementById('mem-form').hidden = true;
    document.getElementById('mem-content').value = '';
  }

  function edit(id) {
    const entry = (_cache || []).find(e => e.id === id);
    if (!entry) return;
    _editingId = id;
    const tabs = document.getElementById('mem-agent-tabs');
    const agent = AGENTS.find(a => a.id === entry.agent) || { emoji: '?', name: entry.agent, color: 'var(--muted)' };
    tabs.innerHTML = `<span class="ao-entity-name" style="--entity-color:${agent.color};">${agent.emoji} ${escHTML(agent.name)}</span>`;
    document.getElementById('mem-agent').value = entry.agent;
    document.getElementById('mem-content').value = entry.content;
    openForm();
  }

  async function save() {
    const agent = document.getElementById('mem-agent').value;
    const content = document.getElementById('mem-content').value.trim();
    if (!agent) { alert('Select an agent first!'); return; }
    if (!content) { alert('Add some content first!'); return; }
    if (!(await ensureAuth())) return;

    if (_editingId) {
      await fetch(`${API}/${_editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ content })
      });
    } else {
      await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ agent, content })
      });
    }
    hideForm();
    render();
  }

  async function remove(id) {
    if (!confirm('Delete this memory?')) return;
    if (!(await ensureAuth())) return;
    await fetch(`${API}/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    render();
  }

  // The roster cards call this with one argument, which used to throw on
  // `btn.classList` and left clicking a card dead. The filter bar redraws
  // itself from activeAgent now, so there is no button to be handed.
  function setFilter(agentId) {
    activeAgent = agentId;
    renderFilters();
    renderList();
  }

  function renderFilters() {
    const bar = document.getElementById('mem-filters');
    const all = `<button class="ao-chip${activeAgent === 'all' ? ' is-active' : ''}" onclick="MEM.setFilter('all')">All</button>`;
    bar.innerHTML = all + AGENTS.map(a =>
      agentChip(a, { selected: activeAgent === a.id, onclick: `MEM.setFilter('${a.id}')` })
    ).join('');
  }

  async function renderList() {
    const list = document.getElementById('mem-list');
    list.innerHTML = `<div class="ao-empty">Loading…</div>`;
    const entries = await load();
    const filtered = activeAgent === 'all' ? entries : entries.filter(e => e.agent === activeAgent);

    if (filtered.length === 0) {
      list.innerHTML = `<div class="ao-empty">No memories yet. Hit <strong>＋ New Memory</strong> to add one.</div>`;
      return;
    }

    list.innerHTML = `<div class="mem-entries">` + filtered.map(e => {
      const agent = AGENTS.find(a => a.id === e.agent) || { emoji: '?', name: e.agent, color: 'var(--muted)' };
      const date = new Date(e.date || e.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      return `<article class="ao-card ao-entity-card" style="--entity-color:${agent.color};">
        <div class="ao-card-head">
          <div class="mem-entry-agent">
            <span class="ao-entity-emoji">${agent.emoji}</span>
            <span class="ao-entity-name">${escHTML(agent.name)}</span>
          </div>
          <div class="ao-toolbar">
            <span class="ao-card-sub">${date}</span>
            <button class="ao-btn ao-btn--sm" onclick="MEM.edit('${e.id}')">edit</button>
            <button class="ao-btn ao-btn--sm ao-btn--danger" onclick="MEM.remove('${e.id}')">delete</button>
          </div>
        </div>
        <div class="mem-entry-body">${escHTML(e.content)}</div>
      </article>`;
    }).join('') + `</div>`;
  }

  function renderRoster() {
    const grid = document.getElementById('mem-roster-grid');
    if (!grid) return;
    grid.innerHTML = Object.entries(AGENT_DESCRIPTIONS).map(([id, info]) => {
      const agent = AGENTS.find(a => a.id === id) || { color: 'var(--muted)', emoji: '?' };
      const memBadge = info.memory
        ? '<span class="ao-badge ao-badge--success">MEMORY ON</span>'
        : '<span class="ao-badge">STATELESS</span>';
      return `<div class="ao-card ao-card--interactive ao-entity-card" style="--entity-color:${agent.color};" onclick="MEM.setFilter('${id}')">
          <div class="ao-card-head">
            <div class="mem-entry-agent">
              <span class="ao-entity-emoji">${agent.emoji}</span>
              <span class="ao-entity-name">${escHTML(info.name)}</span>
            </div>${memBadge}
          </div>
          <div>
            <div class="ao-entity-meta">${escHTML(info.role)}</div>
            <div class="ao-card-sub">Model: <span class="mem-roster-model">${escHTML(info.model)}</span></div>
          </div>
          <div class="ao-card-sub">${escHTML(info.desc)}</div>
        </div>`;
    }).join('');
  }
  async function render() {
    renderRoster();
    renderFilters();
    if (!(await ensureAuth())) {
      document.getElementById('mem-list').innerHTML = `<div class="ao-empty">Unlock the dropbox first to access memories.</div>`;
      return;
    }
    await renderList();
  }

  return { render, renderRoster, showForm, hideForm, save, remove, edit, setFilter, selectFormAgent };
})();



