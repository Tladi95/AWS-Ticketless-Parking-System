CREATE TABLE IF NOT EXISTS parking_sessions (
  session_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_plate     VARCHAR(15) NOT NULL,
  s3_image_url      TEXT NOT NULL,
  entry_timestamp   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  exit_timestamp    TIMESTAMP WITH TIME ZONE,
  session_status    VARCHAR(20) DEFAULT 'ACTIVE',
  calculated_fee    DECIMAL(8,2) DEFAULT 0.00
);
