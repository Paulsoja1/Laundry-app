// admin.js - Admin dashboard behavior separated from admin.html

// Determine API base depending on whether page is loaded from file:// or over HTTP.
const isFileProtocol = window.location.protocol === 'file:';
const API_URL = isFileProtocol ? 'http://127.0.0.1:8000' : window.location.origin;

/**
 * Sort objects by date in descending order.
 * @param {Array} items
 * @param {string} dateKey
 * @returns {Array}
 */
function sortByCreatedAtDesc(items, dateKey = 'created_at') {
    return [...items].sort((a, b) => {
        const dateA = new Date(a[dateKey] || a.orderDate || a.created_at || 0).getTime();
        const dateB = new Date(b[dateKey] || b.orderDate || b.created_at || 0).getTime();
        return dateB - dateA;
    });
}

/**
 * Load fallback data from localStorage when the backend is unavailable.
 */
function getLocalDashboardData() {
    const orders = sortByCreatedAtDesc(JSON.parse(localStorage.getItem('orders')) || [], 'orderDate');
    const users = sortByCreatedAtDesc(JSON.parse(localStorage.getItem('users')) || []);
    const messages = sortByCreatedAtDesc(JSON.parse(localStorage.getItem('contactMessages')) || [], 'timestamp');
    const challenges = JSON.parse(localStorage.getItem('challenges')) || [];

    const payments = sortByCreatedAtDesc(orders.map((order, index) => ({
        payment_id: order.orderId || `PAY-${Date.now()}-${index}`,
        order_id: order.orderId || order.order_id || `ORD-${Date.now()}-${index}`,
        amount: parseFloat(order.estimatedCost || order.estimated_cost || 0),
        payment_method: 'N/A',
        status: 'Completed',
        created_at: order.orderDate || order.created_at || new Date().toISOString()
    })), 'created_at');

    const totalRevenue = orders.reduce((sum, order) => {
        const cost = parseFloat(order.estimatedCost || order.estimated_cost || 0);
        return sum + (isNaN(cost) ? 0 : cost);
    }, 0);

    return {
        total_users: users.length,
        total_orders: orders.length,
        total_revenue: totalRevenue,
        pending_orders: orders.filter(order => order.status === 'Pending').length,
        completed_orders: orders.filter(order => order.status === 'Completed').length,
        total_messages: messages.length,
        open_challenges: challenges.filter(c => c.status === 'open').length,
        orders,
        users,
        payments,
        messages,
        challenges
    };
}

/**
 * Render dashboard statistics and populate each table.
 */
function renderDashboard(data, fallback = false) {
    const alert = document.getElementById('dashboardAlert');

    if (fallback) {
        alert.textContent = 'Backend unavailable — showing local fallback data.';
        alert.classList.add('active');
    } else {
        alert.textContent = '';
        alert.classList.remove('active');
    }

    const fallbackLabel = fallback ? ' (local data)' : '';
    const statsHTML = `
        <div class="stat-card">
            <h3>Total Users${fallbackLabel}</h3>
            <div class="value">${data.total_users}</div>
        </div>
        <div class="stat-card">
            <h3>Total Orders${fallbackLabel}</h3>
            <div class="value">${data.total_orders}</div>
        </div>
        <div class="stat-card">
            <h3>Total Revenue${fallbackLabel}</h3>
            <div class="value">₦${data.total_revenue.toFixed(2)}</div>
        </div>
        <div class="stat-card">
            <h3>Pending Orders${fallbackLabel}</h3>
            <div class="value">${data.pending_orders}</div>
        </div>
        <div class="stat-card">
            <h3>Completed Orders${fallbackLabel}</h3>
            <div class="value">${data.completed_orders}</div>
        </div>
        <div class="stat-card">
            <h3>Contact Messages${fallbackLabel}</h3>
            <div class="value">${data.total_messages || 0}</div>
        </div>
        <div class="stat-card">
            <h3>Open Challenges${fallbackLabel}</h3>
            <div class="value">${data.open_challenges || 0}</div>
        </div>
    `;

    document.getElementById('statsContainer').innerHTML = statsHTML;
    loadOrders(data.orders);
    loadUsers(data.users);
    loadPayments(data.payments);
    loadMessages(data.messages || []);
    loadChallenges(data.challenges || []);
}

/**
 * Fetch dashboard data from backend or fallback to localStorage.
 */
