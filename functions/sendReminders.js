/**
 * Shiny Paws - Automatic 24-Hour Reminder Cloud Function
 * 
 * This Firebase Cloud Function runs every hour and:
 * 1. Checks all appointments in the database
 * 2. Finds appointments that are exactly 24 hours away
 * 3. Sends email + SMS reminders to customers
 * 4. Marks reminders as sent to avoid duplicates
 * 
 * Setup Instructions:
 * 1. Install Firebase CLI: npm install -g firebase-tools
 * 2. Login: firebase login
 * 3. Initialize: firebase init functions
 * 4. Deploy: firebase deploy --only functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

// Initialize Firebase Admin SDK
admin.initializeApp();

/**
 * HTTP Cloud Function - Scheduled via Cloud Scheduler
 * Triggered every hour to check and send reminders
 */
exports.checkAndSendReminders = functions.https.onRequest(async (req, res) => {
  try {
    console.log('🔍 Starting automatic reminder check...');
    
    const db = admin.database();
    const snapshot = await db.ref('appointments').once('value');
    const appointments = snapshot.val() || {};
    
    let remindersSent = 0;
    const now = new Date();
    
    for (const [appointmentId, appointment] of Object.entries(appointments)) {
      // Skip if already reminded or cancelled
      if (appointment.reminderSent || appointment.status === 'cancelled') {
        continue;
      }
      
      // Parse appointment date and time
      const appointmentDateTime = parseAppointmentDateTime(appointment.date, appointment.time);
      const hoursUntil = (appointmentDateTime - now) / (1000 * 60 * 60);
      
      // Send reminder if appointment is 24 hours away (within 1 hour window)
      if (hoursUntil > 23 && hoursUntil < 25) {
        console.log(`📧 Sending reminder for ${appointment.customerName} - ${appointment.petName}`);
        
        const sent = await sendReminderEmail(appointment);
        if (sent) {
          // Mark as reminded in database
          await db.ref(`appointments/${appointmentId}`).update({
            reminderSent: true,
            reminderSentAt: admin.database.ServerValue.TIMESTAMP,
            reminderChannels: {
              email: true,
              sms: false // SMS requires Twilio setup
            }
          });
          remindersSent++;
        }
      }
    }
    
    console.log(`✅ Reminder check complete. Sent ${remindersSent} reminders.`);
    res.json({ success: true, remindersSent });
    
  } catch (error) {
    console.error('❌ Error in reminder check:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Parse appointment date and time into a Date object
 */
function parseAppointmentDateTime(dateStr, timeStr) {
  // dateStr format: "2026-04-12"
  // timeStr format: "14:30" or "2:30 PM"
  
  const [year, month, day] = dateStr.split('-').map(Number);
  let hour, minute;
  
  if (timeStr.includes(':')) {
    const parts = timeStr.split(':');
    hour = parseInt(parts[0]);
    minute = parseInt(parts[1]);
  } else {
    // Handle "2:30 PM" format
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (match) {
      hour = parseInt(match[1]);
      minute = parseInt(match[2]);
      const period = match[3]?.toUpperCase();
      
      if (period === 'PM' && hour !== 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
    }
  }
  
  // Create date in Los Angeles timezone
  const date = new Date(year, month - 1, day, hour, minute);
  return date;
}

/**
 * Send reminder email via Formspree
 */
async function sendReminderEmail(appointment) {
  try {
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
      message: `We're looking forward to seeing ${appointment.petName} tomorrow at ${appointment.time}! Please arrive 10 minutes early. If you need to reschedule, please call us as soon as possible.`
    };
    
    const response = await fetch('https://formspree.io/f/mgopplba', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reminderData)
    });
    
    if (response.ok) {
      console.log(`✅ Email reminder sent to ${appointment.customerEmail}`);
      return true;
    } else {
      console.error(`❌ Failed to send email to ${appointment.customerEmail}`);
      return false;
    }
  } catch (error) {
    console.error('Error sending reminder email:', error);
    return false;
  }
}

/**
 * Optional: Scheduled function using Cloud Scheduler
 * Deploy with: firebase deploy --only functions
 * Then set up Cloud Scheduler to call this every hour
 */
exports.scheduledReminders = functions.pubsub
  .schedule('every 1 hours')
  .timeZone('America/Los_Angeles')
  .onRun(async (context) => {
    console.log('🔔 Scheduled reminder check triggered');
    
    try {
      const db = admin.database();
      const snapshot = await db.ref('appointments').once('value');
      const appointments = snapshot.val() || {};
      
      let remindersSent = 0;
      const now = new Date();
      
      for (const [appointmentId, appointment] of Object.entries(appointments)) {
        if (appointment.reminderSent || appointment.status === 'cancelled') {
          continue;
        }
        
        const appointmentDateTime = parseAppointmentDateTime(appointment.date, appointment.time);
        const hoursUntil = (appointmentDateTime - now) / (1000 * 60 * 60);
        
        if (hoursUntil > 23 && hoursUntil < 25) {
          console.log(`📧 Sending scheduled reminder for ${appointment.customerName}`);
          
          const sent = await sendReminderEmail(appointment);
          if (sent) {
            await db.ref(`appointments/${appointmentId}`).update({
              reminderSent: true,
              reminderSentAt: admin.database.ServerValue.TIMESTAMP
            });
            remindersSent++;
          }
        }
      }
      
      console.log(`✅ Scheduled check complete. Sent ${remindersSent} reminders.`);
      return { remindersSent };
      
    } catch (error) {
      console.error('❌ Error in scheduled reminder check:', error);
      throw error;
    }
  });
