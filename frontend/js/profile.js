// profile.js

const profileOrdersEndpoint = '/orders/me';

const token = localStorage.getItem('access_token');
if (!token) {
    window.location.href = '../index.html';
}

async function apiCall(path, options = {}) {
    const res = await fetch(`http://127.0.0.1:8000${path}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    });

    if (res.status === 401) {
        localStorage.removeItem('access_token');
        window.location.href = '../index.html';
        return;
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(err.detail || `HTTP ${res.status}`);
    }

    // Some endpoints might return empty body; guard it.
    try {
        return await res.json();
    } catch (_) {
        return null;
    }
}

function formatDateTime(value) {
    if (!value) return '';
    try {
        return new Date(value).toLocaleString();
    } catch (_) {
        return String(value);
    }
}

function renderOrders(orders) {
    const ordersList = document.getElementById('ordersList');
    if (!ordersList) return;

    if (!orders || orders.length === 0) {
        ordersList.innerHTML = '<div class="empty-state">No orders yet.</div>';
        return;
    }

    ordersList.innerHTML = '';

    orders.forEach(order => {
        const status = order.status || 'unknown';

        let badgeClass = 'status-pending';
        let badgeText = status;
        if (status === 'confirmed') badgeClass = 'status-confirmed';
        if (status === 'failed') badgeClass = 'status-failed';

        const items = order.items || order.order_items || [];
        const seats = items
            .map(i => i.seat_label || i.seat || i.seatName || i.seat_label_text)
            .filter(Boolean);

        const seatHtml = seats.length
            ? `<div class="seat-list">${seats.map(s => `<span class="seat-pill">${s}</span>`).join('')}</div>`
            : '<div class="order-meta">No seat details.</div>';

        const orderHtml = `
            <div class="order-card">
                <div class="order-title">Order ${order.order_id || order.id || ''}</div>
                <div class="order-meta">${formatDateTime(order.created_at)}</div>
                <div style="margin-bottom: 10px;">
                    <span class="status-badge ${badgeClass}">${badgeText}</span>
                </div>
                ${seatHtml}
            </div>
        `;

        ordersList.insertAdjacentHTML('beforeend', orderHtml);
    });
}

async function loadOrders() {
    const ordersList = document.getElementById('ordersList');
    if (!ordersList) return;

    ordersList.textContent = 'Loading orders...';

    try {
        const data = await apiCall(profileOrdersEndpoint);

        // Accept multiple possible shapes: {orders: [...]}, [...] etc.
        const orders = data?.orders || data || [];
        renderOrders(orders);
    } catch (err) {
        console.error(err);
        ordersList.innerHTML = `<div class="empty-state">Failed to load orders: ${err.message}</div>`;
    }
}

loadOrders();

