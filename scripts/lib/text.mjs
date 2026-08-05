const SMALL_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'nor',
  'of', 'on', 'or', 'over', 'the', 'to', 'up', 'via', 'with', 'without',
]);

/** Words that are already cased deliberately keep their casing. */
const isDeliberatelyCased = (word) => /[A-Z]/.test(word.slice(1));

export function titleCase(input) {
  const words = clean(input).split(/\s+/).filter(Boolean);
  return words
    .map((word, index) => {
      if (isDeliberatelyCased(word)) return word;
      const lower = word.toLowerCase();
      if (index > 0 && index < words.length - 1 && SMALL_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

export function sentenceCase(input) {
  const text = clean(input);
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function clean(input) {
  return String(input ?? '').replace(/\s+/g, ' ').trim();
}

/** Trims a phrase to at most `maxWords` words without cutting mid-word. */
export function condense(input, maxWords) {
  const words = clean(input).split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(' ');
}

/** Common gerunds mapped to their base form so "How to ..." titles read correctly. */
const GERUND_TO_BASE = new Map(Object.entries({
  automating: 'automate', building: 'build', creating: 'create', designing: 'design',
  editing: 'edit', growing: 'grow', launching: 'launch', making: 'make',
  managing: 'manage', running: 'run', scaling: 'scale', shipping: 'ship',
  starting: 'start', turning: 'turn', using: 'use', writing: 'write',
}));

/** Returns the imperative form of a gerund phrase, or null when it isn't one. */
export function toImperative(phrase) {
  const text = clean(phrase);
  const first = text.split(/\s+/)[0]?.toLowerCase();
  if (!first || !first.endsWith('ing')) return null;
  const base = GERUND_TO_BASE.get(first);
  if (!base) return null;
  return [base, ...text.split(/\s+/).slice(1)].join(' ');
}

/** Strips a leading gerund so "building specialist agents" becomes "specialist agents". */
export function stripLeadingGerund(phrase) {
  const text = clean(phrase);
  const words = text.split(/\s+/);
  if (words.length > 1 && GERUND_TO_BASE.has(words[0].toLowerCase())) {
    return words.slice(1).join(' ');
  }
  return text;
}

export function formatTimestamp(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

/** Splits notes/transcripts into usable evidence lines. */
export function toLines(input) {
  return String(input ?? '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => clean(line).replace(/^[-*•]\s*/, ''))
    .filter((line) => line.length > 12);
}
