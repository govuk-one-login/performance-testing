import Koa from 'koa';
const app = new Koa();
import cors from '@koa/cors';
import router from './router';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

let config = {};
if (process.env.AWS_SAM_LOCAL) {
  config = {
    endpoint: "http://host.docker.internal:8000",
  };
}

app.context.ddbClient = new DynamoDBClient(config);

app.use(cors()).use(router.routes());

export default app;
