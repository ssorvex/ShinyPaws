// Scheduled function that scans Firebase appointments and sends SMS reminders
// via Twilio. Runs every 15 minutes (see netlify.toml schedule config).
//
// Two reminders per appointment:
//   • 24h reminder  — fires when appt start is 23–25 hours away, marks reminder24hSent
//   • 3h reminder   — fires when appt start is 2.5–3.5 hours away, marks reminder3hSent
//
// Idempotency: we PATCH the reminder flags into Firebase so a second run (or
// a cold-start retry) can't double-send.
//
// Required Netlify env vars (set in Site Settings → Environment variables):
//   TWILIO_ACCOUNT_SID      - starts with AC...
//   TWILIO_AUTH_TOKEN       - the auth token from Twilio console
//   TWILIO_PHONE            - purchased Twilio number, E.164 format e.g. +13105551234
//   FIREBASE_DATABASE_URL   - https://shiny-paws-default-rtdb.firebaseio.com
//
// Netlify config (netlify.toml):
//   [functions."sms-reminders"]
//     schedule = "*/15 * * * *"

const twilio = require('twilio');

const BUSINESS_NAME  = 'Shiny Paws';
const BUSINESS_PHONE = '(310) 290-4970';

exports.handler = async () => {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_PHONE;
  const dbUrl = process.env.FIREBASE_DATABASE_URL || 'https://shiny-paws-default-rtdb.firebaseio.com';

  if (!sid || !token || !from) {
    console.error('Twilio not configured — skipping SMS run');
    return { statusCode: 200, body: 'Twilio env vars missing — no-op' };
  }

  const client = twilio(sid, token);

  // Pull every appointment. We could optimize with an index later, but volume
  // is small enough that reading all and filtering in-memory is fine.
  const res = await fetch(dbUrl.replace(/\/$/, '') + '/appointments.json');
  if (!res.ok) {
    console.error('Firebase read failed:', res.status);
    return { statusCode: 500, body: 'Firebase read failed' };
  }
  const all = (await res.json()) || {};

  const now = Date.now();
  const sent24 = [], sent3 = [], skipped = [], errors = [];

  for (const [id, apt] of Object.entries(all)) {
    if (!apt || apt.status === 'cancelled') continue;
    if (!apt.customerPhone) continue;
    if (!apt.date || !apt.time) continue;

    const apptMs = parseApptTime(apt.date, apt.time);
    if (!apptMs) continue;
    const hoursUntil = (apptMs - now) / (1000 * 60 * 60);

    // 24-hour reminder window: 23–25h
    if (!apt.reminder24hSent && hoursUntil >= 23 && hoursUntil <= 25) {
      const body = buildMessage(apt, '24h');
      try {
        await client.messages.create({ to: toE164(apt.customerPhone), from, body });
        await markSent(dbUrl, id, 'reminder24hSent');
        sent24.push(id);
      } catch (err) {
        errors.push({ id, phase: '24h', err: err.message });
      }
      continue;
    }

    // 3-hour reminder window: 2.5–3.5h (staff can tweak this; current ask was "2-3h")
    if (!apt.reminder3hSent && hoursUntil >= 2.5 && hoursUntil <= 3.5) {
      const body = buildMessage(apt, '3h');
      try {
        await client.messages.create({ to: toE164(apt.customerPhone), from, body });
        await markSent(dbUrl, id, 'reminder3hSent');
        sent3.push(id);
      } catch (err) {
        errors.push({ id, phase: '3h', err: err.message });
      }
      continue;
    }

    skipped.push(id);
  }

  console.log('SMS run complete', { sent24: sent24.length, sent3: sent3.length, skipped: skipped.length, errors });
  return {
    statusCode: 200,
    body: JSON.stringify({ sent24: sent24.length, sent3: sent3.length, skipped: skipped.length, errors })
  };
};

// Build the SMS body. Kept short so it fits in 1 SMS segment (160 chars).
function buildMessage(apt, when) {
  const firstName = (apt.customerName || '').split(' ')[0] || 'there';
  const pet       = apt.petName || 'your pet';
  const time      = apt.time || '';
  const date      = apt.date || '';

  if (when === '24h') {
    return `Hi ${firstName}! Reminder: ${pet} is booked at ${BUSINESS_NAME} tomorrow (${date}) at ${time}. Reply CANCEL to reschedule, or call ${BUSINESS_PHONE}. 🐾`;
  }
  // 3h
  return `Hi ${firstName}! ${pet}'s appointment at ${BUSINESS_NAME} is in a few hours (${time}). See you soon! 🐾 ${BUSINESS_PHONE}`;
}

// Turn '(310) 555-0123' or '3105550123' into +13105550123. Assumes US.
function toE164(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return '+' + digits; // best effort
}

// Parse '2026-04-25' + '2:00 PM' into an ms timestamp (local time assumed — LA).
// For production consider doing this in a known timezone (America/Los_Angeles).
function parseApptTime(dateStr, timeStr) {
  try {
    const m = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ap = (m[3] || '').toUpperCase();
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    const [y, mo, d] = dateStr.split('-').map(n => parseInt(n, 10));
    // Build a Date in the server's local time. Netlify runs UTC, so this is
    // imperfect — if you find reminders firing off by a few hours, switch to
    // an explicit tz library like luxon or date-fns-tz.
    return new Date(y, mo - 1, d, h, min, 0).getTime();
  } catch { return null; }
}

// PATCH the reminder flag onto the appointment so we never double-send
async function markSent(dbUrl, id, flag) {
  const url = dbUrl.replace(/\/$/, '') + '/appointments/' + id + '.json';
  const body = { [flag]: new Date().toISOString() };
  await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}
