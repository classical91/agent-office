'use strict';

// Reading a rota off a photograph.
//
// This is the only part of Agent Office that asks a model to look at something.
// It takes a picture of a work schedule — the printout on the fridge, the
// screenshot from the scheduling app — and returns the shifts it can see, in
// the shape work-schedule.js stores.
//
// It returns them. It does not save them. That is the whole design: what comes
// back is a draft the page shows for correction, because "9" and "8" look alike
// in a phone photo of a laser print, and a week planned around a shift that
// starts an hour earlier than it really does is worse than no week at all. The
// save is a second, deliberate request with whatever the person corrected.
//
// Configuration is one environment variable, ANTHROPIC_API_KEY. Without it the
// reader is off and the page says so; typing the schedule in by hand is always
// available and needs nothing configured. Being able to read a photo is a
// convenience on top of the record, never the only way to have one.

const schedule = require('./work-schedule.js');

// The SDK is loaded when a photo is actually read, not when the server starts.
// Reading photos is an optional feature behind an optional key; a missing or
// broken dependency should cost you that button, not the whole Office.
//
// It is published as an ES module with a default export, and this server is
// CommonJS, so the constructor is reached through `.default`.
let cachedSdk = null;
function sdk() {
  if (!cachedSdk) {
    const loaded = require('@anthropic-ai/sdk');
    cachedSdk = loaded.default || loaded;
  }
  return cachedSdk;
}

// Whatever the photograph holds, the answer is a small object. Opus reads a
// grid of times off a bad phone photo more reliably than anything cheaper, and
// this runs once a week per person.
const MODEL = 'claude-opus-5-5';
const MAX_TOKENS = 4000;

// Anthropic caps an image at 5MB. This is the decoded size; the base64 the page
// posts is about a third larger again, which is what the route's body limit
// allows for.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const REQUEST_TIMEOUT_MS = 90 * 1000;

// Two rules carry the whole prompt. Read what is there, and say what you could
// not read — a model that guesses at a smudged end time produces a schedule
// that looks finished and is wrong, which is exactly what the correction step
// cannot catch.
const SYSTEM_PROMPT = [
  'You read photographs of work schedules and rotas and return the shifts they show.',
  '',
  'Rules:',
  '- Report only what the image actually shows. Never invent a shift, a day or a time.',
  '- Days are ISO weekdays: Monday is 1, Sunday is 7.',
  '- Times are 24-hour HH:MM. "9a" is 09:00, "9p" and "9" in an evening column are 21:00.',
  '- Group days that share the same hours into one shift rather than repeating it per day.',
  '- A shift that ends earlier than it starts is an overnight shift; report it as written.',
  '- Days with no shift are days off. Do not return a shift for them.',
  '- Put anything you could not read with confidence in `notes`, naming the day: these are',
  '  the rows the person is about to check by eye, and your uncertainty is the whole point',
  '  of showing it to them.',
  '- If the image is not a work schedule at all, return no shifts and say so in `notes`.',
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    shifts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'What the shift is called, e.g. "Work" or "Close".' },
          days: {
            type: 'array',
            items: { type: 'integer', minimum: 1, maximum: 7 },
            description: 'ISO weekdays this shift runs on, Monday = 1.',
          },
          start: { type: 'string', description: '24-hour start time, HH:MM.' },
          end: { type: 'string', description: '24-hour end time, HH:MM.' },
        },
        required: ['label', 'days', 'start', 'end'],
        additionalProperties: false,
      },
    },
    notes: {
      type: 'string',
      description: 'Anything unreadable or ambiguous, named by day. Empty when the rota was clear.',
    },
  },
  required: ['shifts', 'notes'],
  additionalProperties: false,
};

function apiKey() {
  return String(process.env.ANTHROPIC_API_KEY || '').trim();
}

function isConfigured() {
  return Boolean(apiKey());
}

// A data URL from an <input type="file"> and a bare base64 string both arrive
// here; so does an unsupported type, which is worth saying plainly rather than
// forwarding and letting the API complain.
function parseImage(raw, declaredType) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return { ok: false, error: 'No image was uploaded.' };

  let mediaType = String(declaredType || '').trim().toLowerCase();
  let data = text;

  const dataUrl = /^data:([^;,]+);base64,(.*)$/s.exec(text);
  if (dataUrl) {
    mediaType = dataUrl[1].toLowerCase();
    data = dataUrl[2];
  }

  data = data.replace(/\s+/g, '');
  if (!data) return { ok: false, error: 'No image was uploaded.' };
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    return { ok: false, error: 'The image could not be read as base64.' };
  }

  if (mediaType === 'image/jpg') mediaType = 'image/jpeg';
  if (!SUPPORTED_MEDIA_TYPES.includes(mediaType)) {
    return {
      ok: false,
      error: `Upload a JPEG, PNG, GIF or WebP photo (${SUPPORTED_MEDIA_TYPES.join(', ')}).`,
    };
  }

  // Base64 carries three bytes in every four characters.
  const bytes = Math.floor(data.length * 3 / 4);
  if (bytes > MAX_IMAGE_BYTES) {
    return { ok: false, error: 'That photo is larger than 5MB. Take it again at a smaller size.' };
  }

  return { ok: true, value: { mediaType, data, bytes } };
}

