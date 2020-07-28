require('dotenv').config();
const AWS = require("aws-sdk");

AWS.config.update({
  region: "us-west-2",
  endpoint: "http://localhost:8000"
});

const docClient = new AWS.DynamoDB.DocumentClient();

const query = () => {

  console.log("Querying for movies from 1985.");

  const params = {
    TableName: "Movies",
    KeyConditionExpression: "#yr = :yyyy",
    ExpressionAttributeNames: {
      "#yr": "year"
    },
    ExpressionAttributeValues: {
      ":yyyy": 1985
    }
  };

  docClient.query(params, function (err, data) {
    if (err) {
      console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
    } else {
      console.log("Query succeeded.");
      data.Items.forEach(function (item) {
        console.log(" -", item.year + ": " + item.title);
      });
    }
  });
};

const queryByName = () => {
  console.log("Querying for movies from 1992 - titles A-L, with genres and lead actor");

  const params = {
    TableName: "Movies",
    ProjectionExpression: "#yr, title, info.genres, info.actors[0]",
    KeyConditionExpression: "#yr = :yyyy and title between :letter1 and :letter2",
    ExpressionAttributeNames: {
      "#yr": "year"
    },
    ExpressionAttributeValues: {
      ":yyyy": 1992,
      ":letter1": "A",
      ":letter2": "L"
    }
  };

  docClient.query(params, function (err, data) {
    if (err) {
      console.log("Unable to query. Error:", JSON.stringify(err, null, 2));
    } else {
      console.log("Query succeeded.");
      data.Items.forEach(function (item) {
        console.log(" -", item.year + ": " + item.title
          + " ... " + item.info.genres
          + " ... " + item.info.actors[0]);
      });
    }
  });
}

const scan = () => {
  const params = {
    TableName: "Movies",
    ProjectionExpression: "#yr, title, info.rating",
    FilterExpression: "#yr between :start_yr and :end_yr",
    ExpressionAttributeNames: {
      "#yr": "year",
    },
    ExpressionAttributeValues: {
      ":start_yr": 1950,
      ":end_yr": 1959
    }
  };

  console.log("Scanning Movies table.");

  docClient.scan(params, onScan);

  function onScan(err, data) {
    if (err) {
      console.error("Unable to scan the table. Error JSON:", JSON.stringify(err, null, 2));
    } else {
      // print all the movies
      console.log("Scan succeeded.");
      
      data.Items.forEach(function (movie) {
        console.log(
          movie.year + ": ",
          movie.title, "- rating:", movie.info.rating);
      });

      // continue scanning if we have more movies, because
      // scan can retrieve a maximum of 1MB of data
      if (typeof data.LastEvaluatedKey != "undefined") {
        console.log("Scanning for more...");
        params.ExclusiveStartKey = data.LastEvaluatedKey;
        docClient.scan(params, onScan);
      }
    }
  }

}

const exec = {
  query,
  queryByName,
  scan,
}

module.exports = (() => {
  const func = process.argv[2]
  return exec[func]()
})()