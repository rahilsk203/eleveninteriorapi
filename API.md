# API Documentation

## Base URL
- Production: `https://api.eleveninterior.com`
- Staging: `https://staging-api.eleveninterior.com`

## Authentication
```http
X-API-Key: your-admin-api-key
Authorization: Bearer your-jwt-token
```

## Video Endpoints

### Upload Video
```http
POST /api/v1/admin/videos/upload
Content-Type: multipart/form-data

Form Data:
- video: (file) Video file
- section: hero|feature
- title: (optional) Video title
- description: (optional) Description
- alt_text: (optional) Alt text
```

### Get Video
```http
GET /api/v1/videos/{section}
```

### Update Video
```http
PUT /api/v1/admin/videos/{section}
Content-Type: application/json

{
  "title": "Updated title",
  "description": "Updated description",
  "is_active": true
}
```

### Delete Video
```http
DELETE /api/v1/admin/videos/{section}
```

## Image Endpoints

### Upload Image
```http
POST /api/v1/admin/images/upload
Content-Type: multipart/form-data

Form Data:
- image: (file) Image file
- section: contact|entrance|gallery|logo|about|swordman
- title: (optional) Image title
- sort_order: (optional) Display order
```

### Get Images
```http
GET /api/v1/images/{section}?limit=20&offset=0
```

### Update Image
```http
PUT /api/v1/admin/images/{section}/{id}
Content-Type: application/json

{
  "title": "Updated title",
  "sort_order": 1,
  "is_active": true
}
```

### Delete Image
```http
DELETE /api/v1/admin/images/{section}/{id}
```

## Inquiry Endpoints

### Submit Inquiry (Public)
```http
POST /api/v1/inquiries
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "1234567890",
  "location": "New York",
  "project_description": "Office interior design"
}
```

### Get Inquiries (Admin)
```http
GET /api/v1/admin/inquiries?status=pending&limit=20
```

### Update Inquiry (Admin)
```http
PUT /api/v1/admin/inquiries/{id}
Content-Type: application/json

{
  "status": "in_progress",
  "priority": 2,
  "notes": "Customer contacted"
}
```

## Health Endpoints
```http
GET /health                 # Basic health check
GET /health/detailed        # Detailed health status
GET /health/database        # Database health
GET /health/cloudinary      # Cloudinary health
```

## Rate Limiting
- Public: 100 requests/15min
- Admin: 500 requests/15min

## Error Codes
- `VALIDATION_ERROR` (400) - Invalid input
- `UNAUTHORIZED` (401) - Missing/invalid auth
- `NOT_FOUND` (404) - Resource not found
- `RATE_LIMIT_EXCEEDED` (429) - Too many requests
- `INTERNAL_SERVER_ERROR` (500) - Server error