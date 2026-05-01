const { expect } = require("expect");
require("aws-sdk-client-mock-jest");
const axios = require("axios");
const cookieJar = require("tough-cookie");
const wrapper = require("axios-cookiejar-support");
const app = require("../app");
const { mockClient } = require("aws-sdk-client-mock");
const {
  PutItemCommand,
  DynamoDBClient,
  GetItemCommand,
} = require("@aws-sdk/client-dynamodb");

const expiry = new Date();
expiry.setDate(expiry.getDate() + 1);
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

let oidc_server = new OAuth2Server();
let service = oidc_server.service;
let client;
let server;
let oidc_url = "http://localhost:8080";
let app_url = "http://localhost:8081";

beforeAll(async () => {
  await oidc_server.start(8080, "localhost");
  console.log("Issuer URL:", oidc_server.issuer.url);
  process.env.OIDC_ENDPOINT = oidc_server.issuer.url;
  process.env.SESSION_TABLE = "SessionTable";
  process.env.RESPONSE_ALG = "RS256";
  process.env.CLIENT_ID = "testclient";
  process.env.CLIENT_SECRET = "testsecret"; // pragma: allowlist-secret
  process.env.CALLBACK_URL = "http://localhost:8081/callback";
  process.env.LOGOUT_URL = "http://localhost:8081/test";

  // Generate a new RSA key and add it to the keystore
  oidc_server.issuer.keys.generate(process.env.RESPONSE_ALG);
  // Setup the OIDC client
  app.context.ddbClient = dynamoDBMock;
  app.context.oneLogin = await setupClient();
  // Setup the app server
  server = app.listen(8081);

  const jar = new cookieJar.CookieJar();
  client = wrapper.wrapper(axios.create({ jar }));
  /// Adding this delay seems to stop the intermittency of the test success.
  const delay = 1000;
  await new Promise((resolve) => setTimeout(resolve, delay));
});

describe("Tests against the OIDC Service", () => {
  test("The OIDC flow works", async () => {
    const url = `${app_url}/start`;
    const response = await client.get(url, { withCredentials: true });
    expect(response.status).toBe(200);
    expect(dynamoDBMock).toHaveReceivedCommand(PutItemCommand);
    expect(dynamoDBMock).toHaveReceivedCommand(GetItemCommand);
    expect(response.data).toMatchSnapshot();
  });
});
describe("Tests against the OIDC Service with errors", () => {
  test("The OIDC flow works, if the first call to userinfo is a 401", async () => {
    const spyConsole = jest.spyOn(console, "warn");
    service.once("beforeUserinfo", (userInfoResponse, req) => {
      userInfoResponse.body = {
        error: "invalid_token",
        error_message: "token is expired",
      };
      userInfoResponse.statusCode = 401;
    });
    const url = `${app_url}/start`;
    const response = await client.get(url, { withCredentials: true });
    expect(response.status).toBe(200);
    expect(dynamoDBMock).toHaveReceivedCommand(PutItemCommand);
    expect(spyConsole).toHaveBeenCalledTimes(1);
    expect(spyConsole).toHaveBeenCalledWith(
      "Request to userinfo failed due to OPError: invalid_token",
    );
    expect(dynamoDBMock).toHaveReceivedCommand(GetItemCommand);
    expect(response.data).toMatchSnapshot();

    const logouturl = "http://localhost:8081/logout";
    const logoutresponse = await client.get(logouturl, {
      withCredentials: true,
    });
    expect(logoutresponse.status).toBe(200);
    expect(logoutresponse.data).toBe("TestPage");
  });
  test("The OIDC flow fails, if all calls to userinfo is a 401", async () => {
    console.warn.mockRestore();
    const spyConsole = jest.spyOn(console, "warn");
    service.on("beforeUserinfo", (userInfoResponse, req) => {
      userInfoResponse.body = {
        error: "invalid_token",
        error_message: "token is expired",
      };
      userInfoResponse.statusCode = 401;
    });
    const url = `${app_url}/start`;
    await client.get(url, { withCredentials: true }).catch((error) => {
      expect(error).toMatchSnapshot();
    });

    expect(dynamoDBMock).toHaveReceivedCommand(PutItemCommand);
    expect(spyConsole).toHaveBeenCalledTimes(3);
    expect(spyConsole).toHaveBeenCalledWith(
      "Request to userinfo failed due to OPError: invalid_token",
    );
    expect(dynamoDBMock).toHaveReceivedCommand(GetItemCommand);
  });
});

afterAll(async () => {
  await oidc_server.stop();
  server.close();
});
