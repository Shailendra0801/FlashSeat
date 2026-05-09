const params = new URLSearchParams(window.location.search);
const eventId = params.get('event_id');

if (!eventId) {
    alert("No event selected!");
    window.location.href = "dashboard.html";
}

// ====================== LOAD FULL EVENT WITH SESSIONS ======================
async function loadEventPage() {
    try {
        // This uses the detailed endpoint that returns sessions
        const event = await apiCall(`/events/${eventId}`);

        // Update basic event info
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

        // Populate Session Dropdown
        const select = document.getElementById('sessionSelect');
        select.innerHTML = '';

        sessions.forEach(session => {
            const option = document.createElement('option');
            option.value = session.session_id;
            option.textContent = `${session.session_name} — ${new Date(session.start_time).toLocaleString()}`;
            select.appendChild(option);
        });

        // Load seat map for the first session by default
        loadSeatMap(sessions[0].session_id);

    } catch (err) {
        console.error("Failed to load event:", err);
        document.getElementById('eventTitle').textContent = "Failed to Load Event";
    }
}

// ====================== LOAD SEAT MAP FOR SELECTED SESSION ======================
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
            const statusClass = String(seat.status).toLowerCase().replace(/^sessionseatstatus\./i, '');

            seatEl.className = `seat ${statusClass}`;
            seatEl.textContent = `${seat.row_name}${seat.seat_number}`;
            seatEl.title = `${seat.row_name}${seat.seat_number} - ${seat.status}`;
            
            seatMapDiv.appendChild(seatEl);
        });

    } catch (err) {
        console.error("Seat map failed:", err);
        document.getElementById('seatMap').innerHTML = 
            `<p style="color:red; grid-column: 1 / -1;">Failed to load seat map.</p>`;
    }
}

// ====================== HANDLE SESSION CHANGE ======================
function loadSeatMapForSession() {
    const sessionId = document.getElementById('sessionSelect').value;
    if (sessionId) loadSeatMap(sessionId);
}

function goBack() {
    window.location.href = "dashboard.html";
}

// ====================== START ======================
loadEventPage();