/**
 * Shiny Paws - SMS Reminder Service
 * 
 * Sends SMS reminders 24 hours before appointments using Twilio
 * 
 * Setup:
 * 1. Sign up for Twilio (www.twilio.com)
 * 2. Get your Account SID, Auth Token, and Twilio Phone Number
 * 3. Add these as environment variables or update below
 */

// Twilio Configuration
const TWILIO_CONFIG = {
  accountSid: 'YOUR_TWILIO_ACCOUNT_SID',
  authToken: 'YOUR_TWILIO_AUTH_TOKEN',
  fromNumber: 'YOUR_TWILIO_PHONE_NUMBER', // e.g., +1234567890
  apiUrl: 'https://api.twilio.com/2010-04-01/Accounts'
};

/**
 * Send SMS reminder via Twilio
 */
async function sendSMSReminder(appointment, customerPhone, customerName) {
  // If Twilio not configured, skip SMS
  if (TWILIO_CONFIG.accountSid === 'YOUR_TWILIO_ACCOUNT_SID') {
    console.log('⚠️ Twilio not configured. Skipping SMS reminder.');
    return false;
  }

  const message = `Hi ${customerName}! Reminder: Your Shiny Paws appointment for ${appointment.petName} is tomorrow at ${appointment.time}. Service: ${appointment.service}. Call (310) 290-4970 to reschedule.`;

  const formData = new URLSearchParams();
  formData.append('To', customerPhone);
  formData.append('From', TWILIO_CONFIG.fromNumber);
  formData.append('Body', message);

  try {
    const auth = btoa(`${TWILIO_CONFIG.accountSid}:${TWILIO_CONFIG.authToken}`);
    const response = await fetch(
      `${TWILIO_CONFIG.apiUrl}/${TWILIO_CONFIG.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ SMS sent to ${customerPhone} (SID: ${data.sid})`);
      return true;
    } else {
      console.error(`❌ Failed to send SMS to ${customerPhone}`);
      return false;
    }
  } catch (error) {
    console.error('Error sending SMS:', error);
    return false;
  }
}

/**
 * Send both Email and SMS reminders
 */
async function sendMultiChannelReminder(appointment, appointmentId) {
  const reminderData = {
    email: appointment.customerEmail,
    name: appointment.customerName,
    _subject: '⏰ Reminder: Your Shiny Paws Appointment Tomorrow!',
    _template: 'table',
    appointmentDate: appointment.date,
    appointmentTime: appointment.time,
    petName: appointment.petName,
    service: appointment.service,
    businessPhone: '(310) 290-4970',
    businessEmail: 'info@shinypawsla.com',
    message: `We're looking forward to seeing ${appointment.petName} tomorrow at ${appointment.time}!`
  };

  try {
    // Send Email
    const emailResponse = await fetch('https://formspree.io/f/mgopplba', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reminderData)
    });

    let emailSent = false;
    if (emailResponse.ok) {
      console.log(`✅ Email reminder sent to ${appointment.customerEmail}`);
      emailSent = true;
    }

    // Send SMS (if phone number available)
    let smsSent = false;
    if (appointment.customerPhone) {
      smsSent = await sendSMSReminder(appointment, appointment.customerPhone, appointment.customerName);
    }

    // Mark as reminded in Firebase
    if (emailSent || smsSent) {
      await db.ref(`appointments/${appointmentId}/reminderSent`).set(true);
      await db.ref(`appointments/${appointmentId}/reminderChannels`).set({
        email: emailSent,
        sms: smsSent,
        sentAt: new Date().toISOString()
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error sending multi-channel reminder:', error);
    return false;
  }
}

/**
 * Check and send reminders (Email + SMS)
 */
async function checkAndSendMultiChannelReminders() {
  console.log('🔍 Checking for appointments needing reminders (Email + SMS)...');
  
  try {
    const snapshot = await db.ref('appointments').once('value');
    const appointments = snapshot.val() || {};
    
    let remindersSent = 0;
    
    for (const [appointmentId, appointment] of Object.entries(appointments)) {
      if (appointment.reminderSent || appointment.status === 'cancelled') {
        continue;
      }
      
      const hoursUntilAppointment = getHoursUntilAppointment(appointment.date, appointment.time);
      
      if (hoursUntilAppointment > 23 && hoursUntilAppointment < 25) {
        console.log(`📧📱 Sending multi-channel reminder for ${appointment.customerName}`);
        const sent = await sendMultiChannelReminder(appointment, appointmentId);
        if (sent) {
          remindersSent++;
        }
      }
    }
    
    console.log(`✅ Multi-channel reminder check complete. Sent ${remindersSent} reminders.`);
    showSuccess(`Sent ${remindersSent} reminder(s) via Email & SMS`);
    return remindersSent;
  } catch (error) {
    console.error('Error checking appointments:', error);
    showError('Error checking reminders');
    return 0;
  }
}

// Export for use in admin.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sendSMSReminder,
    sendMultiChannelReminder,
    checkAndSendMultiChannelReminders
  };
}
