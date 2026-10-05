import { query } from './pool.js';
import { config } from '../config/index.js';

async function seed(): Promise<void> {
  console.log('🌱 Seeding database...');

  // Categories are already seeded in init.sql via ON CONFLICT DO UPDATE
  // This script can be extended for additional seed data

  const categoriesResult = await query('SELECT code, name_vi FROM categories ORDER BY sort_order');
  console.log(`📂 Categories (${categoriesResult.rowCount}):`);
  categoriesResult.rows.forEach((c) => console.log(`  - ${c.code}: ${c.name_vi}`));

  const placesResult = await query('SELECT code, name_vi, category_id FROM places ORDER BY code');
  console.log(`📍 Places (${placesResult.rowCount}):`);
  placesResult.rows.forEach((p) => console.log(`  - ${p.code}: ${p.name_vi} (cat: ${p.category_id})`));

  // Verify spatial data
  const spatialCheck = await query(`
    SELECT
      COUNT(*) FILTER (WHERE geom_point IS NOT NULL) as with_point,
      COUNT(*) FILTER (WHERE geom_polygon IS NOT NULL) as with_polygon,
      COUNT(*) as total
    FROM places
  `);
  console.log('🗺️ Spatial data:', spatialCheck.rows[0]);

  // Verify routing graph
  const pathCheck = await query(`
    SELECT COUNT(*) as total_paths,
           COUNT(DISTINCT source_code) as connected_places
    FROM campus_paths
  `);
  console.log('🧭 Routing graph:', pathCheck.rows[0]);

  console.log('✅ Seed verification completed');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seed failed:', err);
      process.exit(1);
    });
}

export { seed };