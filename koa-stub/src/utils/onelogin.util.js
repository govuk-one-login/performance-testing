const { Issuer, custom } = require("openid-client");

custom.setHttpOptionsDefaults({
  timeout: 7000,
});

async function setupClient() {
  const response = await Issuer.discover(process.env.OIDC_ENDPOINT);
  console.log(`Got Issuer setup as ${JSON.stringify(response)}`);
  const logout_url =
    process.env.LOGOUT_URL || process.env.CALLBACK_URL.replace("callback", "");
  const client = new response.Client({
    client_id: `${process.env.CLIENT_ID}`,
    client_secret: `${process.env.CLIENT_SECRET}`,
    id_token_signed_response_alg: process.env.RESPONSE_ALG,
    redirect_uris: [process.env.CALLBACK_URL],
    post_logout_redirect_uris: [logout_url],
    response_types: ["code"],
  });
  console.log(`Create client ${JSON.stringify(client)}`);
  return client;
}

module.exports = { setupClient };
