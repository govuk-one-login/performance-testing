import Koa from 'koa';

import cors from '@koa/cors';
import router from './router.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const app = new Koa();

let config = {};
if (process.env.AWS_SAM_LOCAL) {
  config = {
    endpoint: "http://host.docker.internal:8000",
  };
}

app.context.ddbClient = new DynamoDBClient(config);

app.use(cors()).use(router.routes());

export { app};
