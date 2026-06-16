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
    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();
    const hashedPassword = await hashPassword(password);
    const localAdmin = {
        admin_id: `local-${Date.now()}`,
        email: trimmedEmail,
        username: trimmedUsername,
        password_hash: hashedPassword,
        created_at: new Date().toISOString()
    };
    localStorage.setItem(LOCAL_ADMIN_KEY, JSON.stringify(localAdmin));
    return localAdmin;
}

function handleAdminSetup(event) {
    event.preventDefault();

    const email = document.getElementById('email').value.trim();
    const username = document.getElementById('username').value.trim();
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

    try {
        const response = await fetch(`${API_URL_SETUP}/api/admin/setup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                username,
                password
            })
        });

        document.getElementById('loading').style.display = 'none';

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const errorMessage = errorData?.detail || `Setup failed (${response.status})`;
            const serverUnavailable = response.status === 404 || response.status >= 500;
            if (!getLocalAdmin() && serverUnavailable) {
                await saveLocalAdmin(email, username, password);
                showAlert('Backend unavailable. Admin credentials have been saved locally. Redirecting to login...', 'success');
                setTimeout(() => {
                    window.location.href = 'admin-login.html';
                }, 2000);
                return;
            }
            throw new Error(errorMessage);
        }

        await response.json();
        showAlert('Admin credentials created successfully. Redirecting to login...', 'success');
        setTimeout(() => {
            window.location.href = 'admin-login.html';
        }, 2000);
    } catch (error) {
        document.getElementById('submitBtn').disabled = false;
        document.getElementById('loading').style.display = 'none';

        const shouldFallback = error instanceof TypeError || /Failed to fetch|NetworkError|network/i.test(error.message || '') || /Setup failed \(404\)|Setup failed \(5\d\d\)/.test(error.message || '');
        const localAdminExists = getLocalAdmin();

        if (localAdminExists) {
            showAlert('Unable to reach the backend server and a local admin already exists. Please login with your local admin credentials.', 'error');
            return;
        }

        if (shouldFallback) {
            await saveLocalAdmin(email, username, password);
            showAlert('Unable to reach the backend server. Admin credentials have been saved locally. Redirecting to login...', 'success');
            setTimeout(() => {
                window.location.href = 'admin-login.html';
            }, 2000);
            return;
        }

        showAlert(error.message || 'Setup failed. Please try again.', 'error');
    }
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
