// Stripe webhook receiver — fires server-side when a payment succeeds.
// This is the safety net: if the customer's browser dies between Stripe and
// our success page, this still writes the booking to Firebase so we never
// lose a paid appointment.
//
// Triggers on `checkout.session.completed`. Reads the full booking data out
// of the session metadata (set by create-checkout-session.js), then writes
// to Firebase via the REST API and notifies the admin via Formspree.
//
// Idempotency: writes to appointments/{sessionId} so duplicate webhook
// deliveries (or a race with the browser write) just merge into the same row.
//
// Required env vars:
//   STRIPE_SECRET_KEY        - same one used by create-checkout-session
//   STRIPE_WEBHOOK_SECRET    - signing secret from Stripe Dashboard webhook page (whsec_...)
//   FIREBASE_DATABASE_URL    - e.g. https://shiny-paws-default-rtdb.firebaseio.com
//   FORMSPREE_ENDPOINT       - e.g. https://formspree.io/f/mgopplba (for admin notification)

const Stripe = require('stripe');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const secret        = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const dbUrl         = process.env.FIREBASE_DATABASE_URL || 'https://shiny-paws-default-rtdb.firebaseio.com';
  const formspree     = process.env.FORMSPREE_ENDPOINT || 'https://formspree.io/f/mgopplba';

  if (!secret || !webhookSecret) {
    console.error('Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
    return { statusCode: 500, body: 'Server not configured' };
  }

  const stripe = Stripe(secret);

  // Stripe needs the raw body for signature verification.
  // Netlify gives us the body as a string (or base64 string if binary).
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: 'Invalid signature' };
  }

  // We only care about successful checkouts
  if (stripeEvent.type !== 'checkout.session.completed') {
    return { statusCode: 200, body: 'Ignored' };
  }

  const session = stripeEvent.data.object;
  const md = session.metadata || {};

  // Compose the Firebase booking row from session metadata
  const booking = {
    customerName:       (md.fname || '') + ' ' + (md.lname || ''),
    customerFirstName:  md.fname     || '',
    customerLastName:   md.lname     || '',
    customerEmail:      md.email     || session.customer_details && session.customer_details.email || '',
    customerPhone:      md.phone     || '',
    customerAddress:    md.address   || '',
    customerCity:       md.city      || '',
    customerZip:        md.zip       || '',
    petName:            md.petName   || '',
    petBreed:           md.petBreed  || '',
    service:            md.service   || '',
    date:               md.date      || '',
    time:               md.time      || '',
    notes:              md.notes     || '',
    status:             'pending',
    bookingRef:         md.bookingRef    || '',
    bookingToken:       md.bookingToken  || '',
    stripeSessionId:    session.id,
    stripePaymentIntentId: session.payment_intent || null,
    amountPaidCents:    session.amount_total      || null,
    paymentStatus:      session.payment_status    || 'paid',
    createdAt:          new Date().toISOString(),
    source:             'webhook'
  };

  // Idempotent write — keyed by Stripe session id so duplicate deliveries merge
  const safeKey = encodeURIComponent(session.id);
  const writeUrl = dbUrl.replace(/\/$/, '') + '/appointments/' + safeKey + '.json';

  try {
    const fbRes = await fetch(writeUrl, {
      method: 'PATCH',  // PATCH = merge (don't overwrite fields the browser already set)
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(booking)
    });
    if (!fbRes.ok) {
      const errText = await fbRes.text();
      console.error('Firebase write failed:', fbRes.status, errText);
      // Still return 200 — Stripe will retry on non-2xx, and we don't want
      // infinite retries if Firebase is down. We'll see the failure in logs.
    }
  } catch (err) {
    console.error('Firebase write threw:', err);
  }

  // Send admin notification email via Formspree (server-side — won't be lost
  // if the customer's browser died)
  try {
    await fetch(formspree, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        _subject: '🐾 New paid booking — ' + (booking.customerName.trim() || 'unknown'),
        _template: 'table',
        reference:    booking.bookingRef,
        name:         booking.customerName,
        email:        booking.customerEmail,
        phone:        booking.customerPhone,
        service:      booking.service,
        date:         booking.date,
        time:         booking.time,
        pet_name:     booking.petName,
        breed:        booking.petBreed,
        notes:        booking.notes,
        total:        booking.amountPaidCents ? '$' + (booking.amountPaidCents / 100).toFixed(2) : '',
        stripe_payment: booking.stripePaymentIntentId,
        source:       'Stripe webhook (server-side, browser may have dropped)'
      })
    });
  } catch (err) {
    console.error('Formspree notify failed:', err);
  }

  return { statusCode: 200, body: 'OK' };
};
