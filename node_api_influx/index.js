require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');

const CRASH = 1

const {
  DB_URL,
  DATABASE_NAME,
  TABLE_NAME,
} = process.env;

// const Influx = require('influxdb-nodejs');

const Influx = require('influx');

const createTable = async () => {
  try {
    const influx = new Influx.InfluxDB({
      host: DB_URL,
      database: DATABASE_NAME,
      schema: [
        {
          measurement: 'tide',
          fields: { height: Influx.FieldType.FLOAT },
          tags: ['unit', 'location']
        }
      ]
    });

    console.log('conectou influx, influx!!', influx)
    return influx
  } catch (error) {
    console.error('oh no, this influx is not the same', error)
    process.exit(CRASH)
  }
}

const checkInfluxDB = async (influxDB) => {
  try {
    const databaseNames = await influxDB.getDatabaseNames()

    const mydb = databaseNames.some(name => name === DATABASE_NAME)

    if (!mydb) {
      await influxDB.createDatabase(DATABASE_NAME)
      console.log('Creating my database')
      return false
    }

    console.log('It was not necessary create my database')
    return true
  } catch (error) {
    console.error('oh no, this influx is not the same', error)
    process.exit(CRASH)
  }
}

const save = influxDB => async ({ unit, location, height }) => {
  try {
    const point = await influxDB.writePoints([
      {
        measurement: TABLE_NAME,
        tags: {
          unit,
          location,
        },
        fields: { height },
        timestamp: new Date(),
      }
    ])

    console.log('The data was created with no problem at all')
    return point
  } catch (error) {
    console.error('oh no, this influx is not the same', error.message)
    process.exit(CRASH)
  }
}

const queryLocation = influxDB => async ({ location }) => {
  try {
    const point = await influxDB.query(`
    select * from tide
    where location =~ /(?i)(${location})/
  `)

    console.log('The data was found with no problem at all')
    return point
  } catch (error) {
    console.error('oh no, this influx is not the same', error)
    process.exit(CRASH)
  }
}

const init = async () => {
  console.log(`influxDB..: ${DB_URL}/${DATABASE_NAME}`)

  const influxDB = await createTable()

  const app = express();

  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  // curl -i GET http://localhost:2020/influx 
  app.get('/influx', (request, response) => {
    response.status(200).json({
      teste: 1, teste_2: 2
    }).end();
  });

  // curl -i GET http://localhost:2020/influx/checkdb
  app.get('/influx/checkdb', async (request, response) => {
    const res = await checkInfluxDB(influxDB)

    if (!res) {
      return response.status(200).json({
        message: 'The database was not created in a application set up'
      }).end()
    }

    response.status(200).json({
      message: 'All is working'
    }).end()
  })

  // curl -i GET http://localhost:2020/influx/query/location?location=Brazil
  app.get('/influx/query/location', async (request, response) => {
    console.log('query', request.query)

    const { location } = request.query

    const res = await queryLocation(influxDB)({ location })

    response.status(200).json({
      message: 'The data was found with no problem at all',
      data: res,
    }).end();
  });

  // curl -i POST http://localhost:2020/influx/create -H "Content-Type: application/json" -d "@payload.txt"
  app.post('/influx/create', async (request, response) => {
    console.log('body', request.body)

    const { measurement, unit, location, height } = request.body

    const res = await save(influxDB)({ measurement, unit, location, height })

    response.status(200).json({
      message: 'The data was created with no problem at all',
      data: res,
    }).end();
  })

  await app.listen(2020);

  console.log('estamos on the line')
};

(async () => await init())()


/**
 * 
 * influxdb: docker run --name influx-teste -p 8086:8086   -d influxdb
 */