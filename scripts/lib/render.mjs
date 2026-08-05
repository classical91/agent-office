const ANGLE_LABELS = {
  outcome: 'Outcome',
  system: 'System',
  curiosity: 'Curiosity',
  contrarian: 'Contrarian',
  story: 'Story',
};

/** Renders the package payload as the markdown document a human reviews. */
export function renderMarkdown(payload) {
  const { request, package: pkg } = payload;
  const lines = [];
  const push = (...text) => lines.push(...text);

  push(`# YouTube Package: ${truncate(request.idea, 80)}`, '');
  push(
    '| Field | Value |',
    '| --- | --- |',
    `| Format | ${request.format} |`,
    `| Audience | ${request.audience} |`,
    `| Tone | ${request.tone} |`,
    `| Target runtime | ${pkg.longform.applicable ? `${pkg.longform.targetMinutes} min` : 'n/a'} |`,
    `| Source notes | ${request.sourceNotes ? 'supplied' : 'none supplied'} |`,
    `| Handoff | ${request.handoffId ? `${request.handoffId} (from ${request.from ?? 'unknown'})` : 'none'} |`,
    `| Playbook | ${payload.playbook.path} @ ${payload.playbook.sha256} |`,
    `| Schema | ${payload.schemaVersion} |`,
    `| Generated | ${payload.generatedAt} |`,
    ''
  );

  if (payload.warnings.length > 0) {
    push('> **Warnings**');
    for (const warning of payload.warnings) push(`> - ${warning}`);
    push('');
  }

  push('## 1. Title options', '');
  for (const [angle, titles] of Object.entries(pkg.titles.byAngle)) {
    push(`### ${ANGLE_LABELS[angle] ?? angle}`, '');
    for (const text of titles) {
      const option = pkg.titles.options.find((item) => item.text === text);
      push(`- ${text} — *${option.chars} chars${option.flags.length ? `, flags: ${option.flags.join(', ')}` : ''}*`);
    }
    push('');
  }

  push('## 2. Recommended title', '');
  if (pkg.titles.recommended) {
    push(`**${pkg.titles.recommended.text}**`, '');
    push(`${pkg.titles.recommended.rationale}`, '');
  } else {
    push('_No title could be derived — write one by hand._', '');
  }

  push('## 3. Thumbnail concepts', '');
  for (const [index, concept] of pkg.thumbnails.entries()) {
    push(`### ${index + 1}. ${concept.name}`, '');
    push(`- **Layout:** ${concept.layout}`);
    push(`- **Subject:** ${concept.subject}`);
    push(`- **Text (<= 4 words):** ${concept.text}`);
    push(`- **Emotion:** ${concept.emotion}`);
    push(`- **Contrast:** ${concept.contrast}`);
    push(`- **Mobile readability:** ${concept.mobileReadability}`);
    push('');
  }

  push('## 4. Description', '');
  push('```text', pkg.description.fullText, '```', '');

  push('## 5. Pinned comment', '');
  push('```text', pkg.pinnedComment, '```', '');

  push('## 6. Shorts cutdown plan', '');
  if (pkg.shorts.applicable) {
    for (const cutdown of pkg.shorts.cutdowns) {
      push(`### ${cutdown.id}: ${cutdown.name} (${cutdown.totalSeconds}s, ends on ${cutdown.ending})`, '');
      push(`- **Source beat:** ${cutdown.sourceBeat}`);
      push(`- **Hook (first 2s):** ${cutdown.hook}`);
      push(`- **Framing:** ${cutdown.framing}`, '');
      push('| Time | On-screen text | Action |', '| --- | --- | --- |');
      for (const beat of cutdown.beats) {
        push(`| ${beat.range} | ${beat.onScreen} | ${beat.action} |`);
      }
      push('');
    }
  } else {
    push(`_Not applicable — ${pkg.shorts.reason}_`, '');
  }

  push('## 7. Longform chapter outline', '');
  if (pkg.longform.applicable) {
    push(`Target runtime: ${pkg.longform.targetMinutes} minutes.`, '');
    push('| Timestamp | Chapter | Promise |', '| --- | --- | --- |');
    for (const chapter of pkg.longform.chapters) {
      push(`| ${chapter.timestamp} | ${chapter.title} | ${chapter.promise} |`);
    }
    push('');
  } else {
    push(`_Not applicable — ${pkg.longform.reason}_`, '');
  }

  push('## 8. Review checklist', '');
  push(`Source: \`${pkg.reviewChecklist.source}\` @ ${pkg.reviewChecklist.sourceSha256}`, '');
  for (const group of pkg.reviewChecklist.groups) {
    push(`**${group.name}**`, '');
    for (const item of group.items) push(`- [${item.checked ? 'x' : ' '}] ${item.text}`);
    push('');
  }

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

function truncate(text, max) {
  const value = String(text).trim();
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}
