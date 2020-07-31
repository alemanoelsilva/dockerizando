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

  const createTableAsync = promisify(dynamodb.createTable).bind(dynamodb);

  try {
    const data = await createTableAsync(params)

    console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));

    return data

  } catch (error) {
    console.error("Unable to create table. Error JSON:", JSON.stringify(error, null, 2));
    return false
  }
}

const load = async () => {
  console.log("Importing movies into DynamoDB. Please wait.");

  const dynamoPutAsync = promisify(docClient.put).bind(docClient);

  const allMovies = JSON.parse(fs.readFileSync('moviedata.json', 'utf8'));

  const promises = allMovies.map(async (movie) => {
    const params = {
      TableName: DATABASE_NAME,
      Item: {
        "year": movie.year,
        "title": movie.title,
        "info": movie.info
      }
    };

    try {
      const data = await dynamoPutAsync(params)
      console.log("PutItem succeeded:", movie.title);
      return data

    } catch (error) {
      console.error("Unable to add movie", movie.title, ". Error JSON:", JSON.stringify(error, null, 2));
      return false
    }
  });

  return Promise.all(promises)

}

const read = async ({ year, title }) => {
  const params = {
    TableName: DATABASE_NAME,
    Key: {
      "year": parseInt(year, 10),
      "title": title
    }
  };

  console.log('params', params)

  const dynamoGetAsync = promisify(docClient.get).bind(docClient);

  try {
    const data = await dynamoGetAsync(params)
    console.log("GetItem succeeded:", JSON.stringify(data, null, 2));
    return data
  } catch (error) {
    console.error("Unable to read item. Error JSON:", JSON.stringify(error, null, 2));
    return false
  }
}

const atomicPlus = async ({ year, title }) => {
  // Increment an atomic counter

  const params = {
    TableName: DATABASE_NAME,
    Key: {
      "year": parseInt(year, 10),
      "title": title
    },
    UpdateExpression: "set info.rating = info.rating + :val",
    ExpressionAttributeValues: {
      ":val": 1
    },
    ReturnValues: "UPDATED_NEW"
  };

  const dynamoUpdateAsync = promisify(docClient.update).bind(docClient);

  try {
    console.log("Updating the item...");

    const data = await dynamoUpdateAsync(params)
    console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
    return data

  } catch (error) {
    console.error("Unable to update item. Error JSON:", JSON.stringify(error, null, 2));
    return false
  }
}

const update = async ({ year, title, body }) => {
  const params = {
    TableName: DATABASE_NAME,
    Key: {
      "year": parseInt(year, 10),
      "title": title
    },
    UpdateExpression: "set info.rating = :r, info.plot=:p, info.actors=:a",
    ExpressionAttributeValues: {
      ":r": parseFloat(body.rating),
      ":p": body.plot,
      ":a": body.actors,
    },
    ReturnValues: "UPDATED_NEW"
  };

  const dynamoUpdateAsync = promisify(docClient.update).bind(docClient);

  try {
    console.log("Updating the item...");

    const data = await dynamoUpdateAsync(params)
    console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
    return data

  } catch (error) {
    console.error("Unable to update item. Error JSON:", JSON.stringify(error, null, 2));
    return false
  }
}

const destroy = async ({ year, title }) => {
  const params = {
    TableName: DATABASE_NAME,
    Key: {
      "year": parseInt(year, 10),
      "title": title
    },
    ConditionExpression: "title <= :t",
    ExpressionAttributeValues: {
      ":t": title
    }
  };

  const dynamoDeleteAsync = promisify(docClient.delete).bind(docClient);

  try {
    console.log("Destroying the item...");

    const data = await dynamoDeleteAsync(params)
    console.log("DeletedItem succeeded:", JSON.stringify(data, null, 2));
    return data

  } catch (error) {
    console.error("Unable to Delete item. Error JSON:", JSON.stringify(error, null, 2));
    return false
  }
}

const query = async ({ year }) => {
  const params = {
    TableName: DATABASE_NAME,
    KeyConditionExpression: "#yr = :yyyy",
    ExpressionAttributeNames: {
      "#yr": "year"
    },
    ExpressionAttributeValues: {
      ":yyyy": parseInt(year, 10)
    }
  };

  console.log('params', params)

  const dynamoQueryAsync = promisify(docClient.query).bind(docClient);

  try {
    const data = await dynamoQueryAsync(params)
    console.log("QueryItem succeeded:", JSON.stringify(data, null, 2));
    return data
  } catch (error) {
    console.error("Unable to query item. Error JSON:", JSON.stringify(error, null, 2));
    return false
  }
}

