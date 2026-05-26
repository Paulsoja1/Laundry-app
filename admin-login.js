// admin-login.js - Admin login behavior separated from admin-login.html

const isFileProtocolLogin = window.location.protocol === 'file:';
const API_URL_LOGIN = isFileProtocolLogin ? 'http://127.0.0.1:8000' : window.location.origin;
const LOCAL_ADMIN_KEY = 'localAdmin';

function isAdminLoggedIn() {
    return localStorage.getItem('adminSessionToken') !== null;
}

function getLocalAdmin() {
    try {
        return JSON.parse(localStorage.getItem(LOCAL_ADMIN_KEY));
    } catch {
        return null;
    }
}

async function hashPassword(password) {
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    let hash = 0;
    for (let i = 0; i < password.length; i += 1) {
        hash = ((hash << 5) - hash) + password.charCodeAt(i);
        hash |= 0;
    }
    return hash.toString();
}

async function verifyLocalLogin(username, password) {
    const localAdmin = getLocalAdmin();
    if (!localAdmin || localAdmin.username !== username) {
        return null;
    }
    const hashedPassword = await hashPassword(password);
    if (hashedPassword === localAdmin.password_hash) {
        return localAdmin;
    }
    return null;
}

function redirectIfAuthenticated() {
    if (isAdminLoggedIn()) {
        window.location.href = 'admin.html';
    }
}

function showAlert(message, type = 'error') {
    const alertBox = document.getElementById('alertBox');
    alertBox.textContent = message;
    alertBox.style.display = 'block';

    if (type === 'error') {
        alertBox.style.background = '#f8d7da';
        alertBox.style.color = '#721c24';
        alertBox.style.border = '1px solid #f5c6cb';
    } else if (type === 'success') {
        alertBox.style.background = '#d4edda';
        alertBox.style.color = '#155724';
        alertBox.style.border = '1px solid #c3e6cb';
    } else {
        alertBox.style.background = '#d1ecf1';
        alertBox.style.color = '#0c5460';
        alertBox.style.border = '1px solid #bee5eb';
    }
}

function handleAdminLogin(event) {
    event.preventDefault();

    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;
    const loginBtn = document.getElementById('loginBtn');

    if (!username || !password) {
        showAlert('Please enter both username and password', 'error');
        return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';

    fetch(`${API_URL_LOGIN}/api/admin/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username,
            password
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => { throw new Error(data.detail || 'Login failed'); });
        }
        return response.json();
    })
    .then(data => {
        localStorage.setItem('adminSessionToken', data.session_token);
        localStorage.setItem('adminId', data.admin_id);
        localStorage.setItem('adminUsername', data.username);

        showAlert('Login successful! Redirecting...', 'success');
        setTimeout(() => {
            window.location.href = 'admin.html';
        }, 1000);
    })
    .catch(async error => {
        const message = error.message || 'Invalid credentials. Please try again.';

        if (message.toLowerCase().includes('failed to fetch') || message.toLowerCase().includes('network')) {
            const localAdmin = await verifyLocalLogin(username, password);
            if (localAdmin) {
                localStorage.setItem('adminSessionToken', `local-${Date.now()}`);
                localStorage.setItem('adminId', localAdmin.admin_id);
                localStorage.setItem('adminUsername', localAdmin.username);
                showAlert('Logged in locally. Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = 'admin.html';
                }, 1000);
                return;
            }
            showAlert('Backend unavailable. If you created a local admin, ensure you use those credentials. Otherwise start the FastAPI server at http://127.0.0.1:8000.', 'error');
        } else {
            showAlert(message, 'error');
        }

        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    });
}

document.addEventListener('DOMContentLoaded', () => {
    redirectIfAuthenticated();

    const setupNotice = document.getElementById('setupNotice');
    const createAdminMessage = document.getElementById('createAdminMessage');
    const existingAdminNotice = document.getElementById('existingAdminNotice');

    const localAdmin = getLocalAdmin();
    if (localAdmin) {
        if (setupNotice) setupNotice.style.display = 'none';
        if (existingAdminNotice) {
            existingAdminNotice.textContent = 'A local admin account is available. Please login with that account.';
            existingAdminNotice.style.display = 'block';
        }
        if (createAdminMessage) createAdminMessage.style.display = 'none';
        return;
    }

    fetch(`${API_URL_LOGIN}/admin`)
        .then(resp => resp.text())
        .then(text => {
            if (!text) return;
            const t = text.toLowerCase();
            if (t.includes('admin setup') || t.includes('create your unique admin credentials')) {
                if (setupNotice) setupNotice.style.display = 'block';
            } else {
                if (existingAdminNotice) existingAdminNotice.style.display = 'block';
                if (createAdminMessage) createAdminMessage.style.display = 'none';
            }
        })
        .catch(() => {
            if (setupNotice) setupNotice.style.display = 'none';
        });

    const loginForm = document.getElementById('adminLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleAdminLogin);
    }
});
