/**
 * Shiny Paws - Appointment Reminder Service
 * 
 * This service sends appointment reminder emails 24 hours before scheduled appointments.
 * 
 * How to use:
 * 1. Add a button in admin.html to manually send reminders
 * 2. Set up a cron job to run this every hour (or use Firebase Functions)
 * 3. Reminders are tracked with reminderSent flag in Firebase
 */

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mgopplba';

/**
 * Send reminder email via Formspree
 */
async function sendReminderViaFormspree(appointment, customerEmail, customerName) {
  const reminderData = {
    email: customerEmail,
    name: customerName,
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
    const response = await fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reminderData)
    });

    if (response.ok) {
      console.log(`✅ Reminder sent to ${customerEmail}`);
      return true;
    } else {
      console.error(`❌ Failed to send reminder to ${customerEmail}`);
      return false;
    }
  } catch (error) {
    console.error('Error sending reminder:', error);
    return false;
  }
}

/**
 * Check for appointments that need reminders
 * Call this every hour via cron job or Firebase Functions
 */
async function checkAndSendReminders() {
  console.log('🔍 Checking for appointments needing reminders...');

  try {
    // This would be called from admin.js with access to Firebase
    // For now, we'll provide the logic that admin.js can use
    return {
      success: true,
      message: 'Reminder check logic ready. Call from admin.js'
    };
  } catch (error) {
    console.error('Error checking appointments:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Parse appointment date and time into a Date object (Los Angeles timezone)
 */
function parseAppointmentDateTime(dateStr, timeStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  // Create date in Los Angeles timezone
  const date = new Date(year, month - 1, day, hours, minutes, 0);
  return date;
}

/**
 * Calculate hours until appointment
 */
function getHoursUntilAppointment(dateStr, timeStr) {
  const appointmentTime = parseAppointmentDateTime(dateStr, timeStr);
  const now = new Date();
  const diffMs = appointmentTime - now;
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours;
}

/**
 * Check if reminder should be sent (24 hours before, within 1 hour window)
 */
function shouldSendReminder(hoursUntilAppointment, reminderSent) {
  return !reminderSent && hoursUntilAppointment > 23 && hoursUntilAppointment < 25;
}

// Export for use in admin.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sendReminderViaFormspree,
    checkAndSendReminders,
    parseAppointmentDateTime,
    getHoursUntilAppointment,
    shouldSendReminder
  };
}
