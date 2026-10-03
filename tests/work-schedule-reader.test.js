'use strict';

// Reading a rota off a photograph.
//
// The model call itself is not exercised here - that would be a test of
// Anthropic's uptime, and it costs money per run. What is exercised is
// everything around it, which is where this can actually go wrong: what counts
// as an image, what a draft is allowed to contain, and the fact that a draft
// is a draft.

const assert = require('node:assert/strict');
const test = require('node:test');

const reader = require('../agent-office-deploy/dist/work-schedule-reader.js');

const PNG_BYTES = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function withKey(value, run) {
  const previous = process.env.ANTHROPIC_API_KEY;
  if (value === null) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = value;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previous;
  }
}

test('without a key the reader is off, and says so usefully', async () => {
  const outcome = await withKey(null, () => reader.readSchedulePhoto({ image: `data:image/png;base64,${PNG_BYTES}` }));
  assert.equal(outcome.ok, false);
  assert.equal(outcome.status, 503);
  // Typing it in has to still be offered: the photo is a shortcut, not the way in.
  assert.match(outcome.error, /type the schedule in/i);
});

test('a data URL and a bare base64 string are both images', () => {
  const dataUrl = reader.parseImage(`data:image/png;base64,${PNG_BYTES}`);
  assert.equal(dataUrl.ok, true);
  assert.equal(dataUrl.value.mediaType, 'image/png');
  assert.equal(dataUrl.value.data, PNG_BYTES);

  const bare = reader.parseImage(PNG_BYTES, 'image/png');
  assert.equal(bare.ok, true);
  assert.equal(bare.value.mediaType, 'image/png');

  // A phone that reports image/jpg means image/jpeg.
  assert.equal(reader.parseImage(PNG_BYTES, 'image/jpg').value.mediaType, 'image/jpeg');
});

test('what is not a usable photo is refused by name', () => {
  assert.match(reader.parseImage('').error, /No image/);
  assert.match(reader.parseImage(PNG_BYTES, 'application/pdf').error, /JPEG, PNG/);
  assert.match(reader.parseImage('not base64 ***', 'image/png').error, /base64/);

  const huge = 'A'.repeat(Math.ceil((reader.MAX_IMAGE_BYTES + 1024) * 4 / 3));
  assert.match(reader.parseImage(huge, 'image/png').error, /5MB/);
});

test('a draft is normalized into the record shape, and given ids', () => {
  const draft = reader.toDraft({
    shifts: [{ label: 'Work', days: [2, 3, 4, 5, 6], start: '12:30', end: '21:00' }],
    notes: '',
  });
  assert.equal(draft.shifts.length, 1);
  assert.deepEqual(draft.shifts[0].days, [2, 3, 4, 5, 6]);
  assert.ok(draft.shifts[0].id, 'the correction form edits rows by id');
  assert.equal(draft.model, reader.MODEL);
});

test('a row the record cannot hold is counted out loud, not quietly lost', () => {
  const draft = reader.toDraft({
    shifts: [
      { label: 'Work', days: [1], start: '09:00', end: '17:00' },
      { label: 'Smudged', days: [2], start: '', end: '' },
    ],
    notes: 'Tuesday was unreadable.',
  });
  assert.equal(draft.shifts.length, 1);
  assert.match(draft.notes, /Tuesday was unreadable/);
  assert.match(draft.notes, /1 row could not be read/);
});

test('the model is told to report uncertainty rather than guess', () => {
  // The correction step cannot catch a confident wrong answer, so the prompt
  // asking for doubt is load-bearing, not decoration.
  assert.match(reader.SYSTEM_PROMPT, /Never invent/);
  assert.match(reader.SYSTEM_PROMPT, /could not read with confidence/);
  assert.match(reader.SYSTEM_PROMPT, /Monday is 1/);
});

test('the request carries the image, the schema and nothing to save by', () => {
  const body = reader.requestBody({ mediaType: 'image/png', data: PNG_BYTES }, 'nights this week');
  assert.equal(body.model, reader.MODEL);
  assert.equal(body.output_config.format.type, 'json_schema');
  assert.deepEqual(body.output_config.format.schema, reader.RESPONSE_SCHEMA);

  const [image, text] = body.messages[0].content;
  assert.equal(image.source.media_type, 'image/png');
  assert.equal(image.source.data, PNG_BYTES);
  assert.match(text.text, /nights this week/);
});

test('a refusal is an error, not an empty schedule', async () => {
  const outcome = await withKey('test-key', () => reader.readSchedulePhoto(
    { image: `data:image/png;base64,${PNG_BYTES}` },
    { client: { messages: { create: async () => ({ stop_reason: 'refusal', content: [] }) } } }
  ));
  assert.equal(outcome.ok, false);
  assert.equal(outcome.status, 422);
});

test('a read photo comes back as a draft and is not saved anywhere', async () => {
  const outcome = await withKey('test-key', () => reader.readSchedulePhoto(
    { image: `data:image/png;base64,${PNG_BYTES}` },
    {
      client: {
        messages: {
          create: async () => ({
            stop_reason: 'end_turn',
            content: [{
              type: 'text',
              text: JSON.stringify({
                shifts: [{ label: 'Work', days: [2, 3, 4, 5, 6], start: '12:30', end: '21:00' }],
                notes: 'Saturday’s end time was faint.',
              }),
            }],
          }),
        },
      },
    }
  ));

  assert.equal(outcome.ok, true);
  assert.equal(outcome.value.shifts.length, 1);
  assert.equal(outcome.value.shifts[0].end, '21:00');
  assert.match(outcome.value.notes, /faint/);
  assert.ok(outcome.value.read_at, 'the draft records when it was read');
});

test('an answer that is not a schedule is a clear failure, not a blank rota', async () => {
  const outcome = await withKey('test-key', () => reader.readSchedulePhoto(
    { image: `data:image/png;base64,${PNG_BYTES}` },
    { client: { messages: { create: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'sorry!' }] }) } } }
  ));
  assert.equal(outcome.ok, false);
  assert.equal(outcome.status, 502);
  assert.match(outcome.error, /clearer photo/);
});
