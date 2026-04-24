// Firebase Configuration
const firebaseConfig = {
    databaseURL: "https://shiny-paws-default-rtdb.firebaseio.com"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Passwords & Roles
const ADMIN_PASSWORD  = "santamonica2025"; // full access
const VIEWER_PASSWORD = "admin123";        // booking management only

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
    const password = document.getElementById("passwordInput").value;
    let role = null;
    if (password === ADMIN_PASSWORD)  role = 'admin';
    else if (password === VIEWER_PASSWORD) role = 'viewer';

    if (role) {
        localStorage.setItem('adminPassword', password);
        localStorage.setItem('adminRole', role);
        document.getElementById("loginScreen").classList.add("hidden");
        document.getElementById("dashboard").classList.add("active");
        applyRolePermissions(role);
        subscribeWaivers();
        loadAppointments();
        document.getElementById("dateFilter").valueAsDate = new Date();
        document.getElementById("appointmentDate").valueAsDate = new Date();
        updateTimeSlots();
    } else {
        document.getElementById("loginError").style.display = "block";
        setTimeout(() => {
            document.getElementById("loginError").style.display = "none";
        }, 3000);
    }
}

function applyRolePermissions(role) {
    // Role badge
    const badge = document.getElementById('roleBadge');
    if (badge) {
        badge.textContent = role === 'admin' ? '👑 Admin' : '👁 Viewer';
        badge.style.background = role === 'admin' ? '#3D2060' : '#2E7D32';
    }
    // Hide admin-only tabs & panels for viewers
    document.querySelectorAll('[data-admin-only]').forEach(el => {
        el.style.display = role === 'admin' ? '' : 'none';
    });
}

function logout() {
    if (confirm("Are you sure you want to logout?")) {
        localStorage.removeItem('adminPassword');
        localStorage.removeItem('adminRole');
        document.getElementById("loginScreen").classList.remove("hidden");
        document.getElementById("dashboard").classList.remove("active");
        document.getElementById("passwordInput").value = "";
        document.getElementById("bookingForm").reset();
    }
}

// ==================== WAIVERS ====================
// In-memory map: normalized phone -> ISO timestamp of when the waiver was signed.
// Populated from Firebase /customers/{phone}.waiverSignedAt. Each appointment row
// looks itself up in this map to decide whether to show "NEEDS WAIVER" or "✓ Signed".
const waiverByPhone = {};
let lastAppointmentSnapshot = {};

function normalizePhone(p) {
    // Return last 10 digits so "+1 310 555 1234", "13105551234", and "310-555-1234"
    // all collapse to the same key. Handles country-code inconsistency between
    // booking form and waiver form.
    const digits = String(p || '').replace(/\D/g, '');
    return digits.length > 10 ? digits.slice(-10) : digits;
}

// Full customer snapshot for the Waivers directory tab
let customersSnapshot = {};

function subscribeWaivers() {
    db.ref("customers").on("value", (snap) => {
        const data = snap.val() || {};
        customersSnapshot = data;
        // Reset and rebuild fast-lookup map
        for (const k in waiverByPhone) delete waiverByPhone[k];
        Object.entries(data).forEach(([phone, c]) => {
            if (c && c.waiverSignedAt) {
                waiverByPhone[normalizePhone(phone)] = c.waiverSignedAt;
            }
        });
        // Re-render the currently visible appointments so badges flip live
        if (lastAppointmentSnapshot && Object.keys(lastAppointmentSnapshot).length) {
            displayAppointments(lastAppointmentSnapshot);
        }
        // Re-render the waivers directory too
        renderWaiverList();
    });
}

// ============ WAIVERS DIRECTORY TAB ============
function waiverCustomerList() {
    // Normalize the /customers/ snapshot into a sorted array
    return Object.entries(customersSnapshot).map(([phoneKey, c]) => {
        c = c || {};
        const fname = c.fname || c.firstName || '';
        const lname = c.lname || c.lastName  || '';
        const name  = (fname + ' ' + lname).trim() || c.name || '(no name)';
        return {
            phoneKey,
            phone: c.phone || phoneKey,
            name,
            email: c.email || '',
            signedAt: c.waiverSignedAt || null,
            waiverVersion: c.waiverVersion || '',
            raw: c
        };
    }).sort((a, b) => {
        // Unsigned first (so staff see who to chase), then by name
        if (!!a.signedAt !== !!b.signedAt) return a.signedAt ? 1 : -1;
        return a.name.localeCompare(b.name);
    });
}

