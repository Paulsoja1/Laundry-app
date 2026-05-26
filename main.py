from pathlib import Path
from fastapi import FastAPI, HTTPException, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import uuid
from datetime import datetime
import bcrypt
import secrets

BASE_DIR = Path(__file__).resolve().parent
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data Models
class User(BaseModel):
    user_id: str
    username: str
    email: str
    phone: str
    address: str
    created_at: str

class ServiceRequest(BaseModel):
    user_id: str
    user_name: str
    service_type: str
    address: str

class Order(BaseModel):
    order_id: str
    user_id: str
    user_name: str
    service_type: str
    status: str
    rider_assigned: Optional[str] = None
    created_at: str
    total_price: float
    payment_status: str

class Payment(BaseModel):
    payment_id: str
    order_id: str
    user_id: str
    amount: float
    status: str  # pending, completed, failed
    payment_method: str  # card, paypal, wallet
    created_at: str

# Admin Credentials Model
class AdminCredentials(BaseModel):
    admin_id: str
    email: str
    username: str
    hashed_password: str
    created_at: str

class AdminSetup(BaseModel):
    email: str
    username: str
    password: str

class AdminLogin(BaseModel):
    username: str
    password: str

class UserAccount(BaseModel):
    user_id: str
    username: str
    email: str
    phone: str
    address: str
    total_orders: int
    total_spent: float

# User Challenge/Issue Model
class UserChallenge(BaseModel):
    challenge_id: str
    user_id: str
    user_name: str
    user_email: str
    subject: str
    description: str
    category: str  # technical, payment, order, delivery, other
    status: str  # open, in_progress, resolved, closed
    priority: str  # low, medium, high, critical
    admin_notes: str = ""
    created_at: str
    updated_at: str
    resolved_at: Optional[str] = None

class SubmitChallengeRequest(BaseModel):
    user_id: str
    user_name: str
    user_email: str
    subject: str
    description: str
    category: str
    priority: str = "medium"

class UpdateChallengeRequest(BaseModel):
    status: Optional[str] = None
    admin_notes: Optional[str] = None
    priority: Optional[str] = None

# In-memory storage (Resets when server restarts)
users_db = []
orders_db = []
payments_db = []
challenges_db = []  # Stores user challenges/issues
admin_credentials_db = []  # Stores admin credentials
admin_sessions: Dict[str, str] = {}  # Maps session tokens to admin IDs
available_riders = ["Rider_Swift", "Rider_Flash", "Rider_Ace"]

# Service prices
SERVICE_PRICES = {
    "Standard Wash": 5.99,
    "Premium Wash": 8.99,
    "Dry Cleaning": 12.99,
    "Express Service": 15.99
}

# ============ HELPER FUNCTIONS ============
def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode(), salt).decode()

