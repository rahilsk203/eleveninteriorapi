# Authentication System - Eleven Interior API

## Overview
The Eleven Interior API now includes a comprehensive authentication and session management system with JWT-based tokens, secure password handling, and session lifecycle management.

## Features

### 🔐 **Core Authentication**
- **JWT-based Authentication** - Secure token-based authentication
- **Password Hashing** - SHA-256 password encryption
- **Session Management** - Refresh token system for secure session handling
- **Admin User Management** - Complete user lifecycle management

### 🎫 **Token Management**
- **Access Tokens** - Short-lived tokens (24 hours) for API access
- **Refresh Tokens** - Long-lived tokens (7 days) for session renewal
- **Token Revocation** - Secure logout and password change token invalidation
- **Automatic Expiration** - Built-in token expiration handling

### 🛡️ **Security Features**
- **Secure Password Requirements** - Minimum 8 characters
- **Password Change Functionality** - Secure password updates
- **Session Isolation** - One active session per user
- **Request Validation** - Comprehensive input validation with Zod schemas

## Database Schema

### Admin Users Table
```sql
CREATE TABLE admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);
```

### Refresh Tokens Table
```sql
CREATE TABLE refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES admin_users (id) ON DELETE CASCADE
);
```

## API Endpoints

### 1. Setup Admin User (First Time Only)
**Endpoint:** `POST /api/auth/setup`
**Description:** Creates the first admin user. Only works when no admin users exist.

**Request Body:**
```json
{
  "email": "admin@eleveninterior.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Admin user created successfully",
    "userId": 1
  },
  "timestamp": "2024-09-17T13:00:00.000Z"
}
```

### 2. Login
**Endpoint:** `POST /api/auth/login`
**Description:** Authenticate user and receive access + refresh tokens.

**Request Body:**
```json
{
  "email": "admin@eleveninterior.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "admin@eleveninterior.com",
      "role": "admin",
      "created_at": "2024-09-17T12:00:00.000Z",
      "last_login": "2024-09-17T13:00:00.000Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "550e8400-e29b-41d4-a716-446655440000-1726574400000-xyz",
      "expiresIn": 86400,
      "tokenType": "Bearer"
    }
  },
  "timestamp": "2024-09-17T13:00:00.000Z"
}
```

### 3. Refresh Token
**Endpoint:** `POST /api/auth/refresh`
**Description:** Get a new access token using a refresh token.

**Request Body:**
```json
{
  "refreshToken": "550e8400-e29b-41d4-a716-446655440000-1726574400000-xyz"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 86400,
      "tokenType": "Bearer"
    }
  },
  "timestamp": "2024-09-17T13:00:00.000Z"
}
```

### 4. Logout
**Endpoint:** `POST /api/auth/logout`
**Description:** Invalidate refresh token and end session.

**Request Body:**
```json
{
  "refreshToken": "550e8400-e29b-41d4-a716-446655440000-1726574400000-xyz"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  },
  "timestamp": "2024-09-17T13:00:00.000Z"
}
```

### 5. Get Profile (Protected)
**Endpoint:** `GET /api/admin/profile`
**Description:** Get current user profile information.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "admin@eleveninterior.com",
      "role": "admin",
      "created_at": "2024-09-17T12:00:00.000Z",
      "last_login": "2024-09-17T13:00:00.000Z"
    }
  },
  "timestamp": "2024-09-17T13:00:00.000Z"
}
```

### 6. Change Password (Protected)
**Endpoint:** `PUT /api/admin/change-password`
**Description:** Change user password. Revokes all existing sessions.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body:**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newSecurePassword456",
  "confirmPassword": "newSecurePassword456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Password changed successfully. Please log in again."
  },
  "timestamp": "2024-09-17T13:00:00.000Z"
}
```

## Authentication Flow

