const connection = require('./db');

async function testDatabase() {
    try {
        const conn = await connection;

        console.log('Kết nối MySQL thành công!');

        const [rows] = await conn.query('SELECT 1 AS test');

        console.log(rows);

        await conn.end();
    } catch (error) {
        console.error('Kết nối MySQL thất bại!');
        console.error(error.message);
    }
}

testDatabase();
