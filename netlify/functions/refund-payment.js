// Refund a Stripe payment when a customer cancels their booking
// POST { paymentIntentId, bookingRef? } -> { refundId, status, amount }
// Called from manage-booking.html confirmCancel().

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

  const paymentIntentId = String(payload.paymentIntentId || '').trim();
  const bookingRef = String(payload.bookingRef || '').slice(0, 60);

  if (!paymentIntentId.startsWith('pi_')) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid paymentIntentId' })
    };
  }

  const stripe = Stripe(secret);

  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      metadata: { bookingRef, source: 'manage-booking-cancel' }
    });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        refundId: refund.id,
        status: refund.status,
        amount: refund.amount,
        currency: refund.currency
      })
    };
  } catch (err) {
    console.error('Stripe refund error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Stripe refund error', code: err.code })
    };
  }
};
