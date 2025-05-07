//require('source-map-support/register')
import serverlessExpress from '@codegenie/serverless-express';

import { app } from './app.js';
import { setupClient } from './utils/onelogin.util.js';

let serverlessExpressInstance;

async function setup (event, context) {
  const client = await setupClient(event)
  app.context.oneLogin = client;
  serverlessExpressInstance = serverlessExpress({ app })
  return serverlessExpressInstance(event, context)
}

function handler (event, context) {
  if (serverlessExpressInstance) return serverlessExpressInstance(event, context)

  return setup(event, context)
}

export { handler }
export default handler