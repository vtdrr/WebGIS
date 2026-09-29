-- =============================================
-- Phenikaa University WebGIS Database Schema
-- =============================================
-- This script runs automatically on first container startup
-- =============================================

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;  -- for similarity search

-- =============================================
-- Categories table
-- =============================================
CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(50) UNIQUE NOT NULL,
  name_vi     VARCHAR(100) NOT NULL,
  name_en     VARCHAR(100),
  icon        VARCHAR(100),
  color       VARCHAR(7) DEFAULT '#3388ff',
  sort_order  INT DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE categories IS 'Danh mục các loại địa điểm trong khuôn viên';
COMMENT ON COLUMN categories.code IS 'Mã định danh duy nhất (building, lab, canteen, dormitory, parking, sports, library, gate, other)';
COMMENT ON COLUMN categories.icon IS 'Tên icon (Lucide/FontAwesome)';
COMMENT ON COLUMN categories.color IS 'Màu hex cho marker trên bản đồ';

-- =============================================
-- Places table
-- =============================================
CREATE TABLE places (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id     INT REFERENCES categories(id) ON DELETE SET NULL,
  code            VARCHAR(50) UNIQUE,               -- Mã phòng/tòa: 'A1-101', 'LIB-MAIN'
  name_vi         VARCHAR(200) NOT NULL,
  name_en         VARCHAR(200),
  description_vi  TEXT,
  description_en  TEXT,

  -- Geometry: Point (tâm) và Polygon (footprint tòa nhà)
  geom_point      GEOMETRY(Point, 4326),
  geom_polygon    GEOMETRY(Polygon, 4326),

  -- Metadata
  floor           INT,                              -- Tầng (NULL = cả tòa nhà)
  opening_hours   JSONB,                            -- {"mon-fri": "07:00-22:00", "sat": "08:00-17:00", "sun": "closed"}
  contact_phone   VARCHAR(20),
  contact_email   VARCHAR(100),
  images          JSONB DEFAULT '[]'::jsonb,        -- [{"url": "...", "caption": "..."}]
  attributes      JSONB DEFAULT '{}'::jsonb,        -- Flexible: capacity, equipment, wheelchair_access, has_wifi, has_ac...

  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE places IS 'Các địa điểm cụ thể trong khuôn viên trường';
COMMENT ON COLUMN places.geom_point IS 'Điểm đại diện (centroid) cho hiển thị marker';
COMMENT ON COLUMN places.geom_polygon IS 'Polygon footprint tòa nhà/vùng đất';
COMMENT ON COLUMN places.opening_hours IS 'Giờ mở cửa theo ngày trong tuần (JSONB)';
COMMENT ON COLUMN places.attributes IS 'Thuộc tính mở rộng (sức chứa, thiết bị, điều hòa, wifi, tiếp cận khuyết tật...)';

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX idx_places_geom_point ON places USING GIST (geom_point);
CREATE INDEX idx_places_geom_polygon ON places USING GIST (geom_polygon);
CREATE INDEX idx_places_category ON places (category_id);
CREATE INDEX idx_places_code ON places (code);
CREATE INDEX idx_places_floor ON places (floor);

-- Full-text search (using 'simple' config for multilingual support)
-- 'simple' config works for any language without stemming
ALTER TABLE places ADD COLUMN search_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(name_vi, '') || ' ' || coalesce(description_vi, '') || ' ' || coalesce(code, ''))
  ) STORED;
CREATE INDEX idx_places_search ON places USING GIN (search_tsv);

-- Trigram similarity for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_places_name_trgm ON places USING GIN (name_vi gin_trgm_ops);
CREATE INDEX idx_places_code_trgm ON places USING GIN (code gin_trgm_ops);

-- =============================================
-- Updated_at trigger
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_places_updated_at
  BEFORE UPDATE ON places FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Default categories seed data
