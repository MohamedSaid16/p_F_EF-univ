# RECLAMATION VISIBILITY ISSUE - DEBUG & FIX REPORT

## Issue Summary
When a student created a reclamation (complaint/request), the admin could not see it in the admin inbox (/dashboard/requests).

## Root Cause Analysis

### Investigation Steps

1. **Backend API Testing**: Created debug script to test the complete data flow
   - Student login: ✅ Working
   - Create reclamation: ✅ Working  
   - Fetch student reclamations: ✅ Working
   - Admin login: ✅ Working
   - **Admin fetch inbox via `/api/v1/requests/admin/inbox`: ✅ WORKING**

2. **API Response Structure**: Confirmed backend returns correct data
   ```json
   {
     "success": true,
     "data": [
       {
         "id": "REC-3",
         "requestId": 3,
         "category": "reclamation",
         "title": "My grade is incorrect",
         "studentName": "Amira Bensalem",
         "status": "submitted",
         ...
       }
     ]
   }
   ```

3. **Frontend Data Flow**: Traced through AdminRequestsPage component
   - API service is correctly configured
   - AdminRequestsPage properly fetches from `/api/v1/requests/admin/inbox`
   - Data structures align correctly

### Real Root Cause: UI Role Mapping Issue ❌

**File**: `frontend/src/pages/RequestsPage.jsx` Line 625

The RequestsPage component has a role-based conditional that determines what view to show:

```javascript
// BEFORE (BROKEN):
if (role === 'teacher') {
  // Shows both "My Reclamations" and "Student Inbox" tabs
  // Including AdminRequestsPage
}
```

**The Problem**: 
- Admins have `role === 'admin'` from the DashboardLayout role mapper
- Teachers have `role === 'teacher'`
- The condition ONLY checked for `'teacher'`, so admins never got to the inbox tabs
- Admins were silently falling through to the default student view instead

## Solution Applied

Updated line 625 in `frontend/src/pages/RequestsPage.jsx`:

```javascript
// AFTER (FIXED):
if (role === 'teacher' || role === 'admin') {
  // Now shows for both teachers AND admins
  // Both can see the "My Reclamations" and "Student Inbox" tabs
}
```

## Verification

The fix enables:
1. ✅ Admins can now see the "Student Inbox" tab
2. ✅ Admins can view all student reclamations and justifications
3. ✅ Admins can process decisions (approve/reject/request info)
4. ✅ Teachers retain their existing functionality

## Technical Details

### Backend Architecture
- **Endpoint**: `GET /api/v1/requests/admin/inbox`
- **Route Protection**: Requires `admin` or `vice_doyen` role (working correctly)
- **Database Query**: Fetches all reclamations + justifications with full joins
- **Response**: Properly formatted with student info, timestamps, and statuses

### Frontend Architecture  
- **Layout Chain**: App.jsx → ProtectedRoute → DashboardLayout → RequestsPage
- **Role Mapping**: DashboardLayout.uiRole() maps DB roles to UI tokens:
  - `admin`, `vice_doyen` → `'admin'`
  - `enseignant` → `'teacher'`
  - others → `'student'`
- **Component Props**: RequestsPage receives role via React.cloneElement()
- **AdminRequestsPage**: Child component for processing student requests

## Testing Credentials

```
Admin:
  Email: admin@univ-tiaret.dz
  Password: Test@1234
  
Student:
  Email: student@univ-tiaret.dz
  Password: Test@1234
```

## Files Modified

1. **frontend/src/pages/RequestsPage.jsx** (Line 625)
   - Changed conditional from `if (role === 'teacher')` to `if (role === 'teacher' || role === 'admin')`

## Impact Assessment

- ✅ Low risk - only adds admin to existing teacher functionality
- ✅ No API changes required
- ✅ No database changes required
- ✅ Maintains role-based access control
- ✅ No breaking changes to other components
- ✅ Admins can now fulfill their intended responsibilities

## Related Components

- `backend/src/controllers/requests/request.controller.ts` - getAdminRequestsInbox()
- `backend/src/modules/requests/routes/request.routes.ts` - Route registration
- `frontend/src/pages/AdminRequestsPage.jsx` - Inbox UI component
- `frontend/src/layouts/DashboardLayout.jsx` - Role mapping logic
