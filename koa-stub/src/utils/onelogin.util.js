const openidClient = require("openid-client");

async function setupClient() {
  const serverUrl = new URL(process.env.OIDC_ENDPOINT);
  const config = await openidClient.discovery(
    serverUrl,
    process.env.CLIENT_ID,
    {
      client_secret: process.env.CLIENT_SECRET,
      id_token_signed_response_alg: process.env.RESPONSE_ALG,
    },
    openidClient.ClientSecretPost(),
    {
      timeout: 30,
      execute: [openidClient.allowInsecureRequests], // NOSONAR: not truly deprecated, marked by library to flag security implications
    }
  );
  console.log(`Created openid-client configuration`);
  return config;
}

module.exports = { setupClient };
