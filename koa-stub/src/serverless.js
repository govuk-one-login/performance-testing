import serverlessExpress from "@codegenie/serverless-express";
import app from "./app.js";
import { setupClient } from "./utils/onelogin.util.js";

let serverlessExpressInstance;

async function setup(event, context) {
  const client = await setupClient();
  app.context.oneLogin = client;
  serverlessExpressInstance = serverlessExpress({ app });
  return serverlessExpressInstance(event, context);
}

export async function handler(event, context) {
  if (serverlessExpressInstance)
    return serverlessExpressInstance(event, context);
  return setup(event, context);
}
