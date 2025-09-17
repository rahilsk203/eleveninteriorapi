# Multiple Video Upload Feature

## Overview
Added batch/multiple video upload functionality to the Eleven Interior API, allowing users to upload up to 5 videos simultaneously.

## New Features

### 1. Batch Video Upload Endpoint
- **Endpoint**: `POST /api/v1/admin/videos/batch-upload`
- **Authentication**: Requires Admin API Key
- **Max Videos**: 5 videos per batch
- **Sections**: hero, feature

### 2. Individual Video Metadata Support
Each video in a batch can have its own:
- Title (optional)
- Description (optional)
- Alt text (optional)
- Sort order (auto-assigned based on upload order)

### 3. Parallel Processing
- Videos are uploaded in parallel for better performance
- Individual success/failure tracking for each video
- Comprehensive response with detailed results

## API Usage

### Single Video Upload (Existing)
```http
POST /api/v1/admin/videos/upload
Content-Type: multipart/form-data
X-API-Key: your-admin-api-key

Form Data:
- video: (file)
- section: hero|feature
- title: (optional)
- description: (optional)
- alt_text: (optional)
```

### Batch Video Upload (New)
```http
POST /api/v1/admin/videos/batch-upload
Content-Type: multipart/form-data
X-API-Key: your-admin-api-key

Form Data:
- section: hero|feature
- video_0: (file)
- title_0: (optional)
- description_0: (optional)
- alt_text_0: (optional)
- video_1: (file)
- title_1: (optional)
- description_1: (optional)
- alt_text_1: (optional)
... up to video_4
```

## Response Format

### Batch Upload Response
```json
{
  "success": true,
  "data": {
    "message": "Batch upload completed. 3 successful, 0 failed.",
    "section": "hero",
    "successful_uploads": [
      {
        "id": 1,
        "section": "hero",
        "cloudinary_public_id": "hero_video_123456789_0",
        "urls": {
          "original": "https://res.cloudinary.com/...",
          "hd": "https://res.cloudinary.com/...",
          "sd": "https://res.cloudinary.com/...",
          "mobile": "https://res.cloudinary.com/..."
        },
        "metadata": {
          "width": 1920,
          "height": 1080,
          "duration": 30.5,
          "format": "mp4",
          "size": 15728640
        },
        "content": {
          "title": "Hero Video 1",
          "description": "Main hero video",
          "alt_text": "Interior design showcase"
        },
        "uploaded_at": "2025-09-17T07:52:15.123Z"
      }
      // ... more successful uploads
    ],
    "failed_uploads": [
      {
        "index": 2,
        "error": "File too large. Maximum size: 100MB"
      }
      // ... any failed uploads
    ],
    "summary": {
      "total": 3,
      "successful": 2,
      "failed": 1
    }
  },
  "timestamp": "2025-09-17T07:52:15.123Z"
}
```

## Features & Limitations

### Features
✅ Upload up to 5 videos simultaneously  
✅ Individual metadata for each video  
✅ Parallel processing for better performance  
✅ Detailed success/failure reporting  
✅ Automatic sort order assignment  
✅ Multiple video format support (mp4, webm, ogg, mov, avi)  
✅ Video optimization with multiple quality variants  
✅ Cloudinary integration with organized folder structure  

### Limitations
- Maximum 5 videos per batch upload
- Maximum file size: 100MB per video
- Hero and Feature sections only (same as single upload)
- Existing videos in section are replaced (same behavior as single upload)

## File Organization
Videos are organized in Cloudinary following the pattern:
```
eleven-interior/videos/{section}/{section}_video_{timestamp}_{index}
```

Example:
- `eleven-interior/videos/hero/hero_video_1758103973511_0`
- `eleven-interior/videos/hero/hero_video_1758103973511_1`
- `eleven-interior/videos/feature/feature_video_1758103973511_0`

## Test Interface
A comprehensive test interface is available at:
- File: `test-video-upload.html`
- Features: Tabbed interface for single and batch uploads
- Support: Dynamic video input addition/removal
- Testing: Both upload modes with real-time feedback

## Technical Implementation

### New Schema
```javascript
const batchVideoUploadSchema = z.object({
  section: z.enum(['hero', 'feature']),
  videos: z.array(z.object({
    title: z.string().max(200).optional(),
    description: z.string().max(1000).optional(),
    alt_text: z.string().max(200).optional()
  })).max(5)
});
```

### Error Handling
- Individual video validation
- File type and size checking
- Graceful failure handling
- Detailed error reporting per video

### Performance Optimizations
- Parallel upload processing using Promise.all()
- Cloudinary signature optimization
- Database batch operations
- Efficient error collection and reporting

## Security
- Same security model as single upload
- Admin API key authentication required
- Input validation and sanitization
- File type and size restrictions
- Rate limiting applies to batch uploads

## Deployment Status
✅ **Production Ready**  
- Deployed to: `https://eleven-interior-api.aichatapi.workers.dev`
- Version: b4b9d069-d7d3-44ec-bcdd-38d5ee026566
- Status: Active and tested

---

**Note**: This feature maintains backward compatibility with existing single video upload functionality while adding powerful batch upload capabilities for improved workflow efficiency.