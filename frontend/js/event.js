// event.js
const token = localStorage.getItem('access_token');

// ── Auth guard ────────────────────────────────────────────────────────────────
if (!token) {
    window.location.href = 'index.html';
}

// ── Get event_id from URL ─────────────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
const eventId = params.get('event_id');

if (!eventId) {
    alert("No event selected!");
    window.location.href = "dashboard.html";
}

// ── Polling state ─────────────────────────────────────────────────────────────
let pollInterval = null;
let seatPollInterval = null;
let currentSessionId = null;

// ====================== CART STATE ======================
// Holds locked physical seat IDs (Seat.seat_id)
const cartSeatIds = new Set();
let checkoutInProgress = false;
let checkoutPendingReconnect = false;




// ====================== API HELPER ======================
async function apiCall(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    });

    if (res.status === 401) {
        localStorage.removeItem('access_token');
        window.location.href = 'index.html';
        return;
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(err.detail || `HTTP ${res.status}`);
    }

    return res.json();
}

// ====================== CART UI HELPERS ======================
function getSeatByIdFromDOM(seatId) {
    // seat elements have no data attributes currently, so we locate by title/text.
    // We'll reconcile using current DOM rendering by seat text matching (row+number).
    // Fallback: if we can't find, reconciliation still updates UI list.
    const seatGrid = document.getElementById('seatMap');
    if (!seatGrid) return null;
    const all = Array.from(seatGrid.querySelectorAll('.seat'));
    // seat text is row+seat_number; seatId not present in DOM.
    // So just return first match if title includes 'seat_id' (not present). We'll avoid heavy matching.
    return all.find(el => el.dataset && el.dataset.seatId === String(seatId)) || null;
}

function renderCart() {
    const cartSeatsDiv = document.getElementById('cartSeats');
    const cartSubtitle = document.getElementById('cartSubtitle');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const cartMessage = document.getElementById('cartMessage');

    if (!cartSeatsDiv || !cartSubtitle || !checkoutBtn || !cartMessage) return;

    cartSeatsDiv.innerHTML = '';
    cartMessage.textContent = '';

    const ids = Array.from(cartSeatIds);

    if (ids.length === 0) {
        cartSubtitle.textContent = 'No locked seats selected.';
        checkoutBtn.disabled = true;
        return;
    }

    cartSubtitle.textContent = `Locked seats (${ids.length})`;
    checkoutBtn.disabled = checkoutInProgress;

    // Render seats from current DOM labels when possible.
    // seat render sets: seatEl.dataset.seatId and seatEl.textContent/title.
    const seatEls = Array.from(document.getElementById('seatMap')?.querySelectorAll('.seat') || []);
    const labelBySeatId = new Map();

    seatEls.forEach(el => {
        const sid = el.dataset?.seatId;
        if (!sid) return;

        const raw = (el.textContent || '').trim();
        const label = (raw && raw !== 'Locked') ? raw : (el.title || raw);
        if (label) labelBySeatId.set(sid, label);
    });

    ids.forEach(seatId => {
        const p = document.createElement('div');
        p.className = 'cart-seat';
        const label = labelBySeatId.get(String(seatId));
        p.textContent = label ? label : `Seat ${seatId}`;
        cartSeatsDiv.appendChild(p);
    });
}


function elToTextHint(el) {
    if (!el) return null;
    return (el.textContent || '').trim();
}

function reconcileCartAfterSeatRefresh() {
    const seatMap = document.getElementById('seatMap');
    if (!seatMap) return;

    // Rebuild cart from DOM markers.
    const lockedEls = Array.from(seatMap.querySelectorAll('.seat.locked-by-you'));
    const newSet = new Set();
    lockedEls.forEach(el => {
        const sid = el.dataset?.seatId;
        if (sid) newSet.add(sid);
    });

    const changed = newSet.size !== cartSeatIds.size || Array.from(newSet).some(sid => !cartSeatIds.has(sid));
    if (changed) {
        cartSeatIds.clear();
        newSet.forEach(sid => cartSeatIds.add(sid));
        renderCart();
    } else {
        renderCart();
    }
}






