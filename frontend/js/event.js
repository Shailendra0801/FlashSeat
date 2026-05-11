// event.js

const params = new URLSearchParams(window.location.search);
const eventId = params.get('event_id');

if (!eventId) {
    alert("No event selected!");
    window.location.href = "dashboard.html";
}

// ====================== LOAD EVENT & SESSIONS ======================
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

        // Populate Session Dropdown
        const select = document.getElementById('sessionSelect');
        select.innerHTML = '';

        sessions.forEach(session => {
            const option = document.createElement('option');
            option.value = session.session_id;
            option.textContent = `${session.session_name} — ${new Date(session.start_time).toLocaleString()}`;
            select.appendChild(option);
        });

        // Load first session automatically
        loadSeatMap(sessions[0].session_id);

    } catch (err) {
        console.error("Failed to load event:", err);
        document.getElementById('eventTitle').textContent = "Failed to Load Event";
    }
}

// ====================== RENDER VISUAL SEAT GRID ======================
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
            
            // Normalize status
            let status = String(seat.status).toLowerCase().replace(/^sessionseatstatus\./i, '');
            
            seatEl.className = `seat ${status}`;
            seatEl.textContent = `${seat.row_name}${seat.seat_number}`;
            seatEl.title = `${seat.row_name}${seat.seat_number} - ${seat.status}`;

            // Click handler - Today's Goal
            seatEl.addEventListener('click', () => {
                console.log(`Seat clicked → ${seat.row_name}${seat.seat_number} | Seat ID: ${seat.seat_id} | Status: ${seat.status}`);
                
                if (status === 'available') {
                    alert(`✅ Seat ${seat.row_name}${seat.seat_number} selected!`);
                    // TODO: Later - Open booking modal
                } else {
                    alert(`❌ Seat ${seat.row_name}${seat.seat_number} is already booked.`);
                }
            });

            seatMapDiv.appendChild(seatEl);
        });

    } catch (err) {
        console.error("Seat map failed:", err);
        document.getElementById('seatMap').innerHTML = 
            `<p style="color:red; grid-column: 1 / -1; text-align:center;">Failed to load seat map.</p>`;
    }
}

// ====================== SESSION CHANGE ======================
function loadSeatMapForSession() {
    const sessionId = document.getElementById('sessionSelect').value;
    if (sessionId) loadSeatMap(sessionId);
}

function goBack() {
    window.location.href = "dashboard.html";
}

// ====================== INIT ======================
loadEventPage();