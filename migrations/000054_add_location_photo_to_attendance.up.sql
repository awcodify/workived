-- Add location and photo tracking to attendance records
ALTER TABLE attendance_records
ADD COLUMN IF NOT EXISTS clock_in_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS clock_in_longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS clock_in_photo_url TEXT,
ADD COLUMN IF NOT EXISTS clock_out_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS clock_out_longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS clock_out_photo_url TEXT,
ADD COLUMN IF NOT EXISTS work_location_type VARCHAR(20) CHECK (work_location_type IN ('office', 'remote', 'client_site'));

COMMENT ON COLUMN attendance_records.clock_in_latitude IS 'GPS latitude at clock-in';
COMMENT ON COLUMN attendance_records.clock_in_longitude IS 'GPS longitude at clock-in';
COMMENT ON COLUMN attendance_records.clock_in_photo_url IS 'S3 URL of clock-in selfie';
COMMENT ON COLUMN attendance_records.clock_out_latitude IS 'GPS latitude at clock-out';
COMMENT ON COLUMN attendance_records.clock_out_longitude IS 'GPS longitude at clock-out';
COMMENT ON COLUMN attendance_records.clock_out_photo_url IS 'S3 URL of clock-out selfie';
COMMENT ON COLUMN attendance_records.work_location_type IS 'Where employee is working from';
