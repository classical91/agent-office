import {
  clean,
  condense,
  formatTimestamp,
  sentenceCase,
  stripLeadingGerund,
  titleCase,
  toImperative,
  toLines,
} from './text.mjs';

/**
 * Bump the minor version when a field is added, the major version when a field
 * changes shape or disappears. Studio Director and Penny read this to know
 * whether they can consume the payload.
 */
export const SCHEMA_VERSION = '1.0.0';

export const FORMATS = ['short', 'longform', 'both'];
const DEFAULT_TONE = 'practical, direct, no hype';
const DEFAULT_DURATION_MINUTES = 8;
const RECOMMENDED_TITLE_CHARS = 60;
const MAX_TITLE_CHARS = 70;
const ANGLE_PRIORITY = ['outcome', 'system', 'curiosity', 'contrarian', 'story'];

/**
 * Merges a Studio Director handoff packet with explicit overrides.
 * Precedence: explicit fields > handoff packet > defaults.
 */
export function resolveRequest({ input = {}, handoff = null, overrides = {} } = {}) {
  const packet = handoff ?? (input.handoff ?? null);
  const layered = { ...(packet ?? {}), ...input, ...stripEmpty(overrides) };
  delete layered.handoff;

  const idea = clean(layered.idea ?? layered.premise ?? layered.topic);
  if (!idea) {
    throw new Error('Missing required input: idea (the raw idea or video premise).');
  }

  const format = clean(layered.format).toLowerCase() || 'both';
  if (!FORMATS.includes(format)) {
    throw new Error(`Invalid format "${format}". Expected one of: ${FORMATS.join(', ')}.`);
  }

  const audience = clean(layered.audience);
  if (!audience) {
    throw new Error('Missing required input: audience (who this video is for).');
  }

  const durationMinutes = Number(layered.durationMinutes ?? layered.duration ?? 0) || null;

  return {
    handoffId: clean(layered.handoffId) || null,
    from: clean(layered.from) || null,
    idea,
    format,
    audience,
    tone: clean(layered.tone) || DEFAULT_TONE,
    durationMinutes,
    keywords: toArray(layered.keywords),
    constraints: toArray(layered.constraints),
    sourceNotes: clean(layered.sourceNotes ?? layered.transcript ?? layered.notes) || null,
  };
}

export function buildPackage({ request, playbook, generatedAt }) {
  const parts = extractParts(request);
  const warnings = [];

  const titles = buildTitles(parts, warnings);
  const recommended = pickRecommendedTitle(titles, parts);
  const includesShort = request.format === 'short' || request.format === 'both';
  const includesLongform = request.format === 'longform' || request.format === 'both';

  if (!request.sourceNotes) {
    warnings.push(
      'No source notes or transcript supplied — every claim in this package is scaffolding and must be checked against the real video.'
    );
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt,
    playbook: {
      path: playbook.path,
      sha256: playbook.sha256,
      checklistItems: playbook.itemCount,
    },
    request,
    package: {
      titles: {
        options: titles,
        byAngle: groupByAngle(titles),
        recommended,
      },
      thumbnails: buildThumbnails(parts, warnings),
      description: buildDescription(parts, recommended, includesLongform),
      pinnedComment: buildPinnedComment(parts),
      shorts: includesShort
        ? { applicable: true, cutdowns: buildShortsCutdowns(parts) }
        : { applicable: false, reason: `Format is "${request.format}" — no Shorts requested.`, cutdowns: [] },
      longform: includesLongform
        ? { applicable: true, targetMinutes: parts.durationMinutes, chapters: buildChapters(parts) }
        : { applicable: false, reason: `Format is "${request.format}" — no longform requested.`, targetMinutes: null, chapters: [] },
      reviewChecklist: {
        source: playbook.path,
        sourceSha256: playbook.sha256,
        groups: playbook.checklist.map((group) => ({
          name: group.name,
          items: group.items.map((text) => ({ text, checked: false })),
        })),
      },
    },
    warnings,
  };
}

/* ---------------------------------------------------------------- parsing -- */

