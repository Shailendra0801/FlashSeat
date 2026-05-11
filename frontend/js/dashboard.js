// Debug: Check token
console.log("Token from localStorage:", localStorage.getItem('access_token'));

// ====================== AUTH GUARD ======================
const token = localStorage.getItem('access_token');
console.log(token ? "Token found, user is authenticated." : "No token found, redirecting to login.");
if (!token) {
    window.location.href = '../index.html';
    throw new Error("No token found");
}

// ====================== LOGOUT ======================
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    window.location.href = '../index.html';
});

// ====================== LOAD EVENTS ======================
async function loadEvents() {
    const eventsList = document.getElementById('eventsList');
    if (!eventsList) return;

    eventsList.innerHTML = "<p>Loading events...</p>";

    try {
        const data = await apiCall('/events/');
        const events = data.events || [];

        if (events.length === 0) {
            eventsList.innerHTML = '<p>No upcoming events found.</p>';
            return;
        }

        let html = '';

        events.forEach(event => {
            html += `
                <div class="event-card">
                    <h4>${event.title}</h4>
                    <p class="event-info">
                        ${event.category} • ${event.venue_name || 'TBD'} 
                        ${event.venue_city ? `, ${event.venue_city}` : ''}
                    </p>
                    <p><strong>Sessions:</strong> ${event.total_sessions || 0}</p>
                    
                    <button onclick="viewSeats('${event.event_id}')" class="btn-view-seats">
                        View Seats
                    </button>
                </div>
            `;
        });

        eventsList.innerHTML = html;

    } catch (err) {
        console.error(err);
        eventsList.innerHTML = '<p style="color: red;">Failed to load events.</p>';
    }
}

// ====================== VIEW SEATS ======================
function viewSeats(eventId) {
    window.location.href = `event.html?event_id=${eventId}`;
}

// ====================== INIT ======================
loadEvents();