import { expect, describe, test, beforeAll, afterAll, vi } from "vitest";
import axios from "axios";
import * as cookieJar from "tough-cookie";
import { wrapper } from "axios-cookiejar-support";
import app from "../app.js";
import { mockClient } from "aws-sdk-client-mock";
import {
  PutItemCommand,
  DynamoDBClient,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { OAuth2Server } from "oauth2-mock-server";
import { setupClient } from "../utils/onelogin.util.js";

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
  client = wrapper(axios.create({ jar }));
  /// Adding this delay seems to stop the intermittency of the test success.
  const delay = 1000;
  await new Promise((resolve) => setTimeout(resolve, delay));
});

describe("Tests against the OIDC Service", () => {
  test("The OIDC flow works", async () => {
    const url = `${app_url}/start`;
    const response = await client.get(url, { withCredentials: true });
    expect(response.status).toBe(200);
    expect(dynamoDBMock.commandCalls(PutItemCommand).length).toBeGreaterThan(0);
    expect(dynamoDBMock.commandCalls(GetItemCommand).length).toBeGreaterThan(0);
    expect(response.data).toMatchSnapshot();
  });
});
describe("Tests against the OIDC Service with errors", () => {
  test("The OIDC flow works, if the first call to userinfo is a 401", async () => {
    const spyConsole = vi.spyOn(console, "warn");
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
    expect(dynamoDBMock.commandCalls(PutItemCommand).length).toBeGreaterThan(0);
    expect(spyConsole).toHaveBeenCalledTimes(1);
    expect(spyConsole).toHaveBeenCalledWith(
      expect.stringContaining(
        "Request to userinfo failed due to ClientError: unexpected HTTP response status code",
      ),
    );
    expect(dynamoDBMock.commandCalls(GetItemCommand).length).toBeGreaterThan(0);
    expect(response.data).toMatchSnapshot();

    const logouturl = "http://localhost:8081/logout";
    const logoutresponse = await client.get(logouturl, {
      withCredentials: true,
    });
    expect(logoutresponse.status).toBe(200);
    expect(logoutresponse.data).toBe("TestPage");
  });
  test("The OIDC flow fails, if all calls to userinfo is a 401", async () => {
    vi.restoreAllMocks();
    const spyConsole = vi.spyOn(console, "warn");
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

    expect(dynamoDBMock.commandCalls(PutItemCommand).length).toBeGreaterThan(0);
    expect(spyConsole).toHaveBeenCalledTimes(3);
    expect(spyConsole).toHaveBeenCalledWith(
      expect.stringContaining(
        "Request to userinfo failed due to ClientError: unexpected HTTP response status code",
      ),
    );
    expect(dynamoDBMock.commandCalls(GetItemCommand).length).toBeGreaterThan(0);
  });
});

afterAll(async () => {
  await oidc_server.stop();
  server.close();
});
