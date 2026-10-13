ALTER TABLE places
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS osm_type VARCHAR(8),
  ADD COLUMN IF NOT EXISTS osm_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'places_source_check') THEN
    ALTER TABLE places ADD CONSTRAINT places_source_check CHECK (source IN ('sample', 'manual', 'osm'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'places_osm_identity_check') THEN
    ALTER TABLE places ADD CONSTRAINT places_osm_identity_check CHECK ((osm_type IS NULL) = (osm_id IS NULL));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_places_osm_identity
  ON places (osm_type, osm_id);
CREATE INDEX IF NOT EXISTS idx_places_source ON places (source);

UPDATE places
SET source = 'sample'
WHERE code IN ('A1-MAIN', 'A1-101', 'LIB-MAIN', 'CAN-MAIN', 'ADM-MAIN', 'DOR-A', 'PK-MAIN', 'SPT-MAIN', 'GATE-S', 'GATE-N');
