const { expect } = require("expect");
require("aws-sdk-client-mock-jest");
const request = require("supertest");
const app = require("../app");
const { mockClient } = require("aws-sdk-client-mock");
const {
  PutItemCommand,
  DynamoDBClient,
  GetItemCommand,
} = require("@aws-sdk/client-dynamodb");

const expiry = new Date(); expiry.setDate(expiry.getDate()+1);
const dynamoDB = new DynamoDBClient({});
const dynamoDBMock = mockClient(dynamoDB);

dynamoDBMock.on(PutItemCommand, {});

dynamoDBMock.on(GetItemCommand).resolves({
  Item: {
    id: { S: "teststring" },
    state: { S: "teststring" },
    expiry: { S: `${expiry}` },
  },
});

const { OAuth2Server } = require("oauth2-mock-server");
const { setupClient } = require("../utils/onelogin.util");

const oidc_server = new OAuth2Server();

beforeAll(async () => {
  await oidc_server.start(8080, "localhost");
  console.log("Issuer URL:", oidc_server.issuer.url);
  process.env.OIDC_ENDPOINT = oidc_server.issuer.url;
  process.env.SESSION_TABLE = "SessionTable";
  process.env.RESPONSE_ALG = "RS256";
  process.env.CLIENT_ID = "testclient";
  process.env.CLIENT_SECRET = "testsecret";  // pragma: allowlist-secret
  // Generate a new RSA key and add it to the keystore
  oidc_server.issuer.keys.generate(process.env.RESPONSE_ALG);
  // Setup the OIDC client
  app.context.ddbClient = dynamoDBMock;
  app.context.oneLogin = await setupClient();
});

describe("Tests against the OIDC Servce", () => {


  test('The /test endpoint returns TestPage', async () => {
    const response = await request(app.callback()).get('/test');
    expect(response.status).toBe(200);
    expect(response.text).toMatchSnapshot();
  });

  test("The /start endpoint returns 302", async () => {
    const response = await request(app.callback()).get("/start");
    expect(response.status).toBe(302);
    expect(response.text).toContain("authorize?");
    expect(dynamoDBMock).toHaveReceivedCommand(PutItemCommand);
  });

  test("The /callback endpoint returns 200", async () => {
    const response = await request(app.callback())
      .get("/callback")
      .set("Cookie", ["nonce=tests,session=tests"]);
    expect(dynamoDBMock).toHaveReceivedCommand(GetItemCommand);
    expect(response.status).toBe(204);
    expect(response.body).toMatchSnapshot();
  });

  test("The /logout endpoint returns 302", async () => {
    const response = await request(app.callback())
      .get("/logout")
      .set("Cookie", ["id_token=sessiontest"]);
    expect(response.status).toBe(302);
    expect(response.text).toContain("id_token_hint");
  });
});

afterAll(async () => {
  await oidc_server.stop();
});
