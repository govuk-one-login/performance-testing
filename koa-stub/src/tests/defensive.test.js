/**
 * Defensive tests — these cover edge cases and configuration concerns
 * that are not part of the core OIDC logic, but help catch regressions
 * in routing, cookie security attributes, and service initialisation.
 */
const { expect } = require("expect");
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

const dynamoDB = new DynamoDBClient({});
const dynamoDBMock = mockClient(dynamoDB);

let storedSession = {};
dynamoDBMock.on(PutItemCommand).callsFake((input) => {
  storedSession = input.Item;
  return {};
});

dynamoDBMock.on(GetItemCommand).callsFake(() => {
  return { Item: storedSession };
});

const { OAuth2Server } = require("oauth2-mock-server");
const { setupClient } = require("../utils/onelogin.util");

let oidc_server = new OAuth2Server();
let client;
let server;
let app_url = "http://localhost:8082";

beforeAll(async () => {
  await oidc_server.start(8090, "localhost");
  process.env.OIDC_ENDPOINT = oidc_server.issuer.url;
  process.env.SESSION_TABLE = "SessionTable";
  process.env.RESPONSE_ALG = "RS256";
  process.env.CLIENT_ID = "testclient";
  process.env.CLIENT_SECRET = "testsecret"; // pragma: allowlist-secret
  process.env.CALLBACK_URL = "http://localhost:8082/callback";
  process.env.LOGOUT_URL = "http://localhost:8082/test";

  oidc_server.issuer.keys.generate(process.env.RESPONSE_ALG);
  app.context.ddbClient = dynamoDBMock;
  app.context.oneLogin = await setupClient();
  server = app.listen(8082);

  const jar = new cookieJar.CookieJar();
  client = wrapper.wrapper(axios.create({ jar }));
  const delay = 1000;
  await new Promise((resolve) => setTimeout(resolve, delay));
});

describe("Defensive: static routes", () => {
  test("GET / returns 200 with welcome message", async () => {
    const response = await client.get(`${app_url}/`);
    expect(response.status).toBe(200);
    expect(response.data).toContain("Welcome to the RP stub");
  });

  test("GET /test returns 200 with TestPage", async () => {
    const response = await client.get(`${app_url}/test`);
    expect(response.status).toBe(200);
    expect(response.data).toBe("TestPage");
  });

  test("GET /nonexistent returns 404", async () => {
    await client.get(`${app_url}/nonexistent`).catch((error) => {
      expect(error.response.status).toBe(404);
    });
  });
});

describe("Defensive: cookie security attributes", () => {
  test("Session cookies are set with httpOnly flag", async () => {
    const jar = new cookieJar.CookieJar();
    const freshClient = wrapper.wrapper(axios.create({ jar }));

    // Hit /start but don't follow the OIDC redirect — inspect the 302 cookies
    const url = `${app_url}/start`;
    const response = await freshClient.get(url, {
      withCredentials: true,
      maxRedirects: 0,
      validateStatus: (status) => status === 302,
    });

    const setCookieHeaders = response.headers["set-cookie"];
    expect(setCookieHeaders).toBeDefined();

    const nonceCookie = setCookieHeaders.find((h) => h.startsWith("nonce="));
    const sessionCookie = setCookieHeaders.find((h) =>
      h.startsWith("session="),
    );

    expect(nonceCookie).toContain("httponly");
    expect(sessionCookie).toContain("httponly");
  });
});

describe("Defensive: OIDC discovery failure", () => {
  test("setupClient throws when OIDC endpoint is unreachable", async () => {
    const originalEndpoint = process.env.OIDC_ENDPOINT;
    process.env.OIDC_ENDPOINT = "http://localhost:19999"; // nothing listening

    await expect(setupClient()).rejects.toThrow();

    process.env.OIDC_ENDPOINT = originalEndpoint;
  });
});

describe("Defensive: concurrent session isolation", () => {
  test("Two simultaneous /start requests create distinct sessions", async () => {
    const jar1 = new cookieJar.CookieJar();
    const jar2 = new cookieJar.CookieJar();
    const client1 = wrapper.wrapper(axios.create({ jar: jar1 }));
    const client2 = wrapper.wrapper(axios.create({ jar: jar2 }));

    // Fire both requests concurrently, stop at the 302 to inspect cookies
    const opts = {
      withCredentials: true,
      maxRedirects: 0,
      validateStatus: (status) => status === 302,
    };

    const [res1, res2] = await Promise.all([
      client1.get(`${app_url}/start`, opts),
      client2.get(`${app_url}/start`, opts),
    ]);

    const getNonce = (res) =>
      res.headers["set-cookie"]
        .find((h) => h.startsWith("nonce="))
        .split(";")[0]
        .split("=")[1];

    const getState = (res) =>
      res.headers["set-cookie"]
        .find((h) => h.startsWith("session="))
        .split(";")[0]
        .split("=")[1];

    // Each request should have unique nonce and state values
    expect(getNonce(res1)).not.toBe(getNonce(res2));
    expect(getState(res1)).not.toBe(getState(res2));
  });
});

describe("Defensive: logout clears cookies", () => {
  test("Logout clears session cookies", async () => {
    // First do a successful login to set cookies
    const url = `${app_url}/start`;
    const response = await client.get(url, { withCredentials: true });
    expect(response.status).toBe(200);

    // Call logout but don't follow the redirect, so we can inspect Set-Cookie headers
    const logouturl = `${app_url}/logout`;
    const logoutresponse = await client.get(logouturl, {
      withCredentials: true,
      maxRedirects: 0,
      validateStatus: (status) => status === 302,
    });
    expect(logoutresponse.status).toBe(302);

    // Verify cookies have been cleared by checking the Set-Cookie headers
    const setCookieHeaders = logoutresponse.headers["set-cookie"];
    expect(setCookieHeaders).toBeDefined();
    const clearedCookieNames = setCookieHeaders.map(
      (h) => h.split("=")[0],
    );
    expect(clearedCookieNames).toContain("nonce");
    expect(clearedCookieNames).toContain("session");
    expect(clearedCookieNames).toContain("id_token");
  });
});

describe("Defensive: DynamoDB write failure", () => {
  test("Start returns 500 when DynamoDB write fails", async () => {
    // Override PutItemCommand to simulate a DynamoDB failure
    dynamoDBMock.on(PutItemCommand).callsFake(() => {
      throw new Error("DynamoDB write failed");
    });

    const jar = new cookieJar.CookieJar();
    const freshClient = wrapper.wrapper(axios.create({ jar }));

    const url = `${app_url}/start`;
    await freshClient.get(url, { withCredentials: true }).catch((error) => {
      expect(error.response.status).toBe(500);
      expect(error.response.data.error).toBe("DynamoDB write failed");
    });

    // Restore the default mock behaviour
    dynamoDBMock.on(PutItemCommand).callsFake((input) => {
      storedSession = input.Item;
      return {};
    });
  });
});

afterAll(async () => {
  await oidc_server.stop();
  server.close();
});
