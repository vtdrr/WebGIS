const connection = require('./db');

async function analyzeDatabase() {
    try {
        const conn = await connection;
        console.log('✅ Kết nối MySQL thành công!\n');

        // 1. Liệt kê tất cả tables
        console.log('=== DANH SÁCH TABLES ===');
        const [tables] = await conn.query('SHOW TABLES');
        console.table(tables);

        // 2. Phân tích từng table
        for (const tableRow of tables) {
            const tableName = Object.values(tableRow)[0];
            console.log(`\n=== PHÂN TÍCH TABLE: ${tableName} ===`);

            // Cấu trúc cột
            const [columns] = await conn.query(`DESCRIBE \`${tableName}\``);
            console.log('📋 CẤU TRÚC CỘT:');
            console.table(columns);

            // Indexes
            const [indexes] = await conn.query(`SHOW INDEX FROM \`${tableName}\``);
            console.log('🔍 INDEXES:');
            console.table(indexes);

            // Kiểm tra spatial columns
            const spatialCols = columns.filter(c =>
                c.Type.toLowerCase().includes('geometry') ||
                c.Type.toLowerCase().includes('point') ||
                c.Type.toLowerCase().includes('linestring') ||
                c.Type.toLowerCase().includes('polygon') ||
                c.Type.toLowerCase().includes('multipoint') ||
                c.Type.toLowerCase().includes('multilinestring') ||
                c.Type.toLowerCase().includes('multipolygon') ||
                c.Type.toLowerCase().includes('geometrycollection')
            );

            if (spatialCols.length > 0) {
                console.log('🗺️  SPATIAL COLUMNS DETECTED:');
                console.table(spatialCols);
            }

            // Sample data (5 rows)
            const [sample] = await conn.query(`SELECT * FROM \`${tableName}\` LIMIT 5`);
            console.log('📊 SAMPLE DATA (5 rows):');
            console.table(sample);

            // Row count
            const [countResult] = await conn.query(`SELECT COUNT(*) as total FROM \`${tableName}\``);
            console.log(`📈 TOTAL ROWS: ${countResult[0].total}`);

            // Foreign keys
            const [fk] = await conn.query(`
                SELECT
                    CONSTRAINT_NAME,
                    COLUMN_NAME,
                    REFERENCED_TABLE_NAME,
                    REFERENCED_COLUMN_NAME
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = '${tableName}'
                AND REFERENCED_TABLE_NAME IS NOT NULL
            `);
            if (fk.length > 0) {
                console.log('🔗 FOREIGN KEYS:');
                console.table(fk);
            }
        }

        // 3. Kiểm tra MySQL version & spatial support
        console.log('\n=== MYSQL VERSION & SPATIAL SUPPORT ===');
        const [version] = await conn.query('SELECT VERSION() as version');
        console.log(`MySQL Version: ${version[0].version}`);

        const [spatialSupport] = await conn.query("SHOW VARIABLES LIKE 'have_geometry'");
        console.log(`Geometry Support: ${spatialSupport[0].Value}`);

        // 4. Kiểm tra SRID support
        const [srids] = await conn.query('SELECT * FROM INFORMATION_SCHEMA.ST_SPATIAL_REFERENCE_SYSTEMS LIMIT 10');
        console.log('\n📐 SPATIAL REFERENCE SYSTEMS (sample):');
        console.table(srids);

        await conn.end();
        console.log('\n✅ Phân tích hoàn tất!');

    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        console.error(error);
    }
}

analyzeDatabase();
