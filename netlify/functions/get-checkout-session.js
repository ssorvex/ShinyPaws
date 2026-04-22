// Retrieve a Stripe Checkout Session to get its payment_intent
// POST { sessionId } -> { paymentIntentId, amountTotal, currency, status }
// Used right after Stripe redirects back so we can store the PI on the Firebase booking,
// which lets manage-booking.html refund automatically on cancel.

const Stripe = require('stripe');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured on server' })
    };
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, body: 'Invalid JSON' }; }

  const sessionId = String(payload.sessionId || '').trim();
  if (!sessionId.startsWith('cs_')) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid sessionId' })
    };
  }

  const stripe = Stripe(secret);

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        paymentIntentId: session.payment_intent,
        amountTotal: session.amount_total,
        currency: session.currency,
        status: session.payment_status,
        customerEmail: session.customer_details && session.customer_details.email
      })
    };
  } catch (err) {
    console.error('Stripe retrieve error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Stripe error' })
    };
  }
};
