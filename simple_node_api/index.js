const express = require('express');
const bodyParser = require('body-parser');

const init = async () => {
    const app = express();

    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());

    // curl -i GET http://localhost:3030/test 
    app.get('/test', (request, response) => {
        console.log('\n\nEITA', request.config)

        response.status(200).json({
            teste: 1, teste_2: 2
        }).end();

    });

    // curl -i GET http://localhost:3030/test/oi
    app.get('/test/oi', (request, response) => {
        console.log('\n\nEITA', request.config)

        response.status(200).json({
            message: 'oi mano'
        }).end();

    });

    await app.listen(3030);

    console.log('estamos on the line')
};

(async () => await init())()