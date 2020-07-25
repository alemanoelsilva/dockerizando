const MongoClient = require('mongodb').MongoClient;
const dotenv = require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const redis = require('redis');
const { promisify } = require("util");

// Connection URL
const URL = process.env.DB_URL;
const REDIS_URL = process.env.REDIS_URL;
const REDIS_KEY = process.env.REDIS_KEY;
const REDIS_TIME = process.env.REDIS_TIME; // in seconds

console.log('MONGO_URL', URL)
console.log('REDIS_URL', REDIS_URL)

// Database Name
const DATABASE_NAME = process.env.DATABASE_NAME;

// Use connect method to connect to the server

let CONN = {}

const client = redis.createClient(REDIS_URL)


const getAsync = promisify(client.get).bind(client);
const setAsync = promisify(client.set).bind(client);
const expireAsync = promisify(client.expire).bind(client);
const delAsync = promisify(client.del).bind(client);

const getCache = async (key) => {
  try {
    const data = await getAsync(key)
    console.log('oba ', data)
    return JSON.parse(data)
  } catch (error) {
    console.log('erro no getCache', error)
    return null
  }
}

const setCache = async (key, data) => {
  try {
    await setAsync(key, JSON.stringify(data))
    await expireAsync(key, REDIS_TIME) // key, time
    return data
  } catch (error) {
    console.log('erro no setCache', error)
    return null
  }
}

const deleteCache = async key => delAsync(key);

const removeCache = (key) => { }

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

    console.log('antes do get')
    const data = await getCache(REDIS_KEY);
    console.log('depois do get', data)

    if (data) {
      return response.status(200).json({
        message: 'com cache',
        data,
      }).end();
    }

    const database = db.getColletion('test');

    const res = await database.find().toArray();

    if (!data) {
      await setCache(REDIS_KEY, res);
    }

    response.status(200).json({
      message: 'sem cache',
      data: res,
    }).end();

  });

  // curl -i POST http://localhost:2020/test/create -H "Content-Type: application/json"   -d "@payload.txt"
  app.post('/test/create', async (request, response) => {
    const database = db.getColletion('test');

    console.log('body', request.body)

    try {
      const res = await database.insertOne(request.body)
      console.log('res', res.result)

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

  // curl -X DELETE http://localhost:2020/test/delete/cache -H "Content-Type: application/json"
  app.delete('/test/delete/cache', async (request, response) => {
    try {
      await deleteCache(REDIS_KEY)
      console.log('cache deletado')
      response.status(200).json({
        message: `cache deletado: ${REDIS_KEY}`,
      }).end();
    } catch (error) {
      console.log(error)
      response.status(500).json({
        message: 'OPS', error
      }).end();
    }
  })

  await app.listen(2020);

  console.log('estamos on the line')
};

(async () => await init())()

/**
 *
 * mongo: docker run --name mongo-teste -p 27017:27017 -d mongo
 * redis: docker run --name redis-teste -p 6379:6379 -d redis:alpine
 *
 * docker rm $(docker ps -a -q)
*/