function requestBody(image, hint) {
  const prompt = [
    'Read this work schedule and return the shifts it shows.',
    hint ? `The person adds: ${hint}` : '',
  ].filter(Boolean).join('\n\n');

  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: RESPONSE_SCHEMA } },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
        { type: 'text', text: prompt },
      ],
    }],
  };
}

function firstJsonPayload(message) {
  const blocks = Array.isArray(message && message.content) ? message.content : [];
  const text = blocks.filter(block => block && block.type === 'text').map(block => block.text).join('');
  if (!text.trim()) return null;
  try { return JSON.parse(text); } catch { return null; }
}

// The draft. Shifts go through the same normalization a typed one does, so what
// the page draws back is a work schedule and not a second, looser shape — and a
// row the model returned in a form the record cannot hold is counted and said
// out loud rather than vanishing between the photo and the form.
function toDraft(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const offered = Array.isArray(source.shifts) ? source.shifts : [];
  const shifts = schedule.normalizeShifts(offered.map(shift => ({ ...shift, id: schedule.makeId() })));
  const dropped = offered.length - shifts.length;
  const notes = [
    typeof source.notes === 'string' ? source.notes.trim() : '',
    dropped > 0
      ? `${dropped} row${dropped === 1 ? '' : 's'} could not be read as a shift and ${dropped === 1 ? 'was' : 'were'} left out.`
      : '',
  ].filter(Boolean).join(' ');

  return {
    shifts,
    notes: notes.slice(0, schedule.MAX_NOTE_LENGTH),
    model: MODEL,
    read_at: new Date().toISOString(),
  };
}

async function callApi(body, { client = null, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  let Client = null;
  let anthropic = client;
  if (!anthropic) {
    try {
      Client = sdk();
      anthropic = new Client({ apiKey: apiKey(), timeout: timeoutMs, maxRetries: 1 });
    } catch (error) {
      return { ok: false, status: 503, error: 'The photo reader is not installed on this server.' };
    }
  }

  try {
    return { ok: true, value: await anthropic.messages.create(body) };
  } catch (error) {
    // Most specific first: which of these it is decides whether the person
    // should try again, take a better photo, or stop waiting and type it in.
    if (Client && error instanceof Client.AuthenticationError) {
      return { ok: false, status: 503, error: 'The server\'s ANTHROPIC_API_KEY was refused.' };
    }
    if (Client && error instanceof Client.RateLimitError) {
      return { ok: false, status: 429, error: 'The reader is rate limited. Try again in a moment.' };
    }
    if (Client && error instanceof Client.APIConnectionTimeoutError) {
      return { ok: false, status: 504, error: 'Reading the photo took too long. Try again, or type the shifts in.' };
    }
    if (Client && error instanceof Client.APIError) {
      return { ok: false, status: 502, error: error.message || 'The reader could not be reached.' };
    }
    return { ok: false, status: 502, error: 'The reader could not be reached.' };
  }
}

/**
 * Read a photograph of a work schedule into draft shifts.
 *
 * Returns `{ ok: true, value: draft }` or `{ ok: false, status, error }`. The
 * draft is never saved here: the caller shows it, the person corrects it, and
 * the corrected version is what gets stored.
 */
async function readSchedulePhoto(input = {}, options = {}) {
  if (!isConfigured()) {
    return {
      ok: false,
      status: 503,
      error: 'Reading photos needs ANTHROPIC_API_KEY on the server. You can still type the schedule in.',
    };
  }

  const image = parseImage(input.image, input.media_type);
  if (!image.ok) return { ok: false, status: 400, error: image.error };

  const hint = typeof input.hint === 'string' ? input.hint.trim().slice(0, 300) : '';
  const call = await callApi(requestBody(image.value, hint), options);
  if (!call.ok) return call;

  // A refusal arrives as a 200 with nothing useful in it, so stop_reason is
  // checked before the content is read.
  if (call.value && call.value.stop_reason === 'refusal') {
    return { ok: false, status: 422, error: 'The reader declined to read that image.' };
  }

  const payload = firstJsonPayload(call.value);
  if (!payload) {
    return { ok: false, status: 502, error: 'The reader did not return a schedule. Try a clearer photo.' };
  }

  return { ok: true, value: toDraft(payload) };
}

module.exports = {
  MAX_IMAGE_BYTES,
  MODEL,
  RESPONSE_SCHEMA,
  SUPPORTED_MEDIA_TYPES,
  SYSTEM_PROMPT,
  isConfigured,
  parseImage,
  readSchedulePhoto,
  requestBody,
  toDraft,
};
