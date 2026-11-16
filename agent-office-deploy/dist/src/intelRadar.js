const WATCH_ENDPOINT = "/api/watch";
const HISTORY_KEY = "ao-intel-radar-history";
const MAX_HISTORY = 8;
const DEFAULT_QUERY = "latest iOS widgets";

const PRESET_QUERIES = [
  {
    title: "Latest iOS widgets",
    query: "latest iOS widgets for iPhone 2026",
    note: "Home screen stacks, lock screen layouts, and current widget combinations worth copying.",
    targetIds: ["pack", "youtube", "apple"]
  },
  {
    title: "OpenClaw tricks",
    query: "OpenClaw tricks tips workflows 2026",
    note: "Useful command patterns, plugin moves, and automation shortcuts shared by the community.",
    targetIds: ["pack", "youtube", "x"]
  },
  {
    title: "Top iOS shortcuts",
    query: "top iOS shortcuts iPhone automation 2026",
    note: "Current shortcut packs, automations, and creator walkthroughs from video and social posts.",
    targetIds: ["pack", "youtube", "x"]
  },
  {
    title: "Claude Code workflows",
    query: "Claude Code workflow tips tmux agents release notes 2026",
    note: "Workflow upgrades, release notes, and practical team usage patterns.",
    targetIds: ["web", "github", "x"]
  },
  {
    title: "OpenAI launches",
    query: "latest OpenAI launches models Codex ChatGPT 2026",
    note: "New releases, shipping notes, and product changes that may affect your stack.",
    targetIds: ["web", "github", "x"]
  },
  {
    title: "YouTube creator changes",
    query: "latest YouTube creator updates monetization algorithm tools 2026",
    note: "Product updates and creator-facing changes that shape what people are posting about next.",
    targetIds: ["web", "youtube", "x"]
  }
];

const RESEARCH_LANES = [
  {
    title: "Apple + widgets sweep",
    query: "latest iOS widgets lock screen home screen widgets 2026",
    note: "Combines web, Apple site search, and YouTube results."
  },
  {
    title: "OpenClaw social scan",
    query: "OpenClaw tricks workflows plugin tips 2026",
    note: "Best for community techniques across web, YouTube, and X/Twitter."
  },
  {
    title: "Shortcuts deep dive",
    query: "top iOS shortcuts automation ideas 2026",
    note: "Use this when you want creator examples plus current social chatter."
  }
];

const SEARCH_TARGETS = {
  pack: {
    label: "Research Pack",
    buildUrls(query) {
      return [buildGoogleUrl(query), buildYouTubeUrl(query), buildXUrl(query)];
    }
  },
  web: {
    label: "Web",
    buildUrls(query) {
      return [buildGoogleUrl(query)];
    }
  },
  youtube: {
    label: "YouTube",
    buildUrls(query) {
      return [buildYouTubeUrl(query)];
    }
  },
  x: {
    label: "X/Twitter",
    buildUrls(query) {
      return [buildXUrl(query)];
    }
  },
  github: {
    label: "GitHub",
    buildUrls(query) {
      return [buildGitHubUrl(query)];
    }
  },
  apple: {
    label: "Apple",
    buildUrls(query) {
      return [buildGoogleUrl(`site:apple.com ${query}`)];
    }
  }
};

const previewTargetIds = ["web", "youtube", "x", "github", "apple"];

const queryInput = document.querySelector("#intel-query");
const searchForm = document.querySelector("#intel-search-form");
const searchPreview = document.querySelector("#search-preview");
const presetList = document.querySelector("#preset-list");
const historyList = document.querySelector("#history-list");
const laneList = document.querySelector("#lane-list");
const refreshWatchButton = document.querySelector("#refresh-watch-button");
const watchGrid = document.querySelector("#watch-grid");
const watchSourceCount = document.querySelector("#watch-source-count");
const watchGeneratedAt = document.querySelector("#watch-generated-at");
const watchStatusPill = document.querySelector("#watch-status-pill");
const historyCountPill = document.querySelector("#history-count-pill");
const watchNote = document.querySelector("#watch-note");

let history = loadHistory();

function createElement(tagName, className, textContent) {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (textContent !== undefined) {
    element.textContent = textContent;
  }

  return element;
}

function normalizeQuery(value) {
  return value.replace(/\s+/g, " ").trim();
}

function buildGoogleUrl(query) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function buildYouTubeUrl(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function buildXUrl(query) {
  return `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query`;
}

function buildGitHubUrl(query) {
  return `https://github.com/search?q=${encodeURIComponent(query)}&type=repositories`;
}

function formatDateTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.valueOf())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.valueOf())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric"
  }).format(date);
}