### 1. Initial Setup
```mermaid
graph TB
    A[First Time Setup] --> B[POST /api/auth/setup]
    B --> C[Admin User Created]
    C --> D[Ready for Login]
```

### 2. Login Flow
```mermaid
graph TB
    A[User Login] --> B[POST /api/auth/login]
    B --> C[Validate Credentials]
    C --> D[Generate JWT + Refresh Token]
    D --> E[Store Refresh Token in DB]
    E --> F[Return Tokens to Client]
```

### 3. Protected Request Flow
```mermaid
graph TB
    A[Protected Request] --> B[Check Authorization Header]
    B --> C[Validate JWT Token]
    C --> D[Check Expiration]
    D --> E[Grant Access]
    C --> F[Token Invalid/Expired]
    F --> G[Return 401 Unauthorized]
```

### 4. Token Refresh Flow
```mermaid
graph TB
    A[Access Token Expired] --> B[POST /api/auth/refresh]
    B --> C[Validate Refresh Token]
    C --> D[Generate New Access Token]
    D --> E[Return New Token]
```

## Security Considerations

### 🔒 **Password Security**
- Passwords are hashed using SHA-256 before storage
- Minimum 8 character requirement
- No plain text password storage

### 🎫 **Token Security**
- JWT tokens are signed with HS256 algorithm
- Access tokens have short lifespan (24 hours)
- Refresh tokens expire after 7 days
- Tokens are revoked on password change

### 🛡️ **Session Security**
- One active session per user (refresh token limit)
- Secure session invalidation on logout
- Automatic cleanup of expired tokens

### 🚨 **Error Handling**
- No sensitive information in error messages
- Consistent error responses
- Proper HTTP status codes

## Usage Examples

### Setup and Login (JavaScript)
```javascript
// Setup admin user (first time only)
const setupResponse = await fetch('/api/auth/setup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@eleveninterior.com',
    password: 'securePassword123'
  })
});

// Login
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@eleveninterior.com',
    password: 'securePassword123'
  })
});

const { data } = await loginResponse.json();
const { accessToken, refreshToken } = data.tokens;

// Store tokens securely
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);
```

### Making Protected Requests
```javascript
// Use access token for protected requests
const response = await fetch('/api/admin/profile', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  }
});

// Handle token expiration
if (response.status === 401) {
  // Refresh token
  const refreshResponse = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refreshToken: localStorage.getItem('refreshToken')
    })
  });
  
  if (refreshResponse.ok) {
    const { data } = await refreshResponse.json();
    localStorage.setItem('accessToken', data.tokens.accessToken);
    // Retry original request
  } else {
    // Redirect to login
    window.location.href = '/login';
  }
}
```

## Testing Interface

Use the [test-auth.html](file://c:\Users\root\Desktop\eleveninteriorapi\test-auth.html) file to test all authentication features:

1. **Setup Admin User** - Create the first admin account
2. **Login/Logout** - Test authentication flow
3. **Token Management** - Test token refresh and validation
4. **Password Change** - Test secure password updates
5. **Protected Endpoints** - Test authenticated API access

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `TOKEN_EXPIRED` | 401 | Access token has expired |
| `INVALID_REFRESH_TOKEN` | 401 | Refresh token is invalid or expired |
| `NOT_AUTHENTICATED` | 401 | Missing or invalid authentication |
| `USER_NOT_FOUND` | 404 | User account not found |
| `ADMIN_EXISTS` | 403 | Admin user already exists |

## Integration with Existing API

The authentication system seamlessly integrates with the existing Eleven Interior API:

- **Backward Compatibility** - All existing endpoints continue to work
- **Optional Authentication** - Public endpoints remain accessible
- **Protected Admin Routes** - Admin operations now require authentication
- **Enhanced Security** - JWT tokens replace simple API key authentication

All admin routes under `/api/admin/*` now require valid JWT authentication, providing secure access to:
- Media management (upload, update, delete)
- Inquiry management
- User profile and password management