const express = require('express');
const bodyParser = require('body-parser');
const redis = require('redis');
const { promisify } = require("util");
const fs = require('fs');

require('dotenv').config();
const AWS = require("aws-sdk");

// dynamo
const DB_URL = process.env.DB_URL;
const DATABASE_NAME = process.env.DATABASE_NAME;

AWS.config.update({
  region: "us-west-2",
  endpoint: DB_URL
});

const docClient = new AWS.DynamoDB.DocumentClient();

// redis
const REDIS_URL = process.env.REDIS_URL;
const REDIS_KEY = process.env.REDIS_KEY;
const REDIS_TIME = process.env.REDIS_TIME; // in seconds

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

const createTable = async () => {
  const dynamodb = new AWS.DynamoDB();

  const params = {
    TableName: DATABASE_NAME,
    KeySchema: [
      { AttributeName: "year", KeyType: "HASH" },  //Partition key
      { AttributeName: "title", KeyType: "RANGE" }  //Sort key
    ],
    AttributeDefinitions: [
      { AttributeName: "year", AttributeType: "N" },
      { AttributeName: "title", AttributeType: "S" }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 10,
      WriteCapacityUnits: 10
    }
  };

  dynamodb.createTable(params, function (err, data) {
    if (err) {
      console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
    } else {
      console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
    }
  });
}


const load = async () => {
  console.log("Importing movies into DynamoDB. Please wait.");

  const allMovies = JSON.parse(fs.readFileSync('moviedata.json', 'utf8'));

  allMovies.forEach(function (movie) {
    const params = {
      TableName: DATABASE_NAME,
      Item: {
        "year": movie.year,
        "title": movie.title,
        "info": movie.info
      }
    };

    docClient.put(params, function (err, data) {
      if (err) {
        console.error("Unable to add movie", movie.title, ". Error JSON:", JSON.stringify(err, null, 2));
      } else {
        console.log("PutItem succeeded:", movie.title);
      }
    });

  });
}

const init = async () => {
  await createTable()
  const app = express();

  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  // curl -i GET http://localhost:2020/test 
  app.get('/test', (request, response) => 
    response.status(200).json({
      teste: 1, teste_2: 2
    }).end());

  // curl -i GET http://localhost:2020/test/load
  app.get('/test/load', async (request, response) => {
    const res = await load()

    response.status(200).json({
      message: 'foi loadado'
    }).end();

  });

  // // curl -i GET http://localhost:2020/test/find
  // app.get('/test/find', async (request, response) => {

  //   console.log('antes do get')
  //   const data = await getCache(REDIS_KEY);
  //   console.log('depois do get', data)

  //   if (data) {
  //     return response.status(200).json({
  //       message: 'com cache',
  //       data,
  //     }).end();
  //   }

  //   const database = db.getColletion('test');

  //   const res = await database.find().toArray();

  //   if (!data) {
  //     await setCache(REDIS_KEY, res);
  //   }

  //   response.status(200).json({
  //     message: 'sem cache',
  //     data: res,
  //   }).end();

  // });

  // // curl -i POST http://localhost:2020/test/create -H "Content-Type: application/json"   -d "@payload.txt"
  // app.post('/test/create', async (request, response) => {
  //   const database = db.getColletion('test');

  //   console.log('body', request.body)

  //   try {
  //     const res = await database.insertOne(request.body)
  //     console.log('res', res.result)

  //     response.status(200).json({
  //       message: 'oi mano'
  //     }).end();

  //   } catch (e) {
  //     console.log(e)
  //     response.status(500).json({
  //       message: 'OPS', error: e
  //     }).end();
  //   }
  // })

  // // curl -X DELETE http://localhost:2020/test/delete/cache -H "Content-Type: application/json"
  // app.delete('/test/delete/cache', async (request, response) => {
  //   try {
  //     await deleteCache(REDIS_KEY)
  //     console.log('cache deletado')
  //     response.status(200).json({
  //       message: `cache deletado: ${REDIS_KEY}`,
  //     }).end();
  //   } catch (error) {
  //     console.log(error)
  //     response.status(500).json({
  //       message: 'OPS', error
  //     }).end();
  //   }
  // })

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