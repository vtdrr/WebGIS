const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function importDatabase() {
    const sql = fs.readFileSync('./STUDENTREG.sql', 'utf8');

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        multipleStatements: true,
        ssl: {
            ca: fs.readFileSync('./ca.pem')
        }
    });

    try {
        console.log('Đang kết nối Aiven...');

        await connection.query('SET SESSION sql_require_primary_key = 0');

        await connection.query(sql);

        console.log('Import STUDENTSREG thành công!');
    } catch (error) {
        console.error('Import thất bại!');
        console.error(error.message);
    } finally {
        await connection.end();
    }
}

importDatabase();
