# Admin API Key Management - Eleven Interior API

## Overview
The Eleven Interior API provides comprehensive admin API key management through both the authentication system and direct frontend access. This allows you to create admin users in the backend and retrieve the admin API key through the frontend interface.

## 🔑 Admin API Key Features

### **Key Management**
- **Retrieve Current API Key** - Get the active admin API key
- **Regenerate API Key** - Generate new API key for security
- **Test API Key Access** - Validate API key functionality
- **Usage Instructions** - Complete implementation guidance

### **Security Benefits**
- **Secure Access** - Only authenticated admin users can access API keys
- **Key Rotation** - Easy regeneration for enhanced security
- **Access Control** - Role-based access to API key management
- **Usage Tracking** - Clear documentation and examples

## 🛡️ Security Model

### **Access Requirements**
1. **Admin User Creation** - Must create admin account first
2. **JWT Authentication** - Login required to access API key
3. **Admin Role Verification** - Only admin users can retrieve keys
4. **Secure Transmission** - API key sent through authenticated endpoints

### **Best Practices**
- **Regular Key Rotation** - Regenerate API keys periodically
- **Secure Storage** - Store API keys in environment variables
- **Access Monitoring** - Track API key usage
- **Immediate Rotation** - Regenerate if key is compromised

## 📡 API Endpoints

### 1. Create Admin User with API Key
**Endpoint:** `POST /api/auth/setup`
**Description:** Creates first admin user and returns admin API key

**Request:**
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
    "userId": 1,
    "adminApiKey": "eleven-interior-admin-api-key-2024-secure"
  },
  "timestamp": "2024-09-17T13:00:00.000Z"
}
```

### 2. Get Admin API Key (Protected)
**Endpoint:** `GET /api/admin/api-key`
**Description:** Retrieve current admin API key

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "adminApiKey": "eleven-interior-admin-api-key-2024-secure",
    "message": "Admin API key retrieved successfully",
    "usage": {
      "header": "X-API-Key",
      "example": "X-API-Key: eleven-interior-admin-api-key-2024-secure"
    }
  },
  "timestamp": "2024-09-17T13:00:00.000Z"
}
```

### 3. Regenerate API Key (Protected)
**Endpoint:** `POST /api/admin/regenerate-api-key`
**Description:** Generate new admin API key

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "New API key generated. Please update your environment variables.",
    "newApiKey": "eleven-interior-admin-1726574400000-xyz123abc456",
    "currentApiKey": "eleven-interior-admin-api-key-2024-secure",
    "instructions": {
      "step1": "Update ADMIN_API_KEY in wrangler.toml",
      "step2": "Redeploy the application",
      "step3": "Update all clients using the old API key"
    }
  },
  "timestamp": "2024-09-17T13:00:00.000Z"
}
```

## 🎯 Complete Workflow

### **Step 1: Create Admin User**
```javascript
// Create admin user and get API key
const setupResponse = await fetch('/api/auth/setup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@eleveninterior.com',
    password: 'securePassword123'
  })
});

const setup = await setupResponse.json();
console.log('Admin API Key:', setup.data.adminApiKey);
```

### **Step 2: Login and Access API Key Management**
```javascript
// Login to get JWT token
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@eleveninterior.com',
    password: 'securePassword123'
  })
});

const login = await loginResponse.json();
const accessToken = login.data.tokens.accessToken;

