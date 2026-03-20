# Facial Recognition Image Storage - Setup Guide

## Changes Made

The facial recognition system now properly saves both the face encoding **AND** the actual image in MySQL.

### 1. **Database Schema Updated**
- Added `face_image` column to `face_encodings` table
- Stores base64-encoded image data (data:image/jpeg;base64,...)
- Type: `LONGTEXT` to accommodate large images

### 2. **Backend API Updated (`server/routes/face.ts`)**
- Updated `/api/face/store-face` endpoint to accept `imageData` parameter
- Stores both `encoding` (face descriptor) and `imageData` (base64 image)
- Properly handles updates to existing face records with new images

### 3. **Frontend Updated (`client/pages/AttendanceMarking.tsx`)**
- Captures image as base64 using `getScreenshot()`
- Sends both image data and face encoding to backend
- Image is stored immediately on face registration

## Installation Steps

### Step 1: Run the Migration
```bash
npm run migrate
# or
pnpm migrate
```

This will automatically:
- Check if the `face_image` column exists
- Create it if missing
- Skip if already present

### Step 2: Restart Development Server
```bash
npm run dev
# or
pnpm dev
```

### Step 3: Test Face Registration

1. Go to **Attendance Marking** page
2. Select **Facial Recognition**
3. Click **Capture Face to Register**
4. Allow camera access
5. The image will now be properly saved to the database

## Database Schema

```sql
CREATE TABLE `face_encodings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `encoding` TEXT NOT NULL,           -- JSON array of face descriptors
  `face_image` LONGTEXT NULL,         -- Base64 encoded image (NEW!)
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `face_encodings_user_id_fk` FOREIGN KEY (`user_id`) 
    REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## What's Stored

For each user's face registration, the system now stores:

1. **face_image** (NEW)
   - Format: Base64 data URL (e.g., `data:image/jpeg;base64,...`)
   - Size: ~200-500KB per image (compressed JPEG)
   - Use: Visual verification, debugging, display in admin panel

2. **encoding**
   - Format: JSON array of 128 numeric values
   - Size: ~1.5KB per face
   - Use: Face matching algorithm, verification

## API Endpoint Changes

### POST `/api/face/store-face`

**Before:**
```json
{
  "userId": 1,
  "encoding": [0.123, -0.456, ...] // 128 values
}
```

**After:**
```json
{
  "userId": 1,
  "encoding": [0.123, -0.456, ...], // 128 values
  "imageData": "data:image/jpeg;base64,/9j/4AAQSkZJRg..." // Full image
}
```

## Verification

To verify images are being saved:

### MySQL Query
```sql
SELECT 
  u.name,
  LEFT(fe.face_image, 50) as image_preview,
  LENGTH(fe.face_image) as image_size_bytes,
  fe.created_at
FROM face_encodings fe
JOIN users u ON fe.user_id = u.id;
```

Expected output:
- `image_preview`: Should start with `data:image/jpeg;base64,`
- `image_size_bytes`: Should be >100,000 bytes (100KB+)

### In Frontend
To display saved face image:
```typescript
const faceEncoding = await fetch(`/api/face/get-face/${userId}`).then(r => r.json());
const img = document.createElement('img');
img.src = faceEncoding.faceImage; // Direct base64 URL
document.body.appendChild(img);
```

## Performance Notes

⚠️ **Note on Large Datasets:**
- Each face image is ~200-500KB
- 1000 users = ~200-500MB database size
- Consider compression or external storage (S3, Cloudinary) for production

## Future Improvements

1. **Image Compression:** Reduce image size before storage
2. **External Storage:** Store images in AWS S3 instead of database
3. **Image Preview API:** Create endpoint to fetch and display face images
4. **Batch Operations:** Allow bulk face registration with images
5. **Image Quality Check:** Validate image quality before storage

## Troubleshooting

### Issue: "face_image column already exists"
- This is fine! Migration script handles this gracefully.

### Issue: Images not showing in database
1. Check migration ran: `pnpm migrate`
2. Verify api returns `imageData` in response
3. Check browser console for errors during capture

### Issue: Database size growing too fast
- Implement image compression
- Or use external storage service

