// Stripe Checkout Session creator for Shiny Paws
// POST { amountCents, description, customerEmail, bookingRef } -> { url }
// Reads STRIPE_SECRET_KEY from Netlify env vars (set in Site settings → Environment variables).

const Stripe = require('stripe');

exports.handler = async (event) => {
  // CORS preflight (in case the page is loaded from a different origin during testing)
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
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const amountCents = Number(payload.amountCents);
  const description = String(payload.description || 'Shiny Paws booking').slice(0, 250);
  const customerEmail = payload.customerEmail || undefined;
  const bookingRef = String(payload.bookingRef || '').slice(0, 60);
  const successBase = payload.successUrl || 'https://shinypawsla.com/shinypaws-checkout';
  const cancelBase  = payload.cancelUrl  || 'https://shinypawsla.com/shinypaws-checkout';

  // Full booking snapshot — stashed in Stripe session metadata so the webhook
  // can reconstruct the booking server-side if the customer's browser dies
  // before reaching our success page. Each metadata value is capped at 500 chars.
  const b = payload.booking || {};
  const trim = (v, n) => String(v == null ? '' : v).slice(0, n || 500);
  const bookingMetadata = {
    bookingRef:   trim(bookingRef, 60),
    bookingToken: trim(b.bookingToken, 80),
    fname:        trim(b.fname, 80),
    lname:        trim(b.lname, 80),
    email:        trim(b.email || customerEmail, 200),
    phone:        trim(b.phone, 40),
    address:      trim(b.address, 200),
    city:         trim(b.city, 80),
    zip:          trim(b.zip, 20),
    petName:      trim(b.petName, 80),
    petBreed:     trim(b.petBreed, 80),
    service:      trim(b.service, 200),
    date:         trim(b.date, 20),
    time:         trim(b.time, 10),
    notes:        trim(b.notes, 500)
  };

  if (!Number.isFinite(amountCents) || amountCents < 50) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid amount (must be >= 50 cents)' })
    };
  }

  const stripe = Stripe(secret);

  try {
    const sep = (url) => (url.indexOf('?') >= 0 ? '&' : '?');
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // automatic_payment_methods auto-enables Apple Pay, Google Pay, Link, and any
      // other methods enabled in your Stripe Dashboard. Stripe Checkout shows the
      // Apple Pay / Google Pay button automatically on supported devices/browsers
      // (iOS Safari, macOS Safari, Chrome on Android) — no extra config needed.
      automatic_payment_methods: { enabled: true },
      customer_email: customerEmail,
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(amountCents),
          product_data: { name: description }
        },
        quantity: 1
      }],
      metadata: bookingMetadata,
      success_url: successBase + sep(successBase) + 'status=success&booking_ref=' + encodeURIComponent(bookingRef) + '&session_id={CHECKOUT_SESSION_ID}',
      cancel_url:  cancelBase  + sep(cancelBase)  + 'status=cancel&booking_ref='  + encodeURIComponent(bookingRef)
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ url: session.url, id: session.id })
    };
  } catch (err) {
    console.error('Stripe error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Stripe error' })
    };
  }
};
