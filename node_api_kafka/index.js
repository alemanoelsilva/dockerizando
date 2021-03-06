require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { promisify } = require("util");

const {
  KafkaClient,
  Producer,
  Consumer,
  Offset,
} = require('kafka-node');

const {
  KAFKA_HOST,
  KAFKA_REQUEST_QUEUE,
  KAFKA_RESPONSE_QUEUE,
} = process.env

console.log('KAFKA_HOST', KAFKA_HOST)

const getKafkaClient = (host = KAFKA_HOST) => {
  const client = new KafkaClient({ kafkaHost: host });

  return client
}

const getMessageConsumer = ({ topic, value }) => {
  console.log('Hi people, I am the consumer for this message :)')
  console.log('\n\n', topic)
  console.log(JSON.parse(value))
}

const consumer = ({ topic, logger }) => ({
  start: async (job) => {
    try {
      const client = getKafkaClient(KAFKA_HOST)

      const topics = [{ topic, partition: 0 }]

      const options = {
        autoCommit: false,
        fetchMaxWaitMs: 1000,
        fetchMaxBytes: 1024 * 1024,
        requestTimeout: false
      };

      const consumer = new Consumer(client, topics, options);

      const refreshMetadata = promisify(client.refreshMetadata).bind(client)
      await refreshMetadata([topic])


      consumer.on('message', (message) => {
        job(message)
      });

      consumer.on('error', (err) => {
        console.log('Consumer::::::', err)
      })

    } catch (error) {
      logger.error(`There was an error on Consumer run ${error}`);
    }
  }
});

const producer = ({ topic, logger }) => ({
  start: async () => {
    try {
      const client = getKafkaClient(KAFKA_HOST)

      const publisher = new Producer(client)

      publisher.on('ready', async () => {
        try {
          const refreshMetadata = promisify(client.refreshMetadata).bind(client)
          await refreshMetadata([topic])

          logger.info(`The producer is making the correct thing :)`)

        } catch (error) {
          logger.error(`This producer made an wrong thing ${error.message}`)
        }
      })

      publisher.on('error', error => {
        logger.error(`Oh no, occured a unexpected error ${error.message}`)
      })

      return publisher
    } catch (error) {
      logger.error(`There was an error on Publish run ${error}`);
    }
  },
  send: producer => async (message) => {
    try {
      const send = promisify(producer.send).bind(producer)

      await send([{
        topic, messages: [JSON.stringify(message)]
      }])

      logger.info(`The producer is sending the message to the broker :)`)
    } catch (error) {
      logger.error(`This producer made a wrong thing ${error.message}`)
    }
  }
})

const init = async () => {
  const app = express();

  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  const publisher = await producer({
    topic: KAFKA_REQUEST_QUEUE,
    logger: console,
  })

  const publish = await publisher.start()

  await consumer({
    topic: KAFKA_RESPONSE_QUEUE,
    logger: console,
  }).start(getMessageConsumer)

  // curl -i GET http://localhost:2020/kafka/test
  app.get('/kafka/test', (request, response) => {
    response.status(200).json({
      teste: 1, teste_2: 2
    }).end();
  });

  // curl -i POST http://localhost:2020/kafka/create -H "Content-Type: application/json" -d "@payload.txt"
  app.post('/kafka/create', async (request, response) => {
    console.log('body', request.body)

    await publisher.send(publish)(request.body)

    response.status(200).json({
      message: 'Message was sent'
    }).end();
  });

  await app.listen(2020);

  console.log('estamos on the line')
};

(async () => await init())()

// docker run -d --name rabbitmq-test -p 4369:4369 -p 5671:5671 -p 5672:5672 -p 15672:15672 rabbitmq
// docker exec rabbitmq-test rabbitmq-plugins enable rabbitmq_management