function extractParts(request) {
  const idea = clean(request.idea).replace(/^package this for youtube:?\s*/i, '');

  const durationFromIdea = idea.match(/(\d+(?:\.\d+)?)\s*-?\s*(?:minute|min)\b/i);
  const durationMinutes =
    request.durationMinutes ||
    (durationFromIdea ? Number(durationFromIdea[1]) : null) ||
    DEFAULT_DURATION_MINUTES;

  const subjectWithArticles = idea
    .replace(/^(?:a|an|the)\s+/i, '')
    .replace(/^\d+(?:\.\d+)?\s*-?\s*(?:minute|min)(?:ute)?s?\s+/i, '')
    .replace(
      /^(?:youtube\s+)?(?:video|short|episode|film|clip|documentary|vlog|essay|breakdown|tutorial|walkthrough|explainer|deep dive|case study)\s+(?:about|on|covering|explaining)\s+/i,
      ''
    )
    .replace(/^(?:about|on)\s+/i, '')
    .replace(/\.$/, '')
    .trim();
  // Articles can resurface once a leading media phrase is stripped ("a documentary
  // about the history of X" -> "the history of X"), and templates supply their own.
  const subject = subjectWithArticles.replace(/^(?:a|an|the)\s+/i, '');

  const split = subject.match(/^(.*?)\s+(?:that|which|so that)\s+(.*)$/i);
  const topic = clean(split ? split[1] : subject);
  const promise = clean(split ? split[2] : '');

  const intoMatch = promise.match(/^(\w+)\s+(.+?)\s+into\s+(.+)$/i);
  const transform = intoMatch
    ? { verb: intoMatch[1], from: clean(intoMatch[2]), to: clean(intoMatch[3]) }
    : null;

  // An idea arrives either verb-led ("building X", "how I plan Y") or noun-led ("a
  // documentary about X"). Both forms are derived where possible, because the title
  // templates that read well for one read badly for the other.
  const howMatch = topic.match(/^(?:how|why|what)\s+(?:i|we|you|to)\s+(.*)$/i);
  const imperativeTopic = toImperative(topic);

  let actionPhrase = null;
  let topicNoun = stripLeadingGerund(topic).replace(/^(?:a|an|the)\s+/i, '');
  if (imperativeTopic) {
    actionPhrase = imperativeTopic;
  } else if (howMatch) {
    actionPhrase = clean(howMatch[1]);
    topicNoun = dropLeadingVerb(actionPhrase);
  }

  const shortNoun = condenseNoun(topicNoun, 4);
  const notes = toLines(request.sourceNotes);

  return {
    request,
    idea,
    subject,
    topic,
    topicNoun,
    shortNoun,
    tightNoun: tighten(shortNoun),
    actionPhrase: actionPhrase ? condenseNoun(actionPhrase, 6) : null,
    promise,
    transform,
    durationMinutes,
    audience: request.audience,
    tone: request.tone,
    keywords: request.keywords,
    notes,
    noHype: /no hype|no clickbait|understated/i.test(
      `${request.tone} ${request.constraints.join(' ')}`
    ),
  };
}

/* ----------------------------------------------------------------- titles -- */

function buildTitles(parts, warnings) {
  const { shortNoun, tightNoun, transform, actionPhrase } = parts;
  const noun = titleCase(shortNoun);
  const tight = titleCase(tightNoun);
  const action = actionPhrase ? titleCase(actionPhrase) : null;
  const foil = parts.noHype ? 'the Hype' : 'the Guesswork';

  // Transformation titles are the strongest when the idea states one, so they lead.
  const transformBank = transform
    ? [
        {
          angle: 'outcome',
          text: `${titleCase(transform.verb)} ${titleCase(condenseNoun(transform.from, 3))} Into ${titleCase(condenseNoun(transform.to, 3))}`,
        },
        {
          angle: 'outcome',
          text: `From ${titleCase(condenseNoun(transform.from, 3))} to ${titleCase(condenseNoun(transform.to, 3))}`,
        },
      ]
    : [];

  const actionBank = action
    ? [
        { angle: 'outcome', text: `${action}, Start to Finish` },
        { angle: 'system', text: `How to ${action}` },
        { angle: 'system', text: `A Repeatable Way to ${action}` },
        { angle: 'curiosity', text: `What It Actually Takes to ${action}` },
        { angle: 'contrarian', text: `You Don't Need More Tools to ${action}`, needsSourceCheck: true },
        { angle: 'story', text: `What I Learned Trying to ${action}`, needsSourceCheck: true },
      ]
    : [];

  const nounBank = [
    { angle: 'outcome', text: `The ${noun} Setup, End to End` },
    { angle: 'system', text: `The ${tight} Workflow, Step by Step` },
    { angle: 'curiosity', text: `The ${tight} Part Nobody Explains` },
    { angle: 'contrarian', text: `${noun} Without ${foil}`, needsSourceCheck: true },
  ];

  const fallbackBank = [
    { angle: 'outcome', text: `${noun}: What Actually Matters` },
    { angle: 'curiosity', text: `The Honest Guide to ${noun}` },
    { angle: 'system', text: `A Repeatable System for ${noun}` },
    { angle: 'story', text: `Everything I Know About ${noun}`, needsSourceCheck: true },
  ];

  const candidates = [...transformBank, ...actionBank, ...nounBank, ...fallbackBank];

  const seen = new Set();
  const titles = [];
  for (const candidate of candidates) {
    const text = clean(candidate.text);
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    titles.push({
      angle: candidate.angle,
      text,
      chars: text.length,
      flags: titleFlags(text, candidate),
    });
    if (titles.length === 12) break;
  }

  if (titles.length < 8) {
    warnings.push(
      `Only ${titles.length} title options could be derived from this idea — the playbook requires 8-12. Add detail to the idea or write the remainder by hand.`
    );
  }

  const angles = new Set(titles.map((title) => title.angle));
  if (angles.size < 4) {
    warnings.push(
      `Title options cover only ${angles.size} angles (${[...angles].join(', ')}) — the playbook requires at least 4.`
    );
  }

  return titles;
}

