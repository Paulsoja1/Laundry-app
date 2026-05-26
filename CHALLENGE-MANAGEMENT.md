# 🆘 User Challenge & Issue Management System

## Overview

This document explains the new **User Challenge Management System** that allows users to report issues and enables admins to track, manage, and resolve them from the dashboard.

---

## ✨ Features

### For Users:
- ✅ Report issues/challenges easily from frontend
- ✅ Categorize issues (technical, payment, order, delivery, other)
- ✅ Set priority levels (low, medium, high, critical)
- ✅ Provide detailed descriptions
- ✅ Track issue status
- ✅ Get issue ID for reference

### For Admins:
- ✅ View all user challenges on dashboard
- ✅ See open challenges count in stats
- ✅ View detailed challenge information
- ✅ Update challenge status (open → in_progress → resolved → closed)
- ✅ Add admin notes/solutions
- ✅ Change priority levels
- ✅ Track resolution times
- ✅ Filter by status and priority

---

## 🎯 How to Use

### For Users: Report an Issue

#### Option 1: Using Support Page
1. Visit: `/support-issues.html`
2. Fill in the form:
   - **Full Name** (required)
   - **Email Address** (required)
   - **Category** (required) - Choose from:
     - Technical Issue
     - Payment Issue
     - Order Issue
     - Delivery Issue
     - Other Issue
   - **Priority** (required):
     - Low
     - Medium
     - High
     - Critical
   - **Subject** (required) - Brief title
   - **Description** (required) - Detailed explanation
3. Click "Submit Issue Report"
4. You'll receive a challenge ID for reference
5. Admin will respond within 24 hours

#### Issue Categories:
| Category | Description |
|----------|-------------|
| **Technical** | Website/app bugs, functionality issues, crashes |
| **Payment** | Payment processing, billing, transaction issues |
| **Order** | Order placement, modification, cancellation |
| **Delivery** | Delivery delays, rider issues, location problems |
| **Other** | Any other issues not in above categories |

---

### For Admins: Manage Challenges

#### Step 1: View Challenges on Dashboard
1. Log in to admin dashboard
2. Scroll to "User Challenges & Issues" section
3. View all reported issues in table format
4. See status and priority indicators

#### Step 2: Open Challenge Details
1. Click "View & Edit" button on any challenge
2. Modal opens showing:
   - Challenge ID
   - User information
   - Subject & description
   - Category
   - Current status & priority
   - Existing admin notes

#### Step 3: Update Challenge
In the modal, you can:
1. **Change Status**:
   - `open` → Issue just reported
   - `in_progress` → Being worked on
   - `resolved` → Fixed/solved
   - `closed` → Issue concluded

2. **Add Admin Notes**:
   - Explain solution provided
   - Add troubleshooting steps
   - Provide guidance to user

3. **Update Priority**:
   - Change from low/medium/high/critical

4. Click "Save Changes"

---

## 📊 Dashboard Display

### Challenge Table Columns:
| Column | Description |
|--------|-------------|
| **ID** | Unique challenge identifier |
| **User** | User name |
| **Email** | User email for contact |
| **Category** | Issue category |
| **Subject** | Brief description |
| **Priority** | Priority level (low/medium/high/critical) |
| **Status** | Current status |
| **Created** | Date submitted |
| **Actions** | View & Edit button |

### Status Indicators:
- 🟦 **Open** (Light Blue) - New issue
- 🟨 **In Progress** (Yellow) - Being worked on
- 🟩 **Resolved** (Green) - Fixed/solved
- ⬜ **Closed** (Gray) - Concluded

### Priority Indicators:
- 🟦 **Low** (Light Blue)
- 🟨 **Medium** (Yellow)
- 🟥 **High** (Red)
- 🟥 **Critical** (Dark Red - Urgent)

---

## 🔌 API Endpoints

### Submit Challenge (User)
```
POST /api/challenges
Content-Type: application/json

{
    "user_id": "user_123",
    "user_name": "John Doe",
    "user_email": "john@example.com",
    "subject": "Payment not processed",
    "description": "I paid ₦5,000 but it shows pending",
    "category": "payment",
    "priority": "high"
}

Response:
{
    "status": "success",
    "message": "Challenge submitted successfully",
    "challenge_id": "chg12345"
}
```

### Get All Challenges (Admin)
```
GET /admin/challenges?token=SESSION_TOKEN

Response: [
    {
        "challenge_id": "chg12345",
        "user_id": "user_123",
        "user_name": "John Doe",
        "user_email": "john@example.com",
        "subject": "Payment not processed",
        "description": "...",
        "category": "payment",
        "status": "open",
        "priority": "high",
        "admin_notes": "",
        "created_at": "2026-05-25T10:30:00",
        "updated_at": "2026-05-25T10:30:00",
        "resolved_at": null
    }
]
```

### Get Challenge Details (Admin)
```
GET /admin/challenges/chg12345?token=SESSION_TOKEN

Response: {
    "challenge_id": "chg12345",
    ... (full challenge object)
}
```

### Update Challenge (Admin)
```
PUT /admin/challenges/chg12345?token=SESSION_TOKEN
Content-Type: application/json

{
    "status": "in_progress",
    "priority": "critical",
    "admin_notes": "Looking into payment issue. Please wait for update."
}

Response:
{
    "status": "success",
    "message": "Challenge updated successfully",
    "challenge": { ... }
}
```

---

## 💾 Data Structure

