require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');

const amqp = require('amqplib');

const {
  RABBIT_MQ_HOST,
  RABBIT_MQ_REQUEST_QUEUE,
  RABBIT_MQ_RESPONSE_QUEUE,
} = process.env

const getChannel = async (host, queue) => {
  const conn = await amqp.connect(host);
  const channel = await conn.createChannel();
  channel.assertQueue(queue, { durable: true });

  return channel;
}

const getMessageConsumer = (data) => {
  console.log('Hi people, I am the consumer for this message :)')
  console.log('\n\n', JSON.stringify(data))
}

const consumer = ({ host, requestQueue, logger }) => ({
  start: async (consumer) => {
    try {
      const channel = await getChannel(host, requestQueue);
      channel.prefetch(1);

      logger.trace('Consumer on', requestQueue);

      channel.consume(requestQueue, ({ content }) => {
        return consumer(JSON.parse(content.toString()));
      }, { noAck: true });
    } catch (error) {
      logger.error(`There was an error on Consumer run ${error}`);
    }
  }
});

const publish = ({ host, responseQueue, logger }) => ({
  start: async () => {
    try {
      const channel = await getChannel(host, responseQueue);

      logger.trace('Publish on', responseQueue);

      return ({ data }) => {
        channel.sendToQueue(responseQueue, Buffer.from(JSON.stringify(data)));
      };
    } catch (error) {
      logger.error(`There was an error on Publish run ${error}`);
    }
  }
})

const init = async () => {
  const app = express();

  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  const sendMessage = await publish({
    host: RABBIT_MQ_HOST,
    responseQueue: RABBIT_MQ_RESPONSE_QUEUE,
    logger: console,
  }).start()

  await consumer({
    host: RABBIT_MQ_HOST,
    requestQueue: RABBIT_MQ_REQUEST_QUEUE,
    logger: console,
  }).start(getMessageConsumer)

  // curl -i GET http://localhost:2020/rabbitmq/test
  app.get('/rabbitmq/test', (request, response) => {
    response.status(200).json({
      teste: 1, teste_2: 2
    }).end();
  });

  // curl -i POST http://localhost:2020/rabbitmq/create -H "Content-Type: application/json" -d "@payload.txt"
  app.post('/rabbitmq/create', (request, response) => {
    console.log('body', request.body)

    sendMessage({ data: request.body })

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