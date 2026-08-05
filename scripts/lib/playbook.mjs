import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const PLAYBOOK_FILENAME = 'YOUTUBE_PACKAGING.md';

/**
 * Loads YOUTUBE_PACKAGING.md and pulls the review checklist out of it.
 *
 * The checklist lives in exactly one place — the playbook — so a package can never
 * drift from the standard it claims to have been reviewed against. Missing file or
 * empty checklist is a hard failure: shipping an unreviewed package is worse than
 * not shipping one.
 */
export function loadPlaybook(repoRoot) {
  const filePath = path.join(repoRoot, PLAYBOOK_FILENAME);

  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    throw new Error(
      `Cannot package: ${PLAYBOOK_FILENAME} not found at ${filePath}. ` +
        'The packaging playbook is required — restore it before running this command.'
    );
  }

  const groups = parseChecklist(raw);
  if (groups.length === 0) {
    throw new Error(
      `Cannot package: no "## Review checklist" items found in ${PLAYBOOK_FILENAME}. ` +
        'Expected "### Group" headings with "- [ ] item" lines beneath them.'
    );
  }

  return {
    path: PLAYBOOK_FILENAME,
    sha256: createHash('sha256').update(raw).digest('hex').slice(0, 12),
    checklist: groups,
    itemCount: groups.reduce((total, group) => total + group.items.length, 0),
  };
}

function parseChecklist(raw) {
  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+(\d+\.\s+)?review checklist\s*$/i.test(line));
  if (start === -1) return [];

  const groups = [];
  let current = null;

  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;

    const heading = line.match(/^###\s+(.*)$/);
    if (heading) {
      current = { name: heading[1].trim(), items: [] };
      groups.push(current);
      continue;
    }

    const item = line.match(/^\s*-\s*\[\s?\]\s+(.*)$/);
    if (item && current) {
      current.items.push(item[1].trim());
    }
  }

  return groups.filter((group) => group.items.length > 0);
}
