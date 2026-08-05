#!/usr/bin/env node
/**
 * YouTube Claw packaging command.
 *
 * Turns a raw idea — or a Studio Director handoff packet — into a complete YouTube
 * package: titles, thumbnails, description, pinned comment, Shorts cutdowns, longform
 * chapters, and the review checklist read live from YOUTUBE_PACKAGING.md.
 *
 * Deterministic and offline: no API keys, no network, no publishing. The output is a
 * structured first draft that YouTube Claw refines against the playbook — the script
 * guarantees the package is complete and consistently shaped, not that every line is
 * the best line available.
 *
 *   node scripts/package-youtube.mjs --input fixtures/youtube-packaging/sample-input.json
 *   npm run package:youtube -- --idea "..." --format both --audience "..."
 *
 * Run with --help for the full flag list.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPackage, resolveRequest, FORMATS } from './lib/packaging.mjs';
import { loadPlaybook } from './lib/playbook.mjs';
import { renderMarkdown } from './lib/render.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const USAGE = `
YouTube Claw packaging command

Usage:
  node scripts/package-youtube.mjs [options]

Input (at least an idea, a format, and an audience must be resolvable):
  --input <file.json>     Request JSON. May be a Studio Director handoff packet.
  --handoff <file.json>   Studio Director handoff packet (merged under --input).
  --stdin                 Read request JSON from stdin.
  --idea "<text>"         Raw idea or video premise.
  --format <${FORMATS.join('|')}>
  --audience "<text>"     Who the video is for.
  --tone "<text>"         Defaults to "practical, direct, no hype".
  --duration <minutes>    Longform target runtime.
  --keywords "a,b,c"      Search terms to keep on the surface.
  --notes "<text>"        Source notes or transcript.
  --notes-file <file>     Read source notes/transcript from a file.

Output:
  --out <file.md>         Write the markdown package.
  --out-json <file.json>  Write the structured payload.
  --json                  Print JSON to stdout instead of markdown.
  --now <iso8601>         Pin the generatedAt timestamp (for reproducible fixtures).
  --check                 Compare against --out/--out-json instead of writing. Exit 1 on drift.
  --quiet                 Suppress stdout when writing to files.
  -h, --help              Show this help.

Never emits credentials, uploads, schedules, or publishes. Packaging stops at the document.
`.trimStart();

async function main(argv) {
  const args = parseArgs(argv);

  if (args.help) {
    process.stdout.write(USAGE);
    return 0;
  }

  const playbook = loadPlaybook(REPO_ROOT);

  const input = {
    ...(args.input ? readJson(args.input) : {}),
    ...(args.stdin ? JSON.parse(await readStdin()) : {}),
  };
  const handoff = args.handoff ? readJson(args.handoff) : null;

  const request = resolveRequest({
    input,
    handoff,
    overrides: {
      idea: args.idea,
      format: args.format,
      audience: args.audience,
      tone: args.tone,
      durationMinutes: args.duration,
      keywords: args.keywords,
      sourceNotes: args['notes-file'] ? readText(args['notes-file']) : args.notes,
    },
  });

  const payload = buildPackage({
    request,
    playbook,
    generatedAt: args.now ?? new Date().toISOString(),
  });

  const markdown = renderMarkdown(payload);
  const json = `${JSON.stringify(payload, null, 2)}\n`;

  if (args.check) {
    return runCheck(args, { markdown, json });
  }

  if (args.out) writeOut(args.out, markdown);
  if (args['out-json']) writeOut(args['out-json'], json);

  const wroteFiles = Boolean(args.out || args['out-json']);
  if (!wroteFiles || !args.quiet) {
    process.stdout.write(args.json ? json : markdown);
  }

  for (const warning of payload.warnings) {
    process.stderr.write(`warning: ${warning}\n`);
  }

  return 0;
}

function runCheck(args, generated) {
  const targets = [
    args.out && { file: args.out, expected: generated.markdown },
    args['out-json'] && { file: args['out-json'], expected: generated.json },
  ].filter(Boolean);

  if (targets.length === 0) {
    throw new Error('--check needs --out and/or --out-json pointing at the fixture(s) to compare against.');
  }

  let failed = false;
  for (const target of targets) {
    const actual = readText(target.file);
    if (actual === target.expected) {
      process.stdout.write(`ok   ${path.relative(REPO_ROOT, target.file)} matches freshly generated output\n`);
    } else {
      failed = true;
      process.stdout.write(
        `FAIL ${path.relative(REPO_ROOT, target.file)} differs from freshly generated output\n` +
          `     ${describeFirstDifference(actual, target.expected)}\n`
      );
    }
  }

  if (failed) {
    process.stdout.write('\nRegenerate the fixtures if the change was intentional (see SMOKE_TEST.md).\n');
  }
  return failed ? 1 : 0;
}

function describeFirstDifference(actual, expected) {
  const actualLines = actual.split('\n');
  const expectedLines = expected.split('\n');
  const max = Math.max(actualLines.length, expectedLines.length);
  for (let index = 0; index < max; index += 1) {
    if (actualLines[index] !== expectedLines[index]) {
      return `first difference on line ${index + 1}:\n     fixture:   ${trim(actualLines[index])}\n     generated: ${trim(expectedLines[index])}`;
    }
  }
  return 'files differ only in trailing content';
}

const trim = (line) => (line === undefined ? '<end of file>' : line.slice(0, 120));

function parseArgs(argv) {
  const flags = { help: false, stdin: false, json: false, check: false, quiet: false };
  const booleans = new Set(['help', 'stdin', 'json', 'check', 'quiet']);

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '-h') {
      flags.help = true;
      continue;
    }
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument "${token}". Run with --help for usage.`);
    }

    const [name, inlineValue] = splitFlag(token.slice(2));
    if (booleans.has(name)) {
      flags[name] = true;
      continue;
    }

    const value = inlineValue ?? argv[++index];
    if (value === undefined) throw new Error(`Flag --${name} needs a value.`);
    flags[name] = value;
  }

  return flags;
}

function splitFlag(token) {
  const equals = token.indexOf('=');
  return equals === -1 ? [token, undefined] : [token.slice(0, equals), token.slice(equals + 1)];
}

function readJson(file) {
  try {
    return JSON.parse(readText(file));
  } catch (error) {
    throw new Error(`Could not read JSON from ${file}: ${error.message}`);
  }
}

const readText = (file) => readFileSync(path.resolve(REPO_ROOT, file), 'utf8');

function writeOut(file, contents) {
  const target = path.resolve(REPO_ROOT, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents, 'utf8');
  process.stderr.write(`wrote ${path.relative(REPO_ROOT, target)}\n`);
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    process.stderr.write(`error: ${error.message}\n`);
    process.exitCode = 1;
  });
