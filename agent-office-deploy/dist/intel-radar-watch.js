'use strict';

// Official public feeds copied from Cyber Security. No dependency on its host.
// Each Office server owns its cache; failed sources do not hide healthy ones.
function createWatchlist({ fetchImpl = globalThis.fetch, timeoutMs = 6000 } = {}) {
  const WATCH_CACHE_TTL_MS = 1000 * 60 * 15;
  const REMOTE_HEADERS = {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.8,*/*;q=0.7",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
  };

  const watchCache = {
    expiresAt: 0,
    payload: null,
    pending: null
  };

  const WATCH_SOURCES = [
    {
      id: "youtube",
      name: "YouTube",
      description: "Official YouTube Blog entries discovered through the public sitemap.",
      format: "youtube-sitemap",
      homepage: "https://blog.youtube/"
    },
    {
      id: "apple",
      name: "Apple",
      description: "Apple Newsroom pulled from the official RSS feed.",
      feedUrl: "https://www.apple.com/newsroom/rss-feed.rss",
      format: "atom",
      homepage: "https://www.apple.com/newsroom/"
    },
    {
      id: "openclaw",
      name: "OpenClaw",
      description: "Latest project release notes from the official GitHub releases feed.",
      feedUrl: "https://github.com/openclaw/openclaw/releases.atom",
      format: "atom",
      homepage: "https://github.com/openclaw/openclaw/releases"
    },
    {
      id: "claude-code",
      name: "Claude Code",
      description: "Anthropic release notes from the public GitHub releases feed.",
      feedUrl: "https://github.com/anthropics/claude-code/releases.atom",
      format: "atom",
      homepage: "https://github.com/anthropics/claude-code/releases"
    },
    {
      id: "openai",
      name: "OpenAI",
      description: "OpenAI News from the official RSS feed.",
      feedUrl: "https://openai.com/news/rss.xml",
      format: "rss",
      homepage: "https://openai.com/news/"
    }
  ];

  function normalizeWhitespace(value = "") {
    return value.replace(/\s+/g, " ").trim();
  }

  function shorten(value = "", maxLength = 220) {
    const normalized = normalizeWhitespace(value);

    if (normalized.length <= maxLength) {
      return normalized;
    }

    const truncated = normalized.slice(0, maxLength);
    const boundary = truncated.lastIndexOf(" ");
    return `${truncated.slice(0, boundary > 60 ? boundary : maxLength).trimEnd()}...`;
  }

  function decodeEntities(value = "") {
    const namedEntities = {
      amp: "&",
      apos: "'",
      gt: ">",
      lt: "<",
      nbsp: " ",
      quot: '"'
    };

    return value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
      .replace(/&([a-z]+);/gi, (match, name) => namedEntities[name.toLowerCase()] ?? match);
  }

  function stripTags(value = "") {
    return normalizeWhitespace(decodeEntities(value).replace(/<[^>]+>/g, " "));
  }

  function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function cleanValue(value = "") {
    return normalizeWhitespace(decodeEntities(value));
  }

  function extractTag(block, tagName) {
    const match = block.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)</${tagName}>`, "i"));
    return match ? match[1] : "";
  }

  function extractMetaContent(html, attributeName, attributeValue) {
    const escapedValue = escapeRegex(attributeValue);
    const patterns = [
      new RegExp(`<meta[^>]*${attributeName}=["']${escapedValue}["'][^>]*content=["']([^"']*)["'][^>]*>`, "i"),
      new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*${attributeName}=["']${escapedValue}["'][^>]*>`, "i")
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);

      if (match) {
        return match[1];
      }
    }

    return "";
  }

  function extractLinkHref(block) {
    const match = block.match(/<link\b[^>]*href="([^"]+)"[^>]*\/?>/i);
    return match ? cleanValue(match[1]) : "";
  }

  function extractCategory(block) {
    const termMatch = block.match(/<category\b[^>]*term="([^"]+)"/i);

    if (termMatch) {
      return cleanValue(termMatch[1]);
    }

    return cleanValue(extractTag(block, "category"));
  }

  function toIsoDate(value) {
    const cleaned = cleanValue(value);

    if (!cleaned) {
      return null;
    }

    const date = new Date(cleaned);
    return Number.isNaN(date.valueOf()) ? null : date.toISOString();
  }

  function parseRssFeed(xml) {
    return Array.from(xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi))
      .map((match) => match[1])
      .map((block) => ({
        category: extractCategory(block),
        publishedAt: toIsoDate(extractTag(block, "pubDate")),
        summary: shorten(stripTags(extractTag(block, "description") || extractTag(block, "content"))),
        title: cleanValue(extractTag(block, "title")),
        url: cleanValue(extractTag(block, "link"))
      }))
      .filter((item) => item.title && item.url)
      .slice(0, 3);
  }

  function parseAtomFeed(xml) {
    return Array.from(xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi))
      .map((match) => match[1])
      .map((block) => ({
        category: extractCategory(block),
        publishedAt: toIsoDate(extractTag(block, "updated") || extractTag(block, "published")),
        summary: shorten(stripTags(extractTag(block, "content") || extractTag(block, "summary"))),
        title: cleanValue(extractTag(block, "title")),
        url: extractLinkHref(block)
      }))
      .filter((item) => item.title && item.url)
      .slice(0, 3);
  }

  function humanizeSlug(url) {
    const slug = new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? "Latest update";
    return slug
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  function mapYouTubeCategory(url) {
    const segment = new URL(url).pathname.split("/").filter(Boolean)[0] ?? "";
    const categories = {
      "creator-and-artist-stories": "Creators",
      "culture-and-trends": "Culture",
      "inside-youtube": "Inside YouTube",
      madeonyoutube: "Made On YouTube",
      "news-and-events": "News"
    };

    return categories[segment] ?? "YouTube";
  }

  function parseYouTubeSitemap(xml) {
    return Array.from(xml.matchAll(/<url>([\s\S]*?)<\/url>/gi))
      .map((match) => match[1])
      .map((block) => ({
        publishedAt: cleanValue(extractTag(block, "lastmod")),
        url: cleanValue(extractTag(block, "loc"))
      }))
      .filter((entry) =>
        /^https:\/\/blog\.youtube\/(?:news-and-events|creator-and-artist-stories|culture-and-trends|inside-youtube|madeonyoutube)\/[^/]+\/?$/i.test(
          entry.url
        )
      )
      .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt));
  }

  async function fetchText(url) {
    const response = await fetchImpl(url, { headers: REMOTE_HEADERS, signal: AbortSignal.timeout(timeoutMs) });

    if (!response.ok) {
      throw new Error(`Unable to fetch ${url} (${response.status})`);
    }

    return response.text();
  }

  async function fetchYouTubeItems() {
    const sitemapIndex = await fetchText("https://blog.youtube/sitemap.xml");
    const sitemapCandidates = Array.from(sitemapIndex.matchAll(/<loc>([^<]+)<\/loc>/gi)).map((match) => cleanValue(match[1]));
    const sitemapUrl = sitemapCandidates.find((candidate) => /\/en-us\/sitemap\.xml$/i.test(candidate)) ?? sitemapCandidates[0];

    if (!sitemapUrl) {
      return [];
    }

    const sitemap = await fetchText(sitemapUrl);
    const entries = parseYouTubeSitemap(sitemap).slice(0, 3);

    return Promise.all(
      entries.map(async (entry) => {
        try {
          const html = await fetchText(entry.url);
          const title =
            cleanValue(extractMetaContent(html, "property", "og:title")) ||
            cleanValue(extractMetaContent(html, "name", "twitter:title")) ||
            cleanValue(extractTag(html, "title")) ||
            humanizeSlug(entry.url);

          const summary =
            cleanValue(extractMetaContent(html, "name", "description")) ||
            cleanValue(extractMetaContent(html, "property", "og:description")) ||
            "Open the official blog entry for the full YouTube update.";

          const publishedAt =
            toIsoDate(extractMetaContent(html, "property", "article:published_time")) || toIsoDate(entry.publishedAt);

          return {
            category: mapYouTubeCategory(entry.url),
            publishedAt,
            summary: shorten(summary),
            title: title.replace(/\s*\|\s*(blog\.youtube|YouTube).*$/i, ""),
            url: entry.url
          };
        } catch {
          return {
            category: mapYouTubeCategory(entry.url),
            publishedAt: toIsoDate(entry.publishedAt),
            summary: "Open the official blog entry for the full YouTube update.",
            title: humanizeSlug(entry.url),
            url: entry.url
          };
        }
      })
    );
  }

  async function fetchWatchSource(source) {
    if (source.format === "rss") {
      return parseRssFeed(await fetchText(source.feedUrl));
    }

    if (source.format === "atom") {
      return parseAtomFeed(await fetchText(source.feedUrl));
    }

    if (source.format === "youtube-sitemap") {
      return fetchYouTubeItems();
    }

    return [];
  }

  async function buildWatchPayload() {
    const generatedAt = new Date().toISOString();
    const sources = await Promise.all(
      WATCH_SOURCES.map(async (source) => {
        try {
          const items = await fetchWatchSource(source);
          if (!items.length) throw new Error("No recent items returned by this source.");
          return {
            ...source,
            fetchedAt: new Date().toISOString(),
            items,
            status: "ok"
          };
        } catch (error) {
          return {
            ...source,
            error: error instanceof Error ? error.message : "Unknown source error.",
            fetchedAt: new Date().toISOString(),
            items: [],
            status: "error"
          };
        }
      })
    );

    return {
      generatedAt,
      sources
    };
  }

  async function getWatchPayload(forceRefresh = false) {
    if (!forceRefresh && watchCache.payload && watchCache.expiresAt > Date.now()) {
      return watchCache.payload;
    }

    if (watchCache.pending) {
      return watchCache.pending;
    }

    watchCache.pending = buildWatchPayload()
      .then((payload) => {
        watchCache.payload = payload;
        watchCache.expiresAt = Date.now() + WATCH_CACHE_TTL_MS;
        return payload;
      })
      .finally(() => {
        watchCache.pending = null;
      });

    return watchCache.pending;
  }


  return { getWatchPayload };
}

module.exports = { createWatchlist };
