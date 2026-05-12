// event.js

const params = new URLSearchParams(window.location.search);
const eventId = params.get('event_id');

if (!eventId) {
    alert("No event selected!");
    window.location.href = "dashboard.html";
}

let pollInterval = null;

// ====================== ENTER EVENT (QUEUE CHECK) ======================
async function enterEvent() {
    try {
        const data = await apiCall(`/events/${eventId}/queue`);

        if (data.status === "access_granted") {
            // Access granted → Load seat map
            document.getElementById('waitingRoom').classList.add('hidden');
            loadEventPage();
        } 
        else if (data.status === "in_queue") {
            showWaitingRoom(data.queue_position, data.estimated_wait || "");
        }
    } catch (err) {
        console.error("Queue entry failed:", err);
        alert("Failed to connect to event. Please try again.");
    }
}

// ====================== SHOW WAITING ROOM ======================
function showWaitingRoom(position, estimatedWait) {
    const waitingRoom = document.getElementById('waitingRoom');
    waitingRoom.classList.remove('hidden');

    document.getElementById('queuePosition').textContent = position || "?";

    if (estimatedWait) {
        document.getElementById('estimatedWait').textContent = `Estimated wait: ${estimatedWait}`;
    }

    // Start polling every 3 seconds
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(checkQueueStatus, 3000);
}

// ====================== POLL QUEUE STATUS ======================
async function checkQueueStatus() {
    try {
        const data = await apiCall(`/events/${eventId}/queue`);

        if (data.status === "access_granted") {
            clearInterval(pollInterval);
            document.getElementById('waitingRoom').classList.add('hidden');
            loadEventPage();                    // Load seat map
        } else if (data.status === "in_queue") {
            document.getElementById('queuePosition').textContent = data.queue_position;
        }
    } catch (err) {
        console.error("Polling error:", err);
    }
}

// ====================== LOAD EVENT DETAILS & SEAT MAP ======================
async function loadEventPage() {
    try {
        const event = await apiCall(`/events/${eventId}`);

        document.getElementById('eventTitle').textContent = event.title || "Event";
        document.getElementById('eventInfo').innerHTML = `
            ${event.venue_name || 'No venue'} • ${event.venue_city || ''}<br>
            <strong>Category:</strong> ${event.category || 'N/A'}
        `;

        const sessions = event.sessions || [];

        if (sessions.length === 0) {
            document.getElementById('sessionSelect').innerHTML = `<option>No sessions available yet</option>`;
            return;
        }

        const select = document.getElementById('sessionSelect');
        select.innerHTML = '';

        sessions.forEach(session => {
            const option = document.createElement('option');
            option.value = session.session_id;
            option.textContent = `${session.session_name} — ${new Date(session.start_time).toLocaleString()}`;
            select.appendChild(option);
        });

        // Load first session
        loadSeatMap(sessions[0].session_id);

    } catch (err) {
        console.error("Failed to load event:", err);
        document.getElementById('eventTitle').textContent = "Failed to Load Event";
    }
}

// ====================== RENDER SEAT GRID ======================
async function loadSeatMap(sessionId) {
    if (!sessionId) return;

    const infoEl = document.getElementById('selectedSessionInfo');
    const select = document.getElementById('sessionSelect');
    infoEl.textContent = `Showing seats for: ${select.options[select.selectedIndex]?.text || ''}`;

    try {
        const data = await apiCall(`/events/${eventId}/seats?session_id=${sessionId}`);

        const seatMapDiv = document.getElementById('seatMap');
        seatMapDiv.innerHTML = '';

        data.seats.forEach(seat => {
            const seatEl = document.createElement('div');
            let status = String(seat.status).toLowerCase().replace(/^sessionseatstatus\./i, '');

            seatEl.className = `seat ${status}`;
            seatEl.textContent = `${seat.row_name}${seat.seat_number}`;
            seatEl.title = `${seat.row_name}${seat.seat_number} - ${seat.status}`;

            seatEl.addEventListener('click', () => {
                if (status === 'available') {
                    console.log(`Seat selected: ${seat.row_name}${seat.seat_number}`);
                    alert(`✅ Seat ${seat.row_name}${seat.seat_number} selected!`);
                } else {
                    alert(`❌ Seat ${seat.row_name}${seat.seat_number} is already booked.`);
                }
            });

            seatMapDiv.appendChild(seatEl);
        });

    } catch (err) {
        console.error("Seat map failed:", err);
        document.getElementById('seatMap').innerHTML = 
            `<p style="color:red; grid-column:1/-1; text-align:center;">Failed to load seat map.</p>`;
    }
}

function loadSeatMapForSession() {
    const sessionId = document.getElementById('sessionSelect').value;
    if (sessionId) loadSeatMap(sessionId);
}

function goBack() {
    if (pollInterval) clearInterval(pollInterval);
    window.location.href = "dashboard.html";
}

// Cleanup polling when user closes/refreshes tab
window.addEventListener('beforeunload', () => {
    if (pollInterval) {
        clearInterval(pollInterval);
    }
    
    // Optional: Best-effort notify backend that user is leaving
    const token = localStorage.getItem('access_token');
    if (token && eventId) {
        navigator.sendBeacon(
            `${API_BASE}/events/${eventId}/leave`,
            JSON.stringify({})
        );
    }
});

// ====================== INITIALIZE ======================
enterEvent();