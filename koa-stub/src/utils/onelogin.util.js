import * as openidClient from "openid-client";

export async function setupClient() {
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
      execute: [openidClient.allowInsecureRequests],
    },
  );
  console.log("Created openid-client configuration");
  return config;
}
