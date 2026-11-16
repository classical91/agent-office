'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createWatchlist } = require('../agent-office-deploy/dist/intel-radar-watch.js');

function feeds({ failApple = false, emptyOpenAI = false } = {}) {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push(url);
    assert.ok(options.signal, 'remote requests need a timeout');
    if (failApple && url.includes('apple.com')) throw new Error('Apple temporarily unavailable');
    let body;
    if (url === 'https://blog.youtube/sitemap.xml') {
      body = '<sitemapindex><sitemap><loc>https://blog.youtube/en-us/sitemap.xml</loc></sitemap></sitemapindex>';
    } else if (url.endsWith('/en-us/sitemap.xml')) {
      body = '<urlset><url><loc>https://blog.youtube/news-and-events/update/</loc><lastmod>2026-11-15</lastmod></url></urlset>';
    } else if (url.includes('blog.youtube')) {
      body = '<html><meta property="og:title" content="YouTube update"><meta name="description" content="Creator news"></html>';
    } else if (url.includes('openai.com')) {
      body = emptyOpenAI ? '<rss/>' : '<rss><channel><item><title><![CDATA[OpenAI &amp; news]]></title><link>https://openai.com/news/update</link><pubDate>Sun, 15 Nov 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>A new release</p>]]></description></item></channel></rss>';
    } else {
      body = '<feed>' + Array.from({ length: 4 }, (_, i) => `<entry><title>Release ${i}</title><link href="https://example.com/releases/${i}"/><updated>2026-11-15T10:00:00Z</updated><content>&lt;p&gt;Release notes&lt;/p&gt;</content></entry>`).join('') + '</feed>';
    }
    return new Response(body);
  };
  return { requests, fetchImpl };
}

test('the five official feeds produce dated, readable items with a three-item limit', async () => {
  const mock = feeds();
  const watch = createWatchlist(mock);
  const payload = await watch.getWatchPayload();
  assert.deepEqual(payload.sources.map(s => s.name), ['YouTube', 'Apple', 'OpenClaw', 'Claude Code', 'OpenAI']);
  assert.ok(payload.sources.every(s => s.status === 'ok' && s.items.length > 0 && s.items.length <= 3));
  assert.equal(payload.sources[0].items[0].title, 'YouTube update');
  assert.equal(payload.sources[1].items[0].summary, 'Release notes');
  assert.equal(payload.sources[4].items[0].title, 'OpenAI & news');
  assert.equal(payload.sources[4].items[0].summary, 'A new release');
  assert.equal(payload.sources[4].items[0].publishedAt, '2026-11-15T10:00:00.000Z');
});

test('requests share an in-flight refresh and cached data; force refresh fetches again', async () => {
  const mock = feeds();
  const watch = createWatchlist(mock);
  const [first, concurrent] = await Promise.all([watch.getWatchPayload(), watch.getWatchPayload(true)]);
  const fetched = mock.requests.length;
  assert.equal(first, concurrent);
  assert.equal(await watch.getWatchPayload(), first);
  assert.equal(mock.requests.length, fetched);
  const refreshed = await watch.getWatchPayload(true);
  assert.notEqual(refreshed, first);
  assert.equal(mock.requests.length, fetched * 2);
});

test('unavailable or empty feeds are reported per source while healthy feeds stay live', async () => {
  const watch = createWatchlist(feeds({ failApple: true, emptyOpenAI: true }));
  const payload = await watch.getWatchPayload();
  assert.equal(payload.sources[0].status, 'ok');
  assert.equal(payload.sources[1].status, 'error');
  assert.match(payload.sources[1].error, /temporarily unavailable/);
  assert.deepEqual(payload.sources[1].items, []);
  assert.equal(payload.sources[2].status, 'ok');
  assert.equal(payload.sources[3].status, 'ok');
  assert.equal(payload.sources[4].status, 'error');
  assert.match(payload.sources[4].error, /No recent items/);
});