function loadHistory() {
  try {
    const stored = window.localStorage.getItem(HISTORY_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string").slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function persistHistory() {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch { /* Keep search working when browser storage is unavailable. */ }
  historyCountPill.textContent = `Searches: ${history.length}`;
}

function rememberQuery(query) {
  const normalized = normalizeQuery(query);

  if (!normalized) {
    return;
  }

  history = [normalized, ...history.filter((entry) => entry.toLowerCase() !== normalized.toLowerCase())].slice(
    0,
    MAX_HISTORY
  );

  persistHistory();
  renderHistory();
}

function openUrls(urls) {
  for (const url of urls) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function runSearch(targetId, explicitQuery) {
  const normalized = normalizeQuery(explicitQuery ?? queryInput.value);

  if (!normalized) {
    queryInput.focus();
    return;
  }

  rememberQuery(normalized);
  openUrls(SEARCH_TARGETS[targetId].buildUrls(normalized));
}

function createSearchButton(label, targetId, query, tone = "secondary") {
  const button = createElement("button", `ao-btn${tone === "primary" ? " ao-btn--primary" : ""}`, label);
  button.type = "button";
  button.addEventListener("click", () => runSearch(targetId, query));
  return button;
}

function renderSearchPreview(query) {
  const activeQuery = normalizeQuery(query) || DEFAULT_QUERY;
  searchPreview.replaceChildren();

  for (const targetId of previewTargetIds) {
    const target = SEARCH_TARGETS[targetId];
    const article = createElement("article", "preview-row");
    const copy = createElement("div", "preview-copy");
    const label = createElement("strong", null, target.label);
    const link = createElement("a", "preview-link", target.buildUrls(activeQuery)[0]);
    link.href = target.buildUrls(activeQuery)[0];
    link.target = "_blank";
    link.rel = "noreferrer";

    copy.append(label, link);
    article.append(copy, createSearchButton(`Open ${target.label}`, targetId, activeQuery));
    searchPreview.append(article);
  }
}

function renderPresetList(filterValue = "") {
  const normalized = normalizeQuery(filterValue).toLowerCase();
  const tokens = normalized ? normalized.split(" ") : [];
  const presets = [...PRESET_QUERIES].sort((left, right) => {
    if (!tokens.length) {
      return 0;
    }

    const leftHaystack = `${left.title} ${left.query} ${left.note}`.toLowerCase();
    const rightHaystack = `${right.title} ${right.query} ${right.note}`.toLowerCase();
    const leftScore = tokens.filter((token) => leftHaystack.includes(token)).length;
    const rightScore = tokens.filter((token) => rightHaystack.includes(token)).length;
    return rightScore - leftScore;
  });

  presetList.replaceChildren();

  for (const preset of presets) {
    const card = createElement("article", "preset-card");
    const title = createElement("strong", null, preset.title);
    const query = createElement("p", "preset-query", preset.query);
    const note = createElement("p", "signal-note", preset.note);
    const actions = createElement("div", "preset-actions");

    for (const [index, targetId] of preset.targetIds.entries()) {
      actions.append(createSearchButton(SEARCH_TARGETS[targetId].label, targetId, preset.query, index === 0 ? "primary" : "secondary"));
    }

    card.append(title, query, note, actions);
    presetList.append(card);
  }
}

function renderHistory() {
  historyList.replaceChildren();

  if (!history.length) {
    historyList.append(createElement("p", "empty-note", "Your recent searches will appear here after the first run."));
    return;
  }

  for (const query of history) {
    const row = createElement("article", "history-row");
    const copy = createElement("div", "compact-copy");
    copy.append(createElement("strong", null, query), createElement("p", null, "Reopen the pack or send it straight to YouTube."));

    const actions = createElement("div", "preset-actions");
    actions.append(createSearchButton("Research Pack", "pack", query), createSearchButton("YouTube", "youtube", query));
    row.append(copy, actions);
    historyList.append(row);
  }
}

function renderLanes() {
  laneList.replaceChildren();

  for (const lane of RESEARCH_LANES) {
    const row = createElement("article", "preset-card");
    row.append(
      createElement("strong", null, lane.title),
      createElement("p", "preset-query", lane.query),
      createElement("p", "signal-note", lane.note)
    );

    const actions = createElement("div", "preset-actions");
    actions.append(
      createSearchButton("Research Pack", "pack", lane.query, "primary"),
      createSearchButton("Apple", "apple", lane.query),
      createSearchButton("X/Twitter", "x", lane.query)
    );

    row.append(actions);
    laneList.append(row);
  }
}

function createStatusPill(label, tone) {
  return createElement("span", `ao-badge ao-badge--${tone === "stable" ? "success" : "warn"}`, label);
}

function renderWatchLoading() {
  watchGrid.setAttribute("aria-busy", "true");
  watchStatusPill.textContent = "Watchlist: Loading";
  watchGrid.replaceChildren();

  for (let index = 0; index < 5; index += 1) {
    const card = createElement("article", "source-card source-card-loading");
    card.append(
      createElement("div", "source-card-head shimmer-block"),
      createElement("div", "shimmer-block"),
      createElement("div", "shimmer-block")
    );
    watchGrid.append(card);
  }
}

function renderWatchlist(payload) {
  const sources = Array.isArray(payload.sources) ? payload.sources : [];
  watchGrid.replaceChildren();

  watchSourceCount.textContent = String(sources.length);
  watchGeneratedAt.textContent = formatDateTime(payload.generatedAt);

  const liveSources = sources.filter((source) => source.status === "ok").length;
  watchStatusPill.textContent = `Watchlist: ${liveSources}/${sources.length} live`;
  watchStatusPill.className = `ao-badge ao-badge--${liveSources === sources.length ? "success" : "warn"}`;
  watchNote.textContent = liveSources === sources.length
    ? "Watchlist refreshed from the latest available source pages and feeds."
    : "Some feeds are unavailable. You can still open their source pages and use search.";

  for (const source of sources) {
    const card = createElement("article", "source-card");
    const heading = createElement("div", "source-card-head");
    const copy = createElement("div", "source-card-meta");
    const titleLink = createElement("a", "source-card-link", source.name);
    titleLink.href = source.homepage;
    titleLink.target = "_blank";
    titleLink.rel = "noreferrer";

    copy.append(titleLink, createElement("p", null, source.description));
    heading.append(copy, createStatusPill(source.status === "ok" ? "Live" : "Issue", source.status === "ok" ? "stable" : "watch"));
    card.append(heading);

    const items = createElement("div", "source-items");

    if (!source.items?.length) {
      items.append(createElement("p", "empty-note", "This source did not return any recent items right now."));
    } else {
      for (const item of source.items) {
        const row = createElement("article", "source-item");
        const link = createElement("a", "source-item-link", item.title);
        link.href = item.url;
        link.target = "_blank";
        link.rel = "noreferrer";

        const metaBits = [formatDate(item.publishedAt), item.category].filter(Boolean).join(" • ");
        row.append(link, createElement("p", "source-item-meta", metaBits));

        if (item.summary) {
          row.append(createElement("p", "source-item-summary", item.summary));
        }

        items.append(row);
      }
    }

    const footer = createElement("div", "source-card-footer");
    const updatedLabel = createElement("p", "signal-note", `Updated ${formatDateTime(source.fetchedAt || payload.generatedAt)}`);
    const sourceButton = createElement("a", "ao-btn", "Open Source");
    sourceButton.href = source.homepage;
    sourceButton.target = "_blank";
    sourceButton.rel = "noreferrer";

    footer.append(updatedLabel, sourceButton);
    card.append(items, footer);
    watchGrid.append(card);
  }
}

function renderWatchError(error) {
  watchGrid.replaceChildren();
  watchStatusPill.textContent = "Watchlist: source issue";
  watchStatusPill.className = "ao-badge ao-badge--warn";
  watchGeneratedAt.textContent = "Unavailable";
  watchNote.textContent = error instanceof Error ? error.message : "The watchlist could not be loaded.";
  watchGrid.append(
    createElement("p", "empty-note", "The live watchlist is unavailable right now. Try a refresh in a moment.")
  );
}

async function loadWatchlist(options = {}) {
  refreshWatchButton.disabled = true;
  renderWatchLoading();

  try {
    const url = options.force ? `${WATCH_ENDPOINT}?refresh=1&t=${Date.now()}` : WATCH_ENDPOINT;
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Watchlist request failed with status ${response.status}.`);
    }

    const payload = await response.json();
    renderWatchlist(payload);
  } catch (error) {
    renderWatchError(error);
  } finally {
    refreshWatchButton.disabled = false;
    watchGrid.setAttribute("aria-busy", "false");
  }
}

queryInput.value = DEFAULT_QUERY;
persistHistory();
renderSearchPreview(queryInput.value);
renderPresetList(queryInput.value);
renderHistory();
renderLanes();
renderWatchLoading();

queryInput.addEventListener("input", () => {
  renderSearchPreview(queryInput.value);
  renderPresetList(queryInput.value);
});

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runSearch("pack");
});

for (const button of document.querySelectorAll("[data-search-target]")) {
  button.addEventListener("click", () => runSearch(button.dataset.searchTarget));
}

refreshWatchButton.addEventListener("click", () => {
  loadWatchlist({ force: true });
});

loadWatchlist();