### Challenge Object
```json
{
    "challenge_id": "abc12345",
    "user_id": "user_123",
    "user_name": "John Doe",
    "user_email": "john@example.com",
    "subject": "Payment not processed",
    "description": "Detailed description of the issue",
    "category": "payment",
    "status": "open",
    "priority": "high",
    "admin_notes": "Admin response and notes",
    "created_at": "2026-05-25T10:30:00",
    "updated_at": "2026-05-25T10:30:00",
    "resolved_at": "2026-05-25T15:45:00"
}
```

### Valid Values:
- **Categories**: technical, payment, order, delivery, other
- **Status**: open, in_progress, resolved, closed
- **Priority**: low, medium, high, critical

---

## 🔐 Workflow Example

### User Reports Issue:
```
1. User visits /support-issues.html
2. Fills form: "Payment not processed"
   - Category: payment
   - Priority: high
3. Submits challenge
4. Receives challenge ID: chg_a1b2c3d4
```

### Admin Reviews and Resolves:
```
1. Admin logs in to dashboard
2. Sees "Open Challenges" count in stats
3. Scrolls to "User Challenges & Issues" table
4. Clicks "View & Edit" on the challenge
5. Reads issue description
6. Changes status to "in_progress"
7. Adds notes: "Investigating payment failure..."
8. Saves changes
9. Later, updates status to "resolved"
10. Adds solution notes: "Payment processed successfully"
```

---

## 📁 Files Changed/Created

### New Files:
- **support-issues.html** - User-facing issue reporting form

### Modified Files:
- **main.py**:
  - Added UserChallenge, SubmitChallengeRequest, UpdateChallengeRequest models
  - Added challenges_db storage
  - Added /api/challenges endpoint
  - Added /admin/challenges endpoints
  - Updated admin/dashboard to include challenges

- **admin.html**:
  - Added Challenges table section
  - Added Challenge Details modal
  - Added CSS styling for status/priority badges
  - Added JavaScript functions for managing challenges

---

## 🧪 Testing the Feature

### Test 1: Submit Challenge
```
1. Open: http://localhost:8000/support-issues.html
2. Fill form:
   - Name: Test User
   - Email: test@example.com
   - Category: Technical
   - Priority: High
   - Subject: Test Issue
   - Description: This is a test issue report
3. Click "Submit Issue Report"
✓ Should show success message with challenge ID
```

### Test 2: View on Admin Dashboard
```
1. Log in to admin dashboard
2. Look for "Open Challenges" stat card
3. Scroll to "User Challenges & Issues" table
4. Should see the submitted challenge
✓ Challenge appears in table
```

### Test 3: Update Challenge
```
1. Click "View & Edit" on a challenge
2. Change status to "in_progress"
3. Add admin note: "Looking into this"
4. Change priority to "critical"
5. Click "Save Changes"
✓ Should show success message
✓ Dashboard refreshes with updated challenge
```

---

## ⚙️ Technical Details

### Backend Implementation:
- Challenges stored in-memory database
- Sorted by priority (critical → high → medium → low)
- Timestamps automatically added
- Admin authentication required for all admin endpoints

### Frontend Implementation:
- Responsive design works on mobile/tablet
- Modal for detailed view and editing
- Real-time form validation
- Error handling and user feedback
- Automatic dashboard refresh after updates

---

## 🔄 Challenge Lifecycle

```
OPEN
  │
  ├─→ User submits issue
  │
IN_PROGRESS
  │
  ├─→ Admin assigned
  ├─→ Admin adds notes
  ├─→ Admin works on solution
  │
RESOLVED
  │
  ├─→ Issue solved
  ├─→ Solution documented
  ├─→ Admin provides response
  │
CLOSED
  │
  └─→ Issue concluded
      User informed
```

---

## 📈 Best Practices

### For Users:
1. ✅ Provide clear, detailed descriptions
2. ✅ Select appropriate category
3. ✅ Set correct priority
4. ✅ Include relevant details (order ID, transaction ID, etc.)
5. ✅ Be specific about when issue occurred

### For Admins:
1. ✅ Review issues daily
2. ✅ Update status regularly
3. ✅ Always provide admin notes with solution
4. ✅ Respond to critical issues first
5. ✅ Communicate clearly with users
6. ✅ Mark as resolved only when truly fixed
7. ✅ Add follow-up notes if needed

---

## 🚀 Future Enhancements

### High Priority:
- Email notifications when challenge is updated
- Challenge history/changelog
- User can view their challenges status
- Search and filter challenges
- Export challenges report

### Medium Priority:
- Auto-assign to specific admins
- Add attachments (images, receipts, etc.)
- Set SLA/target resolution time
- Customer satisfaction rating
- Challenge templates for common issues

### Nice to Have:
- Statistics dashboard (avg resolution time, etc.)
- Bulk actions on multiple challenges
- Automated responses for common issues
- Integration with external support systems
- Challenge chatbot for initial assessment

---

## 📞 Support

For issues or questions about this feature:
1. Check this documentation
2. Review the API endpoints
3. Check browser console (F12) for errors
4. Verify admin session is valid
5. Ensure backend server is running

---

## Summary

The User Challenge Management System provides:

✅ **Easy Issue Reporting** - Users can quickly submit issues  
✅ **Centralized Dashboard** - Admins manage all issues in one place  
✅ **Status Tracking** - Clear lifecycle from open to resolved  
✅ **Priority Management** - Focus on critical issues first  
✅ **Communication** - Admin notes to respond to users  
✅ **Analytics** - Track issues by category, priority, status  

**Ready to Deploy!**

---

**Version**: 1.0  
**Date**: May 25, 2026  
**Status**: ✅ Complete
