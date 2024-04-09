//require('source-map-support/register')
const serverlessExpress = require('@codegenie/serverless-express')
const app = require('./app')
const { setupClient } = require('./utils/onelogin.util')

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

exports.handler = handler