require('express')()
    .post('/', (req, res) => { req.sBody=''; req.on('data', b => req.sBody += b); req.on('end', () => console.log(req.sBody)); res.status(200).end(); })
    .listen(8080);