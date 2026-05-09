// js/auth.js
const API_BASE = "http://127.0.0.1:8000";
const modal = document.getElementById('authModal');

// ====================== MODAL OPEN/CLOSE ======================

document.getElementById('showLoginBtn').addEventListener('click', () => {
    showModal('login');
});

document.getElementById('showRegisterBtn').addEventListener('click', () => {
    showModal('register');
});

// FIX 1: Use .active class instead of inline style — matches the CSS .modal.active rule
function showModal(tab) {
    modal.classList.add('active');
    switchTab(tab);
}

function closeModal() {
    modal.classList.remove('active');
}

// FIX 2: Wire up the close button added to the HTML
document.getElementById('closeModalBtn').addEventListener('click', closeModal);

// Close modal when clicking the backdrop
modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

// FIX 3: Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// ====================== TAB SWITCHING ======================

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
    });
});

function switchTab(tab) {
    // Update tab button states
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    // FIX 4: Toggle forms using the .hidden class (which is now defined in CSS)
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById(tab + 'Form').classList.remove('hidden');

    // Update modal title
    document.getElementById('modalTitle').textContent =
        tab === 'login' ? 'Welcome Back' : 'Create Account';

    // Clear any leftover messages when switching tabs
    clearMessages();
}

// ====================== MESSAGE HELPERS ======================

// FIX 5: Replace alert() with inline messages — alerts block the UI and look bad
function showMessage(formId, message, type = 'error') {
    let msgEl = document.querySelector(`#${formId} .form-message`);
    // Create the element if it doesn't exist yet
    if (!msgEl) {
        msgEl = document.createElement('div');
        msgEl.className = 'form-message';
        document.getElementById(formId).prepend(msgEl);
    }
    msgEl.textContent = message;
    msgEl.className = `form-message ${type}`;
}

function clearMessages() {
    document.querySelectorAll('.form-message').forEach(el => {
        el.className = 'form-message'; // removes error/success, hides it via CSS
    });
}

// ====================== LOGIN ======================

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();

    const email = document.getElementById('login_email').value.trim();
    const password = document.getElementById('login_password').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    // FIX 6: Disable button during request to prevent double-submits
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in…';

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('access_token', data.access_token);
            window.location.href = 'pages/dashboard.html';
        } else {
            showMessage('loginForm', data.detail || 'Login failed. Please try again.');
        }
    } catch (err) {
        // FIX 7: Distinguish network errors from server errors
        showMessage('loginForm', 'Could not connect to the server. Please try again.');
    } finally {
        // FIX 8: Always re-enable the button
        submitBtn.disabled = false;
        submitBtn.textContent = 'Login';
    }
});

// ====================== REGISTER ======================

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();

    const full_name = document.getElementById('full_name').value.trim();
    const email = document.getElementById('register_email').value.trim();
    const password = document.getElementById('register_password').value;
    const confirm_password = document.getElementById('confirm_password').value;

    // FIX 9: Validate before hitting the network
    if (!full_name) {
        return showMessage('registerForm', 'Please enter your full name.');
    }
    if (password.length < 6) {
        return showMessage('registerForm', 'Password must be at least 6 characters.');
    }
    if (password !== confirm_password) {
        return showMessage('registerForm', 'Passwords do not match.');
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account…';

    try {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name, email, password })
        });

        const data = await res.json();

        if (res.ok) {
            // FIX 10: Show success inline, then auto-switch to login tab
            showMessage('registerForm', 'Account created! Redirecting to login…', 'success');
            setTimeout(() => switchTab('login'), 1500);
        } else {
            showMessage('registerForm', data.detail || 'Registration failed. Please try again.');
        }
    } catch (err) {
        showMessage('registerForm', 'Could not connect to the server. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
    }
});