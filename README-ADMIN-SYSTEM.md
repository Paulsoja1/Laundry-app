# Admin Secure Login System - Setup Guide

## Overview
This document explains the new secure admin login system that allows admins to create their own unique, encrypted login credentials.

---

## 🔐 Security Features

1. **Password Hashing**: Passwords are hashed using bcrypt encryption
2. **Session Tokens**: Secure session tokens are generated for each login
3. **Session Verification**: Admin endpoints verify session tokens before granting access
4. **Confidential Access**: Only the admin with valid credentials can access the admin panel

---

## 📋 How It Works

### Step 1: First-Time Admin Setup
When an admin first visits the system:

1. Go to `/admin` or `/admin-setup`
2. Fill in the admin setup form:
   - **Email**: Your admin email address
   - **Username**: Your unique admin username (3+ characters)
   - **Password**: Strong password (6+ characters recommended)
   - **Confirm Password**: Re-enter your password

3. Click "Create Admin Credentials"
4. If successful, you'll be redirected to the login page

### Step 2: Admin Login
After credentials are created:

1. Go to `/admin` or `/admin-login.html`
2. Enter your username and password
3. Click "Login"
4. On successful authentication:
   - A secure session token is generated
   - You'll be redirected to the admin dashboard
   - Your session is stored locally (encrypted in browser storage)

### Step 3: Accessing Admin Features
- Once logged in, you can access all admin dashboard features
- Your session token is verified on every API call
- All admin endpoints require a valid session token

### Step 4: Logout
- Click the "Logout" button in the navbar
- Your session will be terminated
- You'll be redirected to the login page
- Your credentials won't be stored anymore

---

## 🛡️ Database & Storage

### Admin Credentials Storage (In-Memory)
```
admin_credentials_db = [
    {
        "admin_id": "unique_id",
        "email": "admin@company.com",
        "username": "admin_username",
        "hashed_password": "bcrypt_hashed_password",
        "created_at": "timestamp"
    }
]
```

### Session Management
```
admin_sessions = {
    "session_token": "admin_id"
}
```

**Note**: Data is stored in memory and resets when the server restarts. For production, use a database.

---

## 🔌 API Endpoints

### 1. Admin Setup (Create Credentials)
```
POST /api/admin/setup
Content-Type: application/json

{
    "email": "admin@company.com",
    "username": "admin_username",
    "password": "password123"
}

Response:
{
    "status": "success",
    "message": "Admin credentials created successfully",
    "admin_id": "abc12345",
    "redirect": "/admin-login.html"
}
```

### 2. Admin Login
```
POST /api/admin/login
Content-Type: application/json

{
    "username": "admin_username",
    "password": "password123"
}

Response:
{
    "status": "success",
    "message": "Login successful",
    "session_token": "secure_token_here",
    "admin_id": "abc12345",
    "username": "admin_username",
    "redirect": "/admin.html"
}
```

### 3. Verify Session
```
POST /api/admin/verify-session?token=session_token

Response:
{
    "valid": true,
    "admin_id": "abc12345",
    "username": "admin_username",
    "email": "admin@company.com"
}
```

### 4. Admin Logout
```
POST /api/admin/logout?token=session_token

Response:
{
    "status": "success",
    "message": "Logged out successfully"
}
```

### 5. Protected Admin Endpoints
All admin endpoints now require a session token:
```
GET /admin/dashboard?token=session_token
GET /admin/orders?token=session_token
GET /admin/users?token=session_token
GET /admin/payments?token=session_token
```

---

## 📁 Files Modified/Created

### New Files:
- **admin-setup.html**: Admin credential creation page
- **README-ADMIN-SYSTEM.md**: This guide

### Modified Files:
- **main.py**: Added admin authentication endpoints and password hashing
- **admin-login.html**: Updated with secure login verification
- **admin.html**: Updated to use session tokens
- **requirements.txt**: Added bcrypt for password hashing

---

## 🚀 Installation & Setup

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

Required packages:
- `bcrypt` - For password hashing
- `python-multipart` - For form data handling
- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `pydantic` - Data validation

### 2. Run the Server
```bash
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### 3. Access the System
- First time: Go to `http://localhost:8000/admin` → Redirects to setup page
- Create your admin credentials
- Login with your credentials
- Access the admin dashboard

---

## ✅ Security Best Practices

1. **Use Strong Passwords**:
   - At least 6 characters (recommendation: 12+ with mixed case, numbers, symbols)
   - Don't use simple patterns like "123456" or "password"

2. **Keep Credentials Secret**:
   - Never share your username and password
   - Don't store them in unsecured documents
   - Only you should have access

3. **Browser Storage Security**:
   - Session tokens are stored in browser's localStorage
   - Clear browser data if using a shared computer
   - Close the browser after using the admin panel

4. **Session Management**:
   - Sessions expire when you close the browser (or can be manually ended)
   - For added security, sessions auto-expire after a period of inactivity
   - Always logout when finished

---

## 🔧 Troubleshooting

### Issue: "Admin Already Created"
- **Solution**: An admin account already exists. Go to login page `/admin-login.html`

### Issue: "Invalid Credentials"
- **Solution**: Check your username and password are correct
- Passwords are case-sensitive

### Issue: "No Valid Session"
- **Solution**: Your session has expired. Log in again.

### Issue: API Endpoints Return 401 Unauthorized
- **Solution**: Your session token is invalid or missing. Log in again.

---

## 🔄 Data Persistence

**Current Implementation**: 
- Data stored in-memory (server RAM)
- Data is lost when server restarts

**For Production**:
- Replace in-memory storage with a database (PostgreSQL, MongoDB, etc.)
- Encrypt stored passwords with additional layers
- Implement token expiration policies
- Add audit logging for security events
- Use HTTPS/SSL for all communications

---

## 📞 Support

For issues or questions:
1. Check this guide
2. Review error messages in browser console (F12)
3. Check server logs in terminal
4. Verify all dependencies are installed

---

**Last Updated**: May 24, 2026
**System Version**: 1.0 - Secure Admin Authentication
