// script.js - Client-side interactivity for CleanPress
// Responsibilities:
// - Toggle responsive navigation (hamburger)
// - Calculate estimated pricing for orders
// - Keep order summary up to date
// - Handle order submission and local persistence
// - Show/close registration modal and save users locally

// Hamburger Menu Toggle
// Initializes the hamburger menu for small screens and closes
// the mobile menu when a navigation link is clicked.
function initHamburgerMenu() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');

    if (!hamburger || !navMenu) return;

    // Ensure accessibility attributes exist
    if (!hamburger.hasAttribute('role')) hamburger.setAttribute('role', 'button');
    if (!hamburger.hasAttribute('tabindex')) hamburger.setAttribute('tabindex', '0');
    hamburger.setAttribute('aria-controls', 'navMenu');
    hamburger.setAttribute('aria-expanded', 'false');
    navMenu.setAttribute('aria-hidden', 'true');

    // Toggle function (used by click and keyboard activation)
    function openMenu() {
        hamburger.classList.add('active');
        navMenu.classList.add('active');
        hamburger.setAttribute('aria-expanded', 'true');
        navMenu.setAttribute('aria-hidden', 'false');
        setTimeout(() => {
            navMenu.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
    }

    function closeMenu() {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
        navMenu.setAttribute('aria-hidden', 'true');
    }

    function toggleMenu() {
        if (hamburger.classList.contains('active')) closeMenu();
        else openMenu();
    }

    // Click toggles menu
    hamburger.addEventListener('click', toggleMenu);

    // Keyboard: Enter/Space open/close, Escape closes
    hamburger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleMenu();
        } else if (e.key === 'Escape') {
            closeMenu();
        }
    });

    // Close menu when a nav link is clicked
    const navLinks = navMenu.querySelectorAll('a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            closeMenu();
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!navMenu.contains(e.target) && !hamburger.contains(e.target) && navMenu.classList.contains('active')) {
            closeMenu();
        }
    });

    // Global Escape key closes menu (for convenience)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navMenu.classList.contains('active')) {
            closeMenu();
        }
    });
}

// Pricing data (base unit prices for services)
// Values are in Naira (displayed with ₦ in the UI).
const prices = {
    'wash-fold': 2,
    'dry-clean': 5,
    'express': 4,
    'special-care': 6,
    'bedding': 8,
    'baby-care': 3
};

const serviceNames = {
    'wash-fold': 'Wash & Fold',
    'dry-clean': 'Dry Cleaning',
    'express': 'Express Service',
    'special-care': 'Special Care',
    'bedding': 'Bedding & Linens',
    'baby-care': 'Baby Care'
};

// Initialize date picker (set minimum selectable date to today)
// Ensures users cannot select past pickup/delivery dates.
function initializeDatePicker() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const minDate = `${year}-${month}-${day}`;

    const pickupDateInput = document.getElementById('pickupDate');
    const deliveryDateInput = document.getElementById('deliveryDate');

    if (pickupDateInput) {
        pickupDateInput.setAttribute('min', minDate);
    }
    if (deliveryDateInput) {
        deliveryDateInput.setAttribute('min', minDate);
    }
}

// Calculate estimated cost
// Reads the selected service and quantity, multiplies by the
// unit price and updates the displayed estimated cost.
function calculateCost() {
    const service = document.getElementById('service').value;
    const quantity = parseInt(document.getElementById('quantity').value, 10) || 0;

    if (!service || quantity <= 0) {
        document.getElementById('estimatedCost').textContent = '0';
        return;
    }

    const price = prices[service];
    const totalCost = price * quantity;
    document.getElementById('estimatedCost').textContent = totalCost;

    updateOrderSummary();
}

// Update order summary
// Reflects current form values in the summary panel (service,
// quantity, cost, pickup/delivery dates). Uses the `serviceNames`
// map to display a user-friendly service label.
function updateOrderSummary() {
    const service = document.getElementById('service').value;
    const quantity = document.getElementById('quantity').value || '-';
    const estimatedCost = document.getElementById('estimatedCost').textContent;
    const pickupDate = document.getElementById('pickupDate').value || '-';
    const deliveryDate = document.getElementById('deliveryDate').value || '-';

    document.getElementById('summaryService').textContent = serviceNames[service] || '-';
    document.getElementById('summaryQuantity').textContent = quantity;
    document.getElementById('summaryCost').textContent = `₦${estimatedCost}`;
    document.getElementById('summaryTotal').textContent = `₦${estimatedCost}`;
    document.getElementById('summaryPickup').textContent = pickupDate;
    document.getElementById('summaryDelivery').textContent = deliveryDate;
}

