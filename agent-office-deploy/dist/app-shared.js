// Populate SVG roster panel
(function() {
  const roster = [
    {name:'Devin', role:'Primary Agent', color:'#6366f1'},
    {name:'FatherClaw', role:'Orchestrator', color:'#6366f1'},
    {name:'Rig', role:'Execution Dev', color:'#10b981'},
    {name:'Nova', role:'Product Researcher', color:'#f97316'},
    {name:'Penny', role:'Research & Strategy', color:'#f59e0b'},
    {name:'TraderClaw', role:'Trading Bot', color:'#22c55e'},
    {name:'WebClaw', role:'Web Developer', color:'#3b82f6'},
    {name:'X-Hunter', role:'Social Scout', color:'#06b6d4'},
    {name:'Swarm', role:'Lightweight Coder', color:'#eab308'},
    {name:'Reaper', role:'Farm Bot', color:'#78716c'},
    {name:'Lyra', role:'Innerverse', color:'#a855f7'},
    {name:'XBot', role:'X Publisher', color:'#ec4899'},
    {name:'Guardian', role:'Security', color:'#ef4444'},
  ];
  const el = document.getElementById('svg-roster');
  if (el) {
    el.innerHTML = roster.map(a => `
      <div style="display:flex; align-items:center; gap:8px; padding:4px 0;">
        <div style="width:9px; height:9px; border-radius:50%; background:${a.color}; flex-shrink:0;"></div>
        <div>
          <div style="font-weight:500; color:#f1f5f9; font-size:12px; line-height:1.2;">${a.name}</div>
          <div style="font-size:11px; color:#64748b; line-height:1.2;">${a.role}</div>
        </div>
      </div>`).join('');
  }
})();
// ─── AGENT DATA ───────────────────────────────────────────────
const AGENTS = [
  {
    id: 'devin',
    name: 'Devin',
    emoji: '🛠️',
    color: '#6366f1',
    role: 'Project Overseer',
    model: 'Claude Sonnet 4.6',
    tasks: [
      'Reviewing project status',
      'Coordinating agents',
      'Updating MEMORY.md',
      'Checking on TraderClaw',
      'Overseeing WebClaw demo',
      'Planning next sprint',
    ],
    feed: [
      'Updated MEMORY.md with new project notes',
      'Reviewed TraderClaw dashboard - all green',
      'Coordinated WebClaw demo deployment',
      'Flagged open TODOs for Jason',
      'Cross-checked agent activity logs',
    ]
  },
  {
    id: 'traderclaw',
    name: 'TraderClaw',
    emoji: '📈',
    color: '#22c55e',
    role: 'Trading Bot',
    model: 'Claude Sonnet 4.6',
    tasks: [
      'Monitoring BTC 1H signal',
      'Scanning RSI divergence',
      'Paper trade open: BTC long',
      'Screener refresh (4H)',
      'Checking Polymarket odds',
      'Logging trade to history',
    ],
    feed: [
      'BTC screener refreshed - RSI 58 on 4H',
      'Paper trade opened: BTC long @ 84,200',
      'Polymarket opportunity scan complete',
      'Stop-loss moved to breakeven on BTC',
      'Dashboard updated - 3 open positions',
    ]
  },
  {
    id: 'webclaw',
    name: 'WebClaw',
    emoji: '🌐',
    color: '#3b82f6',
    role: 'Web Developer',
    model: 'GPT-5.4',
    tasks: [
      'Building demo site',
      'Generating client HTML',
      'Deploying to Railway',
      'Customizing template',
      'Writing pitch copy',
      'Optimizing for mobile',
    ],
    feed: [
      'Demo deployed: trail-appliances.up.railway.app',
      'Generated HTML for new client prospect',
      'Customized color scheme for local bakery',
      'Deployed 3 demo sites this session',
      'Updated base template with new CTA block',
    ]
  },
  {
    id: 'xhunter',
    name: 'X-Hunter',
    emoji: '🐦',
    color: '#06b6d4',
    role: 'Social / X Agent',
    model: 'Claude Sonnet 4.6',
    tasks: [
      'Scanning trending crypto posts',
      'Drafting reply to @BitcoinMagazine',
      'Monitoring @CoinDesk feed',
      'Scheduling repost',
      'Checking X notifications',
      'Analyzing engagement metrics',
    ],
    feed: [
      'Trending: BTC ETF inflows spiking on X',
      'Replied to 3 crypto threads',
      'Scheduled evening post - Ripple news',
      'Engagement up 12% from yesterday',
      'Found hot narrative: AI + crypto tools',
    ]
  },
  {
    id: 'swarm',
    name: 'Swarm',
    emoji: '🐝',
    color: '#eab308',
    role: 'Codex Agent',
    model: 'GPT-4o-mini',
    tasks: [
      'Processing codex tasks',
      'Running batch operations',
      'Indexing project data',
      'Syncing agent state',
      'Idle',
    ],
    feed: [
      'Codex batch complete - 12 tasks processed',
      'Project index refreshed',
      'Agent state synced across cluster',
      'Batch queue cleared',
      'Task pipeline healthy',
    ]
  },
  {
    id: 'penny',
    name: 'Penny',
    emoji: '🪙',
    color: '#f59e0b',
    role: 'OSS Agent',
    model: 'GPT-5.4',
    tasks: [
      'Scanning open-source repos',
      'Evaluating dependencies',
      'Checking license compliance',
      'Reviewing PR activity',
      'Idle',
    ],
    feed: [
      'OSS scan complete - 3 repos reviewed',
      'License check passed for all deps',
      'Flagged outdated dependency in trader',
      'PR activity summary generated',
      'Vulnerability scan clean',
    ]
  },
  {
    id: 'reaper',
    name: 'Reaper',
    emoji: '💀',
    color: '#78716c',
    role: 'Farm Bot',
    model: 'GPT-4o-mini',
    tasks: [
      'Running discover pipeline',
      'Posting scheduled content',
      'Farming engagement',
      'Cron job active',
      'Idle',
    ],
    feed: [
      'Morning discover pipeline complete',
      'Scheduled 5 posts for today',
      'Engagement farm cycle finished',
      'Cron job triggered - next run in 4H',
      'Content queue replenished',
    ]
  },
  {
    id: 'forge',
    name: 'Forge',
    emoji: '⚙️',
    color: '#8b5cf6',
    role: 'Dev Agent',
    model: 'Claude Sonnet 4.6',
    tasks: [
      'Writing feature code',
      'Debugging issue',
      'Shipping to production',
      'Code review',
      'Idle',
    ],
    feed: [
      'Feature branch merged to main',
      'Bug fix deployed - auth flow',
      'Code review complete on PR #47',
      'New endpoint shipped to Railway',
      'Test suite passing - 100%',
    ]
  },
  {
    id: 'lyra',
    name: 'Lyra',
    emoji: '✨',
    color: '#a855f7',
    role: 'Innerverse',
    model: 'Claude Sonnet 4.6',
    tasks: [
      'Working on Innerverse...',
      'Crafting narrative',
      'Building world lore',
      'Writing chapter draft',
      'Idle',
    ],
    feed: [
      'New chapter draft saved - 1,200 words',
      'Updated Innerverse world map notes',
      'Character arc revised for Volume 2',
      'Added lore entry: The Hollow Spire',
      'Outline complete for next arc',
    ]
  },
  {
    id: 'xbot',
    name: 'XBot',
    emoji: '🤖',
    color: '#ec4899',
    role: 'X Bot',
    model: 'GPT-5',
    tasks: [
      'Posting to X',
      'Idle',
      'Monitoring mentions',
      'Queuing scheduled posts',
      'Engaging with replies',
    ],
    feed: [
      'Post published @DiamondHands811',
      'Reposted: BTC dominance chart',
      '3 mentions replied to',
      'Evening wrap-up posted',
      'Engagement metric logged',
    ]
  },
  {
    id: 'guardian',
    name: 'Guardian',
    emoji: '🛡',
    color: '#ef4444',
    role: 'Security',
    model: 'Claude Sonnet 4.6',
    tasks: [
      'Monitoring gateway access',
      'Scanning for anomalies',
      'Reviewing auth logs',
      'Hardening firewall rules',
      'Idle - all clear',
    ],
    feed: [
      'Gateway access log reviewed - clean',
      'No unauthorized access attempts',
      'SSH hardening rules applied',
      'All agent permissions verified',
      'Security posture: green',
    ]
  },
  {
    id: 'fatherclaw',
    name: 'FatherClaw',
    emoji: '👑',
    color: '#64748b',
    role: 'Orchestrator',
    model: 'Claude Sonnet 4.6',
    tasks: [
      'Routing tasks between agents',
      'Monitoring agent health',
      'Idle',
      'Queuing cross-agent workflow',
      'Logging inter-agent comms',
    ],
    feed: [
      'Routed WebClaw brief from Swarm',
      'All 12 agents healthy',
      'Cross-agent workflow complete',
      'Task queue: 2 pending',
      'Inter-agent log updated',
    ]
  }
,
  {
    id: 'command',
    name: 'Command',
    emoji: '📡',
    color: '#64748b',
    role: 'Orchestrator',
    model: 'Claude Sonnet 4.6',
    tasks: [
      'Routing tasks between agents',
      'Monitoring agent health',
      'Idle',
      'Queuing cross-agent workflow',
      'Logging inter-agent comms',
    ],
    feed: [
      'Routed WebClaw brief from Swarm',
      'All 12 agents healthy',
      'Cross-agent workflow complete',
      'Task queue: 2 pending',
      'Inter-agent log updated',
    ]
  }
];

// ─── POSITIONS (grid slots in office) ─────────────────────────
const POSITIONS = [
  { x: 0.49, y: 0.36 },
  { x: 0.27, y: 0.59 },
  { x: 0.70, y: 0.58 },
  { x: 0.77, y: 0.41 },
  { x: 0.20, y: 0.39 },
  { x: 0.18, y: 0.71 },
  { x: 0.86, y: 0.24 },
  { x: 0.54, y: 0.23 },
  { x: 0.78, y: 0.71 },
  { x: 0.35, y: 0.45 },
  { x: 0.62, y: 0.45 },
  { x: 0.42, y: 0.68 },
];

// ─── STATE ────────────────────────────────────────────────────
const OFFICE_SCENE = {
  gridW: 14,
  gridH: 11,
  tileRatio: 0.06,
  maxTileW: 84,
  originXRatio: 0.5,
  originYRatio: 0.14,
  platformLiftRatio: 1.55,
};

const OFFICE_ROUTES = {
  devin: [
    { gx: 6.35, gy: 3.45, pose: 'stand', facing: 'S', motion: 'monitoring', tasks: ['Reviewing project status', 'Coordinating agents', 'Planning next sprint'] },
    { gx: 4.95, gy: 6.35, pose: 'stand', facing: 'E', motion: 'reading', tasks: ['Updating MEMORY.md', 'Coordinating agents', 'Planning next sprint'] },
    { gx: 2.15, gy: 8.35, pose: 'stand', facing: 'E', motion: 'reading', tasks: ['Updating MEMORY.md', 'Reviewing project status', 'Flagged open TODOs for Jason'] },
    { gx: 7.2, gy: 8.15, pose: 'stand', facing: 'N', motion: 'monitoring', tasks: ['Planning next sprint', 'Coordinating agents', 'Reviewing project status'] },
  ],
  traderclaw: [
    { gx: 1.82, gy: 2.56, pose: 'seated', facing: 'NE', motion: 'typing', tasks: ['Monitoring BTC 1H signal', 'Scanning RSI divergence', 'Checking Polymarket odds'] },
    { gx: 2.72, gy: 3.26, pose: 'stand', facing: 'E', motion: 'monitoring', tasks: ['Scanning RSI divergence', 'Monitoring BTC 1H signal', 'Logging trade to history'] },
    { gx: 3.28, gy: 8.08, pose: 'stand', facing: 'S', motion: 'reading', tasks: ['Checking Polymarket odds', 'Logging trade to history', 'Screener refresh (4H)'] },
    { gx: 6.18, gy: 6.14, pose: 'stand', facing: 'E', motion: 'monitoring', tasks: ['Paper trade open: BTC long', 'Monitoring BTC 1H signal', 'Screener refresh (4H)'] },
  ],
  webclaw: [
    { gx: 10.22, gy: 2.56, pose: 'seated', facing: 'NW', motion: 'typing', tasks: ['Building demo site', 'Generating client HTML', 'Optimizing for mobile'] },
    { gx: 8.95, gy: 2.02, pose: 'stand', facing: 'N', motion: 'reading', tasks: ['Writing pitch copy', 'Optimizing for mobile', 'Building demo site'] },
    { gx: 8.24, gy: 5.96, pose: 'stand', facing: 'W', motion: 'monitoring', tasks: ['Customizing template', 'Generating client HTML', 'Deploying to Railway'] },
    { gx: 6.48, gy: 3.86, pose: 'stand', facing: 'S', motion: 'monitoring', tasks: ['Building demo site', 'Writing pitch copy', 'Deploying to Railway'] },
  ],
  xhunter: [
    { gx: 10.12, gy: 5.38, pose: 'seated', facing: 'NW', motion: 'typing', tasks: ['Scanning trending crypto posts', 'Drafting reply to @BitcoinMagazine', 'Checking X notifications'] },
    { gx: 12.28, gy: 3.18, pose: 'stand', facing: 'W', motion: 'monitoring', tasks: ['Monitoring @CoinDesk feed', 'Analyzing engagement metrics', 'Scanning trending crypto posts'] },
    { gx: 10.56, gy: 6.08, pose: 'stand', facing: 'S', motion: 'monitoring', tasks: ['Scheduling repost', 'Checking X notifications', 'Analyzing engagement metrics'] },
    { gx: 8.78, gy: 4.58, pose: 'stand', facing: 'W', motion: 'reading', tasks: ['Drafting reply to @BitcoinMagazine', 'Scanning trending crypto posts', 'Monitoring @CoinDesk feed'] },
  ],
  nova: [
    { gx: 1.84, gy: 5.42, pose: 'seated', facing: 'NE', motion: 'typing', tasks: ['Researching niche pain points', 'Analyzing competitor products', 'Drafting positioning brief'] },
    { gx: 1.24, gy: 7.18, pose: 'stand', facing: 'E', motion: 'reading', tasks: ['Analyzing competitor products', 'Evaluating market size', 'Researching niche pain points'] },
    { gx: 4.96, gy: 5.54, pose: 'stand', facing: 'E', motion: 'reading', tasks: ['Drafting positioning brief', 'Evaluating market size', 'Writing lead magnet outline'] },
    { gx: 3.42, gy: 8.48, pose: 'stand', facing: 'N', motion: 'monitoring', tasks: ['Writing lead magnet outline', 'Researching niche pain points', 'Drafting positioning brief'] },
  ],
  lyra: [
    { gx: 4.46, gy: 7.46, pose: 'stand', facing: 'NE', motion: 'reading', tasks: ['Working on Innerverse...', 'Crafting narrative', 'Building world lore'] },
    { gx: 2.18, gy: 8.52, pose: 'stand', facing: 'E', motion: 'reading', tasks: ['Building world lore', 'Writing chapter draft', 'Crafting narrative'] },
    { gx: 5.32, gy: 6.74, pose: 'stand', facing: 'N', motion: 'monitoring', tasks: ['Crafting narrative', 'Working on Innerverse...', 'Writing chapter draft'] },
    { gx: 7.88, gy: 8.66, pose: 'stand', facing: 'W', motion: 'reading', tasks: ['Writing chapter draft', 'Building world lore', 'Crafting narrative'] },
  ],
  xbot: [
    { gx: 10.82, gy: 8.08, pose: 'seated', facing: 'NW', motion: 'typing', tasks: ['Queuing scheduled posts', 'Posting to X', 'Monitoring mentions'] },
    { gx: 12.16, gy: 6.68, pose: 'stand', facing: 'W', motion: 'monitoring', tasks: ['Monitoring mentions', 'Engaging with replies', 'Posting to X'] },
    { gx: 10.94, gy: 6.16, pose: 'stand', facing: 'N', motion: 'monitoring', tasks: ['Posting to X', 'Queuing scheduled posts', 'Engaging with replies'] },
    { gx: 8.82, gy: 7.18, pose: 'stand', facing: 'W', motion: 'reading', tasks: ['Monitoring mentions', 'Engaging with replies', 'Queuing scheduled posts'] },
  ],
  guardian: [
    { gx: 12.28, gy: 2.12, pose: 'stand', facing: 'W', motion: 'monitoring', tasks: ['Monitoring gateway access', 'Reviewing auth logs', 'Scanning for anomalies'] },
    { gx: 12.18, gy: 8.16, pose: 'stand', facing: 'W', motion: 'monitoring', tasks: ['Scanning for anomalies', 'Hardening firewall rules', 'Monitoring gateway access'] },
    { gx: 9.68, gy: 1.42, pose: 'stand', facing: 'S', motion: 'monitoring', tasks: ['Reviewing auth logs', 'Monitoring gateway access', 'Hardening firewall rules'] },
    { gx: 10.44, gy: 4.12, pose: 'stand', facing: 'W', motion: 'reading', tasks: ['Reviewing auth logs', 'Scanning for anomalies', 'Idle - all clear'] },
  ],
  fatherclaw: [
    { gx: 6.9, gy: 8.32, pose: 'seated', facing: 'N', motion: 'typing', tasks: ['Routing tasks between agents', 'Monitoring agent health', 'Queuing cross-agent workflow'] },
    { gx: 7.04, gy: 6.56, pose: 'stand', facing: 'N', motion: 'monitoring', tasks: ['Monitoring agent health', 'Routing tasks between agents', 'Logging inter-agent comms'] },
    { gx: 7.34, gy: 4.32, pose: 'stand', facing: 'S', motion: 'monitoring', tasks: ['Queuing cross-agent workflow', 'Routing tasks between agents', 'Monitoring agent health'] },
    { gx: 4.28, gy: 6.92, pose: 'stand', facing: 'E', motion: 'reading', tasks: ['Logging inter-agent comms', 'Monitoring agent health', 'Queuing cross-agent workflow'] },
  ],
};

function cloneRoute(route) {
  return (route || []).map(stop => ({
    ...stop,
    tasks: stop.tasks ? [...stop.tasks] : null,
  }));
}

