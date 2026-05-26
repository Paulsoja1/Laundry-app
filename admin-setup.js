// admin-setup.js - Admin setup behavior separated from admin-setup.html

const isFileProtocolSetup = window.location.protocol === 'file:';
const API_URL_SETUP = isFileProtocolSetup ? 'http://127.0.0.1:8000' : window.location.origin;
const LOCAL_ADMIN_KEY = 'localAdmin';

function showAlert(message, type) {
    const alertDiv = document.getElementById('alert');
    alertDiv.className = `alert ${type}`;
    alertDiv.innerHTML = `<strong>${type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Info'}:</strong> ${message}`;
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

async function saveLocalAdmin(email, username, password) {
    const hashedPassword = await hashPassword(password);
    const localAdmin = {
        admin_id: `local-${Date.now()}`,
        email,
        username,
        password_hash: hashedPassword,
        created_at: new Date().toISOString()
    };
    localStorage.setItem(LOCAL_ADMIN_KEY, JSON.stringify(localAdmin));
    return localAdmin;
}

function handleAdminSetup(event) {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
        showAlert('Passwords do not match', 'error');
        return;
    }

    if (password.length < 6) {
        showAlert('Password must be at least 6 characters long', 'error');
        return;
    }

    document.getElementById('submitBtn').disabled = true;
    document.getElementById('loading').style.display = 'block';

    fetch(`${API_URL_SETUP}/api/admin/setup`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email,
            username,
            password
        })
    })
    .then(response => {
        document.getElementById('loading').style.display = 'none';

        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.detail || 'Setup failed');
            });
        }
        return response.json();
    })
    .then(data => {
        showAlert('Admin credentials created successfully. Redirecting to login...', 'success');
        setTimeout(() => {
            window.location.href = 'admin-login.html';
        }, 2000);
    })
    .catch(async error => {
        document.getElementById('submitBtn').disabled = false;
        document.getElementById('loading').style.display = 'none';
        const message = error.message || 'Setup failed. Please try again.';

        if (message.toLowerCase().includes('failed to fetch') || message.toLowerCase().includes('network')) {
            if (getLocalAdmin()) {
                showAlert('Unable to reach the backend server and a local admin already exists. Please login with your local admin credentials.', 'error');
                return;
            }

            await saveLocalAdmin(email, username, password);
            showAlert('Backend unreachable. Admin credentials saved locally. Redirecting to login...', 'success');
            setTimeout(() => {
                window.location.href = 'admin-login.html';
            }, 2000);
            return;
        }

        showAlert(message, 'error');
    });
}

function initAdminSetupPage() {
    const setupForm = document.getElementById('setupForm');
    if (!setupForm) {
        return;
    }

    const localAdmin = getLocalAdmin();
    if (localAdmin) {
        showAlert('A local admin account already exists. Please sign in or clear local data to recreate.', 'info');
        setupForm.innerHTML = '<p class="redirect-note"><a href="admin-login.html">Go to Admin Login →</a></p>';
        return;
    }

    fetch(`${API_URL_SETUP}/admin`)
        .then(resp => resp.text())
        .then(text => {
            if (!text) return;
            const lowerText = text.toLowerCase();
            if (lowerText.includes('admin login')) {
                showAlert('An admin account already exists. Please go to the login page.', 'info');
                document.getElementById('setupForm').innerHTML =
                    '<p class="redirect-note"><a href="admin-login.html">Go to Admin Login →</a></p>';
            }
        })
        .catch(() => {
            showAlert('Backend unavailable. You can create a local admin account for this browser.', 'info');
        });

    const form = document.querySelector('.setup-form');
    if (form) {
        form.addEventListener('submit', handleAdminSetup);
    }
}

document.addEventListener('DOMContentLoaded', initAdminSetupPage);