// Handle form submission
// Validates form fields, shows a confirmation alert, persists the
// order to localStorage, and redirects back to the homepage.
function handleOrderSubmit(event) {
    event.preventDefault();

    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert('Please create an account or log in before placing an order.');
        window.location.href = 'index.html';
        return;
    }

    // Get form data
    const formData = {
        service: document.getElementById('service').value,
        quantity: document.getElementById('quantity').value,
        instructions: document.getElementById('instructions').value,
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        address: document.getElementById('address').value,
        city: document.getElementById('city').value,
        state: document.getElementById('state').value,
        zip: document.getElementById('zip').value,
        pickupDate: document.getElementById('pickupDate').value,
        pickupTime: document.getElementById('pickupTime').value,
        deliveryDate: document.getElementById('deliveryDate').value,
        deliveryTime: document.getElementById('deliveryTime').value,
        estimatedCost: document.getElementById('estimatedCost').textContent,
        userId
    };

    // Validate form
    if (!formData.service || !formData.name || !formData.email || !formData.address) {
        alert('Please fill in all required fields');
        return;
    }

    // Show confirmation
    const confirmMessage = `Order Confirmation:\n\n` +
        `Service: ${serviceNames[formData.service]}\n` +
        `Quantity: ${formData.quantity}\n` +
        `Customer: ${formData.name}\n` +
        `Email: ${formData.email}\n` +
        `Address: ${formData.address}, ${formData.city}, ${formData.state} ${formData.zip}\n` +
        `Pickup: ${formData.pickupDate} - ${formData.pickupTime}\n` +
        `Delivery: ${formData.deliveryDate} - ${formData.deliveryTime}\n` +
        `Estimated Cost: ₦${formData.estimatedCost}\n\n` +
        `We will contact you shortly to confirm the order.`;

    alert(confirmMessage);

    // Log the order (in a real application, this would be sent to a server)
    console.log('Order Submitted:', formData);
    saveOrderToLocalStorage(formData);

    // Reset form
    document.getElementById('orderForm').reset();
    document.getElementById('estimatedCost').textContent = '0.00';
    updateOrderSummary();

    // Redirect to home page after 2 seconds
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 2000);
}

// Save order to local storage
// Orders are stored as an array under the `orders` key. This is
// a simple local persistence mechanism for demo/demo-only apps.
function saveOrderToLocalStorage(formData) {
    let orders = JSON.parse(localStorage.getItem('orders')) || [];
    const now = new Date().toISOString();
    const orderId = 'ORD-' + Date.now();
    const userId = localStorage.getItem('userId') || null;

    // Normalize estimated cost to numeric value
    const estimatedRaw = String(formData.estimatedCost || '0').replace(/[^0-9.-]+/g, '');
    const estimatedNumeric = parseFloat(estimatedRaw) || 0;

    // Create a normalized order record compatible with account page expectations
    const orderRecord = {
        order_id: orderId,
        created_at: now,
        user_id: userId,
        userId: userId,
        service_type: serviceNames[formData.service] || formData.service || '-',
        total_price: estimatedNumeric,
        status: 'Pending',
        quantity: formData.quantity || 0,
        instructions: formData.instructions || '',
        customer_name: formData.name || '',
        customer_email: formData.email || '',
        customer_phone: formData.phone || '',
        address: formData.address || '',
        // keep raw form payload for debugging/compatibility
        raw: formData
    };

    orders.push(orderRecord);
    localStorage.setItem('orders', JSON.stringify(orders));
    console.log('Order saved to local storage', orderRecord);
}

// Initialize
// Wire up initial behaviors once the DOM is ready.
function initPage() {
    initializeDatePicker();
    initHamburgerMenu();
    hideAdminLinkOnStaticPages();
    hideScrollbarOnWindows();
    initNavbarScrollEffect();
    initHeroAd();

    // Add event listeners for order form
    const orderForm = document.getElementById('orderForm');
    if (orderForm) {
        document.getElementById('service').addEventListener('change', calculateCost);
        document.getElementById('quantity').addEventListener('input', calculateCost);
        document.getElementById('pickupDate').addEventListener('change', updateOrderSummary);
        document.getElementById('deliveryDate').addEventListener('change', updateOrderSummary);
        orderForm.addEventListener('submit', handleOrderSubmit);
    }

    // Add event listener for registration form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegistration);
    }
}

