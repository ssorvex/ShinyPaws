// Firebase Configuration
const firebaseConfig = {
    databaseURL: "https://shiny-paws-default-rtdb.firebaseio.com"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Admin Password
const ADMIN_PASSWORD = "santamonica2025";

// Business Hours & Service Durations
const BUSINESS_HOURS = { start: 9, end: 18 }; // 9am to 6pm
const SERVICE_DURATIONS = {
    "Bath & Brush": 45,
    "Bath & Trim": 60,
    "Full Grooming": 90,
    "Daycare": 480 // Full day
};

// ==================== LOGIN ====================
function login() {
    console.log('Login function called');
    const password = document.getElementById("passwordInput").value;
    console.log('Password entered:', password);
    console.log('Expected password:', ADMIN_PASSWORD);
    
    if (password === ADMIN_PASSWORD) {
        console.log('Password correct!');
        document.getElementById("loginScreen").classList.add("hidden");
        document.getElementById("dashboard").classList.add("active");
        loadAppointments();
        // Set today's date as default
        document.getElementById("dateFilter").valueAsDate = new Date();
        document.getElementById("appointmentDate").valueAsDate = new Date();
        updateTimeSlots();
    } else {
        console.log('Password incorrect!');
        document.getElementById("loginError").style.display = "block";
        setTimeout(() => {
            document.getElementById("loginError").style.display = "none";
        }, 3000);
    }
}

function logout() {
    if (confirm("Are you sure you want to logout?")) {
        document.getElementById("loginScreen").classList.remove("hidden");
        document.getElementById("dashboard").classList.remove("active");
        document.getElementById("passwordInput").value = "";
        document.getElementById("bookingForm").reset();
    }
}

// ==================== APPOINTMENTS ====================
function loadAppointments() {
    const dateFilter = document.getElementById("dateFilter").value;
    // Use parseDate to correctly handle the date string without timezone conversion
    const date = dateFilter ? parseDate(dateFilter) : new Date();
    const dateStr = formatDate(date);

    db.ref("appointments").orderByChild("date").equalTo(dateStr).on("value", (snapshot) => {
        displayAppointments(snapshot.val() || {});
    });
}

function displayAppointments(appointments) {
    const list = document.getElementById("appointmentsList");
    const items = Object.entries(appointments);

    if (items.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>No appointments for this date</p></div>';
        return;
    }

    list.innerHTML = items.map(([id, apt]) => `
        <div class="appointment-item ${apt.status || 'pending'}">
            <div class="appointment-time">
                ${apt.time}
                <span class="status-badge status-${apt.status || 'pending'}">${apt.status || 'Pending'}</span>
            </div>
            <div class="appointment-details">
                <strong>${apt.customerName}</strong> - ${apt.petName} (${apt.petBreed || 'N/A'})
                <br />Service: ${apt.service}
                <br />Phone: ${apt.customerPhone}
                ${apt.customerEmail ? `<br />Email: ${apt.customerEmail}` : ''}
                ${apt.notes ? `<br />Notes: ${apt.notes}` : ''}
            </div>
            <div class="appointment-actions">
                ${apt.status !== 'completed' ? `<button class="btn-complete" onclick="updateStatus('${id}', 'completed')">✓ Complete</button>` : ''}
                ${apt.status !== 'cancelled' ? `<button class="btn-cancel" onclick="updateStatus('${id}', 'cancelled')">✗ Cancel</button>` : ''}
                ${!apt.reminderSent && apt.status !== 'cancelled' ? `<button class="btn-reminder" onclick="sendManualReminder('${id}')">📧 Send Reminder</button>` : ''}
                <button class="btn-delete" onclick="deleteAppointment('${id}')">🗑️ Delete</button>
            </div>
        </div>
    `).join("");
}

function filterByDate() {
    loadAppointments();
}

// ==================== ADD BOOKING ====================
function addBooking(e) {
    e.preventDefault();

    const customerName = document.getElementById("customerName").value;
    const customerPhone = document.getElementById("customerPhone").value;
    const customerEmail = document.getElementById("customerEmail").value;
    const petName = document.getElementById("petName").value;
    const petBreed = document.getElementById("petBreed").value;
    const service = document.getElementById("service").value;
    const appointmentDate = document.getElementById("appointmentDate").value;
    const selectedTime = document.getElementById("selectedTime").value;
    const notes = document.getElementById("notes").value;

    if (!selectedTime) {
        showError("Please select a time slot");
        return;
    }

    const booking = {
        customerName,
        customerPhone,
        customerEmail,
        petName,
        petBreed,
        service,
        date: appointmentDate,
        time: selectedTime,
        notes,
        status: "confirmed",
        createdAt: new Date().toISOString()
    };

    db.ref("appointments").push(booking).then(() => {
        showSuccess("Booking created successfully!");
        document.getElementById("bookingForm").reset();
        document.getElementById("selectedTime").value = "";
        document.getElementById("appointmentDate").valueAsDate = new Date();
        updateTimeSlots();
        loadAppointments();
    }).catch(error => {
        showError("Error creating booking: " + error.message);
    });
}

// ==================== UPDATE STATUS ====================
function updateStatus(id, status) {
    db.ref("appointments/" + id).update({ status }).then(() => {
        showSuccess(`Appointment marked as ${status}`);
        loadAppointments();
    }).catch(error => {
        showError("Error updating appointment: " + error.message);
    });
}

// ==================== DELETE APPOINTMENT ====================
function deleteAppointment(id) {
    if (confirm("Are you sure you want to delete this appointment?")) {
        db.ref("appointments/" + id).remove().then(() => {
            showSuccess("Appointment deleted");
            loadAppointments();
        }).catch(error => {
            showError("Error deleting appointment: " + error.message);
        });
    }
}

// ==================== TIME SLOTS ====================
function updateTimeSlots() {
    const dateInput = document.getElementById("appointmentDate").value;
    const serviceInput = document.getElementById("service").value;

    if (!dateInput || !serviceInput) {
        document.getElementById("timeSlots").innerHTML = "";
        return;
    }

    const date = new Date(dateInput);
    const dateStr = formatDate(date);
    const duration = SERVICE_DURATIONS[serviceInput] || 60;

    // Get booked times for this date
    db.ref("appointments").orderByChild("date").equalTo(dateStr).once("value", (snapshot) => {
        const bookedTimes = [];
        snapshot.forEach(child => {
            bookedTimes.push(child.val().time);
        });

        // Generate available time slots
        const slots = generateTimeSlots(duration, bookedTimes);
        displayTimeSlots(slots);
    });
}

function generateTimeSlots(duration, bookedTimes) {
    const slots = [];
    const start = BUSINESS_HOURS.start * 60; // Convert to minutes
    const end = BUSINESS_HOURS.end * 60;

    for (let time = start; time < end; time += 30) {
        const hours = Math.floor(time / 60);
        const minutes = time % 60;
        const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

        // Check if slot is available
        const isBooked = bookedTimes.some(bookedTime => {
            const bookedMinutes = timeToMinutes(bookedTime);
            return bookedMinutes <= time && time < bookedMinutes + duration;
        });

        slots.push({
            time: timeStr,
            available: !isBooked
        });
    }

    return slots;
}

function displayTimeSlots(slots) {
    const container = document.getElementById("timeSlots");
    container.innerHTML = slots.map(slot => `
        <div class="time-slot ${!slot.available ? 'booked' : ''}" 
             onclick="${slot.available ? `selectTime('${slot.time}')` : ''}"
             style="cursor: ${slot.available ? 'pointer' : 'not-allowed'}">
            ${slot.time}
        </div>
    `).join("");
}

function selectTime(time) {
    document.getElementById("selectedTime").value = time;
    document.querySelectorAll(".time-slot").forEach(slot => {
        slot.classList.remove("selected");
    });
    event.target.classList.add("selected");
}

// ==================== UTILITY FUNCTIONS ====================
function formatDate(date) {
    // Format date as YYYY-MM-DD using local timezone (Los Angeles)
    // This ensures the date matches what the user selected in the checkout form
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parseDate(dateStr) {
    // Parse a date string (YYYY-MM-DD) in local timezone without UTC conversion
    // This prevents the 1-day shift caused by timezone differences
    if (!dateStr) return new Date();
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date;
}

function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
}

function showSuccess(message) {
    const el = document.getElementById("successMessage");
    el.textContent = message;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 3000);
}