// ====================== ENTER EVENT (QUEUE CHECK) ======================
async function enterEvent() {
    try {
        const data = await apiCall(`/events/${eventId}/queue`);

        if (data.status === "access_granted") {
            document.getElementById('waitingRoom').classList.add('hidden');
            loadEventPage();
        } else if (data.status === "in_queue") {
            showWaitingRoom(data.queue_position, data.estimated_wait_seconds);
        }
    } catch (err) {
        console.error("Queue entry failed:", err);
        alert("Failed to connect to event. Please try again.");
    }
}


// ====================== SHOW WAITING ROOM ======================
function showWaitingRoom(position, estimatedWaitSeconds) {
    const waitingRoom = document.getElementById('waitingRoom');
    waitingRoom.classList.remove('hidden');

    document.getElementById('queuePosition').textContent = position || "?";

    if (estimatedWaitSeconds) {
        document.getElementById('estimatedWait').textContent =
            `Estimated wait: ~${estimatedWaitSeconds} seconds`;
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
            pollInterval = null;
            document.getElementById('waitingRoom').classList.add('hidden');
            loadEventPage();
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
            document.getElementById('sessionSelect').innerHTML =
                `<option>No sessions available yet</option>`;
            return;
        }

        const select = document.getElementById('sessionSelect');
        select.innerHTML = '';

        sessions.forEach(session => {
            const option = document.createElement('option');
            option.value = session.session_id;
            option.textContent =
                `${session.session_name} — ${new Date(session.start_time).toLocaleString()}`;
            select.appendChild(option);
        });

        // Load first session's seat map and start polling
        currentSessionId = sessions[0].session_id;
        await loadSeatMap(currentSessionId);
        startSeatPolling();

    } catch (err) {
        console.error("Failed to load event:", err);
        document.getElementById('eventTitle').textContent = "Failed to Load Event";
    }
}


// ====================== RENDER SEAT GRID ======================
async function loadSeatMap(sessionId) {
    if (!sessionId) return;
    currentSessionId = sessionId;

    const infoEl = document.getElementById('selectedSessionInfo');

    // While checkout is in progress, avoid flickering seat states due to polling.
    if (checkoutInProgress) {
        return;
    }

    const select = document.getElementById('sessionSelect');
    infoEl.textContent =
        `Showing seats for: ${select.options[select.selectedIndex]?.text || ''}`;

    try {
        const data = await apiCall(`/events/${eventId}/seats?session_id=${sessionId}`);
        const seatMapDiv = document.getElementById('seatMap');
        seatMapDiv.innerHTML = '';

        data.seats.forEach(seat => {
            const seatEl = document.createElement('div');

            // Normalize status string from backend
            const rawStatus = String(seat.status)
                .toLowerCase()
                .replace(/^sessionseatstatus\./i, '');

            // Map backend seat state to UI CSS classes
            // - available      -> available
            // - reserved/booked/blocked -> unavailable (unless booked should appear as sold)
            // We treat BOOKED as sold for better UX.
            let domStatus = rawStatus;
            if (['reserved', 'blocked'].includes(rawStatus)) {
                domStatus = 'unavailable';
            } else if (rawStatus === 'booked') {
                domStatus = 'sold';
            }


            seatEl.className = `seat ${domStatus}`;
            seatEl.dataset.seatId = String(seat.seat_id);
            seatEl.textContent = `${seat.row_name}${seat.seat_number}`;
            seatEl.title = `${seat.row_name}${seat.seat_number} - ${rawStatus}`;


            // Only available seats are clickable
            if (rawStatus === 'available') {
                seatEl.addEventListener('click', () => handleSeatClick(
                    seatEl, seat, sessionId
                ));
            }

            seatMapDiv.appendChild(seatEl);
        });

    } catch (err) {
        console.error("Seat map failed:", err);
        document.getElementById('seatMap').innerHTML =
            `<p style="color:red; grid-column:1/-1; text-align:center;">
                Failed to load seat map.
            </p>`;
    }
}


// ====================== HANDLE SEAT CLICK ======================
async function handleSeatClick(seatEl, seat, sessionId) {
    // Clone to strip old listeners, then work with the clone
    const clone = seatEl.cloneNode(true);
    seatEl.replaceWith(clone);

    try {
        await apiCall(`/events/seats/${seat.seat_id}/lock?session_id=${sessionId}`, { method: 'POST' });
        clone.className = 'seat locked-by-you';
        clone.textContent = 'Locked';
        clone.title = `${seat.row_name}${seat.seat_number} - locked by you`;

        // Add to cart
        cartSeatIds.add(seat.seat_id);
        renderCart();
    } catch (err) {
        clone.className = 'seat unavailable';
        clone.textContent = `${seat.row_name}${seat.seat_number}`;
        clone.title = `${seat.row_name}${seat.seat_number} - unavailable`;
    }
}



