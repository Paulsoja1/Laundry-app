const API_URL = "http://127.0.0.1:8000";
        let currentUserId = null;
        let currentUserData = null;
        const defaultAvatarSrc = 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="120"%3E%3Crect width="120" height="120" fill="%23e2e8f0"/%3E%3Ctext x="50%25" y="55%25" font-family="Arial,sans-serif" font-size="36" fill="%236677c0" text-anchor="middle"%3E%3C/tspan%3E%3C/text%3E%3C/svg%3E';

        function getLocalUser(userId) {
            const users = JSON.parse(localStorage.getItem('users')) || [];
            return users.find(user => String(user.user_id || user.userId) === String(userId)) || null;
        }

        function saveLocalUser(userData) {
            const users = JSON.parse(localStorage.getItem('users')) || [];
            const userId = String(userData.user_id || userData.userId || currentUserId || '');
            const normalizedUser = {
                ...userData,
                user_id: userId,
                userId,
                username: String(userData.username || userData.name || ''),
                email: String(userData.email || ''),
                phone: String(userData.phone || ''),
                address: String(userData.address || ''),
                created_at: userData.created_at || new Date().toISOString(),
                profilePic: userData.profilePic || userData.avatar || null
            };
            const existingIndex = users.findIndex(user => String(user.user_id || user.userId) === userId);
            if (existingIndex > -1) {
                users[existingIndex] = normalizedUser;
            } else {
                users.push(normalizedUser);
            }
            localStorage.setItem('users', JSON.stringify(users));
            if (normalizedUser.user_id) {
                localStorage.setItem('userId', normalizedUser.user_id);
            }
            if (normalizedUser.username) {
                localStorage.setItem('username', normalizedUser.username);
            }
        }

        function setProfileAvatar(src) {
            const avatar = document.getElementById('profileAvatar');
            if (avatar) {
                avatar.src = src || defaultAvatarSrc;
            }
        }

        function renderProfileInfo(accountData) {
            const profileHTML = `
                <div class="info-item">
                    <div class="info-label">User ID</div>
                    <div class="info-value">${accountData.user_id || 'N/A'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Username</div>
                    <div class="info-value">${accountData.username || 'N/A'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Email</div>
                    <div class="info-value">${accountData.email || 'N/A'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Phone</div>
                    <div class="info-value">${accountData.phone || 'N/A'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Address</div>
                    <div class="info-value">${accountData.address || 'N/A'}</div>
                </div>
            `;
            document.getElementById('profileInfo').innerHTML = profileHTML;
        }

        function populateEditForm(accountData) {
            document.getElementById('editUsername').value = accountData.username || '';
            document.getElementById('editEmail').value = accountData.email || '';
            document.getElementById('editPhone').value = accountData.phone || '';
            document.getElementById('editAddress').value = accountData.address || '';
            const preview = document.getElementById('editAvatarPreview');
            preview.src = accountData.profilePic ? accountData.profilePic : defaultAvatarSrc;
        }

        function renderAccountData(accountData) {
            currentUserData = accountData;
            setProfileAvatar(accountData.profilePic);
            renderProfileInfo(accountData);
            populateEditForm(accountData);

            const memberSince = document.getElementById('memberSince');
            if (memberSince) {
                const createdAt = accountData.created_at ? new Date(accountData.created_at) : null;
                memberSince.textContent = createdAt && !isNaN(createdAt) ? createdAt.getFullYear() : '-';
            }

            const totalOrders = document.getElementById('totalOrders');
            const totalSpent = document.getElementById('totalSpent');
            if (totalOrders) totalOrders.textContent = accountData.total_orders || '0';
            if (totalSpent) totalSpent.textContent = `₦${(accountData.total_spent || 0).toFixed(2)}`;
        }

        async function loadAccountData() {
            currentUserId = localStorage.getItem('userId');
            if (!currentUserId) {
                const username = localStorage.getItem('username');
                const users = JSON.parse(localStorage.getItem('users')) || [];
                const fallbackUser = users.find(user => user.username === username) || users[0] || null;
                if (fallbackUser) {
                    currentUserId = fallbackUser.user_id || fallbackUser.userId;
                    if (currentUserId) {
                        localStorage.setItem('userId', currentUserId);
                    }
                }
            }

            if (!currentUserId) {
                console.warn('No current user ID found in localStorage.');
                const profileInfo = document.getElementById('profileInfo');
                if (profileInfo) {
                    profileInfo.innerHTML = '<p>Please sign up or log in to see your account details.</p>';
                }
                return;
            }

            let accountData = null;
            const localUser = getLocalUser(currentUserId);
            try {
                const accountResponse = await fetch(`${API_URL}/users/${currentUserId}`);
                if (!accountResponse.ok) {
                    throw new Error(`HTTP ${accountResponse.status}`);
                }
                accountData = await accountResponse.json();
                if (!accountData || (!accountData.user_id && !accountData.userId && !accountData.id)) {
                    throw new Error('Backend returned invalid account data');
                }
                accountData = { ...localUser, ...accountData };
                if (!accountData.profilePic && localUser && localUser.profilePic) {
                    accountData.profilePic = localUser.profilePic;
                }
                renderAccountData(accountData);
            } catch (error) {
                console.warn('Backend account fetch failed, using local profile data if available:', error);
                accountData = localUser;
                if (accountData) {
                    renderAccountData(accountData);
                } else {
                    console.error('No local user profile found for current user.');
                }
            }

            loadUserOrders(currentUserId);
            loadUserPayments(currentUserId);
        }

        function normalizeOrder(order) {
            return {
                orderId: order.order_id || order.orderId || order.id || 'N/A',
                userId: String(order.user_id || order.userId || order.user || ''),
                service: order.service_type || order.service || (order.raw && order.raw.service) || '-',
                date: order.created_at || order.orderDate || (order.raw && order.raw.orderDate) || null,
                price: parseFloat(order.total_price ?? order.estimatedCost ?? order.price ?? 0) || 0,
                status: order.status || 'Pending',
                quantity: order.quantity || order.qty || (order.raw && order.raw.quantity) || '-',
                pickupDate: order.pickupDate || (order.raw && order.raw.pickupDate) || '-',
                deliveryDate: order.deliveryDate || (order.raw && order.raw.deliveryDate) || '-',
                instructions: order.instructions || (order.raw && order.raw.instructions) || '',
                address: order.address || (order.raw && order.raw.address) || ''
            };
        }

        function updateOrderStats(count, total) {
            const totalOrdersEl = document.getElementById('totalOrders');
            const totalSpentEl = document.getElementById('totalSpent');
            if (totalOrdersEl) totalOrdersEl.textContent = String(count);
            if (totalSpentEl) totalSpentEl.textContent = `₦${total.toFixed(2)}`;
        }

        function renderOrderList(userOrders) {
            const ordersContainer = document.getElementById('ordersContainer');
            if (!ordersContainer) return;

            if (!userOrders || userOrders.length === 0) {
                ordersContainer.innerHTML = '<div class="empty-state"><p>No orders yet. <a href="order.html">Place your first order!</a></p></div>';
                updateOrderStats(0, 0);
                return;
            }

            let totalSpent = 0;
            const ordersHTML = userOrders.map(rawOrder => {
                const order = normalizeOrder(rawOrder);
                totalSpent += order.price;
                const statusClass = order.status.replace(/\s+/g, '-').toLowerCase();
                return `
                    <div class="order-item">
                        <div class="order-details">
                            <div class="order-id">Order #${order.orderId}</div>
                            <div class="order-service">${order.service}</div>
                            <div class="order-meta">Quantity: ${order.quantity} · Pickup: ${order.pickupDate} · Delivery: ${order.deliveryDate}</div>
                            ${order.instructions ? `<div class="order-notes">Notes: ${order.instructions}</div>` : ''}
                            ${order.address ? `<div class="order-address">Address: ${order.address}</div>` : ''}
                            <div class="order-date">${order.date ? new Date(order.date).toLocaleDateString() : '-'}</div>
                        </div>
                        <div class="order-status">
                            <div class="order-price">₦${order.price.toFixed(2)}</div>
                            <span class="status-badge status-${statusClass}">${order.status}</span>
                        </div>
                    </div>
                `;
            }).join('');

            ordersContainer.innerHTML = ordersHTML;
            updateOrderStats(userOrders.length, totalSpent);
        }

        async function loadUserOrders(userId) {
            const localOrders = JSON.parse(localStorage.getItem('orders')) || [];
            let localUserOrders = localOrders.filter(order => String(order.user_id || order.userId || order.user || '') === String(userId));

            if (localUserOrders.length === 0 && currentUserData) {
                const userEmail = currentUserData.email;
                const userPhone = currentUserData.phone;
                const fallbackOrders = localOrders.filter(order => {
                    const orderEmail = order.customer_email || order.email || (order.raw && order.raw.email);
                    const orderPhone = order.customer_phone || order.phone || (order.raw && order.raw.phone);
                    const matchEmail = userEmail && orderEmail && String(orderEmail).trim().toLowerCase() === String(userEmail).trim().toLowerCase();
                    const matchPhone = userPhone && orderPhone && String(orderPhone).trim() === String(userPhone).trim();
                    return (order.user_id == null && order.userId == null && order.user == null) && (matchEmail || matchPhone);
                });
                localUserOrders = localUserOrders.concat(fallbackOrders);
            }

            console.info('Account orders debug', {
                currentUserId: userId,
                currentUserData,
                localOrdersCount: localOrders.length,
                localUserOrdersCount: localUserOrders.length,
                localUserOrders
            });

            try {
                const response = await fetch(`${API_URL}/orders`);
                if (response.ok) {
                    const allOrders = await response.json();
                    const backendOrders = (Array.isArray(allOrders) ? allOrders : []).filter(order => String(order.user_id || order.userId || order.user || '') === String(userId));
                    console.info('Backend orders debug', { backendOrdersCount: backendOrders.length, backendOrders });
                    const mergedOrders = [...backendOrders, ...localUserOrders];
                    const uniqueOrdersMap = new Map();
                    mergedOrders.forEach(order => {
                        const key = String(order.order_id || order.orderId || order.id || JSON.stringify(order));
                        if (!uniqueOrdersMap.has(key)) {
                            uniqueOrdersMap.set(key, order);
                        }
                    });
                    const userOrders = Array.from(uniqueOrdersMap.values());
                    renderOrderList(userOrders);
                    return;
                }
                throw new Error(`HTTP ${response.status}`);
            } catch (error) {
                console.error('Error loading orders from backend:', error);
                renderOrderList(localUserOrders);
            }
        }

        // Load orders from localStorage as a fallback for demo/offline modes
        function loadLocalUserOrders(userId) {
            const orders = JSON.parse(localStorage.getItem('orders')) || [];
            let userOrders = orders.filter(order => String(order.user_id || order.userId || order.user || '') === String(userId));

            if (userOrders.length === 0 && currentUserData) {
                const userEmail = currentUserData.email;
                const userPhone = currentUserData.phone;
                userOrders = orders.filter(order => {
                    const orderEmail = order.customer_email || order.email || (order.raw && order.raw.email);
                    const orderPhone = order.customer_phone || order.phone || (order.raw && order.raw.phone);
                    const matchEmail = userEmail && orderEmail && String(orderEmail).trim().toLowerCase() === String(userEmail).trim().toLowerCase();
                    const matchPhone = userPhone && orderPhone && String(orderPhone).trim() === String(userPhone).trim();
                    return (order.user_id == null && order.userId == null && order.user == null) && (matchEmail || matchPhone);
                });
            }

            renderOrderList(userOrders);
        }

        function getLocalUserPayments(userId) {
            const orders = JSON.parse(localStorage.getItem('orders')) || [];
            let userOrders = orders.filter(order => String(order.user_id || order.userId || order.user || '') === String(userId));

            if (userOrders.length === 0 && currentUserData) {
                const userEmail = currentUserData.email;
                const userPhone = currentUserData.phone;
                userOrders = orders.filter(order => {
                    const orderEmail = order.customer_email || order.email || (order.raw && order.raw.email);
                    const orderPhone = order.customer_phone || order.phone || (order.raw && order.raw.phone);
                    const matchEmail = userEmail && orderEmail && String(orderEmail).trim().toLowerCase() === String(userEmail).trim().toLowerCase();
                    const matchPhone = userPhone && orderPhone && String(orderPhone).trim() === String(userPhone).trim();
                    return (order.user_id == null && order.userId == null && order.user == null) && (matchEmail || matchPhone);
                });
            }

            const deliveredOrders = userOrders.filter(order => {
                const status = String(order.status || '').trim().toLowerCase();
                return status === 'delivered' || status === 'completed';
            });

            return deliveredOrders.map((order, index) => ({
                payment_id: order.payment_id || order.order_id || order.orderId || `PAY-${Date.now()}-${index}`,
                order_id: order.order_id || order.orderId || `ORD-${Date.now()}-${index}`,
                amount: parseFloat(order.total_price || order.estimatedCost || order.estimated_cost || order.price || 0) || 0,
                payment_method: order.payment_method || order.paymentMethod || 'Cash on Delivery',
                status: order.payment_status || order.status || 'Completed',
                created_at: order.delivered_at || order.created_at || order.orderDate || new Date().toISOString()
            }));
        }

        function updatePaymentCount(count) {
            const countEl = document.getElementById('paymentCount');
            if (countEl) {
                countEl.textContent = `(${count})`;
            }
        }

        function renderPayments(payments) {
            const paymentsContainer = document.getElementById('paymentsContainer');
            if (!paymentsContainer) return;

            if (!payments || payments.length === 0) {
                paymentsContainer.innerHTML = '<div class="empty-state"><p>No payment records yet.</p></div>';
                updatePaymentCount(0);
                return;
            }

            const paymentsHTML = payments.map(payment => `
                <div class="payment-item">
                    <div class="payment-info">
                        <div class="payment-id">Payment #${payment.payment_id}</div>
                        <div class="payment-method">Method: ${payment.payment_method}</div>
                        <div class="payment-date">${new Date(payment.created_at).toLocaleDateString()}</div>
                    </div>
                    <div class="payment-amount">₦${parseFloat(payment.amount || 0).toFixed(2)}</div>
                </div>
            `).join('');

            paymentsContainer.innerHTML = paymentsHTML;
            updatePaymentCount(payments.length);
        }

        async function loadUserPayments(userId) {
            const localPayments = getLocalUserPayments(userId);
            try {
                const response = await fetch(`${API_URL}/payments/${userId}`);
                if (response.ok) {
                    const payments = await response.json();
                    const combined = [...(Array.isArray(payments) ? payments : []), ...localPayments];
                    const uniquePayments = [];
                    const seen = new Set();
                    combined.forEach(payment => {
                        const key = String(payment.payment_id || payment.order_id || JSON.stringify(payment));
                        if (!seen.has(key)) {
                            seen.add(key);
                            uniquePayments.push(payment);
                        }
                    });
                    renderPayments(uniquePayments);
                    return;
                }
                throw new Error(`HTTP ${response.status}`);
            } catch (error) {
                console.error('Error loading payments:', error);
                renderPayments(localPayments);
            }
        }

        function editProfile() {
            const viewSection = document.getElementById('viewProfileSection');
            const editForm = document.getElementById('editProfileForm');
            if (viewSection && editForm) {
                viewSection.style.display = 'none';
                editForm.style.display = 'block';
            }
        }

        function cancelEditProfile() {
            const viewSection = document.getElementById('viewProfileSection');
            const editForm = document.getElementById('editProfileForm');
            if (viewSection && editForm) {
                viewSection.style.display = 'block';
                editForm.style.display = 'none';
            }
        }

        function previewEditAvatar(file) {
            const preview = document.getElementById('editAvatarPreview');
            if (!preview) return;
            if (!file) {
                preview.src = currentUserData && currentUserData.profilePic ? currentUserData.profilePic : defaultAvatarSrc;
                return;
            }
            const reader = new FileReader();
            reader.onload = function(e) {
                preview.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }

        document.addEventListener('DOMContentLoaded', function() {
            const editForm = document.getElementById('editProfileForm');
            const editProfilePic = document.getElementById('editProfilePic');
            if (editForm) {
                editForm.addEventListener('submit', function(event) {
                    event.preventDefault();
                    const updatedUser = {
                        ...currentUserData,
                        user_id: currentUserId || currentUserData?.user_id,
                        username: document.getElementById('editUsername').value.trim(),
                        email: document.getElementById('editEmail').value.trim(),
                        phone: document.getElementById('editPhone').value.trim(),
                        address: document.getElementById('editAddress').value.trim(),
                        created_at: currentUserData?.created_at || new Date().toISOString()
                    };

                    const file = editProfilePic && editProfilePic.files && editProfilePic.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            updatedUser.profilePic = e.target.result;
                            saveLocalUser(updatedUser);
                            currentUserData = updatedUser;
                            renderAccountData(updatedUser);
                            cancelEditProfile();
                        };
                        reader.readAsDataURL(file);
                    } else {
                        updatedUser.profilePic = currentUserData?.profilePic || null;
                        saveLocalUser(updatedUser);
                        currentUserData = updatedUser;
                        renderAccountData(updatedUser);
                        cancelEditProfile();
                    }
                });
            }

            if (editProfilePic) {
                editProfilePic.addEventListener('change', function(event) {
                    const file = event.target.files[0];
                    previewEditAvatar(file);
                });
            }

            window.addEventListener('storage', function(event) {
                if (!event.key) return;
                if (event.key === 'orders' || event.key === 'users') {
                    console.log('Detected localStorage change in account page:', event.key);
                    loadAccountData();
                }
            });
        });

        // Load account data on page load
        loadAccountData();

        // Refresh data every 30 seconds
        setInterval(loadAccountData, 30000);