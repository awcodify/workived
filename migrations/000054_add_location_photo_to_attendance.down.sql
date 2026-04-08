-- Remove location and photo tracking from attendance records
ALTER TABLE attendance_records
DROP COLUMN IF EXISTS clock_in_latitude,
DROP COLUMN IF EXISTS clock_in_longitude,
DROP COLUMN IF EXISTS clock_in_photo_url,
DROP COLUMN IF EXISTS clock_out_latitude,
DROP COLUMN IF EXISTS clock_out_longitude,
DROP COLUMN IF EXISTS clock_out_photo_url,
DROP COLUMN IF EXISTS work_location_type;
