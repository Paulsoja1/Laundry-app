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

function normalizeOrderStatus(status) {
    return String(status || '').trim().toLowerCase();
}

function isOrderCompleted(status) {
    const normalized = normalizeOrderStatus(status);
    return normalized === 'completed' || normalized === 'delivered';
}

function isOrderPending(status) {
    return normalizeOrderStatus(status) === 'pending';
}

function computePaymentDisplay(order) {
    if (!order) return 'Pending';
    const paymentStatus = normalizeOrderStatus(order.payment_status || order.status || '');
    const orderStatus = normalizeOrderStatus(order.status || '');
    if (paymentStatus === 'cancelled' || orderStatus === 'cleared') return 'Cancelled';
    if (isOrderCompleted(order.status) || paymentStatus === 'completed' || order.delivered_at) return 'Completed';
    return 'Pending';
}

function computeOrderPaymentFields(order, index) {
    const payment_id = order.orderId || order.order_id || `PAY-${Date.now()}-${index}`;
    const order_id = order.orderId || order.order_id || `ORD-${Date.now()}-${index}`;
    let amount = parseFloat(order.total_price || order.estimatedCost || order.estimated_cost || 0) || 0;
    let payment_method = order.payment_method || order.paymentMethod || 'Cash on Delivery';
    let status = order.payment_status || 'Completed';

    const orderStatus = normalizeOrderStatus(order.status || '');
    const wasDelivered = isOrderCompleted(order.status) || !!order.delivered_at;

    if (orderStatus === 'cleared' && !wasDelivered) {
        payment_method = 'Cancelled';
        status = 'Cancelled';
        amount = 0;
    }

    if (normalizeOrderStatus(order.payment_status) === 'cancelled') {
        payment_method = order.payment_method || 'Cancelled';
        status = 'Cancelled';
        amount = 0;
    }

    return {
        payment_id,
        order_id,
        amount,
        payment_method,
        status,
        created_at: order.delivered_at || order.orderDate || order.created_at || new Date().toISOString()
    };
}

// Riders management (stored in localStorage under 'riders')
function getRiders() {
    try {
        return JSON.parse(localStorage.getItem('riders')) || [];
    } catch (e) {
        return [];
    }
}

function saveRiders(riders) {
    localStorage.setItem('riders', JSON.stringify(riders || []));
}

function ensureDefaultRiders() {
    const existing = getRiders();
    const johnExists = existing && existing.some(r => r.name === 'John Alu');
    if (!existing || existing.length === 0) {
        const defaults = [
            { name: 'John Alu', available: true, status: 'available', current_order: null, last_location: '', last_update: null },
            { name: 'Rider B', available: true, status: 'available', current_order: null, last_location: '', last_update: null },
            { name: 'Rider C', available: true, status: 'available', current_order: null, last_location: '', last_update: null }
        ];
        saveRiders(defaults);
    } else if (!johnExists) {
        existing.push({ name: 'John Alu', available: true, status: 'available', current_order: null, last_location: '', last_update: null });
        saveRiders(existing);
    }
}

function toggleRidersPanel() {
    const panel = document.getElementById('ridersPanel');
    if (!panel) return;
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    renderRidersList();
}

function renderRidersList() {
    const list = document.getElementById('ridersList');
    if (!list) return;
    const riders = getRiders();
    if (!riders || riders.length === 0) {
        list.innerHTML = '<li>No riders available</li>';
        return;
    }
    list.innerHTML = riders.map(r => `
        <li style="display:flex;align-items:center;gap:0.5rem;">
            <strong style="min-width:120px;">${escapeHtml(r.name)}</strong>
            <span style="font-size:0.9rem;color:#666;">${r.status || (r.available ? 'available' : 'busy')}</span>
            <label style="font-size:0.9rem;">Available: <input type="checkbox" onchange="toggleRiderAvailability('${encodeURIComponent(r.name)}', this.checked)" ${r.available ? 'checked' : ''}></label>
            <button onclick="removeRider('${encodeURIComponent(r.name)}')">Remove</button>
            <button onclick="updateRiderLocationPrompt('${encodeURIComponent(r.name)}')">Update Location</button>
            <button onclick="trackRider('${encodeURIComponent(r.name)}')">Track</button>
        </li>
    `).join('');
    renderLiveRiders();
}

