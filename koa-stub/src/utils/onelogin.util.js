const { Issuer } = require("openid-client");

async function setupClient() {
    const response = await Issuer.discover(process.env.OIDC_ENDPOINT);
    console.log(`Got Issuer setup as ${response.Issuer}`)   ;
    const client = new response.Client({
            client_id: `${process.env.CLIENT_ID}`,
            client_secret: `${process.env.CLIENT_SECRET}`,
            id_token_signed_response_alg: process.env.RESPONSE_ALG,
            redirect_uris: [process.env.CALLBACK_URL],
            response_types: ['code'],
        });
    console.log(`Create client ${client}`);
    return client

};

module.exports = { setupClient }