async function loadDashboard() {
    if (isFileProtocol) {
        const localData = getLocalDashboardData();
        renderDashboard(localData, true);
        return;
    }

    try {
        const token = localStorage.getItem('adminSessionToken');
        if (!token) {
            throw new Error('No valid session');
        }

        const response = await fetch(`${API_URL}/admin/dashboard?token=${token}`);
        if (response.status === 401) {
            localStorage.removeItem('adminSessionToken');
            window.location.href = 'admin-login.html';
            return;
        }
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        let data = await response.json();

        const localUsers = JSON.parse(localStorage.getItem('users')) || [];
        const mergedUsers = mergeUsers(data.users || [], localUsers);

        data.users = mergedUsers;
        data.total_users = mergedUsers.length;
        data.messages = JSON.parse(localStorage.getItem('contactMessages')) || [];
        data.total_messages = data.messages.length;

        try {
            const challengesResponse = await fetch(`${API_URL}/admin/challenges?token=${token}`);
            if (challengesResponse.ok) {
                const challenges = await challengesResponse.json();
                data.challenges = challenges;
                data.open_challenges = challenges.filter(c => c.status === 'open').length;
            }
        } catch (error) {
            console.warn('Challenges not available', error);
            data.challenges = [];
            data.open_challenges = 0;
        }

        renderDashboard(data);
    } catch (error) {
        console.warn('Backend dashboard fetch failed, using local fallback:', error);
        const localData = getLocalDashboardData();
        renderDashboard(localData, true);
    }
}

/**
 * Merge backend users with locally stored users while avoiding duplicates.
 */
function mergeUsers(backendUsers, localUsers) {
    const userMap = new Map();
    backendUsers.forEach(user => userMap.set(user.user_id, user));
    localUsers.forEach(user => {
        if (!userMap.has(user.user_id)) {
            userMap.set(user.user_id, user);
        }
    });
    return sortByCreatedAtDesc(Array.from(userMap.values()));
}

function loadOrders(orders) {
    const tbody = document.querySelector('#ordersTable tbody');
    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No orders available</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>${order.orderId || order.order_id || 'N/A'}</td>
            <td>${order.name || order.user_name || 'N/A'}</td>
            <td>${order.service || order.service_type || 'N/A'}</td>
            <td>₦${parseInt(order.estimatedCost || order.total_price || 0, 10)}</td>
            <td><span class="status-badge status-${(order.status || 'Completed').toLowerCase()}">${order.status || 'Completed'}</span></td>
            <td><span class="status-badge status-${(order.payment_status || 'Completed').toLowerCase()}">${order.payment_status || 'Completed'}</span></td>
            <td>${order.rider_assigned || 'Not Assigned'}</td>
            <td>${new Date(order.orderDate || order.created_at || new Date().toISOString()).toLocaleDateString()}</td>
        </tr>
    `).join('');
}

function loadUsers(users) {
    const tbody = document.querySelector('#usersTable tbody');
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No users available</td></tr>';
        return;
    }

    const sortedUsers = sortByCreatedAtDesc(users);
    tbody.innerHTML = sortedUsers.map(user => `
        <tr>
            <td>${user.user_id || 'N/A'}</td>
            <td>${user.username || 'N/A'}</td>
            <td>${user.email || 'N/A'}</td>
            <td>${user.phone || 'N/A'}</td>
            <td>${user.address || 'N/A'}</td>
            <td>${new Date(user.created_at || new Date().toISOString()).toLocaleDateString()}</td>
        </tr>
    `).join('');
}

function loadPayments(payments) {
    const tbody = document.querySelector('#paymentsTable tbody');
    if (!payments || payments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No payment records available</td></tr>';
        return;
    }

    tbody.innerHTML = payments.map(payment => `
        <tr>
            <td>${payment.payment_id}</td>
            <td>${payment.order_id}</td>
            <td>₦${parseFloat(payment.amount || 0).toFixed(2)}</td>
            <td>${payment.payment_method || 'N/A'}</td>
            <td><span class="status-badge status-${(payment.status || 'Completed').toLowerCase()}">${payment.status || 'Completed'}</span></td>
            <td>${new Date(payment.created_at || new Date().toISOString()).toLocaleDateString()}</td>
        </tr>
    `).join('');
}

function loadMessages(messages) {
    const tbody = document.querySelector('#messagesTable tbody');
    if (!messages || messages.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No messages available</td></tr>';
        return;
    }

    tbody.innerHTML = sortByCreatedAtDesc(messages, 'timestamp').map(message => `
        <tr>
            <td>${message.name || 'N/A'}</td>
            <td>${message.email || 'N/A'}</td>
            <td>${message.phone || 'N/A'}</td>
            <td>${message.subject || 'N/A'}</td>
            <td>${message.message || 'N/A'}</td>
            <td>${new Date(message.timestamp || new Date().toISOString()).toLocaleString()}</td>
        </tr>
    `).join('');
}

function loadChallenges(challenges) {
    const tbody = document.querySelector('#challengesTable tbody');
    if (!challenges || challenges.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No user challenges available</td></tr>';
        return;
    }

    tbody.innerHTML = challenges.map(challenge => `
        <tr>
            <td>${challenge.challenge_id}</td>
            <td>${challenge.user_name}</td>
            <td>${challenge.user_email}</td>
            <td>${challenge.category}</td>
            <td>${challenge.subject}</td>
            <td><span class="status-badge priority-${challenge.priority}">${challenge.priority.toUpperCase()}</span></td>
            <td><span class="status-badge status-${challenge.status}">${challenge.status.replace('_', ' ').toUpperCase()}</span></td>
            <td>${new Date(challenge.created_at).toLocaleDateString()}</td>
            <td><button class="btn-view" onclick="openChallengeModal('${challenge.challenge_id}')">View & Edit</button></td>
        </tr>
    `).join('');
}

let currentChallengeId = null;

function openChallengeModal(challengeId) {
    const token = localStorage.getItem('adminSessionToken');
    fetch(`${API_URL}/admin/challenges/${challengeId}?token=${token}`)
        .then(response => response.json())
        .then(challenge => {
            currentChallengeId = challenge.challenge_id;
            document.getElementById('modalChallengeId').textContent = challenge.challenge_id;
            document.getElementById('modalUserName').textContent = challenge.user_name;
            document.getElementById('modalUserEmail').textContent = challenge.user_email;
            document.getElementById('modalSubject').textContent = challenge.subject;
            document.getElementById('modalDescription').textContent = challenge.description;
            document.getElementById('modalCategory').textContent = challenge.category.toUpperCase();
            document.getElementById('modalStatus').value = challenge.status;
            document.getElementById('modalPriority').value = challenge.priority;
            document.getElementById('modalAdminNotes').value = challenge.admin_notes || '';
            document.getElementById('challengeModal').classList.add('active');
        })
        .catch(error => {
            alert('Error loading challenge details: ' + error.message);
        });
}

function closeChallengeModal() {
    document.getElementById('challengeModal').classList.remove('active');
    currentChallengeId = null;
}

window.addEventListener('click', function(event) {
    const modal = document.getElementById('challengeModal');
    if (modal && event.target === modal) {
        modal.classList.remove('active');
        currentChallengeId = null;
    }
});

function saveChallengeChanges() {
    const token = localStorage.getItem('adminSessionToken');
    if (!currentChallengeId) {
        alert('Error: Challenge ID not found');
        return;
    }

    const status = document.getElementById('modalStatus').value;
    const priority = document.getElementById('modalPriority').value;
    const adminNotes = document.getElementById('modalAdminNotes').value;

    const updateData = {
        status,
        priority,
        admin_notes: adminNotes
    };

    fetch(`${API_URL}/admin/challenges/${currentChallengeId}?token=${token}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to update challenge');
        }
        return response.json();
    })
    .then(() => {
        alert('Challenge updated successfully!');
        closeChallengeModal();
        loadDashboard();
    })
    .catch(error => {
        alert('Error updating challenge: ' + error.message);
    });
}