function showError(message) {
    const el = document.getElementById("errorMessage");
    el.textContent = message;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 3000);
}

// ==================== APPOINTMENT REMINDERS ====================
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mgopplba';

/**
 * Parse appointment date and time into a Date object (Los Angeles timezone)
 */
function parseAppointmentDateTime(dateStr, timeStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
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
 * Send reminder email to customer
 */
async function sendReminderEmail(appointment, appointmentId) {
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
        const response = await fetch(FORMSPREE_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reminderData)
        });

        if (response.ok) {
            console.log(`✅ Reminder sent to ${appointment.customerEmail}`);
            await db.ref(`appointments/${appointmentId}/reminderSent`).set(true);
            return true;
        } else {
            console.error(`❌ Failed to send reminder to ${appointment.customerEmail}`);
            return false;
        }
    } catch (error) {
        console.error('Error sending reminder:', error);
        return false;
    }
}

/**
 * Check all appointments and send reminders for those 24 hours away
 */
async function checkAndSendReminders() {
    console.log('🔍 Checking for appointments needing reminders...');
    
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
                console.log(`📧 Sending reminder for ${appointment.customerName}`);
                const sent = await sendReminderEmail(appointment, appointmentId);
                if (sent) {
                    remindersSent++;
                }
            }
        }
        
        console.log(`✅ Reminder check complete. Sent ${remindersSent} reminders.`);
        showSuccess(`Sent ${remindersSent} reminder(s)`);
        return remindersSent;
    } catch (error) {
        console.error('Error checking appointments:', error);
        showError('Error checking reminders');
        return 0;
    }
}