function addRider(name) {
    if (!name) return;
    const riders = getRiders();
    if (riders.find(r => r.name === name)) return;
    riders.push({ name, available: true });
    saveRiders(riders);
    renderRidersList();
    renderLiveRiders();
}

function removeRider(encodedName) {
    const name = decodeURIComponent(encodedName);
    let riders = getRiders();
    riders = riders.filter(r => r.name !== name);
    saveRiders(riders);
    renderRidersList();
    renderLiveRiders();
}

function toggleRiderAvailability(encodedName, isAvailable) {
    const name = decodeURIComponent(encodedName);
    const riders = getRiders();
    const idx = riders.findIndex(r => r.name === name);
    if (idx === -1) return;
    riders[idx].available = !!isAvailable;
    saveRiders(riders);
    renderRidersList();
    renderLiveRiders();
}

function updateRiderLocationPrompt(encodedName) {
    const name = decodeURIComponent(encodedName);
    const loc = prompt(`Enter location for ${name} (e.g. 'Ikeja, Lagos'):`);
    if (loc !== null) {
        updateRiderLocation(name, loc.trim());
    }
}

function updateRiderLocation(name, location) {
    if (!name) return;
    const riders = getRiders();
    const r = riders.find(x => x.name === name);
    if (!r) return;
    r.last_location = location || '';
    r.last_update = new Date().toISOString();
    // if location update implies rider is en route, set status
    if (r.current_order) r.status = 'en_route';
    saveRiders(riders);
    renderRidersList();
    renderLiveRiders();
}

function trackRider(encodedName) {
    const name = decodeURIComponent(encodedName);
    const riders = getRiders();
    const r = riders.find(x => x.name === name);
    if (!r) {
        alert('Rider not found');
        return;
    }
    const info = `Rider: ${r.name}\nStatus: ${r.status || (r.available ? 'available' : 'busy')}\nCurrent order: ${r.current_order || 'None'}\nLast location: ${r.last_location || 'Unknown'}\nLast update: ${r.last_update || 'Never'}`;
    alert(info);
}

function renderLiveRiders() {
    const container = document.getElementById('availableRidersContainer');
    if (!container) return;
    const riders = getRiders();
    if (!riders || riders.length === 0) {
        container.innerHTML = '<div class="rider-card"><strong>No riders available</strong></div>';
        return;
    }

    const sortedRiders = [...riders].sort((a, b) => {
        if (a.available === b.available) return 0;
        return a.available ? -1 : 1;
    });

    container.innerHTML = sortedRiders.map(r => {
        const statusText = r.available ? 'Available' : (r.status ? r.status.replace('_', ' ') : 'Busy');
        const vehicleType = r.vehicle ? r.vehicle : 'Bike rider';
        const currentOrder = r.current_order ? `Order ${escapeHtml(String(r.current_order))}` : 'Ready for assignment';
        return `
            <div class="rider-card ${r.available ? 'available' : 'busy'}">
                <div class="rider-card-header">
                    <strong>${escapeHtml(r.name)}</strong>
                    <span class="rider-card-status">${escapeHtml(statusText)}</span>
                </div>
                <div class="rider-card-body">
                    <p><strong>${escapeHtml(vehicleType)}</strong></p>
                    <p>${escapeHtml(r.last_location || 'No location available')}</p>
                    <p>${currentOrder}</p>
                    <p>${r.last_update ? 'Updated ' + new Date(r.last_update).toLocaleString() : 'No recent update'}</p>
                </div>
                <div class="rider-card-actions">
                    ${r.available ? `<button class="btn-rider" onclick="sendRiderForOrder('${encodeURIComponent(r.name)}')">Assign to Pickup</button>` : ''}
                    ${(!r.available && r.current_order) ? `<button class="btn-rider btn-rider-danger" onclick="dropPackageForRider('${encodeURIComponent(r.name)}')">Drop Package</button>` : ''}
                    <button class="btn-rider-secondary" onclick="trackRider('${encodeURIComponent(r.name)}')">Track</button>
                </div>
            </div>
        `;
    }).join('');
}