const scan = async ({ startYear, endYear }) => {
  const params = {
    TableName: DATABASE_NAME,
    ProjectionExpression: "#yr, title, info.rating",
    FilterExpression: "#yr between :start_yr and :end_yr",
    ExpressionAttributeNames: {
      "#yr": "year",
    },
    ExpressionAttributeValues: {
      ":start_yr": parseInt(startYear, 10),
      ":end_yr": parseInt(endYear, 10)
    }
  };

  console.log("Scanning Movies table.");

  const dynamoScanAsync = promisify(docClient.scan).bind(docClient);

  try {
    const data = await dynamoScanAsync(params)
    console.log("ScanItem succeeded:", JSON.stringify(data, null, 2));
    return data
  } catch (error) {
    console.error("Unable to scan item. Error JSON:", JSON.stringify(error, null, 2));
    return false
  }
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

  // curl -i GET http://localhost:2020/test/find?year=1997&title=Anaconda
  // curl -i GET http://localhost:2020/test/find?year=1999&title=Fight%20Club
  app.get('/test/find', async (request, response) => {
    console.log('request.params', request.params)
    console.log('request.query', request.query)
    console.log('request.body', request.body)

    const { year, title } = request.query;

    const resp = await read({ year, title })

    console.log('resp', resp)

    if (!resp) {
      return response.status(500).json({
        message: 'Não deu mesmo hein'
      }).end();
    }

    return response.status(200).json({
      message: resp.Item ? 'Hoje siiiim' : 'Hoje não',
      data: resp.Item,
    }).end();
  });

  // curl -X PATCH http://localhost:2020/test/atomic/add?year=1997&title=Anaconda
  app.patch('/test/atomic/add', async (request, response) => {
    console.log('request.params', request.params)
    console.log('request.query', request.query)
    console.log('request.body', request.body)

    const { year, title } = request.query;

    const resp = await atomicPlus({ year, title })

    console.log('resp', resp)

    if (!resp) {
      return response.status(500).json({
        message: 'Não deu mesmo hein'
      }).end();
    }

    return response.status(200).json({
      message: resp.Item ? 'Hoje siiiim' : 'Hoje não',
      data: resp.Attributes,
    }).end();
  });

  // curl -H "Content-Type: application/json" -X PUT http://localhost:2020/test/update?year=1997&title=Anaconda -d "@update.txt"
  app.put('/test/update', async (request, response) => {
    console.log('request.params', request.params)
    console.log('request.query', request.query)
    console.log('request.body', request.body)

    const { body } = request;
    const { year, title } = request.query;

    const resp = await update({ year, title, body })

    console.log('resp', resp)

    if (!resp) {
      return response.status(500).json({
        message: 'Não deu mesmo hein'
      }).end();
    }

    return response.status(200).json({
      message: resp.Item ? 'Hoje siiiim' : 'Hoje não',
      data: resp.Attributes,
    }).end();
  });

  // curl --request DELETE http://localhost:2020/test/delete?year=1997&title=Anaconda
  // curl --request DELETE http://localhost:2020/test/delete?year=1999&title=Fight%20Club
  app.delete('/test/delete', async (request, response) => {
    console.log('request.params', request.params)
    console.log('request.query', request.query)
    console.log('request.body', request.body)

    const { year, title } = request.query;

    const resp = await destroy({ year, title })

    console.log('resp', resp)

    if (!resp) {
      return response.status(500).json({
        message: 'Não deu mesmo hein'
      }).end();
    }

    return response.status(200).json({
      message: resp ? 'Hoje siiiim' : 'Hoje não',
      data: title + ' deletado',
    }).end();
  });

  // curl -i GET http://localhost:2020/test/query?year=1997
  // curl -i GET http://localhost:2020/test/query?year=1999
  app.get('/test/query', async (request, response) => {
    console.log('request.params', request.params)
    console.log('request.query', request.query)
    console.log('request.body', request.body)

    const { year } = request.query;

    const resp = await query({ year })

    if (!resp) {
      return response.status(500).json({
        message: 'Não deu mesmo hein'
      }).end();
    }

    return response.status(200).json({
      message: resp.Item ? 'Hoje siiiim' : 'Hoje não',
      data: resp.Items,
    }).end();
  });

  // curl -i GET http://localhost:2020/test/scan?startYear=1999&ndYear=2005
  // curl -i GET http://localhost:2020/test/scan?startYear=1950&ndYear=1980
  app.get('/test/scan', async (request, response) => {
    console.log('request.params', request.params)
    console.log('request.query', request.query)
    console.log('request.body', request.body)

    const { startYear, endYear } = request.query;

    const resp = await scan({ startYear, endYear })

    if (!resp) {
      return response.status(500).json({
        message: 'Não deu mesmo hein'
      }).end();
    }

    return response.status(200).json({
      message: resp.Item ? 'Hoje siiiim' : 'Hoje não',
      data: resp.Items,
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
 * mongo : docker run --name mongo-teste  -p 27017:27017 -d mongo
 * redis : docker run --name redis-teste  -p 6379:6379   -d redis:alpine
 * dynamo: docker run --name dynamo-teste -p 8000:8000   -d amazon/dynamodb-local
 *
 * docker rm $(docker ps -a -q)
*/