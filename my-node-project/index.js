const express = require('express');
const connection = require('./db');
const { sql, update } = require('./query');

const app = express();

// Cho phép đọc JSON trong request body
app.use(express.json());

// GET
app.get('/', (req, res) => {
    res.send('Hello from Node.js server!');
});

// POST
app.post('/api/post', (req, res) => {
    const param = req.query.id;
    const body = req.body;
    const headers = req.headers;
    const idHeader = req.headers['idheader'];

    console.log('Query:', param);
    console.log('Body:', body);
    console.log('Header idheader:', idHeader);

    res.json({
        message: 'This is a POST request test!',
        param: param,
        body: body,
        idHeader: idHeader,
        headers: headers
    });
});

const port = 3000;

app.get('/api/dbconn', async (req, res) => {
    try {
        const conn = await connection;

        const [rows] = await conn.query(sql);

        res.json({
            message: 'Kết nối database thành công!',
            data: rows
        });
    } catch (error) {
        console.error(error.message);

        res.status(500).json({
            message: 'Kết nối database thất bại!',
            error: error.message
        });
    }
});

app.get('/api/update', async (req, res) => {
    try {
        const conn = await connection;

        const [result] = await conn.query(update);

        res.json({
            message: 'Update thành công!',
            result: result
        });
    } catch (error) {
        console.error(error.message);

        res.status(500).json({
            message: 'Update thất bại!',
            error: error.message
        });
    }
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});