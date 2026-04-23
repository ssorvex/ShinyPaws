// Sends a booking-confirmation email to the customer right after they submit
// Step 5 of the checkout. Uses Resend (resend.com) — free tier gives us 3000
// emails/month which is miles beyond what Shiny Paws will ever use.
//
// POST body expected from the browser:
//   {
//     customerEmail: 'jane@example.com',
//     customerName:  'Jane Doe',
//     petName:       'Buddy',
//     service:       'Scissor Cut — Large',
//     date:          '2026-04-25',
//     time:          '2:00 PM',
//     total:         140,
//     bookingRef:    'SP-4821',
//     needsWaiver:   true
//   }
//
// Required env vars (set in Netlify → Site Settings → Environment variables):
//   RESEND_API_KEY    - starts with re_
//   FROM_EMAIL        - e.g. hello@shinypawsla.com   (must be on a verified domain)
//   ADMIN_BCC_EMAIL   - optional; if set, every confirmation is BCC'd to you too

const { Resend } = require('resend');

const BUSINESS_NAME    = 'Shiny Paws';
const BUSINESS_PHONE   = '(310) 290-4970';
const BUSINESS_ADDRESS = '15718 S Manhattan Pl, Gardena, CA 90247';
const BUSINESS_SITE    = 'https://shinypawsla.com';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors(204);
  if (event.httpMethod !== 'POST')    return { statusCode: 405, body: 'Method Not Allowed' };

  let p;
  try { p = JSON.parse(event.body || '{}'); }
  catch { return cors(400, { error: 'Invalid JSON' }); }

  const apiKey   = process.env.RESEND_API_KEY;
  const from     = process.env.FROM_EMAIL   || 'Shiny Paws <bookings@shinypawsla.com>';
  const replyTo  = process.env.REPLY_TO_EMAIL || 'shinypawsla@gmail.com';
  const adminBcc = process.env.ADMIN_BCC_EMAIL || '';

  if (!apiKey) {
    console.warn('RESEND_API_KEY missing — email skipped');
    return cors(200, { skipped: true, reason: 'RESEND_API_KEY not configured' });
  }
  if (!p.customerEmail) return cors(400, { error: 'customerEmail required' });

  const resend  = new Resend(apiKey);
  const subject = `✓ Your ${BUSINESS_NAME} appointment is confirmed — ${p.date || ''} ${p.time || ''}`.trim();
  const total   = typeof p.total === 'number' ? '$' + p.total : (p.total || '');

  try {
    const result = await resend.emails.send({
      from,
      to:      [p.customerEmail],
      bcc:     adminBcc ? [adminBcc] : undefined,
      reply_to: replyTo,
      subject,
      html:    renderHtml(p, total),
      text:    renderText(p, total)
    });
    return cors(200, { ok: true, id: result.data && result.data.id });
  } catch (err) {
    console.error('Resend send failed:', err);
    return cors(500, { error: err.message || 'send failed' });
  }
};

