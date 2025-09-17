# Enhanced Gallery Image Information - Eleven Interior API

## Overview
The Eleven Interior API now provides comprehensive image information for gallery images, including upload time, title, description, and category fields. This document outlines the enhanced features and API response format.

## Enhanced Database Schema

The `media_metadata` table now includes the following fields for rich image information:

- **`title`** - Image title (up to 200 characters)
- **`description`** - Detailed image description (up to 1000 characters)  
- **`category`** - Image category for organization (up to 100 characters)
- **`created_at`** - Upload timestamp (automatically set)
- **`updated_at`** - Last modification timestamp (automatically updated)
- **`alt_text`** - Alternative text for accessibility
- **`sort_order`** - Display order within the gallery section

## Enhanced API Response Format

### Gallery Image Response Structure

```json
{
  "success": true,
  "data": {
    "id": 1,
    "section": "gallery",
    "urls": {
      "original": "https://res.cloudinary.com/...",
      "large": "https://res.cloudinary.com/...",
      "medium": "https://res.cloudinary.com/...",
      "small": "https://res.cloudinary.com/...",
      "thumbnail": "https://res.cloudinary.com/...",
      "webp_large": "https://res.cloudinary.com/...",
      "webp_medium": "https://res.cloudinary.com/..."
    },
    "metadata": {
      "width": 1920,
      "height": 1080,
      "format": "jpg",
      "size": 2048576
    },
    "content": {
      "title": "Luxury Master Bedroom",
      "description": "Elegant master bedroom suite with premium finishes, custom lighting, and spa-like ambiance",
      "alt_text": "Luxurious master bedroom with modern interior design",
      "category": "Residential"
    },
    "sort_order": 0,
    "is_active": true,
    "upload_time": "2024-09-17T10:30:45.123Z",
    "last_updated": "2024-09-17T10:30:45.123Z",
    // Legacy fields for backward compatibility
    "created_at": "2024-09-17T10:30:45.123Z",
    "updated_at": "2024-09-17T10:30:45.123Z"
  },
  "timestamp": "2024-09-17T10:30:45.123Z"
}
```

## Available Categories

The following predefined categories are recommended for consistency:

- **Residential** - Home and residential projects
- **Commercial** - Office buildings and commercial spaces
- **Office** - Corporate office interiors
- **Hospitality** - Hotels, restaurants, and leisure spaces
- **Retail** - Shopping centers and retail stores
- **Healthcare** - Medical facilities and clinics
- **Educational** - Schools and educational institutions
- **Mixed-Use** - Multi-purpose developments

## API Endpoints

### 1. Upload Single Gallery Image

**Endpoint:** `POST /api/images/upload`

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `image` (file) - Image file (required)
- `section` (string) - Must be "gallery"
- `title` (string) - Image title (optional)
- `description` (string) - Image description (optional)
- `category` (string) - Image category (optional)
- `alt_text` (string) - Alt text for accessibility (optional)
- `sort_order` (integer) - Display order (optional, default: 0)

### 2. Upload Multiple Gallery Images

**Endpoint:** `POST /api/images/batch-upload`

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `section` (string) - Must be "gallery"
- `image_1`, `image_2`, ... (files) - Image files (up to 5)
- `title_1`, `title_2`, ... (strings) - Individual titles
- `description_1`, `description_2`, ... (strings) - Individual descriptions
- `category_1`, `category_2`, ... (strings) - Individual categories
- `alt_text_1`, `alt_text_2`, ... (strings) - Individual alt texts
- `sort_order_1`, `sort_order_2`, ... (integers) - Individual sort orders

### 3. Get Gallery Images

**Endpoint:** `GET /api/images/gallery`

**Query Parameters:**
- `limit` (integer) - Number of images to return (optional)
- `offset` (integer) - Number of images to skip (optional, default: 0)
- `include_inactive` (boolean) - Include inactive images (optional, default: false)

### 4. Update Gallery Image

**Endpoint:** `PUT /api/images/gallery/{id}`

**Content-Type:** `application/json`

**Request Body:**
```json
{
  "title": "Updated Image Title",
  "description": "Updated image description",
  "category": "Updated Category",
  "alt_text": "Updated alt text",
  "sort_order": 1,
  "is_active": true
}
```

### 5. Delete Gallery Image

**Endpoint:** `DELETE /api/images/gallery/{id}`

## Time Zone Information

- All timestamps are stored and returned in ISO 8601 format (UTC)
- The `upload_time` field represents when the image was first uploaded
- The `last_updated` field represents when the image metadata was last modified

## Validation Rules

- **Title:** 1-200 characters (optional)
- **Description:** Up to 1000 characters (optional)
- **Category:** Up to 100 characters (optional)
- **Alt Text:** Up to 200 characters (optional)
- **Sort Order:** Non-negative integer (optional, default: 0)
- **Image File:** JPEG, JPG, PNG, WebP, or GIF format, max 10MB

## Example Usage

### Using cURL to Upload with Metadata

```bash
curl -X POST http://127.0.0.1:8787/api/images/upload \
  -F "image=@luxury-bedroom.jpg" \
  -F "section=gallery" \
  -F "title=Luxury Master Bedroom" \
  -F "description=Elegant master bedroom suite with premium finishes, custom lighting, and spa-like ambiance" \
  -F "category=Residential" \
  -F "alt_text=Luxurious master bedroom with modern interior design" \
  -F "sort_order=1"
```

### Using JavaScript Fetch API

```javascript
const formData = new FormData();
formData.append('image', imageFile);
formData.append('section', 'gallery');
formData.append('title', 'Luxury Master Bedroom');
formData.append('description', 'Elegant master bedroom suite with premium finishes, custom lighting, and spa-like ambiance');
formData.append('category', 'Residential');
formData.append('alt_text', 'Luxurious master bedroom with modern interior design');
formData.append('sort_order', '1');

const response = await fetch('/api/images/upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result);
```

## Features Summary

✅ **Upload Time Tracking** - Automatic timestamp recording  
✅ **Rich Metadata** - Title, description, and category support  
✅ **Accessibility Support** - Alt text for screen readers  
✅ **Flexible Organization** - Custom categories and sort orders  
✅ **Responsive URLs** - Multiple image sizes for different devices  
✅ **Batch Upload** - Upload up to 5 images simultaneously  
✅ **Backward Compatibility** - Legacy timestamp fields maintained  
✅ **Validation** - Comprehensive input validation and error handling

## Testing Interface

Use the `test-gallery-upload.html` file to test all gallery image features:

1. Single image upload with full metadata
2. Batch image upload (up to 5 images)
3. Gallery display with enhanced information
4. Visual metadata display including upload time and categories

The testing interface provides a comprehensive UI for exploring all the enhanced gallery image features.