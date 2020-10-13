require('express')()
    .post('/', (req, res) => {
        req.sBody='';
        req.on('data', b => req.sBody += b);
        req.on('end', () => {
            console.log(req.sBody);
            res.status(200).end();
        });
    })
    .listen(parseInt(process.env.PORT) || 8080, ()=>{
        console.error('logs writer listening on port', parseInt(process.env.PORT) || 8080);
    });
