-- Hide categories removed from the campus directory without deleting historical/admin data.
UPDATE categories
SET is_active = false,
    updated_at = now()
WHERE code IN ('admin', 'other');

UPDATE categories
SET name_vi = 'Bãi giữ xe',
    name_en = 'Parking',
    updated_at = now()
WHERE code = 'parking';

-- A9/A10 are shown as the main-building category; the previous admin category is inactive.