function renderHtml(p, total) {
  const name       = p.customerName || 'there';
  const pet        = p.petName      || 'your pet';
  const service    = p.service      || '';
  const date       = p.date         || '';
  const time       = p.time         || '';
  const ref        = p.bookingRef   || '';
  const waiverLine = p.needsWaiver
    ? `<p style="margin:18px 0 0;padding:14px;background:#fff8e6;border:1px solid #f5c969;border-radius:8px;color:#704a00;font-size:14px">
         📄 <b>First visit?</b> Please sign our quick liability waiver before your appointment —
         takes 30 seconds: <a href="${BUSINESS_SITE}/waiver.html" style="color:#b8002b;font-weight:700">Sign now →</a>
         (Or use our iPad when you arrive.)
       </p>`
    : '';

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f6eff d;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
<div style="max-width:560px;margin:30px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 30px rgba(91,58,135,.12)">
  <div style="background:linear-gradient(135deg,#3D2060 0%,#5B3090 100%);padding:24px;text-align:center">
    <div style="font-size:32px">🐾</div>
    <h1 style="color:#fff;margin:6px 0 0;font-size:22px">Your appointment is confirmed!</h1>
  </div>
  <div style="padding:26px;color:#3a2d4d;font-size:15px;line-height:1.5">
    <p style="margin:0 0 14px">Hi ${escapeHtml(name)},</p>
    <p style="margin:0 0 18px">Thanks for booking with ${BUSINESS_NAME}! We can't wait to pamper ${escapeHtml(pet)} 💜</p>

    <table style="width:100%;border-collapse:collapse;background:#f3efff;border-radius:10px;padding:0;margin:10px 0 18px">
      <tr><td style="padding:12px 14px;font-weight:700;color:#3D2060;width:120px">Pet</td><td style="padding:12px 14px">${escapeHtml(pet)}</td></tr>
      <tr><td style="padding:12px 14px;font-weight:700;color:#3D2060;border-top:1px solid #e8d5e8">Service</td><td style="padding:12px 14px;border-top:1px solid #e8d5e8">${escapeHtml(service)}</td></tr>
      <tr><td style="padding:12px 14px;font-weight:700;color:#3D2060;border-top:1px solid #e8d5e8">Date</td><td style="padding:12px 14px;border-top:1px solid #e8d5e8">${escapeHtml(date)}</td></tr>
      <tr><td style="padding:12px 14px;font-weight:700;color:#3D2060;border-top:1px solid #e8d5e8">Time</td><td style="padding:12px 14px;border-top:1px solid #e8d5e8">${escapeHtml(time)}</td></tr>
      <tr><td style="padding:12px 14px;font-weight:700;color:#3D2060;border-top:1px solid #e8d5e8">Total</td><td style="padding:12px 14px;border-top:1px solid #e8d5e8;font-weight:700">${escapeHtml(total)}</td></tr>
      ${ref ? `<tr><td style="padding:12px 14px;font-weight:700;color:#3D2060;border-top:1px solid #e8d5e8">Reference</td><td style="padding:12px 14px;border-top:1px solid #e8d5e8;font-family:ui-monospace,monospace">${escapeHtml(ref)}</td></tr>` : ''}
    </table>

    <p style="margin:0;padding:14px;background:#e6f5ec;border:1px solid #b6dcc4;border-radius:8px;color:#1f7a40;font-size:14px">
      💳 <b>Pay at pickup</b> — no charge today. Card or cash at the store after ${escapeHtml(pet)}'s service.
    </p>

    ${waiverLine}

    <p style="margin:18px 0 0;padding:14px;background:#fbeaea;border:1px solid #f5c0c0;border-radius:8px;color:#8c1c1c;font-size:13px">
      ⚠️ <b>Need to reschedule?</b> No problem — just call ${BUSINESS_PHONE} at least 2 hours before your appointment.
      Late cancels or no-shows will be charged a one-time $25 fee on your next visit.
    </p>

    <div style="margin-top:26px;padding-top:18px;border-top:1px solid #eee4f3;font-size:13px;color:#7B5EA7">
      <div style="margin-bottom:6px"><b>${BUSINESS_NAME}</b></div>
      <div>${BUSINESS_ADDRESS}</div>
      <div>${BUSINESS_PHONE} · <a href="${BUSINESS_SITE}" style="color:#5B3090">${BUSINESS_SITE.replace('https://','')}</a></div>
    </div>
  </div>
</div>
</body></html>`;
}

function renderText(p, total) {
  const name    = p.customerName || 'there';
  const pet     = p.petName      || 'your pet';
  const waiver  = p.needsWaiver
    ? `First visit? Please sign our quick liability waiver: ${BUSINESS_SITE}/waiver.html (or use our iPad when you arrive).\n\n`
    : '';
  return `Hi ${name},

Your appointment is confirmed! Thanks for booking with ${BUSINESS_NAME}.

Pet:       ${pet}
Service:   ${p.service || ''}
Date:      ${p.date || ''}
Time:      ${p.time || ''}
Total:     ${total}
${p.bookingRef ? 'Reference: ' + p.bookingRef + '\n' : ''}
💳 Pay at pickup — no charge today.

${waiver}Need to reschedule? Call ${BUSINESS_PHONE} at least 2 hours ahead. No-shows or late cancels will be charged a one-time $25 fee on your next visit.

${BUSINESS_NAME}
${BUSINESS_ADDRESS}
${BUSINESS_PHONE}
${BUSINESS_SITE}
`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
}

function cors(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: body ? JSON.stringify(body) : ''
  };
}