// ====================== SEAT POLLING ======================
function startSeatPolling() {
    // ── FIX: Always clear existing interval before starting a new one ─────────
    if (seatPollInterval) {
        clearInterval(seatPollInterval);
        seatPollInterval = null;
    }

    seatPollInterval = setInterval(async () => {
        if (!currentSessionId) return;
        if (checkoutInProgress) return;
        try {
            // Seat map reload will re-render seats; cart reconciliation runs inside renderCartWithReconciliation().
            await loadSeatMap(currentSessionId);
            reconcileCartAfterSeatRefresh();
        } catch (e) {
            console.error('Seat polling failed:', e);
        }
    }, 5000);
}



// ====================== SESSION CHANGE ======================
function loadSeatMapForSession() {
    const sessionId = document.getElementById('sessionSelect').value;
    if (sessionId) {
        currentSessionId = sessionId;
        loadSeatMap(sessionId);
        startSeatPolling();   // restarts polling for new session
    }
}


// ====================== CHECKOUT ======================
async function checkoutFromCart() {
    const checkoutBtn = document.getElementById('checkoutBtn');
    const cartMessage = document.getElementById('cartMessage');

    if (!currentSessionId) {
        cartMessage.textContent = 'No session selected.';
        return;
    }

    const seatIds = Array.from(cartSeatIds);
    if (seatIds.length === 0) {
        cartMessage.textContent = 'No locked seats selected.';
        return;
    }

    if (checkoutInProgress) return;
    checkoutInProgress = true;
    checkoutPendingReconnect = false;

    if (checkoutBtn) checkoutBtn.disabled = true;
    cartMessage.textContent = 'Processing checkout...';

    try {
        const payload = {
            session_id: currentSessionId,
            seat_ids: seatIds,
        };

        const data = await apiCall('/orders', {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        // Backend returns order info if successful.
        // Update UI: turn locked seats into sold/red.
        const seatMap = document.getElementById('seatMap');
        const seatEls = seatMap ? Array.from(seatMap.querySelectorAll('.seat')) : [];

        seatEls.forEach(el => {
            const sid = el.dataset?.seatId;
            if (!sid) return;
            if (cartSeatIds.has(sid)) {
                el.classList.remove('locked-by-you');
                el.classList.add('sold');
                el.textContent = (el.textContent && el.textContent.trim()) ? el.textContent : 'Sold';
                el.title = 'Sold';
            }
        });

        // Clear cart
        cartSeatIds.clear();
        renderCart();

        cartMessage.textContent = 'Checkout successful! Your seats are confirmed.';

        // Reload seat map after a short delay to sync statuses.
        setTimeout(() => {
            if (!checkoutInProgress) return;
        }, 0);

    } catch (err) {
        cartMessage.textContent = `Checkout failed: ${err.message}`;
    } finally {
        checkoutInProgress = false;
        // Sync seats after checkout attempt.
        try {
            if (currentSessionId) loadSeatMap(currentSessionId);
        } catch (_) {}
    }
}

// ====================== GO BACK ======================
function goBack() {
    if (pollInterval) clearInterval(pollInterval);
    if (seatPollInterval) clearInterval(seatPollInterval);
    notifyLeave();
    window.location.href = "dashboard.html";
}



// ====================== NOTIFY BACKEND ON LEAVE ======================
// FIX: sendBeacon can't send auth headers.
// Use fetch with keepalive: true instead — completes even as page closes.
function notifyLeave() {
    if (!token || !eventId) return;
    fetch(`${API_BASE}/events/${eventId}/leave`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        keepalive: true,   // ← ensures request completes even if page is closing
    }).catch(() => {});    // silent fail — TTL-based cleanup handles the rest
}


// ====================== CLEANUP ON TAB CLOSE ======================
window.addEventListener('beforeunload', () => {
    if (pollInterval) clearInterval(pollInterval);
    if (seatPollInterval) clearInterval(seatPollInterval);
    notifyLeave();
});


// ====================== INITIALIZE ======================
enterEvent();