const API_URL = "http://127.0.0.1:8000";
        let currentUserId = localStorage.getItem("userId");
        let currentUserData = null;
        const defaultAvatarSrc = 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="120"%3E%3Crect width="120" height="120" fill="%23e2e8f0"/%3E%3Ctext x="50%25" y="55%25" font-family="Arial,sans-serif" font-size="36" fill="%236677c0" text-anchor="middle"%3E%3C/tspan%3E%3C/text%3E%3C/svg%3E';

        function getLocalUser(userId) {
            const users = JSON.parse(localStorage.getItem('users')) || [];
            return users.find(user => user.user_id === userId) || null;
        }

        function saveLocalUser(userData) {
            const users = JSON.parse(localStorage.getItem('users')) || [];
            const existingIndex = users.findIndex(user => user.user_id === userData.user_id);
            if (existingIndex > -1) {
                users[existingIndex] = userData;
            } else {
                users.push(userData);
            }
            localStorage.setItem('users', JSON.stringify(users));
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
            if (!currentUserId) {
                console.warn('No current user ID found in localStorage.');
                return;
            }

            let accountData = null;
            try {
                const accountResponse = await fetch(`${API_URL}/users/${currentUserId}`);
                if (!accountResponse.ok) {
                    throw new Error(`HTTP ${accountResponse.status}`);
                }
                accountData = await accountResponse.json();
                if (!accountData.profilePic) {
                    const localUser = getLocalUser(currentUserId);
                    if (localUser && localUser.profilePic) {
                        accountData.profilePic = localUser.profilePic;
                    }
                }
                renderAccountData(accountData);
            } catch (error) {
                console.warn('Backend account fetch failed, using local profile data if available:', error);
                accountData = getLocalUser(currentUserId);
                if (accountData) {
                    renderAccountData(accountData);
                } else {
                    console.error('No local user profile found for current user.');
                }
            }

            loadUserOrders(currentUserId);
            loadUserPayments(currentUserId);
        }

        async function loadUserOrders(userId) {
            try {
                const response = await fetch(`${API_URL}/orders`);
                const allOrders = await response.json();
                const userOrders = allOrders.filter(order => order.user_id === userId);

                if (userOrders.length === 0) {
                    document.getElementById('ordersContainer').innerHTML = '<div class="empty-state"><p>No orders yet. <a href="order.html">Place your first order!</a></p></div>';
                    return;
                }

                const ordersHTML = userOrders.map(order => `
                    <div class="order-item">
                        <div class="order-details">
                            <div class="order-id">Order #${order.order_id}</div>
                            <div class="order-service">${order.service_type}</div>
                            <div class="order-date">${new Date(order.created_at).toLocaleDateString()}</div>
                        </div>
                        <div class="order-status">
                            <div class="order-price">₦${order.total_price.toFixed(2)}</div>
                            <span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span>
                        </div>
                    </div>
                `).join('');

                document.getElementById('ordersContainer').innerHTML = ordersHTML;
            } catch (error) {
                console.error('Error loading orders:', error);
            }
        }

        async function loadUserPayments(userId) {
            try {
                const response = await fetch(`${API_URL}/payments/${userId}`);
                const payments = await response.json();

                if (payments.length === 0) {
                    document.getElementById('paymentsContainer').innerHTML = '<div class="empty-state"><p>No payment records yet.</p></div>';
                    return;
                }

                const paymentsHTML = payments.map(payment => `
                    <div class="payment-item">
                        <div class="payment-info">
                            <div class="payment-id">Payment #${payment.payment_id}</div>
                            <div class="payment-method">Method: ${payment.payment_method}</div>
                            <div class="payment-date">${new Date(payment.created_at).toLocaleDateString()}</div>
                        </div>
                        <div class="payment-amount">₦${payment.amount.toFixed(2)}</div>
                    </div>
                `).join('');

                document.getElementById('paymentsContainer').innerHTML = paymentsHTML;
            } catch (error) {
                console.error('Error loading payments:', error);
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
                        username: document.getElementById('editUsername').value.trim(),
                        email: document.getElementById('editEmail').value.trim(),
                        phone: document.getElementById('editPhone').value.trim(),
                        address: document.getElementById('editAddress').value.trim(),
                        created_at: currentUserData.created_at || new Date().toISOString()
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
                        updatedUser.profilePic = currentUserData.profilePic || null;
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
        });

        // Load account data on page load
        loadAccountData();

        // Refresh data every 30 seconds
        setInterval(loadAccountData, 30000);