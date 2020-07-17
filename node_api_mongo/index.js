const MongoClient = require('mongodb').MongoClient;
const dotenv = require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');

// Connection URL
const URL = process.env.DB_URL;
 
console.log('URL', URL)

// Database Name
const DATABASE_NAME = 'myproject';
 
// Use connect method to connect to the server

let CONN = {}

const mongo = (url, dbName) => ({
    connect: async () => 
        MongoClient.connect(url, (err, client) => {
            err ? console.log(err) : ''

            console.log('connectou manolo :)')

            CONN = client
        }),

    getColletion: (colletionName) => CONN.db(dbName).collection(colletionName),

    disconnect: async () => CONN.close(),
})

const init = async () => {
    const app = express();

    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());

    const db = await mongo(URL, DATABASE_NAME);
    db.connect();

    console.log('db', db)

    // curl -i GET http://localhost:2020/test 
    app.get('/test', (request, response) => {
        console.log('\n\nEITA', request.config)

        response.status(200).json({
            teste: 1, teste_2: 2
        }).end();

    });

    // curl -i GET http://localhost:2020/test/find
    app.get('/test/find', async (request, response) => {
        const database = db.getColletion('test');

        const res = await database.find().toArray()

        response.status(200).json({
            message: 'oi mano',
            data: res,
        }).end();

    });

    // curl -i POST http://localhost:2020/test/create -H "Content-Type: application/json"   -d "@payload.txt"

    app.post('/test/create',  async (request, response) => {
        const database = db.getColletion('test');

        console.log('body', request.body)

        try {
            const res = await database.insertOne(request.body)
            console.log('res', res)

            response.status(200).json({
                message: 'oi mano'
            }).end();

        } catch (e) {
            console.log(e)
            response.status(500).json({
                message: 'OPS', error: e
            }).end();
        }


        

    })

    await app.listen(2020);

    console.log('estamos on the line')
};

(async () => await init())()

/**
 * 
 * mongo: docker run --name mongo-teste -p 27017:27017   -d mongo
 */