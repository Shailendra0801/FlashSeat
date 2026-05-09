// js/api.js

const API_BASE = "http://127.0.0.1:8000";

// Global API call function with automatic token attachment
async function apiCall(endpoint, options = {}) {
    const token = localStorage.getItem('access_token');

    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };

    // Attach JWT token if available
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(API_BASE + endpoint, config);

    if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('access_token');
        alert("Your session has expired. Please login again.");
        window.location.href = '../index.html';
        return null;
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "API request failed");
    }

    return response.json();
}