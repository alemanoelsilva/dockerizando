require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');

const {
  DB_URL,
  DATABASE_NAME,
  TABLE_NAME,
} = process.env;

const Influx = require('influxdb-nodejs');

const TYPE = {
  INTEGER: 'i',
  STRING: 's',
  FLOAT: 'f',
  BOOLEAN: 'bi',
}

const TAG_TYPE = {
  '10X': '1',
  '20X': '2',
  '30X': '3',
  '40X': '4',
  '50X': '5',
}

const tableSchema = {
  use: TYPE.INTEGER,
  bytes: TYPE.INTEGER,
  url: TYPE.STRING,
}

const SPDY = {
  SPEEDY: 'speedy',
  FAST: 'fast',
  SLOW: 'slow',
}

const METHOD = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
  '*': ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
}

const tableTags = {
  spdy: Object.values(SPDY),
  method: METHOD['*'],
  type: Object.values(TAG_TYPE)
}

const createTable = (influx) => {
  try {
    influx.schema(TABLE_NAME, tableSchema, tableTags, {
      // default is false
      stripUnknown: true,
    })
  } catch (error) {
    console.log(`createTable error..: ${error}`)
  }
}

const init = async () => {
  console.log(`influxDB..: ${DB_URL}/${DATABASE_NAME}`)

  const influxdb = new Influx(`${DB_URL}/${DATABASE_NAME}`)

  createTable(influxdb)

  const app = express();

  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  // curl -i GET http://localhost:2020/influx 
  app.get('/influx', (request, response) => {
    console.log('\n\nEITA', request.config)

    response.status(200).json({
      teste: 1, teste_2: 2
    }).end();

  });

  // curl -i GET http://localhost:2020/influx/find?spdy=1&method=GET&use=200
  app.get('/influx/find', async (request, response) => {
    console.log('query', request.query)

    const { spdy, method, use } = request.query

    try {
      const res = await influxdb
        .query(TABLE_NAME)
        .where('spdy', spdy)
        .where('method', method)
        .where('use', use, '>=')

      response.status(200).json({
        message: 'iupi',
        data: res,
      }).end();
    } catch (error) {
      console.error(error)

      response.status(500).json({
        message: 'nao foi dessa vez irmão',
        data: error.message,
      }).end();
    }
  });

  // curl -i POST http://localhost:2020/influx/create -H "Content-Type: application/json" -d "@payload.txt"
  app.post('/influx/create', async (request, response) => {
    console.log('body', request.body)

    const { use, bytes, url } = request.body

    try {
      const res = await influxdb
        .write(TABLE_NAME)
        .tag({
          spdy: SPDY.FAST,
          method: METHOD.GET,
          type: TAG_TYPE['20X'],
        })
        .field({ use, bytes, url })

      response.status(200).json({
        message: 'iupi',
        data: res,
      }).end();
    } catch (error) {
      console.error(error)

      response.status(500).json({
        message: 'nao foi dessa vez irmão',
        data: error.message,
      }).end();
    }
  })

  await app.listen(2020);

  console.log('estamos on the line')
};

(async () => await init())()