// Initialize hero advert: try loading local asset, fall back to animated gradient or remote GIF
function initHeroAd() {
    const heroAd = document.getElementById('heroAd');
    if (!heroAd) return;

    // Use the two images from the workspace root
    const images = [
        'wedding-background.jpeg',
        'crown.jpeg'
    ];

    const fallbackGif = 'https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif';
    const slides = [];
    let loadedCount = 0;
    const maxWait = 2000; // ms
    let carouselStarted = false;

    function startCarousel() {
        if (carouselStarted) return;
        carouselStarted = true;
        if (slides.length === 0) return;

        let current = 0;
        slides[current].classList.add('active');
        if (slides.length === 1) return;

        setInterval(() => {
            slides[current].classList.remove('active');
            current = (current + 1) % slides.length;
            slides[current].classList.add('active');
        }, 5000);
    }

    images.forEach((name) => {
        const src = encodeURI(name);
        const img = new Image();

        img.onload = () => {
            const slide = document.createElement('div');
            slide.className = 'slide';
            slide.style.backgroundImage = `url('${src}')`;
            heroAd.appendChild(slide);
            slides.push(slide);
            loadedCount += 1;
            if (loadedCount === images.length) startCarousel();
        };

        img.onerror = () => {
            const slide = document.createElement('div');
            slide.className = 'slide';
            slide.style.backgroundImage = `url('${fallbackGif}')`;
            heroAd.appendChild(slide);
            slides.push(slide);
            loadedCount += 1;
            if (loadedCount === images.length) startCarousel();
        };

        img.src = src;
    });

    // Safety: start carousel after maxWait even if images take long or browser blocks loading
    setTimeout(startCarousel, maxWait);
}

// Navbar scroll effect
// Toggles a `scrolled` class on the navbar and `nav-scrolled` on the body
// to enable smooth transitions and subtle content effects.
function initNavbarScrollEffect() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    const threshold = 50;

    function onScroll() {
        if (window.scrollY > threshold) {
            navbar.classList.add('scrolled');
            document.body.classList.add('nav-scrolled');
        } else {
            navbar.classList.remove('scrolled');
            document.body.classList.remove('nav-scrolled');
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    // run once to set initial state
    onScroll();
}

// Detect Windows platform and add class to hide scrollbars (keeps scrolling)
function hideScrollbarOnWindows() {
    try {
        const platform = navigator.userAgent || navigator.platform || '';
        if (/Windows/i.test(platform)) {
            document.body.classList.add('hide-scrollbar');
        }
    } catch (e) {
        // silent fallback
    }
}

// Hide Admin link on static pages, show only on backend admin page
// Checks if the page is served from the backend or as a static file
function hideAdminLinkOnStaticPages() {
    const adminLink = document.querySelector('a[href="/admin"]');
    if (!adminLink) return;

    // If on backend admin page (served from /admin route), show admin link
    // If on static pages (index.html, order.html, etc.), hide admin link
    const isBackendAdminPage = window.location.pathname === '/admin' || window.location.pathname === '/admin/';
    
    if (!isBackendAdminPage) {
        adminLink.parentElement.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', initPage);
if (document.readyState !== 'loading') {
    initPage();
}

// Registration Modal Functions
// `openRegisterModal` displays the signup modal using `flex` so it
// centers via CSS; `closeRegisterModal` hides it.
function openRegisterModal() {
    const modal = document.getElementById('registerModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeRegisterModal() {
    const modal = document.getElementById('registerModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Close modal when clicking outside of it
window.addEventListener('click', function(event) {
    const modal = document.getElementById('registerModal');
    if (modal && event.target === modal) {
        modal.style.display = 'none';
    }
});

// Handle Registration
// Client-side signup flow that saves user accounts to
// `localStorage` so signup works without a backend. Fields are
// validated and the new user object is appended to `users`.
function handleRegistration(event) {
    event.preventDefault();

    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const address = document.getElementById('address').value.trim();
    const profilePicInput = document.getElementById('profilePic');
    const profilePicFile = profilePicInput ? profilePicInput.files[0] : null;

    if (!username || !email || !phone || !address) {
        alert('Please fill in all signup fields before creating an account.');
        return;
    }

    const saveUser = (profilePicData) => {
        const userData = {
            user_id: 'user_' + Date.now(),
            username: username,
            email: email,
            phone: phone,
            address: address,
            profilePic: profilePicData || null,
            created_at: new Date().toISOString()
        };

        // Save account locally so the signup works without a backend server.
        localStorage.setItem('userId', userData.user_id);
        localStorage.setItem('username', userData.username);

        let users = JSON.parse(localStorage.getItem('users')) || [];
        users.push(userData);
        localStorage.setItem('users', JSON.stringify(users));

        alert('Account created successfully! Welcome ' + userData.username);

        closeRegisterModal();
        document.getElementById('registerForm').reset();

        setTimeout(() => {
            window.location.href = 'account.html';
        }, 1000);
    };

    if (profilePicFile) {
        const reader = new FileReader();
        reader.onload = function(e) {
            saveUser(e.target.result);
        };
        reader.readAsDataURL(profilePicFile);
    } else {
        saveUser(null);
    }
}