function isAdminLoggedIn() {
    return localStorage.getItem('adminSessionToken') !== null;
}

function ensureAdminAccess() {
    if (!isAdminLoggedIn()) {
        window.location.href = 'admin-login.html';
        return false;
    }
    return true;
}

function deleteAdminCredentials() {
    if (!confirm('Delete your admin credentials? This will log you out and allow a new admin account to be created.')) {
        return;
    }

    const token = localStorage.getItem('adminSessionToken');
    if (!token) {
        alert('No valid session token found. Please log in again.');
        window.location.href = 'admin-login.html';
        return;
    }

    fetch(`${API_URL}/api/admin/delete?token=${token}`, {
        method: 'POST'
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => { throw new Error(data.detail || 'Failed to delete admin credentials'); });
        }
        return response.json();
    })
    .then(data => {
        alert(data.message || 'Admin credentials deleted successfully.');
        localStorage.removeItem('adminSessionToken');
        localStorage.removeItem('adminId');
        localStorage.removeItem('adminUsername');
        window.location.href = 'admin-setup.html';
    })
    .catch(error => {
        alert(error.message || 'Unable to delete admin credentials.');
    });
}

function logout() {
    const token = localStorage.getItem('adminSessionToken');
    if (token) {
        fetch(`${API_URL}/api/admin/logout?token=${token}`, {
            method: 'POST'
        }).catch(() => {});
    }
    localStorage.removeItem('adminSessionToken');
    localStorage.removeItem('adminId');
    localStorage.removeItem('adminUsername');
    window.location.href = 'admin-login.html';
}

if (ensureAdminAccess()) {
    loadDashboard();
    setInterval(loadDashboard, 30000);
}
