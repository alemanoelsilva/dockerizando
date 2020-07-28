require('dotenv').config();
const AWS = require("aws-sdk");

AWS.config.update({
  region: "us-west-2",
  endpoint: "http://localhost:8000"
});

const docClient = new AWS.DynamoDB.DocumentClient();

const create = () => {
  const table = "Movies";
  const year = 2015;
  const title = "The Big New Movie";

  const params = {
    TableName: table,
    Item: {
      "year": year,
      "title": title,
      "info": {
        "plot": "Nothing happens at all.",
        "rating": 0
      }
    }
  };

  console.log("Adding a new item...");
  docClient.put(params, function (err, data) {
    if (err) {
      console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
    } else {
      console.log("Added item:", JSON.stringify(data, null, 2));
    }
  });
};

const read = () => {
  const table = "Movies";

  const year = 2015;
  const title = "The Big New Movie";

  const params = {
    TableName: table,
    Key: {
      "year": year,
      "title": title
    }
  };

  docClient.get(params, function (err, data) {
    if (err) {
      console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
    } else {
      console.log("GetItem succeeded:", JSON.stringify(data, null, 2));
    }
  });
}

const update = () => {
  const table = "Movies";

  const year = 2015;
  const title = "The Big New Movie";

  // Update the item, unconditionally,

  const params = {
    TableName: table,
    Key: {
      "year": year,
      "title": title
    },
    UpdateExpression: "set info.rating = :r, info.plot=:p, info.actors=:a",
    ExpressionAttributeValues: {
      ":r": 5.5,
      ":p": "Everything happens all at once.",
      ":a": ["Larry", "Moe", "Curly"]
    },
    ReturnValues: "UPDATED_NEW"
  };

  console.log("Updating the item...");
  docClient.update(params, function (err, data) {
    if (err) {
      console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
    } else {
      console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
    }
  });
}

const atomicPlus = () => {
  const table = "Movies";

  const year = 2015;
  const title = "The Big New Movie";

  // Increment an atomic counter

  const params = {
    TableName: table,
    Key: {
      "year": year,
      "title": title
    },
    UpdateExpression: "set info.rating = info.rating + :val",
    ExpressionAttributeValues: {
      ":val": 1
    },
    ReturnValues: "UPDATED_NEW"
  };

  console.log("Updating the item...");
  docClient.update(params, function (err, data) {
    if (err) {
      console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
    } else {
      console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
    }
  });
}

const atomicSub = () => {
  const table = "Movies";

  const year = 2015;
  const title = "The Big New Movie";

  // Increment an atomic counter

  const params = {
    TableName: table,
    Key: {
      "year": year,
      "title": title
    },
    UpdateExpression: "set info.rating = info.rating - :val",
    ExpressionAttributeValues: {
      ":val": 1
    },
    ReturnValues: "UPDATED_NEW"
  };

  console.log("Updating the item...");
  docClient.update(params, function (err, data) {
    if (err) {
      console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
    } else {
      console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
    }
  });
}

const updateWithWhere = () => {
  const table = "Movies";

  const year = 2015;
  const title = "The Big New Movie";

  // Conditional update (will fail)

  const params = {
    TableName: table,
    Key: {
      "year": year,
      "title": title
    },
    UpdateExpression: "remove info.actors[0]",
    ConditionExpression: "size(info.actors) >= :num",
    ExpressionAttributeValues: {
      ":num": 3
    },
    ReturnValues: "UPDATED_NEW"
  };

  console.log("Attempting a conditional update...");
  docClient.update(params, function (err, data) {
    if (err) {
      console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
    } else {
      console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
    }
  });
}

const destroy = () => {
  const table = "Movies";

  const year = 2015;
  const title = "The Big New Movie";

  const params = {
    TableName: table,
    Key: {
      "year": year,
      "title": title
    },
    ConditionExpression: "info.rating <= :val",
    ExpressionAttributeValues: {
      ":val": 5.0
    }
  };

  console.log("Attempting a conditional delete...");
  docClient.delete(params, function (err, data) {
    if (err) {
      console.error("Unable to delete item. Error JSON:", JSON.stringify(err, null, 2));
    } else {
      console.log("DeleteItem succeeded:", JSON.stringify(data, null, 2));
    }
  });
}

const exec = {
  create,
  read,
  update,
  atomicPlus,
  atomicSub,
  updateWithWhere,
  destroy
}

module.exports = (() => {
  const func = process.argv[2]
  return exec[func]()
})()