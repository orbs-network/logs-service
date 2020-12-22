require('express')()
    .post('/', (req, res) => {
        req.sBody = '';
        req.on('data', b => req.sBody += b);
        req.on('end', () => {
            res.status(200).end();
        });
    })
    .listen(8080, () => {
        console.error('logs writer listening on port', 8080);
    });