-- =============================================
INSERT INTO categories (code, name_vi, name_en, icon, color, sort_order) VALUES
  ('building',      'Tòa nhà chính',           'Main Building',       'building',      '#1e3a8a', 10),
  ('classroom',     'Phòng học/Giảng đường',   'Classroom/Lecture',   'graduation-cap','#059669', 20),
  ('lab',           'Phòng thí nghiệm',        'Laboratory',          'flask-conical', '#dc2626', 30),
  ('library',       'Thư viện',                'Library',             'book-open',     '#7c3aed', 40),
  ('canteen',       'Căng tin/Nhà ăn',         'Canteen',             'utensils',      '#ea580c', 50),
  ('dormitory',     'Ký túc xá',               'Dormitory',           'home',          '#0891b2', 60),
  ('parking',       'Bãi đỗ xe',               'Parking',             'parking-circle','#6b7280', 70),
  ('sports',        'Sân thể thao/Gym',        'Sports Facility',     'dumbbell',      '#16a34a', 80),
  ('gate',          'Cổng ra vào',             'Gate',                'door-open',     '#64748b', 90),
  ('admin',         'Phòng ban hành chính',    'Admin Office',        'briefcase',     '#475569', 100),
  ('medical',       'Trạm y tế',               'Medical Center',      'cross',         '#ef4444', 110),
  ('other',         'Khác',                    'Other',               'map-pin',       '#9ca3af', 999)
ON CONFLICT (code) DO UPDATE SET
  name_vi = EXCLUDED.name_vi,
  name_en = EXCLUDED.name_en,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order;

-- =============================================
-- Sample places (will be replaced by real data import)
-- =============================================
-- Bounds Phenikaa University approx: 21.287°N, 105.782°E
INSERT INTO places (category_id, code, name_vi, name_en, geom_point, geom_polygon, floor, opening_hours, attributes)
SELECT
  c.id,
  'A1-MAIN',
  'Tòa nhà A1 - Khu A',
  'Building A1 - Zone A',
  ST_SetSRID(ST_MakePoint(105.7825, 21.2872), 4326)::geometry(Point, 4326),
  ST_SetSRID(ST_GeomFromText('POLYGON((105.7820 21.2870, 105.7830 21.2870, 105.7830 21.2874, 105.7820 21.2874, 105.7820 21.2870))'), 4326)::geometry(Polygon, 4326),
  NULL,
  '{"mon-fri": "07:00-22:00", "sat": "07:00-17:00", "sun": "closed"}'::jsonb,
  '{"floors": 5, "has_elevator": true, "has_wifi": true}'::jsonb
FROM categories c WHERE c.code = 'building'
ON CONFLICT (code) DO NOTHING;

INSERT INTO places (category_id, code, name_vi, name_en, geom_point, floor, opening_hours, attributes)
SELECT
  c.id,
  'A1-101',
  'Phòng học A1-101',
  'Classroom A1-101',
  ST_SetSRID(ST_MakePoint(105.7825, 21.2872), 4326)::geometry(Point, 4326),
  1,
  '{"mon-fri": "07:00-22:00", "sat": "07:00-17:00"}'::jsonb,
  '{"capacity": 60, "has_projector": true, "has_ac": true, "has_wifi": true}'::jsonb
FROM categories c WHERE c.code = 'classroom'
ON CONFLICT (code) DO NOTHING;

INSERT INTO places (category_id, code, name_vi, name_en, geom_point, opening_hours, attributes)
SELECT
  c.id,
  'LIB-MAIN',
  'Thư viện chính',
  'Main Library',
  ST_SetSRID(ST_MakePoint(105.7832, 21.2868), 4326)::geometry(Point, 4326),
  '{"mon-fri": "07:00-22:00", "sat": "08:00-20:00", "sun": "08:00-17:00"}'::jsonb,
  '{"capacity": 500, "has_wifi": true, "has_ac": true, "wheelchair_access": true}'::jsonb
FROM categories c WHERE c.code = 'library'
ON CONFLICT (code) DO NOTHING;

-- =============================================
-- Helpful views
-- =============================================
CREATE OR REPLACE VIEW v_places_with_category AS
SELECT
  p.*,
  c.code as category_code,
  c.name_vi as category_name_vi,
  c.name_en as category_name_en,
  c.icon as category_icon,
  c.color as category_color
FROM places p
LEFT JOIN categories c ON p.category_id = c.id;

-- View for GeoJSON export
CREATE OR REPLACE VIEW v_places_geojson AS
SELECT
  jsonb_build_object(
    'type', 'FeatureCollection',
    'features', jsonb_agg(
      jsonb_build_object(
        'type', 'Feature',
        'id', id,
        'geometry', ST_AsGeoJSON(COALESCE(geom_polygon, geom_point))::jsonb,
        'properties', jsonb_build_object(
          'code', code,
          'name_vi', name_vi,
          'name_en', name_en,
          'category_code', category_code,
          'category_name_vi', category_name_vi,
          'category_color', category_color,
          'floor', floor,
          'opening_hours', opening_hours
        )
      )
    )
  ) as geojson
FROM v_places_with_category
WHERE geom_point IS NOT NULL OR geom_polygon IS NOT NULL;