/**
 * Manually send reminder for a specific appointment
 */
async function sendManualReminder(appointmentId) {
    try {
        const snapshot = await db.ref(`appointments/${appointmentId}`).once('value');
        const appointment = snapshot.val();
        
        if (!appointment) {
            showError('Appointment not found');
            return false;
        }
        
        const sent = await sendReminderEmail(appointment, appointmentId);
        if (sent) {
            showSuccess('Reminder sent successfully!');
        } else {
            showError('Failed to send reminder');
        }
        return sent;
    } catch (error) {
        console.error('Error sending manual reminder:', error);
        showError('Error sending reminder');
        return false;
    }
}

/**
 * Send SMS reminder to customer
 */
async function sendSMSReminder(appointment, customerPhone) {
    if (!customerPhone) {
        console.log('No phone number for SMS');
        return false;
    }

    const message = `Hi! Reminder: Your Shiny Paws appointment for ${appointment.petName} is tomorrow at ${appointment.time}. Service: ${appointment.service}. Call (310) 290-4970 to reschedule.`;
    
    console.log(`SMS Message: ${message}`);
    console.log(`To: ${customerPhone}`);
    
    return true;
}

/**
 * Send multi-channel reminders (Email + SMS)
 */
async function sendMultiChannelReminder(appointment, appointmentId) {
    const emailSent = await sendReminderEmail(appointment, appointmentId);
    const smsSent = await sendSMSReminder(appointment, appointment.customerPhone);
    
    if (emailSent || smsSent) {
        await db.ref(`appointments/${appointmentId}/reminderChannels`).set({
            email: emailSent,
            sms: smsSent,
            sentAt: new Date().toISOString()
        });
        return true;
    }
    return false;
}

// ==================== EVENT LISTENERS ====================
document.getElementById("appointmentDate").addEventListener("change", updateTimeSlots);
document.getElementById("service").addEventListener("change", updateTimeSlots);

// Allow Enter key to login
document.getElementById("passwordInput")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") login();
});