function sendRiderForOrder(encodedName) {
    const name = decodeURIComponent(encodedName);
    const riders = getRiders();
    const r = riders.find(x => x.name === name);
    if (!r) return alert('Rider not found');

    // collect pending orders
    let orders = JSON.parse(localStorage.getItem('orders')) || [];
    const pending = orders.filter(o => (o.status || '').toLowerCase() === 'pending');
    if (!pending || pending.length === 0) return alert('No pending orders to assign');
    // build selection list (index, id, customer, amount)
    const list = pending.map((o, i) => {
        const id = o.order_id || o.orderId || '';
        const customer = o.customer_name || o.name || o.username || 'Customer';
        const total = o.total_price || o.estimatedCost || o.estimated_cost || '';
        return `${i+1}) ${id} — ${customer}${total ? ' (₦' + total + ')' : ''}`;
    }).join('\n');

    const choice = prompt(`Select order to send ${name} for pickup (enter list number or order id):\n\n${list}`);
    if (!choice) return;

    let order = null;
    const trimmed = choice.trim();
    const numeric = parseInt(trimmed, 10);
    if (!isNaN(numeric) && numeric >= 1 && numeric <= pending.length) {
        order = pending[numeric - 1];
    } else {
        order = pending.find(o => {
            const id = String(o.order_id || o.orderId || '');
            if (id && id === trimmed) return true;
            const cust = (o.customer_name || o.name || '').toLowerCase();
            if (cust && cust === trimmed.toLowerCase()) return true;
            return false;
        });
    }

    if (!order) return alert('Invalid selection');

    const orderId = order.order_id || order.orderId;

    // assign and dispatch
    assignRider(orderId, name);
    sendRiderToPickup(orderId);

    // update rider last_location placeholder and eta
    const ridersAfter = getRiders();
    const target = ridersAfter.find(x => x.name === name);
    if (target) {
        target.last_location = target.last_location || 'Route to pickup';
        target.last_update = new Date().toISOString();
        target.available = false;
        target.status = 'en_route';
        target.current_order = orderId;
        saveRiders(ridersAfter);
    }

    loadDashboard();
    alert(`${name} sent for order ${orderId}`);
}

// Build rider options for a given order. Shows available riders and preserves assigned rider selection.
function buildRiderOptions(order) {
    const assigned = order.rider_assigned || order.rider || '';
    const riders = getRiders();
    let opts = `<option value="">(Unassign)</option>`;
    riders.forEach(r => {
        // Use status to show availability
        if (r.name === assigned) {
            opts += `<option value="${escapeHtml(r.name)}" selected>${escapeHtml(r.name)}${r.status === 'available' ? '' : ' (' + r.status + ')'} </option>`;
        } else if (r.status === 'available') {
            opts += `<option value="${escapeHtml(r.name)}">${escapeHtml(r.name)}</option>`;
        } else {
            // show busy/en_route riders but disabled
            opts += `<option value="${escapeHtml(r.name)}" disabled>${escapeHtml(r.name)} (${r.status})</option>`;
        }
    });
    return opts;
}

// Map integration: Leaflet fallback + optional Google Maps
let adminMap = null;
let adminMapLib = null; // 'leaflet' or 'google'
let riderMarkers = [];

function initMapIntegration() {
    const key = localStorage.getItem('googleMapsApiKey');
    const useGoogle = !!key;
    document.getElementById('mapToggleLeaflet')?.addEventListener('click', () => {
        loadLeaflet().then(() => renderRiderMarkers()).catch(()=>{});
    });
    document.getElementById('mapCenterAvailable')?.addEventListener('click', () => {
        centerMapOnAvailable();
    });

    if (useGoogle) {
        loadGoogleMaps(key).then(() => renderRiderMarkers()).catch(err => {
            console.warn('Google Maps failed, falling back to Leaflet', err);
            loadLeaflet().then(() => renderRiderMarkers()).catch(()=>{});
        });
    } else {
        loadLeaflet().then(() => renderRiderMarkers()).catch(()=>{});
    }
}

function loadLeaflet() {
    return new Promise((resolve, reject) => {
        if (adminMapLib === 'leaflet' && adminMap) return resolve();
        adminMapLib = 'leaflet';
        if (!document.querySelector('link[data-lf]')) {
            const lnk = document.createElement('link');
            lnk.rel = 'stylesheet';
            lnk.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            lnk.setAttribute('data-lf','1');
            document.head.appendChild(lnk);
        }
        if (!window.L) {
            const s = document.createElement('script');
            s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            s.onload = () => setTimeout(initLeafletMap, 50);
            s.onerror = reject;
            document.head.appendChild(s);
        } else {
            initLeafletMap();
        }

        function initLeafletMap() {
            try {
                if (adminMap && adminMapLib === 'leaflet') return resolve();
                const mapDiv = document.getElementById('map');
                adminMap = L.map(mapDiv).setView([6.5244, 3.3792], 12);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(adminMap);
                resolve();
            } catch (e) { reject(e); }
        }
    });
}