let agentState = AGENTS.map((agent) => {
  const route = cloneRoute(OFFICE_ROUTES[agent.id]);
  const start = route[0] || { gx: 6.5, gy: 5.5, pose: 'stand', facing: 'S', motion: 'monitoring', status: 'active' };
  return {
    ...agent,
    route,
    routeIndex: 0,
    pos: { gx: start.gx, gy: start.gy },
    currentTask: (start.tasks && start.tasks[0]) || agent.tasks[0],
    status: start.status || 'active',
    lookState: {
      pose: start.pose || 'stand',
      facing: start.facing || 'S',
      motion: start.motion || (start.pose === 'seated' ? 'typing' : 'monitoring'),
    },
    travelMs: 2200,
    availableAt: 0,
    arrivalTimer: null,
  };
});

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
  'webclaw': 'data:image/png;base64,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',
  'xhunter': 'data:image/png;base64,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',
  'swarm': 'data:image/png;base64,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',
  'reaper': 'data:image/png;base64,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',
  'lyra': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABuCAYAAACXzxWYAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAFeUlEQVR4nO2cT2hcVRTGz4CLQBYuCqOLSCQ2aRG6aCAS4io2QQWh4kCKuKgYIQT8g7RCIOtgoIqohbhQsRIXDXTRlUqiWQniIl0IUpMaDMmiDmQhLpLd9H3XnMfN630z8yb33LnPe38wvD/z5s37vnvO/ffezCMUONEACpxoAAVONIACJxpAgRMNoMCJBlDgRAMocKIBFDjRAAqcaAAFTjSAAicaQIETDejCdzaavFchx7gyIBX9yydv5B40+u5XujlOzHBhQKOZaB39OM0MUSOkDWhbfBb+3JERYiZIGtCxeB2cQ9IEKQOsiGckTYjNoMA5rZY+IxUFMQKoREhEQakMkCAaQCUgCXu1lKhcvTcA4iWEM14bAPEfTI/RuTc/U9u/ffG29e8QMWCn/g/1Vx9VAm7O19R6p7zz6SotLy/TzMxMaVKgcmnhlhrJFblgznPT5yBeCvEUaCeHOdRR2sAU6lL1gJQB6Kg0qACmUP/66kXq7e39/1eCLDAb6mefOCX+3ZIGVNBtRSVYhGxpIwokm0IvIgAg700ipaNA2gDVInRaetwyIAqkcBIB3C/gZTvc3d1XwsseASCNgjv37qsd7ZigC4cZr394Oz2fzYtzWge8PHamaYXGQrnkdeFHcwHWr0l8WpxXWDgLyavwskL5OKSPBKLT4qurq+nG5ORkut7MBH5fB+KTNErPSyWYEVLi+/v71cbOzs5DB7AJrQZLuviDgwPa3d2loaEhayaIzApD/MTEBB0eHlJPT4/aiX2jSRTopauHu6nDpJU6cTQNDg7S5uamNRNsG5CKBxAPE3DRIM8EkFfBsXCOJtuItwJ5JoBmRmSF4/M4D6/bigKbBhwrfR2TCWBUqxgZU4nz53RM+zrB+VhAv3C9lWBaCbdNVwZDELa1tdU0r12IB10bDXYqsFKpUKNRaK6lKd4Mh9sBfQDbODFgbW1N9QRRc9sIbaSPLcQNwMVCPFd42D6pCUnzR7YQN8DUDT4prTpPRbBqAIc5cFWLnxSbBqipcA5PNsJ3rKfAjfcv0pm+U2memjo7PiFWB6R5auju+oR4JYiIuHztNvlKqTpCEkQDKHBKY4DN7q+O9wawcG5W5y49a/VmqbcGZIUz508/bvV7vDMgK3x2dpbGx8dpampKbWOmGKVv60aJNwZkha+srKjl+vo6bW9v82Gqu63dK/BuWlx1g4uQV+IM1mGCji3xwOqscJH7+CbhmCM0DZ9hwtLSEm/6e3e42b18fQIU4k2hPjAwYDTgKP9L9ZOZFE6JbG2eDXXAuY4lzHCBdQO4jf5jbz8Vj7Z78ebPVKvVaGRkRInT81qr5FSoc1S4wKoBEM1gBMhG4MEIGAAQ4njppc+lPTc3R4uLi6WNgEoiWk3Ym4zQyd4QyQp2JR7YTgFVUWWNQFog5+v1uvFDLgVnkXxUVhkR+oRImha+4uQxOSr44LRLvBkLdItoAJWHsH88/cJbC/T99fnwfjvMEyF///m7yPm9NYCFn3/xNfrhxse0t7dH08n2ne++tfrXGk7+Q6TIwRgPAAj/cuGKWn/+8ntq+Z8RV2h6/iM2wr8ZoU7hEkeuI9zPXXhFCQVZI/AeXt9crXn1nGBH6KGelCrd+/UnOv3Mc2ofRAI2grdB/a+7Vr7fmQEY52M+gGmS44kJPyYmXFBGVJ88+5BwmGQLJwZA5GNPPU23rs8f29cix9U+k9iVz69RX18fVavVE1+bEwP+3b+vXshvUCDH1RAa0QHBvNSEl6MS5BIbe+lVtV0kx3NK2fsfTOhUhoeHVVO4sbGRGsGVXRs5Xuq/0mKUiDwjstjM8Va4bgaNRkjmeCu61Q84ZkTe+y7odkfI+R8oZum2AV0neAMeAKSHpsUgPQOeAAAAAElFTkSuQmCC',
  'xbot': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABuCAYAAACXzxWYAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAFXklEQVR4nO2cPUhkVxTHz0AKwSLFgqQwCBKdNCkiCLKpBK03oLgIQkKyIArZgCQgpg4REoQkhQghJCDIihZbK1gFAoJbpEl0EfwogrBFKu0m8z94Hte3dz7eeM+d+/beHwzzvubN+//vOffrzZu3KHKSARQ5yQCKnGQARU4ygCInGUCRkwygyEkGUOQkAyhykgEUOckAipxkAEVOMoAiJxnQhe+sNdlXIc/4MiAT/eePnzU8aOzLX01zvJjhw4BaM9Em5nGGGapGaBvQtvg88rlbI9RM0DSgY/EmOIemCVoGOBEvaJqQmkGFczotfUErClIEUInQiIJSGaBBMoBKQD3s+V2jcg3eAIjXEC4EbQDEf/f5Q/rgyc+8/tcvXzj/DhUDzq7+o4G+t1nAs2+meLlTnv60R5ubmzQ/P1+aFKg8/naXR3JFLljy3PY5iNdCPQXayWEJdZQ2sIW6Vj2gZQA6KjUqgC3Uf/vqEfX29r75laAIzIf6++8+UP9uTQMq6LaiEixCvrQRBZpNYRARAJD3NpHaUaBtALcInZaetAyIAi28RID0C+S9Hf6+eMXCyx4BIIuCFy//5Q3tmGAKhxmf/vA8O5/Li/NaB3z8sNq0QhOhUvKm8Nu5AOfXpD4tLgsiXIQ0qvDyQuU4pI8GqtPie3t72crk5GS23MwE2W8C8fU0ys5LJZgRYvEDAwO8cnZ29toBYkKrwZIp/vr6mi4uLmh4eNiZCSqzwhA/MTFBNzc31NPTwxuxbaweBWbpmuFu6zAZpU4STUNDQ3R8fOzMBNcGZOIBxMMEXDRoZAJoVMGJcIkm16i3Ao1MAM2MyAvH53EeWXYVBS4NuFP6JjYTwJhRMQq2EpfPmdi2dYL3sYB54WYrIbQS7pquDIYg7OTkpGle+xAPujYa7FRgpVKhWq3QXEtTghkOtwP6AK7xYsD+/j73BFFzuwhtpI8r1A3AxUK8VHhYv68J9eaPXKFugK0bfF9adZ6K4NQACXPgqxa/Ly4N4KlwCU8xInScp8DvXz+iav+DLE9tnZ2QUKsDsjy1dHdDQr0SRER88v1zCpVSdYQ0SAZQ5JTGAJfdX5PgDRDh0qwuP/7I6c3SYA3ICxc+fO8dp98TnAF54QsLCzQ+Pk4zMzO8jplilL6rGyXBGJAXvr29ze8HBwd0enoqh3F327hXENy0OHeDi9CoxAUswwQTV+KB01nhIvfxbcIxR2gbPsOE9fV1WQ337nCze/nmBCjE20J9cHDQasBt/pfqkZkMSYl8bZ4PdSC5jneY4QPnBkgb/c/lq0w82u7VZ3/Q1NQUjY6Osjgzr41KjkNdosIHTg2AaAEjQDECP4yAAQAhjpdZ+lLay8vLtLq6WtoIqNRF84S9zQiT/A2RvGBf4oHrFOCKKm8E0gI5f3V1Zf2QT8F5NH8qy0bEPiGSpUWoePmZHBX84bRPghkLdItkAJWHuB+e3traotnZ2fieHZaJkMPDQ5XzB2uACF9aWuIu8uXlJa+vra05/WsNL/8hUuRgiAUQPjc3x8sYH8g+bMOzRbdGhDcj1ClS4sh1hDueH9rY2OBteSOwD69qtRrU7wQ7wgz1eqnS7u4uD5uBPEQlRpgPVR0dHTn5fm8GYJwvwkCTHKednR2anp7m40dGRl4TDpNc4cUAiMRESL0Zu7OtRY7zNpvYlZUV6u/vZ6PuixcDzs/P+YX8BgVynIfQiA4Ilve+vj45dTkqQSmxxcVFXi+S44ZYk+AfmDCp1POYm0KIEiOksmsjx0v9V1oCi2hkRB6XOd4K382g1QjNHG9Ft/oBd4xotN8H3e4Ief8DxTzdNqDrRG/A/yhCqpM7Y+mBAAAAAElFTkSuQmCC',
  'guardian': 'data:image/png;base64,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',
  'jason': 'data:image/png;base64,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',
};

const officesvg = document.getElementById('officesvg');
const officeArea = officesvg ? officesvg.parentElement : document.getElementById('view-office');
const canvas = {
  get width() { return officesvg ? officesvg.clientWidth || 1100 : 1100; },
  get height() { return officesvg ? officesvg.clientHeight || 720 : 720; }
};
const ctx = null; // SVG mode - no canvas context
// SVG floor is drawn in viewBox coords (see gen_room.js):
//   tile (gx, gy) top point = (550 + (gx - gy) * 40, 295 + (gx + gy) * 20)
//   tile rhombus is 80 wide × 40 tall; center = top + (0, 20)
// The agent <div> is positioned in CSS px relative to officeArea, so we scale
// viewBox → CSS px by (clientWidth / viewBoxWidth).
const SVG_VB_W = 1100;
const SVG_VB_H = 720;
const SVG_OX = 550;   // viewBox x of tile (0,0) top
const SVG_OY = 295;   // viewBox y of tile (0,0) top
const SVG_HW = 40;    // half tile width  (viewBox)
const SVG_HH = 20;    // half tile height (viewBox)

// Habbo sprite canvas sits at bottom:8px and the sprite's feet land near the
// canvas bottom, so feet are ~10px above the avatar's bottom edge. Shift the
// projection down by that amount so the feet plant on the tile.
const AGENT_FOOT_OFFSET_PX = 10;

function getOfficeMetrics(width = canvas.width, height = canvas.height) {
  const scale = width / SVG_VB_W;
  const tileW = 2 * SVG_HW * scale;
  const tileH = 2 * SVG_HH * scale;
  const originX = SVG_OX * scale;
  const originY = (SVG_OY + SVG_HH) * scale; // tile (0,0) center, CSS px
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
    platformLift: 0,
    scale,
    iso,
  };
}

function projectAgentPosition(agent, metrics = getOfficeMetrics(officeArea.clientWidth, officeArea.clientHeight)) {
  const point = metrics.iso(agent.pos.gx, agent.pos.gy, 0);
  const depth = Math.max(0.08, Math.min(0.96, (agent.pos.gx + agent.pos.gy) / (metrics.gridW + metrics.gridH)));
  const ds = depthScale(depth);
  // The canvas sits at bottom:8px inside the avatar; after the avatar is
  // scaled by ds (transform-origin: bottom), the canvas visual bottom lands
  // at projected.y − 8*ds.  We want that to equal the tile's front vertex
  // (iso.y + tileH/2), so projected.y = iso.y + tileH/2 + 8*ds.
  return { x: point.x, y: point.y + metrics.tileH / 2 + 8 * ds, depth };
}

function resizeCanvas() {
  canvas.width = officeArea.clientWidth;
  canvas.height = officeArea.clientHeight;
  drawOffice();
}

function drawOffice() { /* SVG mode: rendering handled by renderAgents() */ }

function depthScale(yNorm) {
  return 0.78 + (yNorm * 0.5);
}