function titleFlags(text, candidate) {
  const flags = [];
  if (text.length > MAX_TITLE_CHARS) flags.push('too-long');
  else if (text.length > RECOMMENDED_TITLE_CHARS) flags.push('over-60-chars');
  if (/[A-Z]{4,}/.test(text)) flags.push('all-caps-word');
  if ((text.match(/[?!]/g) ?? []).length > 1) flags.push('multiple-punctuation-marks');
  if (candidate.needsSourceCheck) flags.push('needs-source-check');
  return flags;
}

function pickRecommendedTitle(titles, parts) {
  if (titles.length === 0) return null;

  const scored = titles
    .map((title, index) => ({
      title,
      index,
      score:
        (title.chars <= RECOMMENDED_TITLE_CHARS ? 100 : 0) +
        (title.flags.length === 0 ? 40 : 0) +
        (ANGLE_PRIORITY.length - ANGLE_PRIORITY.indexOf(title.angle)) * 5,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const winner = scored[0].title;
  return {
    text: winner.text,
    angle: winner.angle,
    chars: winner.chars,
    flags: winner.flags,
    rationale: buildTitleRationale(winner, parts),
  };
}

function buildTitleRationale(title, parts) {
  const lead = condense(title.text, 3);
  const lengthNote =
    title.chars <= RECOMMENDED_TITLE_CHARS
      ? `${title.chars} characters, so it survives mobile truncation`
      : `${title.chars} characters — trim it before publishing`;

  return [
    `Angle: ${title.angle}.`,
    `Front-loads "${lead}", which is the specific thing ${parts.audience} are searching for.`,
    `${sentenceCase(lengthNote)}.`,
    parts.noHype
      ? 'Keeps the requested no-hype register: no caps, no exclamation, no promise beyond the video.'
      : 'States the payoff plainly instead of leaning on an open loop the video has to over-deliver on.',
  ].join(' ');
}

function groupByAngle(titles) {
  return titles.reduce((groups, title) => {
    (groups[title.angle] ??= []).push(title.text);
    return groups;
  }, {});
}

/* ------------------------------------------------------------- thumbnails -- */

function buildThumbnails(parts, warnings) {
  const { tightNoun, transform } = parts;
  const beforeWord = titleCase(condense(transform?.from ?? 'the mess', 2));
  const afterWord = titleCase(condense(transform?.to ?? 'the result', 2));
  const beforeHead = titleCase(headNoun(transform?.from ?? 'mess'));
  const afterHead = titleCase(headNoun(transform?.to ?? 'result'));

  const concepts = [
    {
      id: 'face-led',
      name: 'Face-led: the person mid-decision',
      layout:
        'Subject on the right third, shot from chest up, looking slightly off-camera toward the text. Text block stacked left, upper two-thirds, nothing in the bottom-right (timestamp overlay lands there).',
      subject: `A single person at a desk mid-work on ${tightNoun}, screen glow on one side of the face, hands visible.`,
      text: `${beforeWord} → ${afterWord}`,
      emotion: 'Focused and slightly amused — a person who just figured something out, not a person shouting.',
      contrast:
        'Warm key light on the subject against a desaturated cool background; text in near-white with a 2px dark outline so it holds over both.',
      mobileReadability:
        'Two text words only; at 168x94 px the face reads as a face and the arrow reads as direction. Squint test: subject silhouette and arrow survive, background detail does not — which is fine.',
    },
    {
      id: 'artifact-led',
      name: 'Artifact-led: show the thing itself',
      layout:
        'The artifact fills the left 60% at a slight angle, text right-aligned in the remaining third, baseline centred vertically.',
      subject: `The actual output of ${tightNoun} — the screen, doc, or board — cropped tight enough that one element is unambiguously readable.`,
      text: titleCase(condense(tightNoun, 2)),
      emotion: 'Curiosity through specificity: it looks like a real screenshot, not a stock render.',
      contrast:
        'Single bright accent (one highlighted row/box) against an otherwise muted frame; the accent is the only saturated colour in the image.',
      mobileReadability:
        'One readable element plus two words. At thumbnail size the accent block is the anchor; everything else can blur without losing the message.',
    },
    {
      id: 'before-after',
      name: 'Before/after: the split frame',
      layout:
        'Hard vertical split. Left panel = before state, right panel = after state, thin bright divider. Two-word label bottom-centre spanning the seam.',
      subject: `Left: ${clean(transform?.from ?? 'the scattered starting point')}. Right: ${clean(transform?.to ?? 'the finished result')}. Same framing on both sides so only the content changes.`,
      text: `${beforeHead} vs ${afterHead}`,
      emotion: 'Relief — the right panel is visibly calmer than the left.',
      contrast:
        'Left panel cool and cluttered, right panel warm and clean; the divider is the brightest pixel in the frame.',
      mobileReadability:
        'Composition reads before the text does, so it works even when the label is illegible. Keep each panel to one dominant shape.',
    },
  ];

  return concepts.map((concept) => {
    const textWords = clean(concept.text).split(/\s+/).filter((word) => /[a-z0-9]/i.test(word)).length;
    if (textWords > 4) {
      warnings.push(
        `Thumbnail "${concept.id}" text is ${textWords} words — the playbook caps it at 4. Tighten it before handing off.`
      );
    }
    return { ...concept, textWords };
  });
}

/* ------------------------------------------------------------ description -- */

function buildDescription(parts, recommended, includesLongform) {
  const { audience, topic, topicNoun, transform, notes } = parts;

  const hook = transform
    ? `${sentenceCase(transform.from)} in, ${clean(transform.to)} out — here is the whole path, start to finish.`
    : `Here is the complete, unglamorous version of ${topicNoun} — the parts that actually decide whether it works.`;

  const summary = [
    `This video walks through ${clean(topic)} for ${audience}. No theory detour: the setup, the decisions, and what breaks.`,
    notes.length > 0
      ? `Covered in this video: ${notes.slice(0, 3).map((line) => clean(line).replace(/[.!?]$/, '')).join('; ')}.`
      : `Covered in this video: what the pieces are, how they fit together, where the first attempt usually goes wrong, and the checklist to run before you call it done.`,
    `Made for ${audience} who want the working version, not the pitch. Tone: ${parts.tone}.`,
  ];

  const chapters = includesLongform
    ? buildChapters(parts).map((chapter) => `${chapter.timestamp} ${chapter.title}`)
    : [];

  const cta = `If you build one of these, reply to the pinned comment with what you shipped — that is the only ask.`;

  const links = [
    '<LINK: full written walkthrough>',
    '<LINK: template or starter repo>',
    '<LINK: related video>',
  ];

  const hashtags = buildHashtags(parts);

  const fullText = [
    hook,
    '',
    ...summary.flatMap((paragraph) => [paragraph, '']),
    ...(chapters.length > 0 ? ['CHAPTERS', ...chapters, ''] : []),
    cta,
    '',
    'LINKS',
    ...links,
    '',
    hashtags.join(' '),
  ].join('\n');

  return { hook, summary, chapters, cta, links, hashtags, fullText };
}

function buildHashtags(parts) {
  const fromKeywords = parts.keywords.map(toHashtag);
  const fromTopic = clean(parts.topicNoun)
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 3)
    .map(toHashtag);

  const tags = [...new Set([...fromKeywords, ...fromTopic])].filter(Boolean).slice(0, 5);
  while (tags.length < 3) tags.push(['#workflow', '#automation', '#buildinpublic'][tags.length]);
  return tags;
}

const toHashtag = (value) => `#${clean(value).toLowerCase().replace(/[^a-z0-9]/g, '')}`;

/* ---------------------------------------------------------- pinned comment -- */

function buildPinnedComment(parts) {
  const thing = clean(parts.tightNoun);
  return [
    `Question for the ${parts.audience} watching: what is the one step in ${thing} you still do by hand?`,
    `Tell me which step and I will cover it in the follow-up. Written version: <LINK: full written walkthrough>`,
  ].join(' ');
}

/* ------------------------------------------------------------------ shorts -- */

function buildShortsCutdowns(parts) {
  const { transform, topicNoun, notes, audience } = parts;
  const from = clean(transform?.from ?? 'the vague starting point');
  const to = clean(transform?.to ?? 'the finished result');

  const specs = [
    {
      id: 'short-1',
      name: 'The transformation',
      sourceBeat: notes[0] ?? 'Longform cold open + first walkthrough section',
      hook: `${sentenceCase(from)} to ${to} — in one pass.`,
      beats: [
        { range: '0:00-0:02', onScreen: titleCase(condense(from, 3)), action: `Hard cut straight to the messy starting state. No intro, no name.` },
        { range: '0:02-0:12', onScreen: 'Here is the input', action: `Show the raw input exactly as it arrives — unedited, unflattering.` },
        { range: '0:12-0:28', onScreen: 'One pass', action: `Compress the middle of the longform to the three decisions that matter.` },
        { range: '0:28-0:38', onScreen: titleCase(condense(to, 3)), action: `Reveal the finished output side by side with the opening frame.` },
        { range: '0:38-0:42', onScreen: 'Full build linked', action: `Loop back to the opening frame so the replay is seamless.` },
      ],
      ending: 'loop',
      framing: 'Subject and all on-screen text inside the middle third; keep the bottom 20% clear of the caption bar.',
      totalSeconds: 42,
    },
    {
      id: 'short-2',
      name: 'The one mistake',
      sourceBeat: notes[1] ?? 'Longform section on what goes wrong',
      hook: `Most ${audience} get ${clean(topicNoun)} wrong at exactly one step.`,
      beats: [
        { range: '0:00-0:02', onScreen: 'One step ruins it', action: 'Open on the failure state, mid-frame, already happening.' },
        { range: '0:02-0:14', onScreen: 'The wrong way', action: 'Show the common approach at speed, without mocking it.' },
        { range: '0:14-0:30', onScreen: 'The fix', action: 'Show the corrected step in real time so the difference is visible, not asserted.' },
        { range: '0:30-0:40', onScreen: 'Why it works', action: 'One sentence of reasoning — the mechanism, not the slogan.' },
      ],
      ending: 'cta',
      framing: 'Screen recordings zoomed to 150% so text is legible vertically; subject reaction inset top-right.',
      totalSeconds: 40,
    },
    {
      id: 'short-3',
      name: 'The checklist',
      sourceBeat: notes[2] ?? 'Longform recap chapter',
      hook: `Four checks before you call ${clean(topicNoun)} done.`,
      beats: [
        { range: '0:00-0:02', onScreen: 'Four checks', action: 'Number on screen immediately; promise the count and keep it.' },
        { range: '0:02-0:12', onScreen: 'Check one', action: 'State it, show it, move on. No elaboration.' },
        { range: '0:12-0:22', onScreen: 'Check two', action: 'Same rhythm. The cadence is the retention device.' },
        { range: '0:22-0:32', onScreen: 'Check three', action: 'Same rhythm, slightly faster cut.' },
        { range: '0:32-0:44', onScreen: 'Check four', action: 'Land the last one and stop — no outro.' },
      ],
      ending: 'cta',
      framing: 'Static vertical frame, subject centred, text stacked at eye level so the count is always visible.',
      totalSeconds: 44,
    },
  ];

  return specs.map((spec) => ({ ...spec, standalone: true }));
}

/* ---------------------------------------------------------------- longform -- */

const CHAPTER_PLAN = [
  { title: 'Cold open: the result', promise: 'Show the finished outcome in the first 30 seconds so the viewer knows what they are staying for.' },
  { title: 'Why this is hard', promise: 'Name the real obstacle honestly, including the part most videos skip.' },
  { title: 'The pieces', promise: 'Define every component once, in plain language, so nothing later needs a footnote.' },
  { title: 'Build it: first pass', promise: 'Walk the happy path end to end without cutting away from the mistakes.' },
  { title: 'Where it breaks', promise: 'Show the failure the viewer will actually hit, and the fix.' },
  { title: 'Make it repeatable', promise: 'Turn the one-off into something that runs the same way next week.' },
  { title: 'What I would change', promise: 'Give the honest limitations before the viewer finds them.' },
  { title: 'Recap and next step', promise: 'Restate the through-line in three sentences and make the single ask.' },
];

function buildChapters(parts) {
  const minutes = parts.durationMinutes;
  const count = Math.min(CHAPTER_PLAN.length, Math.max(4, Math.round(minutes / 1.5)));

  // Cold open gets a fixed short slot; the rest split the remaining runtime evenly.
  const totalSeconds = Math.round(minutes * 60);
  const coldOpenSeconds = Math.min(45, Math.round(totalSeconds * 0.08));
  const bodySeconds = totalSeconds - coldOpenSeconds;
  const step = bodySeconds / (count - 1);

  const plan = [CHAPTER_PLAN[0], ...pickEvenly(CHAPTER_PLAN.slice(1), count - 1)];

  return plan.map((chapter, index) => {
    const start = index === 0 ? 0 : coldOpenSeconds + Math.round(step * (index - 1));
    return {
      timestamp: formatTimestamp(start),
      title: chapter.title,
      promise: chapter.promise,
      overLimit: chapter.title.length > 40,
    };
  });
}

/** Picks `count` items spread across the list, always keeping the last one. */
function pickEvenly(items, count) {
  if (count >= items.length) return items.slice(0, count);
  const picked = [];
  for (let index = 0; index < count - 1; index += 1) {
    picked.push(items[Math.round((index * (items.length - 1)) / (count - 1))]);
  }
  picked.push(items[items.length - 1]);
  return picked;
}

/* ----------------------------------------------------------------- helpers -- */

/**
 * Shortens a noun phrase to two words while keeping the head noun, so
 * "OpenClaw specialist agents" tightens to "OpenClaw agents", not "OpenClaw specialist".
 */
function tighten(phrase) {
  const words = clean(phrase).split(/\s+/).filter(Boolean);
  if (words.length <= 2) return words.join(' ');

  // "history of espresso machines" -> the object after the preposition is the specific
  // part; "OpenClaw specialist agents" -> the brand plus the head noun is.
  const content = words.filter((word) => !TRAILING_WORDS.has(word.toLowerCase()));
  const hasBoundary = content.length < words.length;
  if (hasBoundary) return content.slice(-2).join(' ');
  return `${words[0]} ${words[words.length - 1]}`;
}

const BOUNDARY_WORDS = new Set(['of', 'in', 'for', 'with', 'about', 'that', 'and', 'to', 'from', 'on', 'at', 'by']);
const TRAILING_WORDS = new Set([...BOUNDARY_WORDS, 'a', 'an', 'the', 'my', 'your', 'their', 'is', 'are']);

/**
 * Trims a phrase to a title-safe length: cut at a natural preposition boundary when
 * one exists past the first two words, otherwise at the word budget — then drop any
 * function word left dangling on the end.
 */
function condenseNoun(phrase, maxWords) {
  const words = clean(phrase).replace(/\.$/, '').split(/\s+/).filter(Boolean);
  const boundary = words.findIndex((word, index) => index >= 4 && BOUNDARY_WORDS.has(word.toLowerCase()));
  const cut = boundary === -1 ? maxWords : Math.min(boundary, maxWords);
  const kept = words.slice(0, cut);
  while (kept.length > 1 && TRAILING_WORDS.has(kept[kept.length - 1].toLowerCase())) kept.pop();
  return kept.join(' ');
}

/** "plan a week of content" -> "week of content", for turning an action into its object. */
function dropLeadingVerb(phrase) {
  const words = clean(phrase).split(/\s+/).filter(Boolean);
  if (words.length < 3) return words.join(' ');
  return words.slice(1).join(' ').replace(/^(?:a|an|the|my|your)\s+/i, '');
}

/** Last word of a phrase — the head noun, for places with a hard word budget. */
const headNoun = (phrase) => clean(phrase).split(/\s+/).filter(Boolean).pop() ?? '';

function toArray(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(clean).filter(Boolean);
  return [];
}

function stripEmpty(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}