function loadGoogleMaps(key) {
    return new Promise((resolve, reject) => {
        if (!key) return reject(new Error('No API key'));
        if (adminMapLib === 'google' && adminMap) return resolve();
        adminMapLib = 'google';
        window.initAdminGoogleMaps = function() {
            try {
                const mapDiv = document.getElementById('map');
                adminMap = new google.maps.Map(mapDiv, { center: { lat:6.5244, lng:3.3792 }, zoom: 12});
                resolve();
            } catch (e) { reject(e); }
        };
        const existing = document.querySelector('script[data-gm]');
        if (existing) return; // let callback run
        const s = document.createElement('script');
        s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=initAdminGoogleMaps`;
        s.async = true; s.defer = true; s.setAttribute('data-gm','1');
        s.onerror = () => reject(new Error('Failed to load Google Maps'));
        document.head.appendChild(s);
    });
}

async function renderRiderMarkers() {
    try {
        if (adminMapLib === 'leaflet' && window.L) {
            riderMarkers.forEach(m => m.remove && m.remove());
        } else if (adminMapLib === 'google' && window.google) {
            riderMarkers.forEach(m => m.setMap && m.setMap(null));
        }
    } catch (e) {}
    riderMarkers = [];

    const riders = getRiders();
    if (!riders || riders.length === 0) return;

    for (const r of riders) {
        // apply map filter: only show available bike riders when checked
        const bikeFilter = document.getElementById('mapFilterAvailableBike')?.checked;
        if (bikeFilter) {
            if (!r.available) continue;
            const vehicle = (r.vehicle || '').toLowerCase();
            if (!vehicle || vehicle.indexOf('bike') === -1) continue;
        }

        if (!r.last_lat || !r.last_lng) {
            if (r.last_location) {
                try {
                    const coords = await geocodeLocation(r.last_location);
                    if (coords) {
                        r.last_lat = coords.lat; r.last_lng = coords.lon;
                        r.last_update = r.last_update || new Date().toISOString();
                        saveRiders(getRiders());
                    }
                } catch (e) { }
            }
        }

        if (r.last_lat && r.last_lng) {
            const lat = parseFloat(r.last_lat); const lng = parseFloat(r.last_lng);
            const vehicleInfo = r.vehicle ? `Vehicle: ${escapeHtml(r.vehicle)}` : 'Bike rider';
            const statusText = r.available ? 'available' : (r.status || 'busy');
            if (adminMapLib === 'leaflet' && window.L) {
                const marker = L.marker([lat, lng], { draggable: true }).addTo(adminMap);
                marker._riderName = r.name;
                marker.bindPopup(`<strong>${escapeHtml(r.name)}</strong><br>${escapeHtml(r.last_location || '')}<br>${vehicleInfo}<br>Status: ${escapeHtml(statusText)}<br><button onclick="sendRiderFromMarker('${encodeURIComponent(r.name)}')">Assign to Pickup</button><button onclick="saveRiderMarkerLocation('${encodeURIComponent(r.name)}')" style="margin-left:0.5rem;">Save Location</button><br><small>Drag marker to change location, then Save Location.</small>`);
                marker.on('dragend', function(event) {
                    const pos = event.target.getLatLng();
                    marker._pendingLat = pos.lat;
                    marker._pendingLng = pos.lng;
                });
                riderMarkers.push(marker);
            } else if (adminMapLib === 'google' && window.google) {
                const iconUrl = r.available ? 'http://maps.google.com/mapfiles/ms/icons/green-dot.png' : 'http://maps.google.com/mapfiles/ms/icons/grey-dot.png';
                const marker = new google.maps.Marker({ position:{lat,lng}, map:adminMap, title: r.name, icon: iconUrl, draggable: true });
                marker._riderName = r.name;
                const infoWindow = new google.maps.InfoWindow({ content:`<strong>${escapeHtml(r.name)}</strong><br>${escapeHtml(r.last_location || '')}<br>${vehicleInfo}<br>Status: ${escapeHtml(statusText)}<br><button onclick="sendRiderFromMarker('${encodeURIComponent(r.name)}')">Assign to Pickup</button><button onclick="saveRiderMarkerLocation('${encodeURIComponent(r.name)}')" style="margin-left:0.5rem;">Save Location</button><br><small>Drag marker to change location, then Save Location.</small>` });
                marker.addListener('click', () => infoWindow.open(adminMap, marker));
                marker.addListener('dragend', function(event) {
                    const position = event.latLng;
                    marker._pendingLat = position.lat();
                    marker._pendingLng = position.lng();
                });
                riderMarkers.push(marker);
            }
        }
    }
}

function centerMapOnAvailable() {
    const riders = getRiders().filter(r => r.available && r.last_lat && r.last_lng);
    if (!riders || riders.length === 0) return alert('No available riders with known locations');
    const lats = riders.map(r => parseFloat(r.last_lat));
    const lngs = riders.map(r => parseFloat(r.last_lng));
    const avgLat = lats.reduce((a,b)=>a+b,0)/lats.length;
    const avgLng = lngs.reduce((a,b)=>a+b,0)/lngs.length;
    if (adminMapLib === 'leaflet' && window.L) {
        adminMap.setView([avgLat, avgLng], 13);
    } else if (adminMapLib === 'google' && window.google) {
        adminMap.setCenter({lat:avgLat,lng:avgLng}); adminMap.setZoom(13);
    }
}

async function geocodeLocation(location) {
    if (!location) return null;
    const q = encodeURIComponent(location);
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || data.length === 0) return null;
        return { lat: data[0].lat, lon: data[0].lon };
    } catch (e) { return null; }
}

async function reverseGeocode(lat, lng) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data.display_name || null;
    } catch (e) {
        return null;
    }
}

async function updateRiderCoordinates(name, lat, lng) {
    const riders = getRiders();
    const rider = riders.find(r => r.name === name);
    if (!rider) return;
    rider.last_lat = lat;
    rider.last_lng = lng;
    const newLocation = await reverseGeocode(lat, lng);
    if (newLocation) {
        rider.last_location = newLocation;
    }
    rider.last_update = new Date().toISOString();
    saveRiders(riders);
    renderRidersList();
    renderLiveRiders();
}

function sendRiderFromMarker(encodedName) {
    const name = decodeURIComponent(encodedName);
    const r = getRiders().find(x => x.name === name);
    if (!r) return alert('Rider not found');
    if (!r.available) return alert('Rider not available');
    sendRiderForOrder(encodeURIComponent(name));
}

async function saveRiderMarkerLocation(encodedName) {
    const name = decodeURIComponent(encodedName);
    const marker = riderMarkers.find(m => m._riderName === name);
    if (!marker) return alert('Marker not found for rider');
    let lat, lng;
    if (adminMapLib === 'leaflet' && marker._pendingLat && marker._pendingLng) {
        lat = marker._pendingLat;
        lng = marker._pendingLng;
    } else if (adminMapLib === 'google' && marker._pendingLat && marker._pendingLng) {
        lat = marker._pendingLat;
        lng = marker._pendingLng;
    } else if (adminMapLib === 'leaflet') {
        const pos = marker.getLatLng();
        lat = pos.lat;
        lng = pos.lng;
    } else if (adminMapLib === 'google') {
        const pos = marker.getPosition();
        lat = pos.lat();
        lng = pos.lng();
    }
    if (lat == null || lng == null) return alert('No new marker location to save.');
    await updateRiderCoordinates(name, lat, lng);
    alert('Location saved for ' + name);
}

function dropPackage(orderId) {
    if (!orderId) return;
    let orders = JSON.parse(localStorage.getItem('orders')) || [];
    const idx = orders.findIndex(o => String(o.order_id || o.orderId) === String(orderId));
    if (idx === -1) return;
    const assigned = orders[idx].rider_assigned || orders[idx].rider || '';
    if (!assigned) return alert('No rider assigned to this order.');
    if (!confirm('Confirm package drop and mark this order as Delivered?')) return;

    orders[idx].status = 'Delivered';
    orders[idx].delivered_at = new Date().toISOString();
    orders[idx].delivery_notes = 'Package dropped at destination';
    orders[idx].payment_status = orders[idx].payment_status || 'Completed';
    orders[idx].payment_method = orders[idx].payment_method || 'Cash on Delivery';
    orders[idx].total_price = orders[idx].total_price || parseFloat(orders[idx].estimatedCost || orders[idx].estimated_cost || 0) || 0;

    const riders = getRiders();
    const rider = riders.find(r => r.name === assigned);
    if (rider) {
        rider.available = true;
        rider.status = 'available';
        rider.current_order = null;
        rider.last_update = new Date().toISOString();
    }

    saveRiders(riders);
    localStorage.setItem('orders', JSON.stringify(orders));
    loadDashboard();
    renderRidersList();
    renderLiveRiders();
    renderRiderMarkers();
    alert('Package dropped and order marked Delivered.');
}

function dropPackageForRider(encodedName) {
    const name = decodeURIComponent(encodedName);
    const riders = getRiders();
    const rider = riders.find(r => r.name === name);
    if (!rider) return alert('Rider not found');
    if (!rider.current_order) return alert('This rider has no current order to deliver.');
    dropPackage(rider.current_order);
}

function renderOrderRow(order) {
    const orderId = order.order_id || order.orderId || '';
    const assigned = order.customer_name || order.name || order.user_name || order.username || '';
    const riderAssigned = order.rider_assigned || order.rider || '';
    const riders = getRiders();
    const riderObj = riders.find(r => r.name === riderAssigned) || null;

    const statusClass = (order.status || 'Completed').toLowerCase().replace(/\s+/g, '_');
    const sendButton = (riderAssigned && (order.status || '').toLowerCase() === 'pending')
        ? `<button onclick="sendRiderToPickup('${orderId}')" class="btn-send">Send Rider</button>`
        : '';
    const dropButton = (riderAssigned && (order.status || '').toLowerCase() === 'out for pickup')
        ? `<button onclick="dropPackage('${orderId}')" class="btn-send">Drop Package</button>`
        : '';
    const delivered = isOrderCompleted(order.status) || !!order.delivered_at;

    return `
        <tr>
            <td>${orderId || 'N/A'}</td>
            <td>${order.customer_name || order.name || order.user_name || order.username || 'N/A'}</td>
            <td>${order.service || order.service_type || 'N/A'}</td>
            <td>
            <input type="number" min="0" step="0.01" value="${parseFloat(order.total_price || order.estimatedCost || order.estimated_cost || 0).toFixed(2)}" 
                onchange="updateOrderPayment('${orderId}', this.value, null)" style="width:100px;" />
        </td>
            <td>
                <select onchange="updateOrderPayment('${orderId}', null, this.value)">
                    ${renderPaymentMethodOptions(order.payment_method || order.paymentMethod || 'Cash on Delivery')}
                </select>
            </td>
            <td><span class="status-badge status-${statusClass}">${order.status || 'Completed'}</span></td>
            <td>
                <span class="status-badge status-${computePaymentDisplay(order).toLowerCase().replace(/\s+/g,'_')}">${computePaymentDisplay(order)}</span>
            </td>
            <td>${order.rider_assigned || order.rider || 'Not Assigned'}</td>
            <td>${new Date(order.orderDate || order.created_at || new Date().toISOString()).toLocaleDateString()}</td>
            <td>
                ${delivered ? `<button class="btn-done" disabled>Done</button>` : `<button onclick="clearOrder('${orderId}')" class="btn-clear">Cancel Order</button>`}
            </td>
        </tr>
    `;
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Load fallback data from localStorage when the backend is unavailable.
 */
function getLocalContactMessages() {
    const rawMessages = localStorage.getItem('contactMessages');
    if (!rawMessages) {
        return [];
    }
    try {
        return JSON.parse(rawMessages);
    } catch (err) {
        console.warn('Failed to parse contactMessages from localStorage', err);
        return [];
    }
}

function getLocalDashboardData() {
    const orders = sortByCreatedAtDesc(JSON.parse(localStorage.getItem('orders')) || [], 'orderDate');
    const users = sortByCreatedAtDesc(JSON.parse(localStorage.getItem('users')) || []);
    const messages = sortByCreatedAtDesc(getLocalContactMessages(), 'timestamp');
    const challenges = JSON.parse(localStorage.getItem('challenges')) || [];

    const payments = sortByCreatedAtDesc(orders.map((order, index) => computeOrderPaymentFields(order, index)), 'created_at');

    const totalRevenue = orders.reduce((sum, order) => {
        const isDelivered = isOrderCompleted(order.status);
        const amount = isDelivered ? parseFloat(order.total_price || order.estimatedCost || order.estimated_cost || 0) : 0;
        return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    return {
        total_users: users.length,
        total_orders: orders.length,
        total_revenue: totalRevenue,
        pending_orders: orders.filter(order => isOrderPending(order.status)).length,
        completed_orders: orders.filter(order => isOrderCompleted(order.status)).length,
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
    renderRidersList();
    renderLiveRiders();
    renderRiderMarkers();
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
        const localOrders = JSON.parse(localStorage.getItem('orders')) || [];
        const mergedUsers = mergeUsers(data.users || [], localUsers);
        const mergedOrders = mergeOrders(data.orders || [], localOrders);

        data.users = mergedUsers;
        data.orders = mergedOrders;
        data.total_users = mergedUsers.length;
        data.total_orders = mergedOrders.length;
        data.pending_orders = mergedOrders.filter(order => isOrderPending(order.status)).length;
        data.completed_orders = mergedOrders.filter(order => isOrderCompleted(order.status)).length;
        data.total_revenue = mergedOrders.reduce((sum, order) => {
            const isDelivered = isOrderCompleted(order.status);
            const amount = isDelivered ? parseFloat(order.total_price || order.estimatedCost || order.estimated_cost || 0) : 0;
            return sum + (isNaN(amount) ? 0 : amount);
        }, 0);
        data.messages = getLocalContactMessages();
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

function mergeOrders(backendOrders, localOrders) {
    const orderMap = new Map();
    const addOrder = (order, override = false) => {
        const id = String(order.order_id || order.orderId || '').trim();
        if (!id) return;
        if (!orderMap.has(id) || override) {
            orderMap.set(id, order);
        }
    };
    (backendOrders || []).forEach(order => addOrder(order, false));
    (localOrders || []).forEach(order => addOrder(order, true));
    return sortByCreatedAtDesc(Array.from(orderMap.values()), 'orderDate');
}

function loadOrders(orders) {
    const tbody = document.querySelector('#ordersTable tbody');
    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No orders available</td></tr>';
        return;
    }
    tbody.innerHTML = orders.map(order => renderOrderRow(order)).join('');
}

function assignRider(orderId, riderName) {
    if (!orderId) return;
    let orders = JSON.parse(localStorage.getItem('orders')) || [];
    const idx = orders.findIndex(o => String(o.order_id || o.orderId) === String(orderId));
    if (idx === -1) return;

    const prev = orders[idx].rider_assigned || orders[idx].rider || '';
    const selected = riderName || '';

    // update riders availability
    const riders = getRiders();
    if (prev) {
        const prevR = riders.find(r => r.name === prev);
        if (prevR) prevR.available = true;
    }
    if (selected) {
        const newR = riders.find(r => r.name === selected);
        if (newR) newR.available = false;
        orders[idx].rider_assigned = selected;
    } else {
        orders[idx].rider_assigned = '';
    }

    saveRiders(riders);
    localStorage.setItem('orders', JSON.stringify(orders));
    loadDashboard();
}

function sendRiderToPickup(orderId) {
    if (!orderId) return;
    const orders = JSON.parse(localStorage.getItem('orders')) || [];
    const idx = orders.findIndex(o => String(o.order_id || o.orderId) === String(orderId));
    if (idx === -1) return;

    const riderName = orders[idx].rider_assigned || orders[idx].rider || '';
    if (!riderName) {
        alert('No rider assigned to this order. Assign a rider first.');
        return;
    }

    // mark order as out for pickup and update rider status
    orders[idx].status = 'Out for Pickup';
    orders[idx].pickup_dispatched_at = new Date().toISOString();

    let riders = getRiders();
    const r = riders.find(x => x.name === riderName);
    if (r) {
        r.status = 'en_route';
        r.available = false;
        r.current_order = orderId;
        r.last_update = new Date().toISOString();
    }

    saveRiders(riders);
    localStorage.setItem('orders', JSON.stringify(orders));
    loadDashboard();
}

function clearOrder(orderId) {
    if (!orderId) return;
    if (!confirm('Clear this order? It will be removed from Pending but kept in the overview.')) return;
    let orders = JSON.parse(localStorage.getItem('orders')) || [];
    const idx = orders.findIndex(o => (o.order_id || o.orderId) === orderId);
    if (idx === -1) return;

    // Mark the order as cleared/archived instead of deleting it so it remains in the overview
    const assigned = orders[idx].rider_assigned || orders[idx].rider || '';
    if (assigned) {
        const riders = getRiders();
        const r = riders.find(x => x.name === assigned);
        if (r) {
            r.available = true;
            saveRiders(riders);
        }
    }

    const wasDelivered = isOrderCompleted(orders[idx].status);
    orders[idx].status = 'Cleared';
    orders[idx].cleared_at = new Date().toISOString();
    orders[idx].cleared_by = localStorage.getItem('adminUsername') || 'admin';

    if (!wasDelivered) {
        orders[idx].payment_method = 'Cancelled';
        orders[idx].payment_status = 'Cancelled';
        orders[idx].total_price = 0;
        orders[idx].estimatedCost = 0;
        orders[idx].cancelled_at = new Date().toISOString();
    }

    localStorage.setItem('orders', JSON.stringify(orders));
    loadDashboard();
}

function updateOrderPayment(orderId, amount, method) {
    if (!orderId) return;
    const orders = JSON.parse(localStorage.getItem('orders')) || [];
    const idx = orders.findIndex(o => String(o.order_id || o.orderId) === String(orderId));
    if (idx === -1) return;

    if (amount != null) {
        const sanitized = parseFloat(String(amount).replace(/[^0-9.-]+/g, ''));
        if (!isNaN(sanitized)) {
            orders[idx].total_price = sanitized;
            orders[idx].estimatedCost = sanitized;
        }
    }

    if (method != null) {
        orders[idx].payment_method = method || 'Cash on Delivery';
    }

    localStorage.setItem('orders', JSON.stringify(orders));
    loadDashboard();
}

function updateOrderPaymentStatus(orderId, paymentStatus) {
    if (!orderId) return;
    const orders = JSON.parse(localStorage.getItem('orders')) || [];
    const idx = orders.findIndex(o => String(o.order_id || o.orderId) === String(orderId));
    if (idx === -1) return;

    orders[idx].payment_status = paymentStatus || 'Completed';
    localStorage.setItem('orders', JSON.stringify(orders));
    loadDashboard();
}

function renderPaymentMethodOptions(selectedMethod) {
    const methods = [
        'Cash on Delivery',
        'POS',
        'Bank Transfer',
        'Paystack',
        'Flutterwave',
        'Opay',
        'Mobile Money',
        'Cancelled'
    ];
    return methods.map(method => `
        <option value="${escapeHtml(method)}" ${method === selectedMethod ? 'selected' : ''}>${escapeHtml(method)}</option>
    `).join('');
}

function renderPaymentStatusOptions(selectedStatus) {
    const statuses = [
        'Completed',
        'Pending',
        'Failed',
        'Refunded',
        'Authorized',
        'Cancelled'
    ];
    return statuses.map(status => `
        <option value="${escapeHtml(status)}" ${status === selectedStatus ? 'selected' : ''}>${escapeHtml(status)}</option>
    `).join('');
}

function clearAllOrders() {
    if (!confirm('Clear ALL orders? This will remove all local orders.')) return;
    localStorage.removeItem('orders');
    loadDashboard();
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

    const deleteLocalAdmin = () => {
        localStorage.removeItem('localAdmin');
        localStorage.removeItem('adminSessionToken');
        localStorage.removeItem('adminId');
        localStorage.removeItem('adminUsername');
        alert('Local admin credentials deleted successfully.');
        window.location.href = 'admin-setup.html';
    };

    if (token.startsWith('local-')) {
        deleteLocalAdmin();
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
        console.warn('Remote admin delete failed, removing local admin if present', error);
        if (localStorage.getItem('localAdmin')) {
            deleteLocalAdmin();
            return;
        }
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
    // ensure riders exist and bind riders UI
    ensureDefaultRiders();
    const addRiderForm = document.getElementById('addRiderForm');
    if (addRiderForm) {
        addRiderForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const input = document.getElementById('newRiderName');
            if (!input) return;
            const name = input.value.trim();
            if (!name) return;
            addRider(name);
            input.value = '';
        });
    }

    renderRidersList();
    initMapIntegration();
    loadDashboard();
    setInterval(loadDashboard, 30000);
    window.addEventListener('storage', function(event) {
        if (!event.key) return;
        if (event.key === 'orders' || event.key === 'users') {
            console.log('Detected external storage update for', event.key, 'refreshing dashboard');
            loadDashboard();
        }
    });
}