function applyAgentDepth(el, yNorm) {
  const scale = depthScale(yNorm);
  el.style.setProperty('--agent-scale', scale.toFixed(2));
  el.style.setProperty('--agent-z', String(100 + Math.round(yNorm * 100)));
  el.style.filter = `drop-shadow(0 1px ${Math.round(5 * scale)}px rgba(0,0,0,0.35))`;
  const label = el.querySelector('.agent-label');
  if (label) label.style.opacity = (0.84 + yNorm * 0.18).toFixed(2);
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

function drawPixelAgent(canvasEl, look, agent) {
  if (!canvasEl) return;
  const agentId = agent ? agent.id : null;
  const spriteKey = agentId && HABBO_SPRITES[agentId] ? agentId : null;

  if (spriteKey) {
    // Use real Habbo sprite
    const c = canvasEl.getContext('2d', { willReadFrequently: true });
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, canvasEl.width, canvasEl.height);
    const img = new Image();
    img.onload = () => {
      c.clearRect(0, 0, canvasEl.width, canvasEl.height);
      // Scale to fit canvas maintaining aspect ratio
      const scale = Math.min(canvasEl.width / img.width, canvasEl.height / img.height);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const x = Math.round((canvasEl.width - w) / 2);
      const y = canvasEl.height - h;
      c.drawImage(img, x, y, w, h);
    };
    img.src = HABBO_SPRITES[spriteKey];
    return;
  }

  // Fallback: original pixel art renderer
  const c = canvasEl.getContext('2d', { willReadFrequently: true });
  c.imageSmoothingEnabled = false;
  c.clearRect(0, 0, canvasEl.width, canvasEl.height);
  const dot = (x, y, color) => { c.fillStyle = color; c.fillRect(x, y, 1, 1); };
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
  const online = agentState.filter(a => a.status !== 'offline').length;
  ['room-online-count', 'office-online-top', 'onlineCount'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = online;
  });
}
let _roomTickerIdx = -1;
function cycleRoomTicker() {
  const el = document.getElementById('room-task-ticker');
  if (!el || typeof agentState === 'undefined') return;
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

function renderAgents() {
  document.querySelectorAll('.agent-char').forEach(el => el.remove());

  agentState.forEach(agent => {
    const el = document.createElement('div');
    el.className = 'agent-char';
    el.id = 'agent-' + agent.id;

    el.innerHTML = `
      <div class="agent-label">
        <div class="agent-status-dot"></div>
        <div class="agent-label-text">
          <strong>${agent.name}</strong>
          <span>${agent.currentTask}</span>
        </div>
      </div>
      <div class="agent-avatar">
        <div class="agent-shadow"></div>
        <div class="agent-chair"></div>
        <canvas class="agent-pixel" width="26" height="36"></canvas>
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
function renderStatusBar() {
  const bar = document.getElementById('statusbar');
  bar.innerHTML = agentState.map(agent => `
    <div class="status-card">
      <div class="status-card-avatar" style="background: ${agent.color}33; border: 1px solid ${agent.color}55;">
        ${agent.emoji}
      </div>
      <div class="status-card-info">
        <div class="status-card-name">${agent.name}</div>
        <div class="status-card-task">${agent.currentTask}</div>
      </div>
      <div class="status-dot ${agent.status === 'active' ? 'dot-active' : agent.status === 'idle' ? 'dot-idle' : 'dot-offline'}"></div>
    </div>
  `).join('');
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
      <div class="feed-avatar" style="background: ${agent.color}33; border: 1px solid ${agent.color}44;">
        ${agent.emoji}
      </div>
      <span class="feed-name" style="color: ${agent.color}">${agent.name}</span>
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

function screenFacingFromDelta(dx, dy, fallback = 'S') {
  const vertical = Math.abs(dy) < 6 ? '' : (dy < 0 ? 'N' : 'S');
  const horizontal = Math.abs(dx) < 6 ? '' : (dx < 0 ? 'W' : 'E');
  return (vertical + horizontal) || fallback;
}

function syncAgentElement(agent) {
  const el = document.getElementById('agent-' + agent.id);
  if (!el) return;

  const look = getAgentLook(agent);
  const projected = projectAgentPosition(agent);
  el.style.left = projected.x + 'px';
  el.style.top = projected.y + 'px';
  el.style.setProperty('--travel-ms', `${agent.travelMs || 2200}ms`);
  el.classList.toggle('agent-moving', look.motion === 'walking');

  const labelName = el.querySelector('.agent-label strong');
  const labelTask = el.querySelector('.agent-label span');
  if (labelName) labelName.textContent = agent.name;
  if (labelTask) labelTask.textContent = agent.currentTask;

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
    dot.style.background = agent.status === 'active'
      ? 'var(--green)'
      : agent.status === 'idle'
        ? 'var(--yellow)'
        : 'var(--muted)';
  }

  applyAgentDepth(el, projected.depth);
  drawPixelAgent(el.querySelector('.agent-pixel'), look, agent);
}

function nextWorkStop(agent) {
  const route = agent.route || [];
  if (!route.length) {
    return { gx: agent.pos.gx, gy: agent.pos.gy, pose: 'stand', facing: agent.lookState?.facing || 'S', motion: 'monitoring', tasks: agent.tasks };
  }

  if (Math.random() < 0.24) {
    return route[agent.routeIndex];
  }

  const stride = route.length > 3 && Math.random() > 0.78 ? 2 : 1;
  agent.routeIndex = (agent.routeIndex + stride) % route.length;
  return route[agent.routeIndex];
}

function updateAgentTask(agent) {
  const now = Date.now();
  if (agent.availableAt && now < agent.availableAt) return false;

  const stop = nextWorkStop(agent);
  const metrics = getOfficeMetrics(officeArea.clientWidth, officeArea.clientHeight);
  const fromPoint = projectAgentPosition({ pos: { gx: agent.pos.gx, gy: agent.pos.gy } }, metrics);
  const toPoint = projectAgentPosition({ pos: { gx: stop.gx, gy: stop.gy } }, metrics);
  const dx = toPoint.x - fromPoint.x;
  const dy = toPoint.y - fromPoint.y;
  const taskPool = stop.tasks && stop.tasks.length ? stop.tasks : agent.tasks;
  const nextTask = randomFrom(taskPool);
  const isIdleTask = nextTask.toLowerCase().includes('idle');
  const isMoving = Math.hypot(dx, dy) > 10;

  window.clearTimeout(agent.arrivalTimer);
  agent.currentTask = nextTask;
  agent.status = isIdleTask ? 'idle' : (stop.status || (Math.random() > 0.18 ? 'active' : 'idle'));
  agent.pos = { gx: stop.gx, gy: stop.gy };

  if (!isMoving) {
    agent.lookState = {
      pose: stop.pose || 'stand',
      facing: stop.facing || agent.lookState?.facing || 'S',
      motion: stop.motion || (stop.pose === 'seated' ? 'typing' : 'monitoring'),
    };
    agent.travelMs = 1000;
    agent.availableAt = now + 900;
    syncAgentElement(agent);
    return true;
  }

  agent.travelMs = Math.max(1450, Math.min(3200, Math.round(900 + Math.hypot(dx, dy) * 3.15)));
  agent.availableAt = now + agent.travelMs + 260;
  agent.lookState = {
    pose: 'stand',
    facing: screenFacingFromDelta(dx, dy, stop.facing || agent.lookState?.facing || 'S'),
    motion: 'walking',
  };
  syncAgentElement(agent);

  agent.arrivalTimer = window.setTimeout(() => {
    agent.lookState = {
      pose: stop.pose || 'stand',
      facing: stop.facing || screenFacingFromDelta(dx, dy, agent.lookState?.facing || 'S'),
      motion: stop.motion || (stop.pose === 'seated' ? 'typing' : 'monitoring'),
    };
    syncAgentElement(agent);
  }, Math.max(240, agent.travelMs - 180));

  return true;
}

function tick() {
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

  const activeCount = agentState.filter(a => a.status === 'active').length;
  document.getElementById('onlineCount').textContent = activeCount;
}

// ─── CLOCK ────────────────────────────────────────────────────
function updateClock() {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString('en-CA', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
}

// ─── VIEW SWITCHER ────────────────────────────────────────────
const VIEW_HANDLERS = {
  office: { enter: () => { resizeCanvas(); renderAgents(); centerOfficeView(); }, focus: false },
  org: { focus: false }
};
VIEW_HANDLERS.calendar = { enter: () => { if (window.CAL) window.CAL.render(); }, focus: false };
VIEW_HANDLERS.resets = { enter: () => { if (window.AOResets) window.AOResets.init(); }, focus: false };
VIEW_HANDLERS.settings = { enter: () => { if (window.SETTINGS) window.SETTINGS.load(); }, focus: false };

window.SETTINGS = (() => {
  const GW_LOCAL_KEY = 'ao-gateway-local';
  const GW_LAN_KEY   = 'ao-gateway-lan';
  const THEME_KEY    = 'ao-theme';

  const THEMES = {
    dark:     { label: 'Dark',     bg: '#0d0f14', panel: '#13161d', border: '#1e2330', text: '#e2e8f0', muted: '#64748b', accent: '#6366f1', viewBg: '#0a0c11' },
    midnight: { label: 'Midnight', bg: '#000000', panel: '#0e0e0e', border: '#1c1c1c', text: '#f1f5f9', muted: '#52525b', accent: '#10b981', viewBg: '#000000' },
    ocean:    { label: 'Ocean',    bg: '#050e1c', panel: '#091626', border: '#0f2540', text: '#e0f2fe', muted: '#4a7090', accent: '#38bdf8', viewBg: '#050e1c' },
    crimson:  { label: 'Crimson',  bg: '#0f0808', panel: '#160c0c', border: '#2c1212', text: '#fef2f2', muted: '#7a5050', accent: '#ef4444', viewBg: '#0f0808' },
    forest:   { label: 'Forest',   bg: '#060e08', panel: '#09160b', border: '#122818', text: '#f0fdf4', muted: '#4a7055', accent: '#22c55e', viewBg: '#060e08' },
    amber:    { label: 'Amber',    bg: '#0f0c05', panel: '#17120a', border: '#2e2010', text: '#fefce8', muted: '#7a6535', accent: '#f59e0b', viewBg: '#0f0c05' },
  };

  function applyTheme(name) {
    const t = THEMES[name] || THEMES.dark;
    const s = document.documentElement.style;
    s.setProperty('--bg',     t.bg);
    s.setProperty('--panel',  t.panel);
    s.setProperty('--border', t.border);
    s.setProperty('--text',   t.text);
    s.setProperty('--muted',  t.muted);
    s.setProperty('--accent', t.accent);
    document.body.style.background = t.bg;
    document.querySelectorAll('.view').forEach(el => { el.style.background = t.viewBg; });
    localStorage.setItem(THEME_KEY, name);
    const grid = document.getElementById('settings-theme-grid');
    if (grid) renderThemePicker(grid, name);
  }

  function renderThemePicker(grid, active) {
    active = active || localStorage.getItem(THEME_KEY) || 'dark';
    grid.innerHTML = Object.entries(THEMES).map(([key, t]) => {
      const on = key === active;
      return `<button onclick="SETTINGS.applyTheme('${key}')" style="display:flex;flex-direction:column;align-items:center;gap:8px;background:${t.panel};border:2px solid ${on ? t.accent : t.border};border-radius:12px;padding:14px 16px;cursor:pointer;min-width:76px;transition:border-color 0.15s;">
        <div style="display:flex;gap:4px;">
          <div style="width:13px;height:13px;border-radius:50%;background:${t.bg};border:1px solid ${t.border};"></div>
          <div style="width:13px;height:13px;border-radius:50%;background:${t.panel};border:1px solid ${t.border};"></div>
          <div style="width:13px;height:13px;border-radius:50%;background:${t.accent};"></div>
        </div>
        <div style="font-size:11px;color:${t.text};font-weight:${on ? 600 : 400};">${t.label}</div>
        ${on ? `<div style="font-size:9px;color:${t.accent};">✓ Active</div>` : '<div style="font-size:9px;color:transparent;">·</div>'}
      </button>`;
    }).join('');
  }

  function load() {
    const local = localStorage.getItem(GW_LOCAL_KEY);
    const lan   = localStorage.getItem(GW_LAN_KEY);
    const inpLocal = document.getElementById('settings-gateway-local');
    const inpLan   = document.getElementById('settings-gateway-lan');
    if (inpLocal) inpLocal.value = local || '';
    if (inpLan)   inpLan.value   = lan   || '';
    const grid = document.getElementById('settings-theme-grid');
    if (grid) renderThemePicker(grid);
  }

  function saveGateway() {
    const local = (document.getElementById('settings-gateway-local').value || '').trim();
    const lan   = (document.getElementById('settings-gateway-lan').value   || '').trim();
    if (local) localStorage.setItem(GW_LOCAL_KEY, local); else localStorage.removeItem(GW_LOCAL_KEY);
    if (lan)   localStorage.setItem(GW_LAN_KEY,   lan);   else localStorage.removeItem(GW_LAN_KEY);
    const msg = document.getElementById('settings-gateway-msg');
    if (msg) { msg.style.display = 'inline'; setTimeout(() => { msg.style.display = 'none'; }, 2000); }
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

  return { load, saveGateway, clearKey, clearAll, applyTheme };
})();

// Apply saved theme immediately so there's no flash on load
(function() { const t = localStorage.getItem('ao-theme'); if (t && window.SETTINGS) window.SETTINGS.applyTheme(t); })();

let currentView = 'office';

function switchView(view, navEl) {
  closeMobileNav();
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  if (navEl) navEl.classList.add('active');
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
  renderAgents();
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

  function randomId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'reset-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }

  function loadCards() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (err) {}
    }
    return [
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
    ];
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

const DE = (() => {
const TAG_STYLE={X:{bg:"#1d4ed820",border:"#3b82f6",text:"#93c5fd"},TG:{bg:"#0369a120",border:"#0ea5e9",text:"#7dd3fc"},GOOGLE:{bg:"#15803d20",border:"#22c55e",text:"#86efac"},CMC:{bg:"#c2410c20",border:"#f97316",text:"#fdba74"},MEXC:{bg:"#7c3aed20",border:"#a78bfa",text:"#c4b5fd"},TV:{bg:"#0f766e20",border:"#14b8a6",text:"#5eead4"},RSI:{bg:"#b4520920",border:"#d97706",text:"#fcd34d"},SC:{bg:"#4338ca20",border:"#818cf8",text:"#a5b4fc"},TA:{bg:"#05966920",border:"#10b981",text:"#6ee7b7"},ETF:{bg:"#0e749020",border:"#06b6d4",text:"#67e8f9"},FUTURES:{bg:"#be123c20",border:"#f43f5e",text:"#fda4af"},SECTORS:{bg:"#92400e20",border:"#f59e0b",text:"#fbbf24"},ALERTS:{bg:"#6b21a820",border:"#a855f7",text:"#d8b4fe"},CORR:{bg:"#1e3a5f20",border:"#3b82f6",text:"#93c5fd"},SCAN:{bg:"#064e3b20",border:"#059669",text:"#34d399"},DERIV:{bg:"#7f1d1d20",border:"#ef4444",text:"#fca5a5"},CRYPTOPY:{bg:"#1c191720",border:"#78716c",text:"#a8a29e"},SENT:{bg:"#1e293b20",border:"#64748b",text:"#94a3b8"}};
const OT_TEMPLATE=[{id:"fib_618",label:".618 - Fib level plotted",hint:"Most common reversal zone.",weight:3},{id:"fib_65",label:".65 - Fib level plotted",hint:"Upper edge of the golden pocket.",weight:3},{id:"fib_gp",label:"Golden Pocket (.618 to .65) identified",hint:"Highest probability long entry.",weight:4},{id:"fib_5",label:".5 - Mid level plotted",hint:"Equilibrium.",weight:2},{id:"fib_786",label:".786 - Deep retrace plotted",hint:"Trend strength weakening.",weight:2},{id:"vp_os",label:"Oversold zone identified (low vol node)",hint:"Price below VAL = discount.",weight:3},{id:"vp_poc",label:"POC (Point of Control) marked",hint:"Highest volume node.",weight:4},{id:"vp_ob",label:"Overbought zone identified (high vol node)",hint:"Price above VAH = premium.",weight:3},{id:"vp_pos",label:"Price position vs VP noted",hint:"Discount / Fair Value / Premium.",weight:3},{id:"sr_key",label:"Key support level identified",hint:"Where will buyers step in?",weight:3},{id:"sr_res",label:"Key resistance level identified",hint:"Where will sellers push back?",weight:3},{id:"sr_flip",label:"Flip zone identified (S→R or R→S)",hint:"High-conviction levels.",weight:4},{id:"sr_clear",label:"Clear path to next resistance",hint:"No major clusters to first TP.",weight:3},{id:"ms_trend",label:"Trend confirmed (HH/HL or LH/LL)",hint:"HH+HL = uptrend.",weight:4},{id:"ms_bos",label:"BOS (Break of Structure) identified",hint:"Confirmed BOS = trend continuation.",weight:4},{id:"ms_bo",label:"Breakout setup visible on chart",hint:"Price coiling at resistance.",weight:3},{id:"ms_choch",label:"No CHoCH against your position",hint:"CHoCH opposite = potential reversal.",weight:4},{id:"ms_range",label:"Range / consolidation zone mapped",hint:"Mark the high and low.",weight:2}];
const OT_TOKENS=[{prefix:"btc",label:"BITCOIN",sub:"Review BTC drawings on TradingView."},{prefix:"usdtd",label:"USDT.D",sub:"Review USDT.D drawings on TradingView."},{prefix:"total",label:"TOTAL",sub:"Review TOTAL drawings on TradingView."},{prefix:"btcd",label:"BTC.D",sub:"Review BTC.D drawings on TradingView."}];
const CU_GROUPS=[{id:"cu_tv",label:"TRADINGVIEW CHARTS",links:[{id:"a",label:"Market Dominance",url:"https://www.tradingview.com/chart/uwHQFIja/"},{id:"b",label:"All Market Spectrum",url:"https://www.tradingview.com/chart/tDSfdLfo/"},{id:"c",label:"Global OI Layout",url:"https://www.tradingview.com/chart/UBsUirLO/"},{id:"d",label:"Market Summary",url:"https://www.tradingview.com/#main-market-summary"}]},{id:"cu_cmc",label:"COINMARKETCAP",links:[{id:"e",label:"Crypto Market Overview",url:"https://coinmarketcap.com/charts/"},{id:"f",label:"Leaderboards",url:"https://coinmarketcap.com/best-cryptos/"}]},{id:"cu_macro",label:"MACRO & MARKETS",links:[{id:"g",label:"CNBC",url:"https://www.cnbc.com/"},{id:"h",label:"Futures Overview",url:"https://www.barchart.com/futures"},{id:"i",label:"Indexes",url:"https://tradingeconomics.com/stocks"},{id:"j",label:"Currencies",url:"https://tradingeconomics.com/currencies"}]},{id:"cu_moon",label:"MOON PHASES",links:[{id:"k",label:"Moon Phases",url:"https://www.timeanddate.com/moon/phases/"}]}];
const MTD_GROUPS=[{id:"mtd_news",label:"NEWS & ANALYSIS",sub:"Run bots and agents first.",items:[{id:"n_gpt",label:"GPT TA Agent - Screenshot BTC, USDT.D, TOTAL, BTC.D",hint:"Run your GPT TA agent.",weight:4},{id:"n_4h",label:"4H Chart-IMG Bot - Check latest output",hint:"Pull the latest 4H chart image.",weight:3},{id:"n_auto",label:"Automation for Cryptocurrency - Check latest",hint:"Run or check the automation.",weight:3},{id:"n_news",label:"CoinTrendsZBot - Run /news",hint:"Read the latest crypto news.",weight:3}]},{id:"mtd_vol",label:"VOLUME ANALYSIS",sub:"ETF inflows, CVD vs OI, funding rates.",items:[{id:"etf_pos",label:"ETF inflows positive in last 24H",hint:"Positive = institutional demand.",weight:4},{id:"etf_size",label:"ETF inflow size is meaningful",hint:"$200M+ = strong conviction.",weight:2},{id:"cvd_oi",label:"CVD vs OI checked on CoinAnk",hint:"Diverging or converging?",weight:4},{id:"cvd_read",label:"CVD and OI relationship noted",hint:"Converging = confirms the move.",weight:3},{id:"vol_tmpl",label:"Volume template reviewed on TradingView",hint:"Does volume support price action?",weight:3},{id:"vol_spike",label:"Volume spike on the key candle",hint:"High volume on breakout = real participation.",weight:3},{id:"vol_dry",label:"Volume dried up on the pullback",hint:"Low volume retrace = weak selling.",weight:3},{id:"fund_chk",label:"Funding rate checked on Coinglass",hint:"Check before entering.",weight:4,link:"https://www.coinglass.com/FundingRate/BTC"},{id:"fund_ok",label:"Funding rate not extreme (<0.05%/8H)",hint:"High positive funding = overcrowded.",weight:3}]},{id:"mtd_qual",label:"QUALITATIVE ANALYSIS",sub:"Check X, TradingView Ideas, Telegram bot.",items:[{id:"q_x",label:"X - Check sentiment and narrative",hint:"What are traders saying?",weight:3},{id:"q_tv",label:"TradingView Ideas - Check published ideas",hint:"Read recent TV ideas on BTC.",weight:3},{id:"q_bot",label:"Telegram Bot - Run /ideas",hint:"Compare against your analysis.",weight:3}]}];
const BTC_GROUPS=[{id:"bsg_price",label:"PRICE & OVERVIEW",links:[{id:"a",label:"CoinMarketCap BTC",url:"https://coinmarketcap.com/currencies/bitcoin/"},{id:"b",label:"TradingView Overview",url:"https://www.tradingview.com/symbols/BTCUSDT.P/"},{id:"c",label:"Barchart - BTC History",url:"https://www.barchart.com/crypto/quotes/%5EBTCUSD/price-history/historical"}]},{id:"bsg_flow",label:"ORDER FLOW",links:[{id:"a",label:"Orderbook (Futures)",url:"https://www.coinglass.com/mergev2/BTC-USDT"},{id:"b",label:"Longs vs Shorts",url:"https://www.coinglass.com/LongShortRatio"},{id:"c",label:"Daily Exchange Volume",url:"https://www.theblock.co/data/crypto-markets/spot/total-exchange-volume-daily/embed"}]},{id:"bsg_ta",label:"TECHNICAL ANALYSIS",links:[{id:"a",label:"BTC Technical Analysis",url:"https://coinalyze.net/bitcoin/technical-analysis/"},{id:"b",label:"Indicators Summary",url:"https://www.tradingview.com/symbols/BTCUSD/technicals/"},{id:"c",label:"Superchart - Coinalyze",url:"https://coinalyze.net/bitcoin/usd/binance/btcusd_perp/price-chart-live/"},{id:"d",label:"Superchart - Coinglass",url:"https://www.coinglass.com/tv/Binance_BTCUSDT"}]},{id:"bsg_onchain",label:"ON-CHAIN & SENTIMENT",links:[{id:"a",label:"CryptoQuant",url:"https://cryptoquant.com/asset/btc/summary"},{id:"b",label:"Glassnode - Active Addresses",url:"https://studio.glassnode.com/charts/addresses.ActiveCount?a=BTC"},{id:"c",label:"Google Trends (BTC)",url:"https://trends.google.com/trends/explore?date=today%203-m&geo=CA&q=bitcoin"}]}];
const ALT_RESEARCH_GROUPS=[{id:"ar_market",label:"MARKET OVERVIEW",links:[{id:"a",label:"Crypto Bubbles",url:"https://cryptobubbles.net/"},{id:"b",label:"Cryptocurrency Sectors 24H",url:"https://coinmarketcap.com/cryptocurrency-category/"}]},{id:"ar_etf",label:"ETF & POSITIONING",links:[{id:"a",label:"ETF Tracker (ETH)",url:"https://coinank.com/etf/EthEtf"},{id:"b",label:"Top Futures Trader Positions",url:"https://www.coinglass.com/position"}]},{id:"ar_scan",label:"SCREENERS",links:[{id:"a",label:"Better Crypto Scanner",url:"https://bettertrader.io/cryptoscanner"},{id:"b",label:"RSI Heatmap",url:"https://coinank.com/chart/derivatives/rsi-map"},{id:"c",label:"Crypto Derivatives Visual Screener",url:"https://coinank.com/chart/derivatives/visual-map"}]}];
const ALT_LIST=[{id:"p1",phase:true,label:"PHASE 1 - SOCIAL & SENTIMENT",sub:"Search the token across platforms."},{id:"a_x",tag:"X",label:"X - Search token on your trading account",hint:"Sentiment, key takes.",weight:3},{id:"a_tg",tag:"TG",label:"Telegram - Search token in crypto groups",hint:"Major trading channels.",weight:3},{id:"a_g",tag:"GOOGLE",label:"Google - Token name + news (72H only)",hint:"Recent listings, partnerships, FUD?",weight:2},{id:"a_mn",tag:"MEXC",label:"MEXC - % notification alert fired",hint:"Large % move alert triggered?",weight:3},{id:"a_s",tag:"SENT",label:"Overall sentiment: net bullish",hint:"Is the crowd leaning long?",weight:2},{id:"p2",phase:true,label:"PHASE 2 - MARKET DATA",sub:"Where does this token sit vs the market?"},{id:"m_cs",tag:"CMC",label:"CMC Sectors - Token in hot sector (24H)",hint:"Sector up 5%+ in 24H?",weight:4},{id:"m_ct",tag:"CMC",label:"CMC Trending - Token on trending list",hint:"Retail attention incoming.",weight:3},{id:"m_mf",tag:"MEXC",label:"MEXC Futures - Token in top % movers",hint:"Top 20 MEXC futures % change.",weight:3},{id:"m_ms",tag:"MEXC",label:"MEXC Spot - Token in top spot movers",hint:"Spot leading futures = organic.",weight:2},{id:"m_tv",tag:"TV",label:"TradingView - Token in top % change",hint:"TV screener % change.",weight:3},{id:"p3",phase:true,label:"PHASE 3 - SCREENERS & CHARTS",sub:"Look at the actual chart."},{id:"c_ts",tag:"TV",label:"TradingView Screener - Token passes filter",hint:"RSI < 35 or > 65, volume spike.",weight:4},{id:"c_rh",tag:"RSI",label:"RSI Heatmap - Token at RSI extreme",hint:"RSI < 30 oversold, > 70 overbought.",weight:4},{id:"c_ma",tag:"TA",label:"Price above key MAs (EMA 20 / EMA 50)",hint:"Above MAs = momentum aligned.",weight:3},{id:"c_vo",tag:"TA",label:"Volume spike visible on chart",hint:"2x+ volume vs 20-period avg.",weight:3},{id:"c_st",tag:"TA",label:"Market structure intact (Higher Lows)",hint:"HH + HL = trend is your friend.",weight:3},{id:"p4",phase:true,label:"PHASE 4 - TOOL CHECKS",sub:"Run through Brave bookmark tools."},{id:"t_e",tag:"ETF",label:"ETH ETF Inflows - Positive",hint:"Positive ETF inflows = risk-on.",weight:3},{id:"t_fp",tag:"FUTURES",label:"Top Futures Traders - Not max long",hint:"Max long = crowded trade.",weight:3},{id:"t_d",tag:"DERIV",label:"Derivatives Screener - OI and funding OK",hint:"Funding > 0.1%/8H = overcrowded.",weight:4},{id:"t_sc",tag:"SCAN",label:"Better Crypto Scanner - Token passes",hint:"Breakout or reversal setup?",weight:3},{id:"p5",phase:true,label:"PHASE 5 - FINAL FILTER",sub:"Hard rules before entry."},{id:"f_v",label:"24H volume > 2x 7-day average",hint:"Volume spike = real demand.",weight:4},{id:"f_b",label:"BTC.D not strongly rising",hint:"Rising dominance = alts get drained.",weight:4},{id:"f_f",label:"Funding rate below 0.05%/8H",hint:"Not overcrowded.",weight:3},{id:"f_u",label:"USDT.D not rising aggressively",hint:"Rising USDT.D = risk-off.",weight:4}];
const VIEWS=[{id:"home",label:"HOME",dot:"#e4e4e7"},{id:"markettd",label:"MARKET TOP-DOWN",dot:"#a78bfa"},{id:"bottomup",label:"CRYPTO BOTTOM-UP",dot:"#38bdf8"},{id:"btcstrat",label:"BTC STRATEGY",dot:"#f97316"},{id:"altres",label:"ALT RESEARCH",dot:"#f59e0b"},{id:"drafting",label:"DRAFTING IDEAS",dot:"#71717a"}];

const st={view:"home",menuOpen:false,checks:{},collapsed:{},filter:"all",altToken:"",altChecks:{},altCollapsed:{},altFilter:"all",drafts:[{id:1,text:"",done:false}],draftsOpen:false,tdStep:1,td:{usdt_above_ema:null,usdt_change:"",btc_d_rising:null,total_bull:null,dxy_bull:null,blackout:false,adx:"",price_ema50:null,ema50_ema200:null,atr_state:null,daily_ema200:null,ema50_cross:null,structure:null,trend:null,momentum:null,reversal:null,participation:null,volatility:null,cipher:null,balance:"",risk:"1",atr_val:"",entry:"",dir:null},linkOpen:{},cuOpen:false,mtdCollapsed:{}};
Object.assign(st, JSON.parse(localStorage.getItem('de-state') || '{}'));

function fmt(n,d=0){if(isNaN(n)||!isFinite(n))return"-";return Number(n).toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});}
function pill(color,text){const m={green:"background:rgba(6,78,59,0.5);color:#6ee7b7;border:1px solid rgba(16,185,129,0.4)",red:"background:rgba(127,29,29,0.5);color:#fca5a5;border:1px solid rgba(239,68,68,0.4)",amber:"background:rgba(120,53,15,0.5);color:#fcd34d;border:1px solid rgba(245,158,11,0.4)",blue:"background:rgba(12,74,110,0.5);color:#7dd3fc;border:1px solid rgba(14,165,233,0.4)",gray:"background:rgba(39,39,42,0.8);color:#a1a1aa;border:1px solid rgba(63,63,70,0.5)"};return`<span style="font-size:11px;font-family:monospace;padding:2px 8px;border-radius:3px;${m[color]||m.gray}">${text}</span>`;}
function tagBadge(tag){const t=TAG_STYLE[tag];if(!t)return"";return`<span style="background:${t.bg};color:${t.text};border:1px solid ${t.border};font-size:10px;font-family:monospace;padding:2px 6px;border-radius:3px;">${tag}</span>`;}

function checkItem(item,value,index,checkKey){
  const isY=value==="yes",isN=value==="no",isS=value==="skip";
  const rowBg=isY?"background:rgba(5,46,22,0.15)":isN?"background:rgba(69,10,10,0.15)":"";
  const boxStyle=isY?"background:#10b981;border-color:#10b981;color:#000":isN?"background:#ef4444;border-color:#ef4444;color:#fff":isS?"background:#3f3f46;border-color:#52525b;color:#a1a1aa":"border:1px solid #3f3f46;color:#52525b";
  const boxTxt=isY?"✓":isN?"✕":isS?"-":index;
  const yS=isY?"background:rgba(6,78,59,0.6);color:#6ee7b7;border-color:#10b981":"border:1px solid #27272a;color:#52525b";
  const nS=isN?"background:rgba(127,29,29,0.6);color:#fca5a5;border-color:#ef4444":"border:1px solid #27272a;color:#52525b";
  const sS=isS?"background:#3f3f46;color:#d4d4d8;border-color:#52525b":"border:1px solid #27272a;color:#52525b";
  const hw=item.weight>=4?`<span style="font-size:10px;font-family:monospace;color:#d97706;margin-left:4px;">HIGH WT</span>`:"";
  return`<div style="border-bottom:1px solid rgba(39,39,42,0.4);${rowBg}"><div style="display:flex;align-items:flex-start;gap:10px;padding:10px 16px;"><div style="flex-shrink:0;width:22px;padding-top:2px;"><div style="width:20px;height:20px;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:11px;font-family:monospace;${boxStyle}">${boxTxt}</div></div><div style="flex:1;min-width:0;"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">${item.tag?tagBadge(item.tag):""}<span style="font-size:11px;font-family:monospace;color:${isY?"#e4e4e7":isN?"#52525b":"#d4d4d8"}">${item.label}</span>${hw}</div>${item.hint?`<div style="font-size:10px;font-family:monospace;color:#3f3f46;margin-top:2px;">${item.hint}</div>`:""}</div><div style="display:flex;gap:4px;flex-shrink:0;margin-top:2px;"><button style="padding:3px 8px;font-size:10px;font-family:monospace;border-radius:3px;cursor:pointer;${yS}" data-deaction="check" data-id="${item.id}" data-val="yes" data-key="${checkKey}">YES</button><button style="padding:3px 8px;font-size:10px;font-family:monospace;border-radius:3px;cursor:pointer;${nS}" data-deaction="check" data-id="${item.id}" data-val="no" data-key="${checkKey}">NO</button><button style="padding:3px 8px;font-size:10px;font-family:monospace;border-radius:3px;cursor:pointer;${sS}" data-deaction="check" data-id="${item.id}" data-val="skip" data-key="${checkKey}">-</button></div></div></div>`;
}

function grpHdr(id,label,sub,yes,total,collapsed){
  return`<button style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:transparent;border:none;border-bottom:1px solid #1c1c1e;cursor:pointer;text-align:left;" data-deaction="toggle-group" data-group="${id}"><div style="flex:1;min-width:0;"><div style="font-size:11px;font-family:monospace;font-weight:600;color:#e4e4e7;letter-spacing:.05em;">${label}</div>${sub?`<div style="font-size:10px;font-family:monospace;color:#52525b;margin-top:2px;">${sub}</div>`:""}</div><div style="display:flex;align-items:center;gap:8px;margin-left:10px;flex-shrink:0;"><span style="font-size:11px;font-family:monospace;color:#10b981;">${yes}</span><span style="font-size:11px;font-family:monospace;color:#3f3f46;">/</span><span style="font-size:11px;font-family:monospace;color:#71717a;">${total}</span><span style="font-size:11px;font-family:monospace;color:#52525b;">${collapsed?"▶":"▼"}</span></div></button>`;
}

function linkDrop(gid,label,links){
  const open=st.linkOpen[gid];
  return`<div style="border:1px solid #1c1c1e;border-radius:3px;overflow:hidden;margin-bottom:4px;"><button style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:transparent;border:none;cursor:pointer;" data-deaction="toggle-link" data-linkgroup="${gid}"><span style="font-size:11px;font-family:monospace;color:#a1a1aa;">${label}</span><div style="display:flex;align-items:center;gap:6px;"><span style="font-size:10px;font-family:monospace;color:#52525b;">${links.length}</span><span style="font-size:10px;font-family:monospace;color:#52525b;">${open?"▼":"▶"}</span></div></button>${open?`<div style="border-top:1px solid #1c1c1e;">${links.map(l=>`<a href="${l.url}" target="_blank" style="display:flex;align-items:center;gap:10px;padding:8px 16px;border-bottom:1px solid rgba(28,28,30,0.5);text-decoration:none;" onmouseover="this.style.background='#1c1c1e'" onmouseout="this.style.background='transparent'"><span style="font-size:10px;font-family:monospace;color:#3f3f46;">↗</span><span style="font-size:11px;font-family:monospace;color:#71717a;">${l.label}</span></a>`).join("")}</div>`:""}</div>`;
}

function row(label,hint,content){
  return`<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 16px;border-bottom:1px solid rgba(39,39,42,0.4);"><div><div style="font-size:11px;font-family:monospace;color:#d4d4d8;">${label}</div>${hint?`<div style="font-size:10px;font-family:monospace;color:#3f3f46;margin-top:2px;">${hint}</div>`:""}</div>${content}</div>`;
}
function ct(key,tl,fl){
  const val=st.td[key];
  const yA=val===true?"background:rgba(6,78,59,0.5);color:#6ee7b7;border-color:#10b981":"border:1px solid #27272a;color:#52525b";
  const nA=val===false?"background:rgba(127,29,29,0.5);color:#fca5a5;border-color:#ef4444":"border:1px solid #27272a;color:#52525b";
  return`<div style="display:flex;gap:4px;"><button style="padding:4px 10px;font-size:10px;font-family:monospace;border-radius:3px;cursor:pointer;${yA}" data-deaction="set-td" data-key="${key}" data-value="true">${tl}</button><button style="padding:4px 10px;font-size:10px;font-family:monospace;border-radius:3px;cursor:pointer;${nA}" data-deaction="set-td" data-key="${key}" data-value="false">${fl}</button></div>`;
}
function mu(key,opts){
  const val=st.td[key];
  return`<div style="display:flex;flex-wrap:wrap;gap:4px;">${opts.map(o=>`<button style="padding:4px 10px;font-size:10px;font-family:monospace;border-radius:3px;cursor:pointer;${val===o.v?"background:#3f3f46;color:#e4e4e7;border:1px solid #52525b":"border:1px solid #27272a;color:#52525b"}" data-deaction="set-td" data-key="${key}" data-value="${o.v}">${o.l}</button>`).join("")}</div>`;
}
function fld(key,ph){
  return`<input value="${st.td[key]||""}" placeholder="${ph}" style="width:110px;background:#18181b;border:1px solid #3f3f46;color:#e4e4e7;font-size:11px;font-family:monospace;padding:6px 8px;border-radius:3px;" data-deaction="td-input" data-key="${key}"/>`;
}
function ph(title,right){
  return`<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #1c1c1e;"><span style="font-size:10px;font-family:monospace;color:#52525b;letter-spacing:.1em;">${title}</span>${right||""}</div>`;
}
function panel(content){return`<div style="border:1px solid #1c1c1e;border-radius:3px;margin-bottom:12px;">${content}</div>`;}
function fbar(fkey,label){
  const f=st[fkey];
  return`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;"><span style="font-size:10px;font-family:monospace;color:#3f3f46;">${label}</span><div style="display:flex;gap:4px;"><button style="padding:4px 10px;font-size:10px;font-family:monospace;border-radius:3px;cursor:pointer;${f==="all"?"background:#3f3f46;color:#e4e4e7;border:1px solid #52525b":"border:1px solid #27272a;color:#52525b"}" data-deaction="set-filter" data-filterkey="${fkey}" data-filterval="all">ALL</button><button style="padding:4px 10px;font-size:10px;font-family:monospace;border-radius:3px;cursor:pointer;${f==="unanswered"?"background:#3f3f46;color:#e4e4e7;border:1px solid #52525b":"border:1px solid #27272a;color:#52525b"}" data-deaction="set-filter" data-filterkey="${fkey}" data-filterval="unanswered">UNANSWERED</button><button style="padding:4px 10px;font-size:10px;font-family:monospace;border-radius:3px;cursor:pointer;border:1px solid #27272a;color:#52525b;" data-deaction="reset-checks" data-filterkey="${fkey}">RESET</button></div></div>`;
}

function buildHome(){
  const now=new Date();
  const t=now.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:true});
  const d=now.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  const wf=[{id:"markettd",n:"01",label:"MARKET TOP-DOWN",desc:"Get the macro picture first.",dot:"#a78bfa"},{id:"bottomup",n:"02",label:"CRYPTO BOTTOM-UP",desc:"Review all object trees.",dot:"#38bdf8"},{id:"btcstrat",n:"03",label:"BTC STRATEGY",desc:"Deep dive into BTC.",dot:"#f97316"},{id:"altres",n:"04",label:"ALT RESEARCH",desc:"Scan for alt opportunities.",dot:"#f59e0b"}];
  return`<div style="margin-bottom:28px;"><div style="font-size:10px;font-family:monospace;color:#3f3f46;margin-bottom:4px;">${d}</div><div style="font-size:24px;font-family:monospace;font-weight:700;color:#e4e4e7;margin-bottom:4px;">Decision Engine</div><div style="font-size:10px;font-family:monospace;color:#52525b;">@DiamondHands811 · ${t}</div></div><div style="margin-bottom:20px;"><div style="font-size:10px;font-family:monospace;color:#3f3f46;letter-spacing:.1em;margin-bottom:8px;">SESSION WORKFLOW</div>${wf.map(w=>`<button style="width:100%;display:flex;align-items:center;gap:12px;padding:10px 14px;border:1px solid #1c1c1e;border-radius:3px;background:#0d0d0f;margin-bottom:4px;cursor:pointer;text-align:left;" data-deaction="nav" data-view="${w.id}" onmouseover="this.style.background='#1c1c1e'" onmouseout="this.style.background='#0d0d0f'"><span style="font-size:10px;font-family:monospace;color:#3f3f46;width:20px;">${w.n}</span><div style="width:8px;height:8px;border-radius:50%;background:${w.dot};flex-shrink:0;"></div><div style="flex:1;"><div style="font-size:11px;font-family:monospace;font-weight:600;color:#d4d4d8;">${w.label}</div><div style="font-size:10px;font-family:monospace;color:#3f3f46;margin-top:2px;">${w.desc}</div></div><span style="font-size:11px;font-family:monospace;color:#27272a;">→</span></button>`).join("")}</div><div style="margin-bottom:16px;"><div style="font-size:10px;font-family:monospace;color:#3f3f46;letter-spacing:.1em;margin-bottom:8px;">ALL SECTIONS</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">${VIEWS.filter(v=>v.id!=="home").map(v=>`<button style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #1c1c1e;border-radius:3px;background:transparent;cursor:pointer;text-align:left;" data-deaction="nav" data-view="${v.id}"><div style="width:6px;height:6px;border-radius:50%;background:${v.dot};flex-shrink:0;"></div><span style="font-size:10px;font-family:monospace;color:#52525b;">${v.label}</span></button>`).join("")}</div></div><div style="border:1px solid rgba(28,28,30,0.5);border-radius:3px;padding:14px;text-align:center;"><div style="font-size:10px;font-family:monospace;color:#3f3f46;font-style:italic;">"Process over prediction. System over impulse."</div></div>`;
}

function buildMTD(){
  let h=`<div style="border:1px solid #1c1c1e;border-radius:3px;margin-bottom:16px;overflow:hidden;"><button style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:transparent;border:none;cursor:pointer;" data-deaction="toggle-cu"><div><div style="font-size:11px;font-family:monospace;font-weight:600;color:#e4e4e7;">DASHBOARD - QUICK LINKS</div></div><span style="font-size:10px;font-family:monospace;color:#52525b;">${st.cuOpen?"▼":"▶"}</span></button>${st.cuOpen?`<div style="padding:8px;border-top:1px solid #1c1c1e;">${CU_GROUPS.map(g=>linkDrop(g.id,g.label,g.links)).join("")}</div>`:""}</div><div style="display:flex;flex-direction:column;gap:8px;">`;
  MTD_GROUPS.forEach(grp=>{
    const yes=grp.items.filter(i=>st.checks[i.id]==="yes").length,isC=st.mtdCollapsed[grp.id]!==false;
    h+=`<div style="border:1px solid #1c1c1e;border-radius:3px;overflow:hidden;">${grpHdr(grp.id,grp.label,grp.sub,yes,grp.items.length,isC)}`;
    if(!isC){h+="<div>";grp.items.forEach((item,idx)=>{h+=checkItem(item,st.checks[item.id]||null,idx+1,"checks");if(item.link)h+=`<div style="padding:0 16px 10px;"><a href="${item.link}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;font-size:10px;font-family:monospace;border:1px solid #3f3f46;color:#a1a1aa;border-radius:3px;text-decoration:none;">↗ Coinglass Funding</a></div>`;});h+="</div>";}
    h+="</div>";
  });
  return h+"</div>";
}

function buildBU(){
  const sections=[];let curSec=null,curGrp=null;
  const buList=[{id:"sec1",sectionDiv:true,label:"SECTION 1 - OBJECT TREE",sub:"Open TradingView. Review each chart."},...OT_TOKENS.flatMap(t=>[{id:`g_${t.prefix}`,group:true,label:`${t.label} - OBJECT TREE`,sub:t.sub},...OT_TEMPLATE.map(i=>({...i,id:`${t.prefix}_${i.id}`}))])];
  buList.forEach(i=>{if(i.sectionDiv){curSec={...i,groups:[]};sections.push(curSec);curGrp=null;}else if(i.group){curGrp={...i,items:[]};if(curSec)curSec.groups.push(curGrp);}else if(curGrp)curGrp.items.push(i);});
  let h=fbar("filter","S1: OBJECT TREE · S2: SAVED DRAFTS");
  sections.forEach(sec=>{
    const all=sec.groups.flatMap(g=>g.items),secY=all.filter(i=>st.checks[i.id]==="yes").length;
    h+=`<div style="display:flex;align-items:center;gap:10px;margin:16px 0 10px;"><div style="flex:1;height:1px;background:#1c1c1e;"></div><div style="padding:4px 10px;border:1px solid #27272a;border-radius:3px;background:#0d0d0f;font-size:10px;font-family:monospace;font-weight:600;color:#a1a1aa;letter-spacing:.1em;">${sec.label}</div><div style="font-size:10px;font-family:monospace;color:#52525b;">${secY}/${all.length}</div><div style="flex:1;height:1px;background:#1c1c1e;"></div></div>`;
    sec.groups.forEach(grp=>{
      const yes=grp.items.filter(i=>st.checks[i.id]==="yes").length,isC=st.collapsed[grp.id]!==false;
      h+=`<div style="border:1px solid #1c1c1e;border-radius:3px;overflow:hidden;margin-bottom:8px;">${grpHdr(grp.id,grp.label,grp.sub,yes,grp.items.length,isC)}`;
      if(!isC){h+="<div>";let idx=0;grp.items.forEach(item=>{if(st.filter==="unanswered"&&st.checks[item.id])return;idx++;h+=checkItem(item,st.checks[item.id]||null,idx,"checks");});h+="</div>";}
      h+="</div>";
    });
  });
  const done=st.drafts.filter(d=>d.done).length;
  h+=`<div style="display:flex;align-items:center;gap:10px;margin:16px 0 10px;"><div style="flex:1;height:1px;background:#1c1c1e;"></div><div style="padding:4px 10px;border:1px solid #27272a;border-radius:3px;background:#0d0d0f;font-size:10px;font-family:monospace;font-weight:600;color:#a1a1aa;letter-spacing:.1em;">SECTION 2 - SAVED DRAFTS</div><div style="font-size:10px;font-family:monospace;color:#52525b;">${done}/${st.drafts.length}</div><div style="flex:1;height:1px;background:#1c1c1e;"></div></div><div style="border:1px solid #1c1c1e;border-radius:3px;overflow:hidden;"><button style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:transparent;border:none;cursor:pointer;" data-deaction="toggle-drafts"><div style="display:flex;align-items:center;gap:10px;"><span style="font-size:11px;font-family:monospace;font-weight:600;color:#e4e4e7;">CHART DRAFTS</span><a href="https://t.me/tesr56788/14817" target="_blank" onclick="event.stopPropagation()" style="font-size:10px;font-family:monospace;padding:2px 8px;border:1px solid #27272a;color:#71717a;border-radius:3px;text-decoration:none;">↗ Telegram Drafts</a></div><div style="display:flex;align-items:center;gap:6px;"><span style="font-size:11px;font-family:monospace;color:#10b981;">${done}</span><span style="font-size:10px;font-family:monospace;color:#3f3f46;">/</span><span style="font-size:11px;font-family:monospace;color:#71717a;">${st.drafts.length}</span><span style="font-size:10px;font-family:monospace;color:#52525b;">${st.draftsOpen?"▼":"▶"}</span></div></button>`;
  if(st.draftsOpen){h+="<div>";st.drafts.forEach((d,i)=>{h+=`<div style="display:flex;align-items:center;gap:10px;padding:8px 16px;border-bottom:1px solid rgba(28,28,30,0.4);${d.done?"background:rgba(5,46,22,0.1)":""}"><div style="width:20px;height:20px;border-radius:3px;border:1px solid ${d.done?"#10b981":"#3f3f46"};display:flex;align-items:center;justify-content:center;font-size:11px;font-family:monospace;cursor:pointer;${d.done?"background:#10b981;color:#000":"color:#52525b"}" data-deaction="toggle-draft" data-draftid="${d.id}">${d.done?"✓":i+1}</div><input value="${d.text.replace(/"/g,"&quot;")}" placeholder="Draft ${i+1} - describe the setup..." style="flex:1;background:transparent;border:none;border-bottom:1px solid #1c1c1e;color:${d.done?"#52525b":"#d4d4d8"};font-size:11px;font-family:monospace;padding:2px 0;${d.done?"text-decoration:line-through":""}" data-deaction="edit-draft" data-draftid="${d.id}"/><button style="font-size:10px;font-family:monospace;color:#27272a;background:transparent;border:none;cursor:pointer;" data-deaction="remove-draft" data-draftid="${d.id}">✕</button></div>`;});h+=`<button style="width:100%;padding:8px 16px;font-size:10px;font-family:monospace;color:#3f3f46;background:transparent;border:none;border-top:1px solid #1c1c1e;cursor:pointer;text-align:left;" data-deaction="add-draft">+ add draft</button></div>`;}
  return h+"</div>";
}

function buildBTC(){return`<div style="border:1px solid #1c1c1e;border-radius:3px;padding:14px;margin-bottom:16px;"><div style="font-size:10px;font-family:monospace;color:#52525b;letter-spacing:.1em;margin-bottom:4px;">BTC STRATEGY</div><div style="font-size:10px;font-family:monospace;color:#3f3f46;">All BTC research and analysis tools.</div></div>${BTC_GROUPS.map(g=>linkDrop(g.id,g.label,g.links)).join("")}`;}

function buildAlt(){
  const phases=[];let cur=null;ALT_LIST.forEach(i=>{if(i.phase){cur={...i,items:[]};phases.push(cur);}else if(cur)cur.items.push(i);});
  let total=0,earned=0,answered=0;ALT_LIST.forEach(i=>{if(i.phase)return;total+=i.weight||1;if(st.altChecks[i.id]==="yes"){earned+=i.weight||1;answered++;}else if(st.altChecks[i.id]==="no")answered++;});
  const pct=total?Math.round((earned/total)*100):0;
  let verdict={label:"RESEARCHING...",color:"#52525b",sub:"Work through each phase."};
  if(answered>=5){if(pct>=80)verdict={label:"HIGH CONVICTION",color:"#10b981",sub:"Strong signal."};else if(pct>=65)verdict={label:"MODERATE SIGNAL",color:"#f59e0b",sub:"Wait for 1 more confirmation."};else if(pct>=45)verdict={label:"WEAK SIGNAL",color:"#f97316",sub:"Too many gaps."};else verdict={label:"PASS - NO TRADE",color:"#ef4444",sub:"Not enough confluence."};}
  let h=`${ALT_RESEARCH_GROUPS.map(g=>linkDrop(g.id,g.label,g.links)).join("")}<div style="border:1px solid #1c1c1e;border-radius:3px;padding:14px;margin:16px 0;"><div style="font-size:10px;font-family:monospace;color:#52525b;letter-spacing:.1em;margin-bottom:10px;">TOKEN UNDER RESEARCH</div><div style="display:flex;gap:8px;"><input value="${st.altToken}" placeholder="e.g. HBAR, SUI, TAO..." style="flex:1;background:#18181b;border:1px solid #3f3f46;color:#e4e4e7;font-size:12px;font-family:monospace;padding:8px;border-radius:3px;" data-deaction="set-token"/><button style="padding:8px 14px;font-size:10px;font-family:monospace;border:1px solid #27272a;color:#52525b;background:transparent;border-radius:3px;cursor:pointer;" data-deaction="clear-token">CLEAR</button></div>${st.altToken?`<div style="display:flex;align-items:center;gap:8px;margin-top:10px;"><div style="width:6px;height:6px;border-radius:50%;background:#f59e0b;"></div><span style="font-size:10px;font-family:monospace;color:#f59e0b;letter-spacing:.1em;">RESEARCHING: ${st.altToken}</span></div>`:""}</div>${fbar("altFilter","RESEARCH PHASES")}<div style="display:flex;flex-direction:column;gap:8px;">`;
  phases.forEach(ph=>{
    const yes=ph.items.filter(i=>st.altChecks[i.id]==="yes").length,isC=st.altCollapsed[ph.id]!==false;
    h+=`<div style="border:1px solid #1c1c1e;border-radius:3px;overflow:hidden;">${grpHdr(ph.id,ph.label,ph.sub,yes,ph.items.length,isC)}`;
    if(!isC){h+="<div>";let idx=0;ph.items.forEach(item=>{if(st.altFilter==="unanswered"&&st.altChecks[item.id])return;idx++;h+=checkItem(item,st.altChecks[item.id]||null,idx,"altChecks");});h+="</div>";}
    h+="</div>";
  });
  h+="</div>";
  if(answered>=10)h+=`<div style="margin-top:16px;border:1px solid ${verdict.color}40;border-radius:3px;padding:14px;background:${verdict.color}08;"><div style="display:flex;align-items:flex-start;justify-content:space-between;"><div><div style="font-size:10px;font-family:monospace;color:#52525b;margin-bottom:4px;">${st.altToken?st.altToken+" - ":""}VERDICT</div><div style="font-size:18px;font-family:monospace;font-weight:700;color:${verdict.color};">${verdict.label}</div><div style="font-size:10px;font-family:monospace;color:#71717a;margin-top:4px;">${verdict.sub}</div></div><div style="text-align:right;margin-left:16px;"><div style="font-size:10px;font-family:monospace;color:#52525b;">SCORE</div><div style="font-size:36px;font-family:monospace;font-weight:700;color:${verdict.color};">${pct}%</div></div></div></div>`;
  return h;
}

function buildDrafting(){
  const notes=[{id:"dn_ind",title:"Indicator setup",lines:["Object tree from HTF to LTF","Volatility (indicator + chart)","2x Volume + MA","MACD for range","Moving avgs for trend","Stochastic/AO/Cipher (accumulation vs distribution)","USDT.D vs BTC"]},{id:"dn_alt",title:"Alt research",lines:["Use trading X account","Telegram/Twitter/Google search of the specific crypto token","Mexc % notification - futures and spot % change","Coinmarketcap hot sectors","TradingView % change + screener/heatmaps","ETH ETF inflows, Top Futures Positions, Sectors 24H","Cryptoalerts.ai, Correlation Tool, Better Crypto Scanner","Crypto Derivatives Visual Screener, Cryptopy, RSI Heatmap","Supercharts, order book, moving avgs, oscillators, divergences","Market structure, oversold/overbought, local tops/bottoms","GPT TA agent, Telegram TA bot, Sharebot67","Templates, Trading focus, Volatility checker","Fundamental analysis, Technical analysis, Sentiment analysis","Qualitative analysis, Risk management"]}];
  return`<div style="border:1px solid #1c1c1e;border-radius:3px;padding:14px;margin-bottom:16px;"><div style="font-size:10px;font-family:monospace;color:#52525b;letter-spacing:.1em;margin-bottom:4px;">DRAFTING IDEAS</div><div style="font-size:10px;font-family:monospace;color:#3f3f46;">Reference notes.</div></div><div style="display:flex;flex-direction:column;gap:8px;">${notes.map(n=>{const isC=st.collapsed[n.id]!==false;return`<div style="border:1px solid #1c1c1e;border-radius:3px;overflow:hidden;"><button style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:transparent;border:none;cursor:pointer;" data-deaction="toggle-group" data-group="${n.id}"><span style="font-size:11px;font-family:monospace;font-weight:600;color:#e4e4e7;">${n.title}</span><span style="font-size:10px;font-family:monospace;color:#52525b;">${isC?"▶":"▼"}</span></button>${!isC?`<div style="padding:10px 16px;border-top:1px solid #1c1c1e;">${n.lines.map(l=>`<div style="font-size:10px;font-family:monospace;color:#71717a;line-height:1.8;">${l}</div>`).join("")}</div>`:""}</div>`;}).join("")}</div>`;
}

function buildTD(){
  const s=st.td,step=st.tdStep;
  const uc=parseFloat(s.usdt_change),ro=s.usdt_above_ema===true&&uc>0.75,rn=s.usdt_above_ema===false&&uc<-0.25;
  const ms=s.blackout?"BLACKOUT":ro?"RISK_OFF":rn?"RISK_ON":"NEUTRAL";
  const msc=s.blackout?0:rn?20:ro?0:10,mc={RISK_ON:"green",RISK_OFF:"red",NEUTRAL:"amber",BLACKOUT:"amber"}[ms];
  const adx=parseFloat(s.adx);let regime="UNCLASSIFIED",rc="gray";
  if(s.atr_state==="high"){regime="VOLATILE EXP";rc="amber";}else if(s.atr_state==="low"){regime="COMPRESSION";rc="gray";}else if(adx>25&&s.price_ema50==="above"&&s.ema50_ema200==="above"){regime="TREND UP";rc="green";}else if(adx>25&&s.price_ema50==="below"&&s.ema50_ema200==="below"){regime="TREND DOWN";rc="red";}else if(adx<20){regime="RANGE";rc="blue";}
  const b3=s.daily_ema200==="above"&&s.ema50_cross===true&&s.structure==="HL",be3=s.daily_ema200==="below"&&s.ema50_cross===false&&s.structure==="LH";
  const bl=b3?"BULLISH":be3?"BEARISH":"NEUTRAL",bsc=(b3||be3)?30:15,bc={BULLISH:"green",BEARISH:"red",NEUTRAL:"amber"}[bl];
  const fired=[s.trend,s.momentum,s.reversal,s.participation,s.volatility].filter(v=>v===true).length;
  const sigsc=fired>=3?20:fired===2?10:0,volsc=s.participation===true?15:s.participation===false?0:7,atsc=s.volatility===true?10:0,fsc=s.cipher==="accum"?5:0;
  const conf=Math.min(100,bsc+msc+sigsc+volsc+atsc+fsc),sco=conf>=80?"#10b981":conf>=65?"#f59e0b":"#ef4444";
  const sm=conf>=80?1:conf>=65?0.5:conf>=50?0.25:0;
  const bal=parseFloat(s.balance),rf=parseFloat(s.risk)/100,av=parseFloat(s.atr_val),ep=parseFloat(s.entry);
  const ev=!!(bal&&av&&ep&&s.dir&&sm>0),ra=ev?bal*rf*sm:0,sd=ev?1.5*av:0,ps=ev?ra/sd:0;
  const sp=ev?(s.dir==="long"?ep-sd:ep+sd):0,t1=ev?(s.dir==="long"?ep+1.5*sd:ep-1.5*sd):0,t2=ev?(s.dir==="long"?ep+2.5*sd:ep-2.5*sd):0;
  const cc={green:"color:#10b981",red:"color:#ef4444",amber:"color:#f59e0b",blue:"color:#38bdf8",gray:"color:#52525b"};
  const steps=[{id:1,label:"Macro",dot:ms==="RISK_ON"?"#10b981":ms==="RISK_OFF"?"#ef4444":"#f59e0b"},{id:2,label:"Regime",dot:rc==="green"?"#10b981":rc==="red"?"#ef4444":rc==="blue"?"#38bdf8":"#f59e0b"},{id:3,label:"Bias",dot:bc==="green"?"#10b981":bc==="red"?"#ef4444":"#f59e0b"},{id:4,label:"Signals",dot:fired>=3?"#10b981":fired>=2?"#f59e0b":"#ef4444"},{id:5,label:"Score",dot:conf>=80?"#10b981":conf>=65?"#f59e0b":"#ef4444"},{id:6,label:"Execute",dot:ev?"#10b981":"#27272a"}];
  let h=`<div style="display:flex;gap:2px;margin-bottom:20px;border:1px solid #1c1c1e;border-radius:3px;overflow:hidden;">${steps.map(st2=>`<button style="flex:1;padding:10px 6px;text-align:left;background:${step===st2.id?"#1c1c1e":"transparent"};border:none;border-right:1px solid #1c1c1e;cursor:pointer;last-child{border-right:none}" data-deaction="td-step" data-step="${st2.id}"><div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;"><div style="width:6px;height:6px;border-radius:50%;background:${st2.dot};"></div><span style="font-size:9px;font-family:monospace;color:#52525b;">${String(st2.id).padStart(2,"0")}</span></div><div style="font-size:10px;font-family:monospace;font-weight:600;color:#d4d4d8;">${st2.label}</div></button>`).join("")}</div>`;

  if(step===1){h+=`<div style="font-size:10px;font-family:monospace;color:#52525b;margin-bottom:12px;letter-spacing:.1em;">STEP 01 / MACRO - Bad macro = no trade.</div>${panel(ph("USDT.D - PRIMARY RISK GAUGE",pill(mc,ms))+row("USDT.D above 4H EMA20?","Rising = money leaving crypto = risk off",ct("usdt_above_ema","ABOVE","BELOW"))+row("USDT.D 24H % change",">+0.75% = risk-off | <-0.25% = risk-on",fld("usdt_change","e.g. -0.8")))}${panel(ph("DOMINANCE + STRUCTURE","")+row("BTC.D rising (above 4H EMA20)?","",ct("btc_d_rising","RISING","FALLING"))+row("TOTAL above Daily EMA200?","",ct("total_bull","ABOVE (BULL)","BELOW (BEAR)"))+row("DXY above Daily EMA50?","",ct("dxy_bull","YES (HEADWIND)","NO (TAILWIND)"))+row("News blackout active?","",ct("blackout","BLACKOUT","CLEAR")))}<div style="border:1px solid ${ro?"#7f1d1d":rn?"#064e3b":"#3f3f46"};border-radius:3px;padding:10px;font-size:11px;font-family:monospace;background:${ro?"#450a0a15":rn?"#022c2215":"#0d0d0f"};margin-bottom:12px;"><span style="color:#52525b;">VERDICT - </span><span style="${cc[mc]};font-weight:600;">${ms}</span><span style="color:#52525b;margin-left:12px;">${{RISK_OFF:"No longs. Shorts only. 50% size.",RISK_ON:"Longs preferred. Full size.",NEUTRAL:"Longs OK. 75% size.",BLACKOUT:"Stand aside."}[ms]}</span></div><button style="width:100%;padding:10px;font-size:10px;font-family:monospace;color:#a1a1aa;border:1px solid #1c1c1e;border-radius:3px;background:transparent;cursor:pointer;" data-deaction="td-step" data-step="2">NEXT - CLASSIFY REGIME →</button>`;}

  if(step===2){const am={"TREND UP":"Pullback longs only","TREND DOWN":"Bounce shorts only",RANGE:"Mean reversion both sides","VOLATILE EXP":"Breakout continuation",COMPRESSION:"No entries",UNCLASSIFIED:"Needs more data"};const fm={"TREND UP":"Shorts, mean reversion","TREND DOWN":"Longs, mean reversion",RANGE:"Breakout chasing","VOLATILE EXP":"Scalps, mean reversion",COMPRESSION:"Everything",UNCLASSIFIED:"Trading without clarity"};h+=`<div style="font-size:10px;font-family:monospace;color:#52525b;margin-bottom:12px;letter-spacing:.1em;">STEP 02 / REGIME</div>${panel(ph("4H STRUCTURE READ",pill(rc,regime))+row("ADX(14) value",">25 trending | <20 ranging",fld("adx","e.g. 31"))+row("Price vs 4H EMA50","",mu("price_ema50",[{l:"ABOVE",v:"above"},{l:"BELOW",v:"below"}]))+row("EMA50 vs 4H EMA200","",mu("ema50_ema200",[{l:"50>200 BULL",v:"above"},{l:"50<200 BEAR",v:"below"}]))+row("ATR vs 20-period avg","",mu("atr_state",[{l:"NORMAL",v:"normal"},{l:">1.5x HIGH",v:"high"},{l:"<0.6x LOW",v:"low"}])))}<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;"><div style="border:1px solid #1c1c1e;border-radius:3px;padding:10px;"><div style="font-size:10px;font-family:monospace;color:#52525b;margin-bottom:4px;">ALLOWED</div><div style="font-size:11px;font-family:monospace;color:#10b981;">${am[regime]||"-"}</div></div><div style="border:1px solid #1c1c1e;border-radius:3px;padding:10px;"><div style="font-size:10px;font-family:monospace;color:#52525b;margin-bottom:4px;">FORBIDDEN</div><div style="font-size:11px;font-family:monospace;color:#ef4444;">${fm[regime]||"-"}</div></div></div><div style="display:flex;gap:8px;"><button style="flex:1;padding:10px;font-size:10px;font-family:monospace;color:#52525b;border:1px solid #1c1c1e;border-radius:3px;background:transparent;cursor:pointer;" data-deaction="td-step" data-step="1">← MACRO</button><button style="flex:1;padding:10px;font-size:10px;font-family:monospace;color:#a1a1aa;border:1px solid #1c1c1e;border-radius:3px;background:transparent;cursor:pointer;" data-deaction="td-step" data-step="3">DAILY BIAS →</button></div>`;}

  if(step===3){h+=`<div style="font-size:10px;font-family:monospace;color:#52525b;margin-bottom:12px;letter-spacing:.1em;">STEP 03 / DAILY BIAS - All 3 must agree.</div>${panel(ph("3-CONDITION HTF FILTER",pill(bc,bl))+row("Daily close above EMA200?","",mu("daily_ema200",[{l:"ABOVE",v:"above"},{l:"BELOW",v:"below"}]))+row("Daily EMA50 above EMA200?","",ct("ema50_cross","YES (GOLDEN)","NO (DEATH)"))+row("Last confirmed market structure","",mu("structure",[{l:"HL (BULL)",v:"HL"},{l:"LH (BEAR)",v:"LH"},{l:"UNCLEAR",v:"unclear"}])))}<div style="border:1px solid #1c1c1e;border-radius:3px;padding:10px;margin-bottom:12px;"><div style="font-size:10px;font-family:monospace;color:#52525b;margin-bottom:4px;">VERDICT</div><div style="font-size:16px;font-family:monospace;font-weight:700;${cc[bc]}">${bl}</div><div style="font-size:10px;font-family:monospace;color:#52525b;margin-top:4px;">${{NEUTRAL:"Scalp only. 50% max.",BULLISH:"Full stack. Longs preferred.",BEARISH:"Short bias. Longs need 80+."}[bl]}</div></div><div style="display:flex;gap:8px;"><button style="flex:1;padding:10px;font-size:10px;font-family:monospace;color:#52525b;border:1px solid #1c1c1e;border-radius:3px;background:transparent;cursor:pointer;" data-deaction="td-step" data-step="2">← REGIME</button><button style="flex:1;padding:10px;font-size:10px;font-family:monospace;color:#a1a1aa;border:1px solid #1c1c1e;border-radius:3px;background:transparent;cursor:pointer;" data-deaction="td-step" data-step="4">SIGNALS →</button></div>`;}

  if(step===4){h+=`<div style="font-size:10px;font-family:monospace;color:#52525b;margin-bottom:12px;letter-spacing:.1em;">STEP 04 / SIGNALS - 3 of 5 buckets required.</div>${panel(ph("5-BUCKET CONFLUENCE",pill(fired>=3?"green":fired>=2?"amber":"red",fired+"/5 FIRING"))+[{k:"trend",n:"TREND",h:"EMA stack aligned"},{k:"momentum",n:"MOMENTUM",h:"MACD histogram direction"},{k:"reversal",n:"REVERSAL",h:"Stoch cross from extreme"},{k:"participation",n:"PARTICIPATION",h:"Volume > 1.5x MA"},{k:"volatility",n:"VOLATILITY",h:"ATR within normal range"}].map(b=>row(b.n,b.h,ct(b.k,"FIRES","DEAD"))).join(""))}${panel(ph("CIPHER B / AO","")+row("Cipher B mode","Accumulation = smart money buying",mu("cipher",[{l:"ACCUMULATION",v:"accum"},{l:"DISTRIBUTION",v:"dist"},{l:"NEUTRAL",v:"neutral"}])))}<div style="display:flex;gap:8px;"><button style="flex:1;padding:10px;font-size:10px;font-family:monospace;color:#52525b;border:1px solid #1c1c1e;border-radius:3px;background:transparent;cursor:pointer;" data-deaction="td-step" data-step="3">← BIAS</button><button style="flex:1;padding:10px;font-size:10px;font-family:monospace;color:#a1a1aa;border:1px solid #1c1c1e;border-radius:3px;background:transparent;cursor:pointer;" data-deaction="td-step" data-step="5">SCORE →</button></div>`;}

  if(step===5){const sb=[{label:"HTF Trend Alignment",pts:bsc,max:30},{label:"Macro Filter",pts:msc,max:20},{label:"Signal Confluence",pts:sigsc,max:20},{label:"Volume Confirmation",pts:volsc,max:15},{label:"Volatility",pts:atsc,max:10},{label:"Funding / Cipher",pts:fsc,max:5}];h+=`<div style="font-size:10px;font-family:monospace;color:#52525b;margin-bottom:12px;letter-spacing:.1em;">STEP 05 / CONFIDENCE SCORE</div>${panel(ph("SCORE BREAKDOWN","")+sb.map(item=>`<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 16px;border-bottom:1px solid rgba(28,28,30,0.4);"><div style="font-size:11px;font-family:monospace;color:#d4d4d8;">${item.label}</div><div style="display:flex;align-items:center;gap:10px;"><div style="width:80px;height:4px;background:#1c1c1e;border-radius:2px;overflow:hidden;"><div style="height:100%;border-radius:2px;background:${sco};width:${(item.pts/item.max)*100}%"></div></div><span style="font-size:10px;font-family:monospace;color:#a1a1aa;width:40px;text-align:right;">${item.pts}/${item.max}</span></div></div>`).join(""))}<div style="border:1px solid #1c1c1e;border-radius:3px;padding:16px;margin-bottom:12px;"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;"><span style="font-size:10px;font-family:monospace;color:#52525b;">TOTAL</span><span style="font-size:10px;font-family:monospace;color:${sco};">${conf>=80?"FULL SIZE":conf>=65?"HALF SIZE":conf>=50?"25% SIZE":"NO TRADE"}</span></div><div style="font-size:48px;font-family:monospace;font-weight:700;color:${sco};margin-bottom:10px;">${conf}<span style="font-size:14px;color:#27272a;margin-left:4px;">/ 100</span></div><div style="height:4px;background:#1c1c1e;border-radius:2px;overflow:hidden;"><div style="height:100%;border-radius:2px;background:${sco};width:${conf}%;"></div></div></div><div style="display:flex;gap:8px;"><button style="flex:1;padding:10px;font-size:10px;font-family:monospace;color:#52525b;border:1px solid #1c1c1e;border-radius:3px;background:transparent;cursor:pointer;" data-deaction="td-step" data-step="4">← SIGNALS</button><button style="flex:1;padding:10px;font-size:10px;font-family:monospace;border:1px solid #1c1c1e;border-radius:3px;cursor:pointer;${conf>=65?"color:#a1a1aa;background:transparent":"color:#27272a;background:transparent;cursor:not-allowed"}" ${conf<50?"disabled":""} data-deaction="td-step" data-step="6">${conf>=65?"EXECUTE →":"SCORE TOO LOW"}</button></div>`;}

  if(step===6){h+=`<div style="font-size:10px;font-family:monospace;color:#52525b;margin-bottom:12px;letter-spacing:.1em;">STEP 06 / EXECUTION</div>${panel(ph("TRADE PARAMETERS",pill(conf>=80?"green":"amber","SCORE "+conf))+row("Direction","",mu("dir",[{l:"LONG",v:"long"},{l:"SHORT",v:"short"}]))+row("Account balance","",fld("balance","e.g. 10000"))+row("Risk %","",mu("risk",[{l:"1%",v:"1"},{l:"1.5%",v:"1.5"},{l:"2%",v:"2"}]))+row("ATR(14) value","",fld("atr_val","e.g. 1250"))+row("Entry price","",fld("entry","e.g. 87000")))}${ev?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;border:1px solid #1c1c1e;border-radius:3px;overflow:hidden;margin-bottom:12px;">${[{l:"POSITION SIZE",v:ps.toFixed(5)+" BTC",c:"color:#e4e4e7"},{l:"RISK AMOUNT",v:"$"+fmt(ra,2),c:"color:#e4e4e7"},{l:"STOP LOSS",v:"$"+fmt(sp,0),c:"color:#ef4444"},{l:"STOP DIST",v:"$"+fmt(sd,0)+" (1.5x ATR)",c:"color:#52525b"},{l:"TP1 1.5R (40%)",v:"$"+fmt(t1,0),c:"color:#10b981"},{l:"TP2 2.5R (40%)",v:"$"+fmt(t2,0),c:"color:#6ee7b7"},{l:"RUNNER (20%)",v:"Trail 1x ATR after TP2",c:"color:#38bdf8"},{l:"SIZE MULT",v:(sm*100).toFixed(0)+"%",c:"color:#f59e0b"}].map(item=>`<div style="background:#0d0d0f;padding:10px 12px;"><div style="font-size:9px;font-family:monospace;color:#3f3f46;">${item.l}</div><div style="font-size:12px;font-family:monospace;font-weight:600;margin-top:4px;${item.c}">${item.v}</div></div>`).join("")}</div>`:""}  <button style="width:100%;padding:10px;font-size:10px;font-family:monospace;color:#52525b;border:1px solid #1c1c1e;border-radius:3px;background:transparent;cursor:pointer;" data-deaction="td-reset">RESET - NEW ANALYSIS</button>`;}
  return h;
}

function buildApp(){
  const cur=VIEWS.find(v=>v.id===st.view)||VIEWS[0];
  let content="";
  if(st.view==="home")content=buildHome();
  else if(st.view==="markettd")content=buildMTD();
  else if(st.view==="bottomup")content=buildBU();
  else if(st.view==="btcstrat")content=buildBTC();
  else if(st.view==="altres")content=buildAlt();
  else if(st.view==="drafting")content=buildDrafting();
  else if(st.view==="topdown")content=buildTD();

  const menuHtml=st.menuOpen?`<div style="border-top:1px solid #1c1c1e;padding:8px 16px;display:flex;flex-wrap:wrap;gap:4px;">${VIEWS.map(v=>`<button style="padding:4px 10px;font-size:10px;font-family:monospace;border-radius:3px;cursor:pointer;border:1px solid ${st.view===v.id?"#52525b":"#1c1c1e"};background:${st.view===v.id?"#27272a":"transparent"};color:${st.view===v.id?"#e4e4e7":"#52525b"};" data-deaction="nav" data-view="${v.id}">${v.label}</button>`).join("")}<button style="padding:4px 10px;font-size:10px;font-family:monospace;border-radius:3px;cursor:pointer;border:1px solid #1c1c1e;background:transparent;color:#52525b;" data-deaction="nav" data-view="topdown">TOP-DOWN WIZARD</button></div>`:"";

  return`<div style="min-height:100%;background:#09090b;color:#e4e4e7;"><div style="position:sticky;top:0;z-index:100;border-bottom:1px solid #1c1c1e;background:rgba(9,9,11,0.97);">${menuHtml?`<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;"><div style="display:flex;align-items:center;gap:10px;">${st.view!=="home"?`<button style="font-size:11px;font-family:monospace;color:#52525b;background:transparent;border:none;cursor:pointer;" data-deaction="nav" data-view="home">←</button>`:""}  <div style="display:flex;align-items:center;gap:6px;"><div style="width:8px;height:8px;border-radius:50%;background:${cur.dot};"></div><span style="font-size:11px;font-family:monospace;font-weight:600;color:#e4e4e7;">${cur.label}</span></div></div><button style="font-size:10px;font-family:monospace;color:#52525b;background:transparent;border:1px solid #1c1c1e;border-radius:3px;padding:4px 10px;cursor:pointer;" data-deaction="toggle-menu">MENU</button></div>${menuHtml}`:`<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;"><div style="display:flex;align-items:center;gap:10px;">${st.view!=="home"?`<button style="font-size:11px;font-family:monospace;color:#52525b;background:transparent;border:none;cursor:pointer;" data-deaction="nav" data-view="home">←</button>`:""}  <div style="display:flex;align-items:center;gap:6px;"><div style="width:8px;height:8px;border-radius:50%;background:${cur.dot};"></div><span style="font-size:11px;font-family:monospace;font-weight:600;color:#e4e4e7;">${cur.label}</span></div></div><button style="font-size:10px;font-family:monospace;color:#52525b;background:transparent;border:1px solid #1c1c1e;border-radius:3px;padding:4px 10px;cursor:pointer;" data-deaction="toggle-menu">MENU</button></div>`}</div><div style="padding:16px;max-width:640px;margin:0 auto;">${content}</div></div>`;
}

function render(){
  const el=document.getElementById("de-app");
  if(!el)return;
  localStorage.setItem('de-state', JSON.stringify(st));
  el.innerHTML=buildApp();
  el.addEventListener("click",handleClick,{once:true});
  el.addEventListener("input",handleInput,{once:true});
}

function handleClick(e){
  const el=e.target.closest("[data-deaction]");
  if(!el){render();return;}
  const a=el.dataset.deaction;
  if(a==="nav"){st.view=el.dataset.view;st.menuOpen=false;render();return;}
  if(a==="toggle-menu"){st.menuOpen=!st.menuOpen;render();return;}
  if(a==="toggle-group"){const g=el.dataset.group;st.collapsed[g]=st.collapsed[g]===false?true:false;render();return;}
  if(a==="toggle-link"){const g=el.dataset.linkgroup;st.linkOpen[g]=!st.linkOpen[g];render();return;}
  if(a==="toggle-cu"){st.cuOpen=!st.cuOpen;render();return;}
  if(a==="toggle-drafts"){st.draftsOpen=!st.draftsOpen;render();return;}
  if(a==="add-draft"){st.drafts.push({id:Date.now(),text:"",done:false});render();return;}
  if(a==="toggle-draft"){const id=parseInt(el.dataset.draftid);const d=st.drafts.find(x=>x.id===id);if(d)d.done=!d.done;render();return;}
  if(a==="remove-draft"){const id=parseInt(el.dataset.draftid);st.drafts=st.drafts.filter(x=>x.id!==id);render();return;}
  if(a==="check"){const{id,val,key}=el.dataset;if(st[key][id]===val)st[key][id]=null;else st[key][id]=val;render();return;}
  if(a==="set-filter"){st[el.dataset.filterkey]=el.dataset.filterval;render();return;}
  if(a==="reset-checks"){const k=el.dataset.filterkey;if(k==="filter")st.checks={};else if(k==="altFilter")st.altChecks={};render();return;}
  if(a==="set-td"){const{key,value}=el.dataset;st.td[key]=value==="true"?true:value==="false"?false:value;render();return;}
  if(a==="td-step"){const s=parseInt(el.dataset.step);if(!isNaN(s)){st.tdStep=s;render();}return;}
  if(a==="td-reset"){st.td={usdt_above_ema:null,usdt_change:"",btc_d_rising:null,total_bull:null,dxy_bull:null,blackout:false,adx:"",price_ema50:null,ema50_ema200:null,atr_state:null,daily_ema200:null,ema50_cross:null,structure:null,trend:null,momentum:null,reversal:null,participation:null,volatility:null,cipher:null,balance:"",risk:"1",atr_val:"",entry:"",dir:null};st.tdStep=1;render();return;}
  if(a==="clear-token"){st.altToken="";st.altChecks={};render();return;}
  render();
}

function handleInput(e){
  const el=e.target;const a=el.dataset.deaction;
  if(a==="td-input"){st.td[el.dataset.key]=el.value;render();return;}
  if(a==="edit-draft"){const id=parseInt(el.dataset.draftid);const d=st.drafts.find(x=>x.id===id);if(d)d.text=el.value;render();return;}
  if(a==="set-token"){st.altToken=el.value.toUpperCase();render();return;}
  render();
}

return{render};
})();
const SORA = (() => {
const STAGES=[{id:"idea",label:"Idea",color:"#a78bfa"},{id:"queued",label:"Queued",color:"#fbbf24"},{id:"generating",label:"Generating",color:"#34d399"},{id:"review",label:"Review",color:"#60a5fa"},{id:"done",label:"Archive",color:"#94a3b8"}];
const ASPECT_RATIOS=["16:9","9:16","1:1","4:3","2.35:1"];
const DURATIONS=[5,8,10,12,15,20];

let ideas=[
  {id:1,title:"Neon Reflections in Rain",prompt:"A lone figure walks through a neon-lit urban street at 3am, rain falling in slow motion, vivid neon signs reflecting on wet pavement, motion blur and bokeh, surreal atmosphere",stage:"queued",aspectRatio:"16:9",duration:10,tags:["urban","surreal","neon","rain","cinematic"],notes:"Urban / Surreal category. Grainy 35mm film style. High contrast neon palette. Reference: Wong Kar-wai aesthetic.",referenceImage:null,createdAt:"2025-03-15"},
  {id:2,title:"The Higher Self Awakens",prompt:"A translucent human figure rising slowly upward through layers of golden light, energy radiating from the chest outward, cosmic particles dissolving into stardust, transcendent and serene",stage:"queued",aspectRatio:"9:16",duration:12,tags:["spiritual","transformation","ascension","golden-light"],notes:"Self & Transformation category. Ethereal lighting. Soft bloom, no hard shadows. Ties into Ascension Glossary - Higher Self concept.",referenceImage:null,createdAt:"2025-03-15"},
  {id:3,title:"Stardust Falling on Skin",prompt:"Extreme close-up of stardust and golden particles slowly drifting onto dark skin, each particle glowing softly, cosmic and intimate, macro lens aesthetic",stage:"idea",aspectRatio:"1:1",duration:8,tags:["cosmic","intimate","macro","stardust"],notes:"Cosmic / Mystical category. Pair with soft ambient music. Could work as a loop.",referenceImage:null,createdAt:"2025-03-15"},
  {id:4,title:"Golden Hour on Skin",prompt:"Warm golden-hour sunlight slowly moving across a face in extreme close-up, soft shadows shifting, skin texture and light refracting beautifully, meditative and still",stage:"idea",aspectRatio:"9:16",duration:8,tags:["nature","golden-hour","minimalism","portrait"],notes:"Nature & Minimalism category. No movement except the light. Film grain overlay.",referenceImage:null,createdAt:"2025-03-15"},
  {id:5,title:"Memory of a Past Life",prompt:"A blurred, desaturated figure walks through faded architectural hallways that morph and dissolve into new scenes - beaches, forests, city streets - layered like fragmented memory, dreamlike transitions",stage:"idea",aspectRatio:"16:9",duration:15,tags:["dreamlike","mood","memory","surreal"],notes:"Dream & Mood category. Desaturated with flashes of warm color. Slow dissolve transitions.",referenceImage:null,createdAt:"2025-03-15"},
  {id:6,title:"Between Love and Letting Go",prompt:"Two figures in slow motion, one slowly fading into golden particles as the other reaches out, soft light, emotional and cinematic, backlit silhouette",stage:"idea",aspectRatio:"16:9",duration:12,tags:["emotion","human","silhouette","letting-go"],notes:"Human Emotion category. Backlit scene. Particle dissolve effect on the fading figure.",referenceImage:null,createdAt:"2025-03-15"},
  {id:7,title:"Celestial Drift - Mood Concept",prompt:"Slow aerial drift through luminous clouds at dusk, warm amber and violet sky, camera gliding weightlessly, serene and infinite, loopable",stage:"idea",aspectRatio:"16:9",duration:10,tags:["ethereal","dreamlike","cloud9","brand-concept","loopable"],notes:"From Idea 1 - Ethereal / Dreamlike. One of the strongest visual brand moods. 'Celestial Drift' as a title/track name candidate.",referenceImage:null,createdAt:"2025-03-15"},
  {id:8,title:"Heaven.exe - Digital Spiritual Aesthetic",prompt:"A digital interface dissolving into sacred geometry and soft light - UI elements glitching into clouds and golden halos, merging tech and transcendence, surreal and beautiful",stage:"idea",aspectRatio:"9:16",duration:10,tags:["aesthetic","culture","digital","glitch","spiritual"],notes:"From Idea 1 - Aesthetic / Culture. 'Heaven.exe' and 'Angel Error' are strong visual identity titles.",referenceImage:null,createdAt:"2025-03-15"},
  {id:9,title:"Akashic Records Visualization",prompt:"An infinite luminous library of light - pillars of glowing data streams rising into a vast cosmic architecture, records crystallizing and dissolving, otherworldly and vast",stage:"idea",aspectRatio:"16:9",duration:15,tags:["ascension-glossary","akashic","cosmic","spiritual"],notes:"From Ascension Glossary - Akashic Records: universal memory-matrix of consciousness.",referenceImage:null,createdAt:"2025-03-15"},
  {id:10,title:"5D Ascension - Timeline Shift",prompt:"A figure standing at a crossroads of parallel realities - layered dimensions visible simultaneously, each slightly different, light bending between them, gradual merging into one radiant path",stage:"idea",aspectRatio:"16:9",duration:15,tags:["ascension-glossary","5D","timelines","transformation"],notes:"Combines Ascension Glossary: 5D Ascension + Timelines. Great for longer-form content.",referenceImage:null,createdAt:"2025-03-15"},
  {id:11,title:"IQ & Age Norms - Explainer Concept",prompt:"Animated data visualization showing two bell curves side by side (adult vs child IQ distribution), age groups highlighted, scores shifting to show relative comparison - clean and informative",stage:"idea",aspectRatio:"16:9",duration:12,tags:["educational","explainer","data-viz","psychology"],notes:"IQ tests are age-normed. Key insight: a child with IQ 130 outperforms age peers, not adults. Short-form educational visual.",referenceImage:null,createdAt:"2025-03-15"},
];
const _savedSora = localStorage.getItem('sora-ideas'); if(_savedSora) try { ideas = JSON.parse(_savedSora); } catch(e) {}

let selectedId=1,search="",filterStage="all",newTag="";

function getStage(id){return STAGES.find(s=>s.id===id);}
function stageCount(id){return ideas.filter(i=>i.stage===id).length;}
function getSelected(){return ideas.find(i=>i.id===selectedId);}
function getFiltered(){
  return ideas.filter(i=>{
    const ms=i.title.toLowerCase().includes(search.toLowerCase())||i.prompt.toLowerCase().includes(search.toLowerCase());
    const mf=filterStage==="all"||i.stage===filterStage;
    return ms&&mf;
  });
}
function updateIdea(field,value){ideas=ideas.map(i=>i.id===selectedId?{...i,[field]:value}:i);}
function addIdea(){const n={id:Date.now(),title:"Untitled Sequence",prompt:"",stage:"idea",aspectRatio:"16:9",duration:10,tags:[],notes:"",referenceImage:null,createdAt:new Date().toISOString().split("T")[0]};ideas=[n,...ideas];selectedId=n.id;}
function deleteIdea(id){const r=ideas.filter(i=>i.id!==id);ideas=r;if(selectedId===id)selectedId=r[0]?.id||null;}
function advanceStage(){const s=getSelected();if(!s)return;const idx=STAGES.findIndex(st=>st.id===s.stage);if(idx<STAGES.length-1)updateIdea("stage",STAGES[idx+1].id);}

function buildList(){
  const filtered=getFiltered();
  const stageFilters=["all",...STAGES.map(s=>s.id)];
  return`<div style="width:260px;border-right:1px solid #14141f;display:flex;flex-direction:column;background:#08080e;flex-shrink:0;overflow:hidden;">
    <div style="padding:10px;border-bottom:1px solid #14141f;flex-shrink:0;">
      <div style="position:relative;margin-bottom:8px;">
        <span style="position:absolute;left:9px;top:50%;transform:translateY(-50%);color:#28283a;font-size:10px;">🔍</span>
        <input value="${search.replace(/"/g,"&quot;")}" placeholder="Search..." style="width:100%;background:#0e0e18;border:1px solid #14141f;border-radius:5px;padding:6px 8px 6px 26px;color:#ddd8cc;font-size:11px;outline:none;box-sizing:border-box;font-family:inherit;" data-soraaction="search"/>
      </div>
      <button style="width:100%;background:linear-gradient(135deg,#6d28d9,#4f46e5);border:none;border-radius:5px;padding:7px 10px;color:#fff;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:5px;justify-content:center;font-family:inherit;letter-spacing:.04em;" data-soraaction="add-idea">+ New Sequence</button>
    </div>
    <div style="padding:6px 10px;border-bottom:1px solid #14141f;display:flex;gap:4px;flex-wrap:wrap;flex-shrink:0;">
      ${stageFilters.map(s=>{const stage=s==="all"?null:getStage(s);const isA=filterStage===s;return`<button style="background:${isA?(stage?.color||"#a78bfa")+"18":"transparent"};border:1px solid ${isA?stage?.color||"#a78bfa":"#1c1c2a"};border-radius:3px;padding:2px 7px;color:${isA?stage?.color||"#a78bfa":"#32324a"};font-size:9px;cursor:pointer;font-family:inherit;text-transform:uppercase;letter-spacing:.06em;" data-soraaction="filter-stage" data-stage="${s}">${s==="all"?"All":stage?.label}</button>`;}).join("")}
    </div>
    <div style="overflow-y:auto;flex:1;">
      ${filtered.length===0?`<div style="padding:24px 14px;font-size:11px;color:#28283a;text-align:center;">No sequences found</div>`:""}
      ${filtered.map(idea=>{
        const stage=getStage(idea.stage);const isSel=idea.id===selectedId;
        return`<div style="padding:11px 12px;border-bottom:1px solid #0e0e18;cursor:pointer;background:${isSel?"#0e0e18":"transparent"};border-left:2px solid ${isSel?"#7c3aed":"transparent"};" data-soraaction="select-idea" data-id="${idea.id}">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;gap:6px;">
            <span style="font-size:12px;font-weight:600;color:${isSel?"#ddd8cc":"#8888a0"};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${idea.title}</span>
            <span style="font-size:8px;padding:2px 5px;border-radius:3px;background:${stage?.color+"18"};color:${stage?.color};border:1px solid ${stage?.color+"33"};flex-shrink:0;text-transform:uppercase;letter-spacing:.06em;">${stage?.label}</span>
          </div>
          <div style="font-size:10px;color:#2e2e44;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${idea.prompt||"No prompt yet..."}</div>
          ${idea.tags.length>0?`<div style="display:flex;gap:3px;margin-top:5px;flex-wrap:wrap;">${idea.tags.slice(0,3).map(t=>`<span style="font-size:8px;color:#3a3a56;background:#0e0e18;padding:1px 5px;border-radius:2px;border:1px solid #1a1a28;">#${t}</span>`).join("")}</div>`:""}
        </div>`;
      }).join("")}
    </div>
  </div>`;
}

function buildDetail(){
  const sel=getSelected();
  if(!sel)return`<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#1e1e2e;font-size:12px;">Select a sequence</div>`;
  const activeIdx=STAGES.findIndex(s=>s.id===sel.stage);
  return`<div style="flex:1;overflow-y:auto;padding:24px 32px 40px;background:#06060a;">
    <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:20px;">
      <div style="flex:1;">
        <input value="${sel.title.replace(/"/g,"&quot;")}" style="background:transparent;border:none;outline:none;font-size:22px;font-weight:700;color:#ddd8cc;font-family:inherit;width:100%;letter-spacing:-.02em;" data-soraaction="edit-title"/>
        <div style="display:flex;align-items:center;gap:4px;margin-top:10px;flex-wrap:wrap;">
          ${STAGES.map((s,i)=>{
            const isCur=s.id===sel.stage,isPast=i<activeIdx;
            return`<div style="display:flex;align-items:center;gap:4px;">
              <button style="background:${isCur?s.color+"18":"transparent"};border:1px solid ${isCur?s.color:isPast?"#22222e":"#14141f"};border-radius:4px;padding:3px 9px;color:${isCur?s.color:isPast?"#2e2e44":"#1c1c2a"};font-size:9px;cursor:pointer;font-family:inherit;text-transform:uppercase;letter-spacing:.08em;" data-soraaction="set-stage" data-stage="${s.id}">${s.label}</button>
              ${i<STAGES.length-1?`<span style="color:#1c1c2a;font-size:9px;">›</span>`:""}
            </div>`;
          }).join("")}
        </div>
      </div>
      <button style="background:transparent;border:1px solid #14141f;border-radius:5px;padding:7px 10px;cursor:pointer;color:#28283a;margin-top:4px;" data-soraaction="delete-idea" data-id="${sel.id}" title="Delete">🗑</button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">
      <div style="grid-column:1/-1;">
        <div style="font-size:9px;color:#32324a;text-transform:uppercase;letter-spacing:.12em;margin-bottom:7px;font-weight:600;">Prompt</div>
        <textarea rows="4" style="width:100%;background:#0c0c14;border:1px solid #14141f;border-radius:7px;padding:11px 13px;color:#ddd8cc;font-size:12px;font-family:inherit;resize:vertical;outline:none;line-height:1.65;box-sizing:border-box;" data-soraaction="edit-prompt">${sel.prompt}</textarea>
      </div>

      <div style="grid-column:1/-1;">
        <div style="font-size:9px;color:#32324a;text-transform:uppercase;letter-spacing:.12em;margin-bottom:7px;font-weight:600;">Reference Image</div>
        ${sel.referenceImage
          ?`<div style="position:relative;display:inline-block;"><img src="${sel.referenceImage}" style="max-width:100%;max-height:220px;border-radius:8px;border:1px solid #1a1a28;display:block;"/><button style="position:absolute;top:8px;right:8px;background:#06060acc;border:1px solid #1a1a28;border-radius:4px;padding:4px 6px;cursor:pointer;color:#8888a0;font-size:10px;" data-soraaction="clear-image">✕</button></div>`
          :`<div style="background:#0c0c14;border:1px dashed #1c1c2a;border-radius:8px;padding:28px 20px;text-align:center;cursor:pointer;color:#28283a;font-size:11px;" data-soraaction="upload-trigger"><div style="font-size:20px;margin-bottom:8px;opacity:.3;">⬆</div>Click to upload reference image<div style="font-size:9px;margin-top:4px;color:#1c1c2a;">PNG · JPG · WEBP</div></div>`}
        <input type="file" accept="image/*" id="sora-file-input" style="display:none;" data-soraaction="file-input"/>
      </div>

      <div>
        <div style="font-size:9px;color:#32324a;text-transform:uppercase;letter-spacing:.12em;margin-bottom:7px;font-weight:600;">Aspect Ratio</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;">
          ${ASPECT_RATIOS.map(ar=>`<button style="background:${sel.aspectRatio===ar?"#6d28d918":"#0c0c14"};border:1px solid ${sel.aspectRatio===ar?"#7c3aed":"#14141f"};border-radius:4px;padding:5px 10px;color:${sel.aspectRatio===ar?"#a78bfa":"#2e2e44"};font-size:10px;cursor:pointer;font-family:inherit;" data-soraaction="set-aspect" data-val="${ar}">${ar}</button>`).join("")}
        </div>
      </div>

      <div>
        <div style="font-size:9px;color:#32324a;text-transform:uppercase;letter-spacing:.12em;margin-bottom:7px;font-weight:600;">Duration</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;">
          ${DURATIONS.map(d=>`<button style="background:${sel.duration===d?"#6d28d918":"#0c0c14"};border:1px solid ${sel.duration===d?"#7c3aed":"#14141f"};border-radius:4px;padding:5px 10px;color:${sel.duration===d?"#a78bfa":"#2e2e44"};font-size:10px;cursor:pointer;font-family:inherit;" data-soraaction="set-duration" data-val="${d}">${d}s</button>`).join("")}
        </div>
      </div>

      <div style="grid-column:1/-1;">
        <div style="font-size:9px;color:#32324a;text-transform:uppercase;letter-spacing:.12em;margin-bottom:7px;font-weight:600;">Tags</div>
        <div style="background:#0c0c14;border:1px solid #14141f;border-radius:7px;padding:8px 10px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;min-height:38px;">
          ${sel.tags.map(tag=>`<span style="background:#14141f;border:1px solid #1c1c2a;border-radius:3px;padding:2px 7px;font-size:10px;color:#5a5a78;display:inline-flex;align-items:center;gap:5px;">#${tag}<span style="cursor:pointer;opacity:.6;font-size:9px;" data-soraaction="remove-tag" data-tag="${tag}">✕</span></span>`).join("")}
          <input value="${newTag.replace(/"/g,"&quot;")}" placeholder="${sel.tags.length===0?"Type a tag and press Enter...":"+"}" style="background:transparent;border:none;outline:none;font-size:10px;color:#5a5a78;font-family:inherit;flex:1;min-width:80px;" data-soraaction="tag-input"/>
        </div>
      </div>

      <div style="grid-column:1/-1;">
        <div style="font-size:9px;color:#32324a;text-transform:uppercase;letter-spacing:.12em;margin-bottom:7px;font-weight:600;">Director's Notes</div>
        <textarea rows="3" style="width:100%;background:#0c0c14;border:1px solid #14141f;border-radius:7px;padding:10px 13px;color:#8888a0;font-size:11px;font-family:inherit;resize:vertical;outline:none;line-height:1.65;box-sizing:border-box;font-style:italic;" data-soraaction="edit-notes">${sel.notes}</textarea>
      </div>

      <div style="grid-column:1/-1;">
        ${sel.stage!=="done"
          ?`<button style="background:linear-gradient(135deg,#6d28d9,#4f46e5);border:none;border-radius:6px;padding:9px 18px;color:#fff;font-size:11px;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px;letter-spacing:.04em;" data-soraaction="advance-stage">Move to ${STAGES[activeIdx+1]?.label||""} ›</button>`
          :`<div style="background:#94a3b818;border:1px solid #94a3b830;border-radius:6px;padding:9px 16px;font-size:11px;color:#94a3b8;">✓ Archived - this sequence is complete</div>`}
      </div>
    </div>

    <div style="margin-top:28px;padding-top:12px;border-top:1px solid #0e0e18;font-size:9px;color:#1e1e2e;display:flex;gap:16px;text-transform:uppercase;letter-spacing:.08em;">
      <span>Created ${sel.createdAt}</span><span>${sel.aspectRatio}</span><span>${sel.duration}s</span><span>ID #${sel.id}</span>
    </div>
  </div>`;
}

function buildApp(){
  return`<div style="height:100%;display:flex;flex-direction:column;background:#06060a;color:#ddd8cc;font-family:'DM Mono','Fira Code','Courier New',monospace;overflow:hidden;">
    <div style="border-bottom:1px solid #14141f;padding:0 20px;height:46px;display:flex;align-items:center;gap:12px;background:#08080e;flex-shrink:0;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:14px;">🎬</span>
        <span style="font-size:12px;font-weight:700;color:#ddd8cc;letter-spacing:.14em;text-transform:uppercase;">Sora Studio</span>
        <span style="font-size:10px;color:#28283a;margin-left:2px;">/ sequences</span>
      </div>
      <div style="flex:1;"></div>
      <div style="display:flex;gap:14px;font-size:10px;color:#28283a;">
        ${STAGES.map(s=>`<span><span style="color:${s.color}">${stageCount(s.id)}</span> ${s.label}</span>`).join("")}
      </div>
    </div>
    <div style="display:flex;flex:1;overflow:hidden;">
      ${buildList()}
      ${buildDetail()}
    </div>
  </div>`;
}

function render(){
  const el=document.getElementById("sora-app");
  if(!el)return;
  localStorage.setItem('sora-ideas', JSON.stringify(ideas));
  el.innerHTML=buildApp();
  attachEvents();
}

function attachEvents(){
  const el=document.getElementById("sora-app");
  if(!el)return;
  el.addEventListener("click",handleClick,{once:true});
  el.addEventListener("input",handleInput,{once:true});
  el.addEventListener("keydown",handleKeydown,{once:true});
  const fi=document.getElementById("sora-file-input");
  if(fi)fi.addEventListener("change",handleFileUpload,{once:true});
}

function handleClick(e){
  const t=e.target.closest("[data-soraaction]");
  if(!t){render();return;}
  const a=t.dataset.soraaction;
  if(a==="select-idea"){selectedId=parseInt(t.dataset.id);render();return;}
  if(a==="add-idea"){addIdea();render();return;}
  if(a==="delete-idea"){deleteIdea(parseInt(t.dataset.id));render();return;}
  if(a==="filter-stage"){filterStage=t.dataset.stage;render();return;}
  if(a==="set-stage"){updateIdea("stage",t.dataset.stage);render();return;}
  if(a==="set-aspect"){updateIdea("aspectRatio",t.dataset.val);render();return;}
  if(a==="set-duration"){updateIdea("duration",parseInt(t.dataset.val));render();return;}
  if(a==="advance-stage"){advanceStage();render();return;}
  if(a==="remove-tag"){const sel=getSelected();if(sel)updateIdea("tags",sel.tags.filter(t2=>t2!==t.dataset.tag));render();return;}
  if(a==="upload-trigger"){const fi=document.getElementById("sora-file-input");if(fi)fi.click();render();return;}
  if(a==="clear-image"){updateIdea("referenceImage",null);render();return;}
  render();
}

function handleInput(e){
  const t=e.target;const a=t.dataset.soraaction;
  if(a==="search"){search=t.value;render();return;}
  if(a==="edit-title"){updateIdea("title",t.value);attachEvents();return;}
  if(a==="edit-prompt"){updateIdea("prompt",t.value);attachEvents();return;}
  if(a==="edit-notes"){updateIdea("notes",t.value);attachEvents();return;}
  if(a==="tag-input"){newTag=t.value;attachEvents();return;}
  render();
}

function handleKeydown(e){
  const t=e.target;const a=t.dataset?.soraaction;
  if(a==="tag-input"&&e.key==="Enter"&&newTag.trim()){
    const sel=getSelected();if(sel)updateIdea("tags",[...(sel.tags||[]),newTag.trim()]);
    newTag="";render();return;
  }
  attachEvents();
}

function handleFileUpload(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{updateIdea("referenceImage",ev.target.result);render();};
  reader.readAsDataURL(file);
}

return{render};
})();
const AGENT_DESCRIPTIONS = {
  'devin':      { name: 'Devin',      role: 'Project Overseer',    model: 'Claude Sonnet 4.6', memory: true,  desc: "The overseer. Coordinates all agents, tracks every active project, and is Jason main developer assistant. Handles new builds, cross-agent strategy, and big-picture planning." },
  'traderclaw': { name: 'TraderClaw', role: 'Trading Bot',          model: 'Claude Sonnet 4.6', memory: true,  desc: "Autonomous trading agent. Monitors BTC 1H/4H/1D signals, RSI divergence, BTC.D and USDT.D. Runs paper trades on Bitget and shadows Polymarket. Live at traderclaw-production.up.railway.app." },
  'webclaw':    { name: 'WebClaw',    role: 'Web Developer',        model: 'GPT-5.4',           memory: true,  desc: "AI web agency agent. Builds pitch-ready demo sites for local Nanaimo businesses. Generates HTML and deploys a live URL for cold-call pitches. $300-500 setup + $50-100/month." },
  'xhunter':    { name: 'X-Hunter',  role: 'Social / X Agent',     model: 'Claude Sonnet 4.6', memory: true,  desc: "Crypto Twitter monitor and content agent. Tracks @BitcoinMagazine, @CoinDesk, and other major handles for trending narratives. Posts content and manages Jason X presence." },
  'swarm':      { name: 'Swarm',     role: 'Codex Agent',          model: 'GPT-4o-mini',       memory: false, desc: "OpenClaw Codex harness agent (@codex87bot on Telegram). Runs coding tasks in isolated ACP sessions. Stateless - no persistent memory between runs. Formerly called Codex." },
  'penny':      { name: 'Penny',     role: 'General Utility',      model: 'GPT-5.4',           memory: true,  desc: "General-purpose utility agent (@oss bot). Handles miscellaneous tasks, research, and one-off jobs. Switched to GPT-5.4 on 2026-04-11 after free models kept hitting rate limits." },
  'reaper':     { name: 'Reaper',    role: 'CommentFarm Operator', model: 'GPT-4o-mini',       memory: false, desc: "Runs the CommentFarm pipeline autonomously. Fetches trending X posts via xAI, ranks and queues them for review, then posts approved content to @DiamondHands811. Cron-driven." },
  'forge':      { name: 'Forge',     role: 'Dev Agent',            model: 'Claude Sonnet 4.6', memory: true,  desc: "General coding and development agent (@dev bot). Handles feature work, bug fixes, and dev tasks. A solid pair programmer for focused coding sessions." },
  'lyra':       { name: 'Lyra',      role: 'Innerverse Agent',     model: 'Claude Sonnet 4.6', memory: true,  desc: "Creative and narrative agent for the Innerverse project (@sora bot). Handles world-building, storytelling, character arcs, and all creative work tied to the Innerverse universe." },
  'xbot':       { name: 'XBot',      role: 'X Posting Bot',        model: 'GPT-5',             memory: false, desc: "Automated posting bot for @DiamondHands811. Handles scheduled X posts, content queuing, and crypto narrative amplification. Stateless - no memory, just executes the post queue." },
  'guardian':   { name: 'Guardian',  role: 'Security Agent',       model: 'Claude Sonnet 4.6', memory: true,  desc: "Security and hardening agent. Monitors OpenClaw gateway access, reviews auth logs, scans for anomalies, and hardens firewall and SSH rules. Quiet by default - speaks up when something is wrong." },
  'command':    { name: 'Command',   role: 'Orchestrator',         model: 'Claude Sonnet 4.6', memory: true,  desc: "Cross-agent orchestration layer. Routes tasks between agents, monitors agent health, and manages multi-agent workflows. The system internal air traffic control." },
  'fatherclaw': { name: 'FatherClaw',role: 'Orchestrator',         model: 'Claude Sonnet 4.6', memory: true,  desc: "Senior orchestrator. Jason top-level system coordinator. Oversees all agents, manages inter-agent dependencies, and handles escalations." },
};

function showAgentInfo(id) {
  closeMobileNav();
  const info = AGENT_DESCRIPTIONS[id];
  if (!info) return;
  const panel = document.getElementById('agent-info-panel');
  document.getElementById('agent-info-name').textContent = info.name;
  document.getElementById('agent-info-role').textContent = info.role;
  document.getElementById('agent-info-model').textContent = '\u26a1 ' + (info.model || '');
  const memEl = document.getElementById('agent-info-memory');
  memEl.innerHTML = info.memory
    ? '<span style="color:#22c55e;">\u25cf</span> Memory enabled'
    : '<span style="color:#64748b;">\u25cb</span> No memory (stateless)';
  document.getElementById('agent-info-desc').textContent = info.desc;
  panel.style.display = 'block';
  const nav = document.querySelector('.nav');
  if (nav) nav.scrollTop = 99999;
}


function toggleProjGroup(headerEl) {
  const links = headerEl.nextElementSibling;
  if (!links) return;
  const isOpen = links.style.maxHeight && links.style.maxHeight !== '0px';
  if (isOpen) {
    links.style.maxHeight = links.scrollHeight + 'px';
    requestAnimationFrame(() => { links.style.maxHeight = '0px'; });
    headerEl.classList.add('collapsed');
  } else {
    links.style.maxHeight = links.scrollHeight + 'px';
    links.addEventListener('transitionend', () => {
      if (!headerEl.classList.contains('collapsed')) links.style.maxHeight = 'none';
    }, { once: true });
    headerEl.classList.remove('collapsed');
  }
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

document.addEventListener('DOMContentLoaded', () => {
  const state = getNavState();
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
  document.querySelectorAll('.nav-proj-links').forEach(el => {
    el.style.maxHeight = '0px';
    el.style.overflow = 'hidden';
  });
  const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (!isLocalHost) {
    document.querySelectorAll('[data-dev-only="true"]').forEach(el => el.remove());
  }
});

// ─── PANEL COLLAPSE ───────────────────────────────────────────────────────────
let feedPanelOpen = false;

function toggleFeedPanel() {
  feedPanelOpen = !feedPanelOpen;
  const layout = document.querySelector('.layout');
  const btn = document.getElementById('feed-toggle-btn');
  if (feedPanelOpen) {
    layout.classList.remove('feed-collapsed');
    if (btn) { btn.style.color = 'var(--accent)'; btn.style.borderColor = 'var(--accent)'; btn.style.background = 'rgba(99,102,241,0.12)'; }
  } else {
    layout.classList.add('feed-collapsed');
    if (btn) { btn.style.color = 'var(--muted)'; btn.style.borderColor = 'var(--border)'; btn.style.background = 'transparent'; }
  }
}

let focusMode = false;

function setFocusMode(enabled) {
  focusMode = enabled;
  const layout = document.querySelector('.layout');
  const btn = document.getElementById('focus-btn');
  if (focusMode) {
    layout.classList.add('nav-collapsed', 'feed-collapsed');
    btn.style.color = 'var(--accent)';
    btn.style.borderColor = 'var(--accent)';
    btn.style.background = 'rgba(99,102,241,0.12)';
    btn.textContent = '⛶ Focus';
  } else {
    layout.classList.remove('nav-collapsed');
    if (!feedPanelOpen) layout.classList.add('feed-collapsed');
    else layout.classList.remove('feed-collapsed');
    btn.style.color = 'var(--muted)';
    btn.style.borderColor = 'var(--border)';
    btn.style.background = 'transparent';
    btn.textContent = '⛶ Focus';
  }
}

// ─── MOBILE NAV ───────────────────────────────────────────────────────────────
function updateFocusButtonLabel() {
  const btn = document.getElementById('focus-btn');
  if (!btn) return;
  btn.textContent = focusMode ? 'Exit Focus' : 'Focus';
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

function toggleMobileNav() {
  var nav = document.querySelector('.nav');
  var overlay = document.getElementById('mobile-overlay');
  var isOpen = nav.classList.toggle('mobile-open');
  if (overlay) overlay.style.display = isOpen ? 'block' : 'none';
  // Other sections are always-visible headings; the Apps & Sites dropdown keeps its own state.
}
function closeMobileNav() {
  var nav = document.querySelector('.nav');
  var overlay = document.getElementById('mobile-overlay');
  if (nav) nav.classList.remove('mobile-open');
  if (overlay) overlay.style.display = 'none';
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

    errorEl.style.display = 'none';
    errorEl.textContent = '';
    input.value = '';
    modal.style.display = 'flex';
    setTimeout(() => input.focus(), 100);

    function cleanup() {
      modal.style.display = 'none';
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
  errorEl.style.display = 'block';
  input.value = '';
  modal.style.display = 'flex';
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
    sort: 'updated_desc',
  },
};

async function enterDropboxView() {
  if (!await ensureDropsSession(true)) return;
  const drops = await loadDrops();
  if (drops !== null) {
    dropboxState.drops = drops;
    const taskId = new URLSearchParams(location.search).get('task');
    if (taskId) dropboxState.selectedId = taskId;
    renderDropbox();
  }
}

function getFilteredDrops() {
  let items = [...dropboxState.drops];
  const { search, subject, status, priority, sort } = dropboxState.filters;

  if (search) {
    const q = search.toLowerCase();
    items = items.filter(drop =>
      [drop.title, drop.subject, drop.project, drop.content, ...(drop.tags || []), ...(drop.links || [])]
        .join(' ').toLowerCase().includes(q)
    );
  }

  if (subject) items = items.filter(drop => (drop.subject || '') === subject);
  if (status)  items = items.filter(drop => (drop.status  || '') === status);
  if (priority) items = items.filter(drop => (drop.priority || '') === priority);

  items.sort((a, b) => {
    if (sort === 'updated_asc') return new Date(a.updated_at) - new Date(b.updated_at);
    if (sort === 'priority_desc') {
      const rank = { urgent: 3, high: 2, normal: 1 };
      return (rank[b.priority] || 0) - (rank[a.priority] || 0);
    }
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
        <th>Title</th><th>Subject</th><th>Status</th><th>Priority</th>
        <th>Project</th><th>Tags</th><th>Updated</th>
      </tr></thead>
      <tbody>
        ${items.map(drop => `
          <tr data-drop-id="${escAttr(drop.id)}" class="${drop.id === dropboxState.selectedId ? 'selected' : ''}">
            <td>${escHTML(drop.title || 'Untitled drop')}</td>
            <td>${dropBadge(drop.subject, 'subject')}</td>
            <td>${dropBadge(drop.status, 'status')}</td>
            <td>${dropBadge(drop.priority, 'priority')}</td>
            <td>${escHTML(drop.project || '—')}</td>
            <td>${(drop.tags || []).slice(0, 3).map(t => dropBadge(t, 'tag')).join(' ')}</td>
            <td>${dropFormatDate(drop.updated_at || drop.date)}</td>
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

  if (!items.length) {
    wrap.innerHTML = '<div class="drop-empty"><div class="drop-empty-title">No drops match.</div><div class="drop-empty-copy">Try adjusting the filters.</div></div>';
    return;
  }

  wrap.innerHTML = items.map(drop => {
    const preview = (drop.content || '').replace(/\s+/g, ' ').trim();
    const hasMeta = drop.status || drop.subject || (drop.tags || []).length > 0;
    return `
    <article class="drop-card ${drop.id === dropboxState.selectedId ? 'selected' : ''}" data-drop-id="${escAttr(drop.id)}">
      <div class="drop-card-header">
        <h3 class="drop-card-title">${escHTML(drop.title || 'Untitled drop')}</h3>
        <span class="drop-card-date">${dropFormatShortDate(drop.updated_at || drop.date)}</span>
      </div>
      ${preview ? `<p class="drop-card-preview">${escHTML(preview)}</p>` : ''}
      ${hasMeta ? `<div class="drop-card-meta">
        ${dropBadge(drop.status, 'status')}
        ${dropBadge(drop.subject, 'subject')}
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

  listEl.style.display = 'none';
  document.getElementById('note-view-section')?.remove();

  const backlinks = dropboxState.drops.filter(other =>
    other.id !== drop.id &&
    (other.links || []).some(link => link.toLowerCase() === (drop.title || '').toLowerCase())
  );

  const metaParts = [];
  if (drop.subject) metaParts.push(dropBadge(drop.subject, 'subject'));
  if (drop.status)  metaParts.push(dropBadge(drop.status, 'status'));
  if (drop.priority && drop.priority !== 'normal') metaParts.push(dropBadge(drop.priority, 'priority'));
  if (drop.project) metaParts.push(`<span style="font-size:12px;color:var(--muted);">${escHTML(drop.project)}</span>`);

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

function renderDetailPanel() {
  const panel = document.getElementById('drop-detail-panel');
  if (panel) panel.innerHTML = '<div class="drop-detail-empty">Select a drop to view details.</div>';
  const drop = dropboxState.drops.find(d => d.id === dropboxState.selectedId);
  if (drop) openNoteView(drop);
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
    priority: document.getElementById('drop-priority').value,
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
    const drops = await loadDrops();
    if (drops !== null) { dropboxState.drops = drops; }
    renderDropbox();
  } catch (error) {
    handleDropboxRequestError(error, 'Failed to save drop.');
  }
}

function clearDropForm() {
  ['drop-title', 'drop-project', 'drop-tags', 'drop-content'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const subjectEl = document.getElementById('drop-subject');
  if (subjectEl) subjectEl.value = dropboxState.filters.subject || '';
  const p = document.getElementById('drop-priority');
  if (p) p.value = 'normal';
  const s = document.getElementById('drop-status');
  if (s) s.value = 'idea';
}

// ─── Dropbox event listeners ──────────────────────────────────────────────────

if (document.getElementById('save-drop-btn')) {
  document.getElementById('save-drop-btn').addEventListener('click', async () => {
    try { await saveDrop(); } catch (err) { alert(err.message); }
  });

  document.getElementById('clear-drop-btn').addEventListener('click', clearDropForm);

  document.getElementById('new-drop-btn').addEventListener('click', async () => {
    if (!await ensureDropsSession(true)) return;
    const el = document.getElementById('drop-title');
    if (el) el.focus();
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

  document.getElementById('drop-filter-priority').addEventListener('change', e => {
    dropboxState.filters.priority = e.target.value;
    renderDropbox();
  });

  document.getElementById('drop-sort').addEventListener('change', e => {
    dropboxState.filters.sort = e.target.value;
    renderDropbox();
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

// Patch switchView to render Dropbox when opened + auto focus-mode
// Consolidated router - single source of truth for all view lifecycle
VIEW_HANDLERS.traderclaw = { enter: () => { if (typeof DE !== 'undefined') DE.render(); }, focus: true };
VIEW_HANDLERS.lyra       = { enter: () => { if (typeof SORA !== 'undefined') SORA.render(); }, focus: true };
VIEW_HANDLERS.calendar   = { enter: () => { if (window.CAL) CAL.render(); }, focus: false, feedOnly: true };
VIEW_HANDLERS.dropbox    = { enter: () => enterDropboxView(), focus: true };
VIEW_HANDLERS.projects   = { enter: () => { if (window.ProjectRooms) ProjectRooms.render(); }, focus: true };
VIEW_HANDLERS.agents     = { enter: () => { if (window.AgentRegistry) AgentRegistry.render(); }, focus: true };
VIEW_HANDLERS.memory     = { enter: () => { if (typeof MEM !== 'undefined') MEM.render(); }, focus: true };
VIEW_HANDLERS.office     = { enter: null, focus: false };
VIEW_HANDLERS.org        = { enter: null, focus: false };

const _baseSwitchView = switchView;
window.switchView = function(view, navEl) {
  _baseSwitchView(view, navEl);
  const layout = document.querySelector('.layout');
  const btn = document.getElementById('focus-btn');
  const handler = VIEW_HANDLERS[view];
  if (!handler) return;
  if (handler.enter) handler.enter();
  if (handler.focus) {
    layout.classList.add('nav-collapsed', 'feed-collapsed');
    focusMode = true;
    if (btn) { btn.style.color = 'var(--accent)'; btn.style.borderColor = 'var(--accent)'; btn.style.background = 'rgba(99,102,241,0.12)'; }
  } else if (handler.feedOnly) {
    layout.classList.remove('nav-collapsed');
    layout.classList.add('feed-collapsed');
    focusMode = false;
    if (btn) { btn.style.color = 'var(--muted)'; btn.style.borderColor = 'var(--border)'; btn.style.background = 'transparent'; }
  } else {
    layout.classList.remove('nav-collapsed');
    if (!feedPanelOpen) layout.classList.add('feed-collapsed');
    else layout.classList.remove('feed-collapsed');
    focusMode = false;
    if (btn) { btn.style.color = 'var(--muted)'; btn.style.borderColor = 'var(--border)'; btn.style.background = 'transparent'; }
  }
};

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

  function selectFormAgent(id) {
    document.getElementById('mem-agent').value = id;
    document.querySelectorAll('#mem-agent-tabs .mem-tab').forEach(b => {
      const a = AGENTS.find(x => x.id === b.dataset.agent);
      if (!a) return;
      const sel = b.dataset.agent === id;
      b.style.background = sel ? a.color + '25' : 'transparent';
      b.style.borderColor = sel ? a.color : 'var(--border)';
      b.style.color = sel ? a.color : 'var(--muted)';
    });
  }

  function showForm() {
    _editingId = null;
    const tabs = document.getElementById('mem-agent-tabs');
    tabs.innerHTML = AGENTS.map(a =>
      `<button class="mem-tab" data-agent="${a.id}" onclick="MEM.selectFormAgent('${a.id}')"
        style="font-size:12px; padding:6px 14px; border-radius:20px; border:1px solid var(--border); background:transparent; color:var(--muted); cursor:pointer; white-space:nowrap;">${a.emoji} ${a.name}</button>`
    ).join('');
    const preselect = activeAgent !== 'all' ? activeAgent : AGENTS[0].id;
    selectFormAgent(preselect);
    document.getElementById('mem-content').value = '';
    document.getElementById('mem-form').style.display = 'block';
    document.getElementById('mem-content').focus();
  }

  function hideForm() {
    _editingId = null;
    document.getElementById('mem-form').style.display = 'none';
    document.getElementById('mem-content').value = '';
  }

  function edit(id) {
    const entry = (_cache || []).find(e => e.id === id);
    if (!entry) return;
    _editingId = id;
    const tabs = document.getElementById('mem-agent-tabs');
    const agent = AGENTS.find(a => a.id === entry.agent) || { emoji: '?', name: entry.agent, color: '#64748b' };
    tabs.innerHTML = `<span style="font-size:13px; color:${agent.color}; font-weight:600;">${agent.emoji} ${escHTML(agent.name)}</span>`;
    document.getElementById('mem-agent').value = entry.agent;
    document.getElementById('mem-content').value = entry.content;
    document.getElementById('mem-form').style.display = 'block';
    document.getElementById('mem-content').focus();
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

  function setFilter(agentId, btn) {
    activeAgent = agentId;
    document.querySelectorAll('#mem-filters .mem-filter').forEach(b => {
      b.classList.remove('active');
      b.style.background = 'transparent';
      b.style.borderColor = 'var(--border)';
      b.style.color = 'var(--muted)';
    });
    btn.classList.add('active');
    const agent = AGENTS.find(a => a.id === agentId);
    const color = agent ? agent.color : 'var(--accent)';
    btn.style.background = (agentId === 'all') ? 'rgba(99,102,241,0.15)' : color + '20';
    btn.style.borderColor = (agentId === 'all') ? 'var(--accent)' : color;
    btn.style.color = (agentId === 'all') ? 'var(--accent)' : color;
    renderList();
  }

  function renderFilters() {
    const bar = document.getElementById('mem-filters');
    const isAll = activeAgent === 'all';
    let html = `<button class="mem-filter${isAll ? ' active' : ''}" onclick="MEM.setFilter('all', this)"
      style="font-size:12px; padding:6px 14px; border-radius:20px; border:1px solid ${isAll ? 'var(--accent)' : 'var(--border)'}; background:${isAll ? 'rgba(99,102,241,0.15)' : 'transparent'}; color:${isAll ? 'var(--accent)' : 'var(--muted)'}; cursor:pointer;">All</button>`;
    AGENTS.forEach(a => {
      const isActive = activeAgent === a.id;
      html += `<button class="mem-filter${isActive ? ' active' : ''}" onclick="MEM.setFilter('${a.id}', this)"
        style="font-size:12px; padding:6px 14px; border-radius:20px; border:1px solid ${isActive ? a.color : 'var(--border)'}; background:${isActive ? a.color + '20' : 'transparent'}; color:${isActive ? a.color : 'var(--muted)'}; cursor:pointer;">${a.emoji} ${a.name}</button>`;
    });
    bar.innerHTML = html;
  }

  async function renderList() {
    const list = document.getElementById('mem-list');
    list.innerHTML = `<div style="text-align:center;padding:40px 0;color:var(--muted);font-size:13px;">Loading...</div>`;
    const entries = await load();
    const filtered = activeAgent === 'all' ? entries : entries.filter(e => e.agent === activeAgent);

    if (filtered.length === 0) {
      list.innerHTML = `<div style="text-align:center; padding:60px 0; color:var(--muted); font-size:13px;">No memories yet. Hit <strong style="color:var(--text)">+ New Memory</strong> to add one.</div>`;
      return;
    }

    list.innerHTML = filtered.map(e => {
      const agent = AGENTS.find(a => a.id === e.agent) || { emoji: '?', name: e.agent, color: '#64748b' };
      const date = new Date(e.date || e.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      return `<div style="background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:16px 20px; margin-bottom:12px; border-left:3px solid ${agent.color};">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; gap:12px; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:16px;">${agent.emoji}</span>
            <span style="font-size:13px; font-weight:600; color:${agent.color};">${escHTML(agent.name)}</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:11px; color:var(--muted);">${date}</span>
            <button onclick="MEM.edit('${e.id}')" style="background:transparent; border:1px solid rgba(99,102,241,0.3); color:var(--accent); border-radius:6px; padding:4px 10px; font-size:11px; cursor:pointer; opacity:0.6; transition:opacity 0.15s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">edit</button>
            <button onclick="MEM.remove('${e.id}')" style="background:transparent; border:1px solid rgba(239,68,68,0.3); color:#ef4444; border-radius:6px; padding:4px 10px; font-size:11px; cursor:pointer; opacity:0.6; transition:opacity 0.15s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">delete</button>
          </div>
        </div>
        <div style="font-size:13px; color:var(--text); line-height:1.6; white-space:pre-wrap;">${escHTML(e.content)}</div>
      </div>`;
    }).join('');
  }

    function renderRoster() {
    const grid = document.getElementById('mem-roster-grid');
    if (!grid) return;
    grid.innerHTML = Object.entries(AGENT_DESCRIPTIONS).map(([id, info]) => {
      const agent = AGENTS.find(a => a.id === id) || { color: '#64748b', emoji: '?' };
      const memBadge = info.memory
        ? '<span style="background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3);border-radius:20px;padding:2px 8px;font-size:10px;font-weight:600;">MEMORY ON</span>'
        : '<span style="background:rgba(100,116,139,0.15);color:var(--muted);border:1px solid var(--border);border-radius:20px;padding:2px 8px;font-size:10px;">STATELESS</span>';
      return '<div style="background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px;border-left:3px solid ' + agent.color + ';cursor:pointer;" onclick="MEM.setFilter(\'' + id + '\')">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">'
        + '<div style="display:flex;align-items:center;gap:8px;">'
        + '<span style="font-size:18px;">' + agent.emoji + '</span>'
        + '<span style="font-size:13px;font-weight:700;color:' + agent.color + ';">' + info.name + '</span>'
        + '</div>' + memBadge + '</div>'
        + '<div style="font-size:11px;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;">' + info.role + '</div>'
        + '<div style="font-size:11px;color:var(--muted);margin-bottom:10px;">Model: <span style="color:var(--text);">' + info.model + '</span></div>'
        + '<div style="font-size:12px;color:var(--text);line-height:1.5;opacity:0.75;">' + info.desc + '</div>'
        + '</div>';
    }).join('');
  }
  async function render() {
    renderRoster();
    renderFilters();
    if (!(await ensureAuth())) {
      document.getElementById('mem-list').innerHTML = `<div style="text-align:center; padding:60px 0; color:var(--muted); font-size:13px;">Unlock the dropbox first to access memories.</div>`;
      return;
    }
    await renderList();
  }

  return { render, renderRoster, showForm, hideForm, save, remove, edit, setFilter, selectFormAgent };
})();