def verify_password(password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return bcrypt.checkpw(password.encode(), hashed_password.encode())

def generate_session_token() -> str:
    """Generate a secure session token"""
    return secrets.token_urlsafe(32)

@app.get("/", response_class=HTMLResponse)
def home():
    return FileResponse(BASE_DIR / "index.html")

@app.get("/admin", response_class=HTMLResponse)
def admin_page():
    # Redirect to setup if no admin exists
    if not admin_credentials_db:
        return FileResponse(BASE_DIR / "admin-setup.html")
    return FileResponse(BASE_DIR / "admin-login.html")

@app.get("/admin-setup", response_class=HTMLResponse)
def admin_setup_page():
    return FileResponse(BASE_DIR / "admin-setup.html")

# ============ ADMIN AUTHENTICATION ENDPOINTS ============
@app.post("/api/admin/setup")
def admin_setup(setup_data: AdminSetup):
    """Create admin credentials (first-time setup)"""
    # Check if admin already exists
    if admin_credentials_db:
        raise HTTPException(
            status_code=403,
            detail="Admin already exists. Contact existing admin for access."
        )
    
    # Validate inputs
    if len(setup_data.password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters long"
        )
    
    if any(a["username"] == setup_data.username for a in admin_credentials_db):
        raise HTTPException(
            status_code=400,
            detail="Username already taken"
        )
    
    # Create admin credentials
    hashed_pw = hash_password(setup_data.password)
    new_admin = {
        "admin_id": str(uuid.uuid4())[:8],
        "email": setup_data.email,
        "username": setup_data.username,
        "hashed_password": hashed_pw,
        "created_at": datetime.now().isoformat()
    }
    
    admin_credentials_db.append(new_admin)
    
    return {
        "status": "success",
        "message": "Admin credentials created successfully",
        "admin_id": new_admin["admin_id"],
        "redirect": "/admin-login.html"
    }

@app.post("/api/admin/login")
def admin_login(login_data: AdminLogin):
    """Admin login endpoint"""
    # Find admin by username
    admin = next(
        (a for a in admin_credentials_db if a["username"] == login_data.username),
        None
    )
    
    if not admin:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )
    
    # Verify password
    if not verify_password(login_data.password, admin["hashed_password"]):
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )
    
    # Generate session token
    session_token = generate_session_token()
    admin_sessions[session_token] = admin["admin_id"]
    
    return {
        "status": "success",
        "message": "Login successful",
        "session_token": session_token,
        "admin_id": admin["admin_id"],
        "username": admin["username"],
        "redirect": "/admin.html"
    }

@app.post("/api/admin/logout")
def admin_logout(token: str):
    """Admin logout endpoint"""
    if token in admin_sessions:
        del admin_sessions[token]
        return {"status": "success", "message": "Logged out successfully"}
    raise HTTPException(status_code=400, detail="Invalid session token")

@app.post("/api/admin/verify-session")
def verify_admin_session(token: str):
    """Verify if admin session is valid"""
    if token in admin_sessions:
        admin_id = admin_sessions[token]
        admin = next(
            (a for a in admin_credentials_db if a["admin_id"] == admin_id),
            None
        )
        if admin:
            return {
                "valid": True,
                "admin_id": admin["admin_id"],
                "username": admin["username"],
                "email": admin["email"]
            }
    
    raise HTTPException(status_code=401, detail="Invalid or expired session")

@app.post("/api/admin/delete")
def admin_delete(token: str):
    """Delete the current admin credentials and all active admin sessions."""
    if not token or token not in admin_sessions:
        raise HTTPException(status_code=401, detail="Unauthorized: No valid session")

    admin_id = admin_sessions[token]
    admin = next((a for a in admin_credentials_db if a["admin_id"] == admin_id), None)
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")

    # Remove admin credentials and all sessions
    admin_credentials_db.clear()
    admin_sessions.clear()

    return {"status": "success", "message": "Admin credentials deleted. You can create a new admin account."}


# ============ USER ENDPOINTS ============
@app.post("/register", response_model=User)
def register_user(user: User):
    # Check if user already exists
    if any(u["username"] == user.username for u in users_db):
        raise HTTPException(status_code=400, detail="Username already exists")
    
    new_user = {
        "user_id": str(uuid.uuid4())[:8],
        "username": user.username,
        "email": user.email,
        "phone": user.phone,
        "address": user.address,
        "created_at": datetime.now().isoformat()
    }
    users_db.append(new_user)
    return new_user