// Get API key using JWT token
const apiKeyResponse = await fetch('/api/admin/api-key', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const apiKey = await apiKeyResponse.json();
console.log('Admin API Key:', apiKey.data.adminApiKey);
```

### **Step 3: Use API Key for Admin Operations**
```javascript
// Use API key for admin operations
const adminResponse = await fetch('/api/admin/inquiries', {
  headers: {
    'X-API-Key': apiKey.data.adminApiKey
  }
});

const inquiries = await adminResponse.json();
console.log('Admin Access Successful:', inquiries);
```

## 🔄 API Key Lifecycle

### **Creation**
1. Admin user setup automatically provides initial API key
2. Key is generated during first admin account creation
3. Key is immediately available for use

### **Retrieval**
1. Login with admin credentials
2. Access `/api/admin/api-key` endpoint
3. Receive current active API key with usage instructions

### **Rotation**
1. Login with admin credentials
2. Call `/api/admin/regenerate-api-key` endpoint
3. Update environment variables with new key
4. Redeploy application
5. Update all client applications

### **Usage**
1. Include API key in `X-API-Key` header
2. Access any `/api/admin/*` endpoint
3. Alternative to JWT authentication for server-to-server calls

## 🖥️ Frontend Integration

### **HTML Interface**
The `test-auth.html` interface provides complete API key management:

1. **Admin Setup Section** - Create admin user and see API key
2. **API Key Management Section** - Retrieve and manage API keys
3. **Testing Tools** - Validate API key functionality
4. **Usage Instructions** - Clear implementation guidance

### **Key Features**
- **Visual API Key Display** - Easy copy-paste functionality
- **Usage Examples** - Ready-to-use code snippets
- **Test Functions** - Validate API key access
- **Security Warnings** - Regeneration confirmations

## 📋 Implementation Examples

### **Frontend JavaScript**
```javascript
// Complete admin setup and API key retrieval
class AdminManager {
  constructor(apiBase) {
    this.apiBase = apiBase;
    this.accessToken = null;
    this.apiKey = null;
  }

  async setupAdmin(email, password) {
    const response = await fetch(`${this.apiBase}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const result = await response.json();
    if (response.ok) {
      this.apiKey = result.data.adminApiKey;
      return result;
    }
    throw new Error(result.error.message);
  }

  async login(email, password) {
    const response = await fetch(`${this.apiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const result = await response.json();
    if (response.ok) {
      this.accessToken = result.data.tokens.accessToken;
      return result;
    }
    throw new Error(result.error.message);
  }

  async getApiKey() {
    const response = await fetch(`${this.apiBase}/api/admin/api-key`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });
    
    const result = await response.json();
    if (response.ok) {
      this.apiKey = result.data.adminApiKey;
      return result;
    }
    throw new Error(result.error.message);
  }

  async useApiKey(endpoint) {
    const response = await fetch(`${this.apiBase}${endpoint}`, {
      headers: {
        'X-API-Key': this.apiKey
      }
    });
    
    return await response.json();
  }
}

// Usage
const admin = new AdminManager('https://eleven-interior-api.aichatapi.workers.dev');

// Setup admin
await admin.setupAdmin('admin@eleveninterior.com', 'password123');

// Login and get API key
await admin.login('admin@eleveninterior.com', 'password123');
await admin.getApiKey();

// Use API key
const inquiries = await admin.useApiKey('/api/admin/inquiries');
```

### **Node.js Server Integration**
```javascript
// Server-side API key usage
const ADMIN_API_KEY = 'eleven-interior1-admin-api-key-2024-secure';
const API_BASE = 'https://eleven-interior-api.aichatapi.workers.dev';

async function uploadImage(imageFile, section) {
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('section', section);
  
  const response = await fetch(`${API_BASE}/api/admin/images/upload`, {
    method: 'POST',
    headers: {
      'X-API-Key': ADMIN_API_KEY
    },
    body: formData
  });
  
  return await response.json();
}

async function getInquiries() {
  const response = await fetch(`${API_BASE}/api/admin/inquiries`, {
    headers: {
      'X-API-Key': ADMIN_API_KEY
    }
  });
  
  return await response.json();
}
```

## 🔒 Security Considerations

### **API Key Security**
- **Environment Variables** - Store API key in secure environment variables
- **HTTPS Only** - Always use HTTPS for API key transmission
- **Regular Rotation** - Rotate API keys periodically
- **Access Logging** - Monitor API key usage

### **Access Control**
- **Admin Role Required** - Only admin users can access API key management
- **JWT Protection** - API key endpoints require valid JWT authentication
- **Rate Limiting** - API key requests are rate limited
- **Audit Trail** - All API key operations are logged

### **Best Practices**
- **Immediate Rotation** - Rotate keys immediately if compromised
- **Secure Storage** - Never store API keys in client-side code
- **Access Monitoring** - Track and monitor API key usage
- **Key Validation** - Always validate API key format and expiration

## ✅ Testing Checklist

### **Admin Setup**
- [ ] Create admin user successfully
- [ ] Receive API key in setup response
- [ ] Verify API key format and length

### **API Key Management**
- [ ] Login with admin credentials
- [ ] Retrieve API key via JWT authentication
- [ ] Test API key with admin endpoints
- [ ] Regenerate API key successfully
- [ ] Verify old key is invalidated

### **Security Validation**
- [ ] Non-admin users cannot access API key endpoints
- [ ] Invalid JWT tokens are rejected
- [ ] API key works for admin operations
- [ ] Rate limiting is enforced

### **Frontend Integration**
- [ ] API key displays correctly in interface
- [ ] Usage instructions are clear
- [ ] Test functions work properly
- [ ] Error handling is appropriate

Your Eleven Interior API now provides complete admin API key management through the frontend interface! 🎉