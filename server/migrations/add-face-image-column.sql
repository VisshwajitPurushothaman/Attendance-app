-- Add face_image column to store base64 encoded face images
ALTER TABLE face_encodings ADD COLUMN face_image LONGTEXT NULL AFTER encoding;