function renderWaiverList() {
    const body   = document.getElementById('waiverTableBody');
    if (!body) return;
    const search = (document.getElementById('waiverSearch').value || '').toLowerCase().trim();
    const filter = document.getElementById('waiverFilter').value;

    let all = waiverCustomerList();
    const total = all.length;
    const totalSigned   = all.filter(c => !!c.signedAt).length;
    const totalUnsigned = total - totalSigned;

    document.getElementById('waiverCountTotal').textContent    = total;
    document.getElementById('waiverCountSigned').textContent   = totalSigned;
    document.getElementById('waiverCountUnsigned').textContent = totalUnsigned;

    let rows = all;
    if (filter === 'signed')   rows = rows.filter(c => !!c.signedAt);
    if (filter === 'unsigned') rows = rows.filter(c => !c.signedAt);
    if (search) {
        rows = rows.filter(c =>
            c.name.toLowerCase().includes(search) ||
            normalizePhone(c.phone).includes(normalizePhone(search)) ||
            (c.email || '').toLowerCase().includes(search)
        );
    }

    if (rows.length === 0) {
        body.innerHTML = `<tr><td colspan="6" style="padding:30px;text-align:center;color:#7B5EA7">
            ${total === 0 ? 'No customers in the database yet.' : 'No customers match those filters.'}
        </td></tr>`;
        return;
    }

    body.innerHTML = rows.map(c => {
        const escName  = (c.name  || '').replace(/'/g, "\\'");
        const escPhone = (c.phone || '').replace(/'/g, "\\'");
        const signedDate = c.signedAt
            ? new Date(c.signedAt).toLocaleDateString('en-US', {year:'numeric', month:'short', day:'numeric'})
            : '—';
        const status = c.signedAt
            ? `<span class="waiver-badge waiver-ok">✓ Signed</span>`
            : `<span class="waiver-badge waiver-needs">🔴 Not signed</span>`;
        const actions = c.signedAt
            ? `<button class="btn-waiver-ok" onclick="openWaiverFor('${escPhone}','${escName}')">📄 View</button>
               <button class="btn-waiver-ok" onclick="copyWaiverLink('${escPhone}','${escName}')">🔗 Copy link</button>`
            : `<button class="btn-waiver" onclick="openWaiverFor('${escPhone}','${escName}')">📄 Open waiver</button>
               <button class="btn-waiver-ok" onclick="copyWaiverLink('${escPhone}','${escName}')">🔗 Text link</button>`;
        return `<tr style="border-bottom:1px solid #eee4f3">
            <td style="padding:10px;font-weight:600;color:#3D2060">${c.name}</td>
            <td style="padding:10px">${c.phone}</td>
            <td style="padding:10px;color:#7B5EA7">${c.email || '—'}</td>
            <td style="padding:10px;color:#7B5EA7">${signedDate}</td>
            <td style="padding:10px">${status}</td>
            <td style="padding:10px;white-space:nowrap">${actions}</td>
        </tr>`;
    }).join('');
}

// CSV export — handy for texting campaigns or spreadsheets
function exportWaiverCSV() {
    const rows = waiverCustomerList();
    const header = ['Name','Phone','Email','Signed At','Status'];
    const csv = [header.join(',')].concat(
        rows.map(c => [
            '"' + (c.name || '').replace(/"/g,'""') + '"',
            '"' + (c.phone || '').replace(/"/g,'""') + '"',
            '"' + (c.email || '').replace(/"/g,'""') + '"',
            c.signedAt || '',
            c.signedAt ? 'signed' : 'not_signed'
        ].join(','))
    ).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shinypaws-waivers-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
}

function hasWaiver(phone) {
    return !!waiverByPhone[normalizePhone(phone)];
}

function openWaiverFor(phone, name) {
    const params = new URLSearchParams();
    if (phone) params.set('phone', phone);
    if (name)  params.set('name',  name);
    window.open('waiver.html?' + params.toString(), '_blank', 'noopener');
}

// Copy a tap-to-sign link to the clipboard so admin can text it to the customer.
function copyWaiverLink(phone, name) {
    const base = window.location.origin + window.location.pathname.replace(/admin\.html$/, '');
    const params = new URLSearchParams();
    if (phone) params.set('phone', phone);
    if (name)  params.set('name',  name);
    const url = base + 'waiver.html?' + params.toString();
    navigator.clipboard.writeText(url).then(() => {
        showSuccess('Waiver link copied — paste into a text to ' + (name || 'the customer') + '.');
    }).catch(() => {
        prompt('Copy this waiver link and text it to the customer:', url);
    });
}

function updateWaiverPendingPill(appts) {
    const pill = document.getElementById('waiverPendingPill');
    const count = document.getElementById('waiverPendingCount');
    if (!pill || !count) return;
    let pending = 0;
    Object.values(appts || {}).forEach(a => {
        if (a.status === 'cancelled') return;
        if (!hasWaiver(a.customerPhone)) pending++;
    });
    count.textContent = pending;
    pill.classList.toggle('empty', pending === 0);
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
    lastAppointmentSnapshot = appointments || {};
    const list = document.getElementById("appointmentsList");
    const items = Object.entries(appointments);

    updateWaiverPendingPill(appointments);

    if (items.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>No appointments for this date</p></div>';
        return;
    }

    list.innerHTML = items.map(([id, apt]) => {
        const signed = hasWaiver(apt.customerPhone);
        const waiverBadge = signed
            ? `<span class="waiver-badge waiver-ok" title="Signed ${waiverByPhone[normalizePhone(apt.customerPhone)]}">✓ Waiver on file</span>`
            : `<span class="waiver-badge waiver-needs" title="No waiver yet for this phone number">📄 Needs waiver</span>`;

        const escName = (apt.customerName || '').replace(/'/g, "\\'");
        const escPhone = (apt.customerPhone || '').replace(/'/g, "\\'");

        const waiverActions = signed
            ? `<button class="btn-waiver-ok" onclick="openWaiverFor('${escPhone}','${escName}')" title="View / re-sign">📄 View waiver</button>`
            : `<button class="btn-waiver" onclick="openWaiverFor('${escPhone}','${escName}')" title="Open the waiver — hand the iPad to the customer at checkin">📄 Open waiver</button>
               <button class="btn-waiver-ok" onclick="copyWaiverLink('${escPhone}','${escName}')" title="Copy a link to text the customer">🔗 Copy link</button>`;

        return `
        <div class="appointment-item ${apt.status || 'pending'}">
            <div class="appointment-time">
                ${apt.time}
                <span class="status-badge status-${apt.status || 'pending'}">${apt.status || 'Pending'}</span>
                ${waiverBadge}
            </div>
            <div class="appointment-details">
                <strong>${apt.customerName}</strong> - ${apt.petName} (${apt.petBreed || 'N/A'})
                <br />Service: ${apt.service}
                <br />Phone: ${apt.customerPhone}
                ${apt.customerEmail ? `<br />Email: ${apt.customerEmail}` : ''}
                ${apt.notes ? `<br />Notes: ${apt.notes}` : ''}
            </div>
            <div class="appointment-actions">
                ${waiverActions}
                ${apt.status !== 'completed' ? `<button class="btn-complete" onclick="updateStatus('${id}', 'completed')">✓ Complete</button>` : ''}
                ${apt.status !== 'cancelled' ? `<button class="btn-cancel" onclick="updateStatus('${id}', 'cancelled')">✗ Cancel</button>` : ''}
                ${!apt.reminderSent && apt.status !== 'cancelled' ? `<button class="btn-reminder" onclick="sendManualReminder('${id}')">📧 Send Reminder</button>` : ''}
                <button class="btn-delete" onclick="deleteAppointment('${id}')">🗑️ Delete</button>
            </div>
        </div>`;
    }).join("");
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

// ==================== SCHEDULE CONTROLS (closed days + clear future) ====================
function todayIso() {
    const d = new Date(); d.setHours(0,0,0,0);
    return d.toISOString().slice(0,10);
}

function renderClosedDays(map) {
    const el = document.getElementById('closedDaysList');
    if (!el) return;
    const entries = Object.entries(map || {}).filter(function(e){ return e[1] }).map(function(e){ return e[0] }).sort();
    if (!entries.length) { el.innerHTML = '<span style="color:#7B5EA7">No days blocked.</span>'; return; }
    el.innerHTML = entries.map(function(d){
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:#f3efff;border-radius:8px;margin-bottom:6px">' +
                 '<span>' + d + '</span>' +
                 '<button type="button" class="btn-delete" style="padding:4px 10px;font-size:12px" onclick="removeClosedDay(\'' + d + '\')">Unblock</button>' +
               '</div>';
    }).join('');
}

function watchClosedDays() {
    db.ref('closedDays').on('value', function(snap){ renderClosedDays(snap.val() || {}); });
}

function addClosedDay() {
    const input = document.getElementById('closeDayInput');
    const date = input.value;
    if (!date) { alert('Pick a date first.'); return; }
    db.ref('closedDays/' + date).set(true).then(function(){
        showNotification && showNotification('Day blocked: ' + date, 'success');
        input.value = '';
    }).catch(function(err){ alert('Failed to block day: ' + err.message); });
}

function removeClosedDay(date) {
    if (!confirm('Unblock ' + date + '? Customers will be able to book again.')) return;
    db.ref('closedDays/' + date).remove().catch(function(err){ alert('Failed to unblock: ' + err.message); });
}

async function clearFutureAppointments() {
    const cutoff = todayIso();
    if (!confirm('Delete ALL appointments dated ' + cutoff + ' or later?\n\nThis cannot be undone.')) return;
    if (!confirm('Last chance. Really delete all future appointments?')) return;
    try {
        const snap = await db.ref('appointments').once('value');
        const all = snap.val() || {};
        const toDelete = Object.entries(all).filter(function(e){
            const d = (e[1] && e[1].date) || '';
            return d >= cutoff;
        });
        if (!toDelete.length) { alert('No future appointments to delete.'); return; }
        const updates = {};
        toDelete.forEach(function(e){ updates['appointments/' + e[0]] = null; });
        await db.ref().update(updates);
        alert('Deleted ' + toDelete.length + ' future appointment(s).');
    } catch (err) {
        alert('Delete failed: ' + err.message);
    }
}

watchClosedDays();

// ==================== EVENT LISTENERS ====================
document.getElementById("appointmentDate").addEventListener("change", updateTimeSlots);
document.getElementById("service").addEventListener("change", updateTimeSlots);

// Allow Enter key to login
document.getElementById("passwordInput")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") login();
});

// ==================== AUTO-LOGIN (persist across F5 and browser restarts) ====================
// Uses localStorage so session survives tab close and hard refresh. Logout clears it.
(function autoLogin() {
    try {
        const password = localStorage.getItem('adminPassword');
        const role = localStorage.getItem('adminRole');
        if (!password || !role) return;
        if (password !== ADMIN_PASSWORD && password !== VIEWER_PASSWORD) {
            // Password changed — clear stale creds
            localStorage.removeItem('adminPassword');
            localStorage.removeItem('adminRole');
            return;
        }
        const loginEl = document.getElementById("loginScreen");
        const dashEl  = document.getElementById("dashboard");
        if (loginEl) loginEl.classList.add("hidden");
        if (dashEl)  dashEl.classList.add("active");
        applyRolePermissions(role);
        subscribeWaivers();
        loadAppointments();
        const df = document.getElementById("dateFilter");
        if (df) df.valueAsDate = new Date();
        const ad = document.getElementById("appointmentDate");
        if (ad) ad.valueAsDate = new Date();
        if (typeof updateTimeSlots === 'function') updateTimeSlots();
    } catch (e) {
        console.warn('Auto-login failed:', e);
    }
})();
