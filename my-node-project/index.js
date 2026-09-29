const express = require('express');

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

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});