@app.get("/users/{user_id}", response_model=UserAccount)
def get_user_account(user_id: str):
    user = next((u for u in users_db if u["user_id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_orders = [o for o in orders_db if o["user_id"] == user_id]
    total_spent = sum(o["total_price"] for o in user_orders)
    
    return {
        "user_id": user["user_id"],
        "username": user["username"],
        "email": user["email"],
        "phone": user["phone"],
        "address": user["address"],
        "total_orders": len(user_orders),
        "total_spent": total_spent
    }

@app.put("/users/{user_id}")
def update_user(user_id: str, updated_data: dict):
    user = next((u for u in users_db if u["user_id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.update(updated_data)
    return user

# ============ ORDER ENDPOINTS ============
@app.post("/request", response_model=Order)
def create_request(req: ServiceRequest):
    # Assign the first available rider
    rider = None
    if available_riders:
        rider = available_riders.pop(0)
        status = "Rider Assigned"
    else:
        status = "Pending"
    
    price = SERVICE_PRICES.get(req.service_type, 9.99)
    
    new_order = {
        "order_id": str(uuid.uuid4())[:8],
        "user_id": req.user_id,
        "user_name": req.user_name,
        "service_type": req.service_type,
        "status": status,
        "rider_assigned": rider,
        "created_at": datetime.now().isoformat(),
        "total_price": price,
        "payment_status": "pending"
    }
    
    orders_db.append(new_order)
    return new_order

@app.get("/orders", response_model=List[Order])
def get_orders():
    return orders_db

@app.get("/orders/{order_id}", response_model=Order)
def get_order(order_id: str):
    order = next((o for o in orders_db if o["order_id"] == order_id), None)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@app.put("/orders/{order_id}")
def update_order(order_id: str, status: str):
    order = next((o for o in orders_db if o["order_id"] == order_id), None)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order["status"] = status
    return order

# ============ PAYMENT ENDPOINTS ============
@app.post("/payment", response_model=Payment)
def process_payment(payment_req: dict):
    # Extract data from request
    order_id = payment_req.get("order_id")
    user_id = payment_req.get("user_id")
    amount = payment_req.get("amount")
    payment_method = payment_req.get("payment_method", "card")
    
    # Validate order exists
    order = next((o for o in orders_db if o["order_id"] == order_id), None)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    new_payment = {
        "payment_id": str(uuid.uuid4())[:8],
        "order_id": order_id,
        "user_id": user_id,
        "amount": amount,
        "status": "completed",  # In real app, integrate with Stripe/PayPal
        "payment_method": payment_method,
        "created_at": datetime.now().isoformat()
    }
    
    payments_db.append(new_payment)
    
    # Update order payment status
    order["payment_status"] = "completed"
    
    return new_payment

@app.get("/payments/{user_id}")
def get_user_payments(user_id: str):
    return [p for p in payments_db if p["user_id"] == user_id]

# ============ ADMIN ENDPOINTS ============
@app.get("/admin/dashboard")
def admin_dashboard(token: Optional[str] = None):
    # Verify admin session
    if not token or token not in admin_sessions:
        raise HTTPException(status_code=401, detail="Unauthorized: No valid session")
    
    total_users = len(users_db)
    total_orders = len(orders_db)
    total_revenue = sum(p["amount"] for p in payments_db)
    pending_orders = len([o for o in orders_db if o["status"] == "Pending"])
    completed_orders = len([o for o in orders_db if o["status"] == "Completed"])
    
    return {
        "total_users": total_users,
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "pending_orders": pending_orders,
        "completed_orders": completed_orders,
        "users": users_db,
        "orders": orders_db,
        "payments": payments_db,
        "challenges": challenges_db
    }

@app.get("/admin/orders")
def admin_view_orders(token: Optional[str] = None):
    if not token or token not in admin_sessions:
        raise HTTPException(status_code=401, detail="Unauthorized: No valid session")
    return orders_db

@app.get("/admin/users")
def admin_view_users(token: Optional[str] = None):
    if not token or token not in admin_sessions:
        raise HTTPException(status_code=401, detail="Unauthorized: No valid session")
    return users_db

@app.get("/admin/payments")
def admin_view_payments(token: Optional[str] = None):
    if not token or token not in admin_sessions:
        raise HTTPException(status_code=401, detail="Unauthorized: No valid session")
    return payments_db

# ============ USER CHALLENGE/ISSUE ENDPOINTS ============
@app.post("/api/challenges")
def submit_challenge(challenge: SubmitChallengeRequest):
    """Submit a new challenge/issue from user frontend"""
    
    # Validate inputs
    if not challenge.subject or len(challenge.subject.strip()) < 3:
        raise HTTPException(status_code=400, detail="Subject must be at least 3 characters")
    
    if not challenge.description or len(challenge.description.strip()) < 10:
        raise HTTPException(status_code=400, detail="Description must be at least 10 characters")
    
    if challenge.category not in ["technical", "payment", "order", "delivery", "other"]:
        raise HTTPException(status_code=400, detail="Invalid category")
    
    if challenge.priority not in ["low", "medium", "high", "critical"]:
        raise HTTPException(status_code=400, detail="Invalid priority")
    
    # Create new challenge
    new_challenge = {
        "challenge_id": str(uuid.uuid4())[:8],
        "user_id": challenge.user_id,
        "user_name": challenge.user_name,
        "user_email": challenge.user_email,
        "subject": challenge.subject,
        "description": challenge.description,
        "category": challenge.category,
        "status": "open",
        "priority": challenge.priority,
        "admin_notes": "",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "resolved_at": None
    }
    
    challenges_db.append(new_challenge)
    
    return {
        "status": "success",
        "message": "Challenge submitted successfully",
        "challenge_id": new_challenge["challenge_id"]
    }

@app.get("/admin/challenges")
def admin_view_challenges(token: Optional[str] = None):
    """Get all user challenges/issues for admin dashboard"""
    if not token or token not in admin_sessions:
        raise HTTPException(status_code=401, detail="Unauthorized: No valid session")
    
    # Sort by priority (critical, high, medium, low) and creation date
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    sorted_challenges = sorted(
        challenges_db,
        key=lambda x: (
            priority_order.get(x.get("priority", "medium"), 2),
            x.get("created_at", "")
        )
    )
    
    return sorted_challenges

@app.get("/admin/challenges/{challenge_id}")
def admin_get_challenge(challenge_id: str, token: Optional[str] = None):
    """Get specific challenge details"""
    if not token or token not in admin_sessions:
        raise HTTPException(status_code=401, detail="Unauthorized: No valid session")
    
    challenge = next(
        (c for c in challenges_db if c["challenge_id"] == challenge_id),
        None
    )
    
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    return challenge

@app.put("/admin/challenges/{challenge_id}")
def admin_update_challenge(challenge_id: str, update: UpdateChallengeRequest, token: Optional[str] = None):
    """Update challenge status and admin notes"""
    if not token or token not in admin_sessions:
        raise HTTPException(status_code=401, detail="Unauthorized: No valid session")
    
    challenge = next(
        (c for c in challenges_db if c["challenge_id"] == challenge_id),
        None
    )
    
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    # Update status
    if update.status:
        valid_statuses = ["open", "in_progress", "resolved", "closed"]
        if update.status not in valid_statuses:
            raise HTTPException(status_code=400, detail="Invalid status")
        challenge["status"] = update.status
        
        # Mark resolved_at if status is resolved
        if update.status == "resolved":
            challenge["resolved_at"] = datetime.now().isoformat()
    
    # Update admin notes
    if update.admin_notes:
        challenge["admin_notes"] = update.admin_notes
    
    # Update priority
    if update.priority:
        valid_priorities = ["low", "medium", "high", "critical"]
        if update.priority not in valid_priorities:
            raise HTTPException(status_code=400, detail="Invalid priority")
        challenge["priority"] = update.priority
    
    # Update timestamp
    challenge["updated_at"] = datetime.now().isoformat()
    
    return {
        "status": "success",
        "message": "Challenge updated successfully",
        "challenge": challenge
    }

# Serve static app assets and HTML pages
app.mount("/", StaticFiles(directory=str(BASE_DIR), html=True), name="static")