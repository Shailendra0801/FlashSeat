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

    // Safety Check
    if (!eventsList) {
        console.error("Element with id='eventsList' not found in HTML!");
        return;
    }

    eventsList.innerHTML = "<p>Loading events...</p>";

    try {
        const res = await fetch(`${API_BASE}/events/`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (res.status === 401) {
            alert("Session expired. Please login again.");
            localStorage.removeItem('access_token');
            window.location.href = '../index.html';
            return;
        }

        if (!res.ok) {
            throw new Error("Failed to fetch events");
        }

        const data = await res.json();
        console.log("Events data received:", data);
        const events = data.events || [];

        if (events.length === 0) {
            eventsList.innerHTML = '<p>No upcoming events found.</p>';
            return;
        }

        eventsList.innerHTML = events.map(event => `
            <div class="event-card" style="margin-bottom: 15px; padding: 15px; border: 1px solid #ddd; border-radius: 8px;">
                <h4>${event.title}</h4>
                <p>
                    ${event.category} • 
                    ${event.venue_name || 'Venue TBD'} 
                    ${event.venue_city ? `, ${event.venue_city}` : ''}
                </p>
                <p><strong>Sessions:</strong> ${event.total_sessions || 0}</p>
                <button onclick="viewEvent('${event.event_id}')">View & Book</button>
            </div>
        `).join('');

    } catch (err) {
        console.error('Could not load events:', err);
        eventsList.innerHTML = '<p style="color: red;">Failed to load events. Please try again.</p>';
    }
}

// ====================== VIEW EVENT ======================
function viewEvent(eventId) {
    window.location.href = `event.html?event_id=${eventId}`;
}

// ====================== INIT ======================
loadEvents();