
const Koa = require('koa');
const app = new Koa();
const cors = require("@koa/cors");
const router = require('./router');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');


let config = {};
if (process.env.AWS_SAM_LOCAL) {
    config = {
        endpoint: "http://host.docker.internal:8000"
    }
}

app.context.ddbClient = new DynamoDBClient(config)

app.use(cors())
    .use(router.routes())

module.exports = app