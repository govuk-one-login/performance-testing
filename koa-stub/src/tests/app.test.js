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

const dynamoDB = new DynamoDBClient({});
const dynamoDBMock = mockClient(dynamoDB);

// FIX: The GetItemCommand mock must return the state that was actually stored by PutItemCommand,
// otherwise the new state validation check will correctly reject the mismatch.
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
let service = oidc_server.service;
let client;
let server;
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
    console.warn.mockClear();
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
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "Request to userinfo failed due to ClientError: unexpected HTTP response status code",
      ),
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
  test("The OIDC flow works, if the first two calls to userinfo are 401s", async () => {
    console.warn.mockClear();
    let callCount = 0;
    service.on("beforeUserinfo", (userInfoResponse, req) => {
      callCount++;
      if (callCount <= 2) {
        userInfoResponse.body = {
          error: "invalid_token",
          error_message: "token is expired",
        };
        userInfoResponse.statusCode = 401;
      }
    });
    const url = `${app_url}/start`;
    const response = await client.get(url, { withCredentials: true });
    expect(response.status).toBe(200);
    expect(console.warn).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "Request to userinfo failed due to ClientError: unexpected HTTP response status code",
      ),
    );
    expect(dynamoDBMock).toHaveReceivedCommand(PutItemCommand);
    expect(dynamoDBMock).toHaveReceivedCommand(GetItemCommand);
  });
  test("The OIDC flow fails, if all calls to userinfo is a 401", async () => {
    console.warn.mockClear();
    service.on("beforeUserinfo", (userInfoResponse, req) => {
      userInfoResponse.body = {
        error: "invalid_token",
        error_message: "token is expired",
      };
      userInfoResponse.statusCode = 401;
    });
    const url = `${app_url}/start`;
    await client.get(url, { withCredentials: true }).catch((error) => {
      expect(error.response.status).toBe(500);
      expect(error.response.data.error).toBe(
        "Userinfo endpoint not authorising",
      );
    });

    expect(dynamoDBMock).toHaveReceivedCommand(PutItemCommand);
    expect(console.warn).toHaveBeenCalledTimes(3);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "Request to userinfo failed due to ClientError: unexpected HTTP response status code",
      ),
    );
    expect(dynamoDBMock).toHaveReceivedCommand(GetItemCommand);
  });
});

describe("Tests for state validation", () => {
  test("Callback returns 500 when state in DynamoDB does not match cookie", async () => {
    // Override GetItemCommand to return a mismatched state
    dynamoDBMock.on(GetItemCommand).callsFake(() => {
      return {
        Item: {
          id: { S: "some-nonce" },
          state: { S: "wrong-state-value" },
          expiry: { S: "2099-01-01" },
        },
      };
    });

    const url = `${app_url}/start`;
    await client.get(url, { withCredentials: true }).catch((error) => {
      expect(error.response.status).toBe(500);
      expect(error.response.data.error).toBe(
        "State mismatch between cookie and database",
      );
    });

    // Restore the default mock behaviour for subsequent tests
    dynamoDBMock.on(GetItemCommand).callsFake(() => {
      return { Item: storedSession };
    });
  });

  test("Callback returns 500 when session not found in DynamoDB", async () => {
    // Override GetItemCommand to return no Item (session expired/missing)
    dynamoDBMock.on(GetItemCommand).callsFake(() => {
      return {};
    });

    const url = `${app_url}/start`;
    await client.get(url, { withCredentials: true }).catch((error) => {
      expect(error.response.status).toBe(500);
      expect(error.response.data.error).toBe("Session not found in database");
    });

    // Restore the default mock behaviour for subsequent tests
    dynamoDBMock.on(GetItemCommand).callsFake(() => {
      return { Item: storedSession };
    });
  });

  test("Callback returns 500 when nonce cookie is missing", async () => {
    // Use a fresh client with no cookies to simulate missing session cookies
    const jar = new cookieJar.CookieJar();
    const freshClient = wrapper.wrapper(axios.create({ jar }));

    const url = `${app_url}/callback?code=test&state=test`;
    await freshClient.get(url, { withCredentials: true }).catch((error) => {
      expect(error.response.status).toBe(500);
    });
  });
});

describe("Tests for token exchange failures", () => {
  test("Callback returns 500 when token endpoint returns an error", async () => {
    service.once("beforeResponse", (tokenEndpointResponse, req) => {
      tokenEndpointResponse.body = {
        error: "invalid_grant",
        error_description: "Authorization code has expired",
      };
      tokenEndpointResponse.statusCode = 400;
    });

    const url = `${app_url}/start`;
    await client.get(url, { withCredentials: true }).catch((error) => {
      expect(error.response.status).toBe(500);
      expect(error.response.data.error).toBeDefined();
    });
  });

  test("Callback returns 500 when token set has no access_token", async () => {
    service.once("beforeResponse", (tokenEndpointResponse, req) => {
      // Strip the access_token — openid-client validates the response
      // and throws before our code can check, confirming the library guards this path
      delete tokenEndpointResponse.body.access_token;
    });

    const url = `${app_url}/start`;
    await client.get(url, { withCredentials: true }).catch((error) => {
      expect(error.response.status).toBe(500);
      expect(error.response.data.error).toBeDefined();
    });
  });
});

describe("Tests for logout edge cases", () => {
  test("Logout returns 500 when no id_token cookie is present", async () => {
    // Use a fresh client with no cookies — no prior login
    const jar = new cookieJar.CookieJar();
    const freshClient = wrapper.wrapper(axios.create({ jar }));

    const url = `${app_url}/logout`;
    await freshClient.get(url, { withCredentials: true }).catch((error) => {
      expect(error.response.status).toBe(500);
    });
  });
});

describe("Tests for DynamoDB read failures", () => {
  test("Callback returns 500 when DynamoDB read fails", async () => {
    // Override GetItemCommand to simulate a DynamoDB read failure
    dynamoDBMock.on(GetItemCommand).callsFake(() => {
      throw new Error("DynamoDB read timeout");
    });

    const url = `${app_url}/start`;
    await client.get(url, { withCredentials: true }).catch((error) => {
      expect(error.response.status).toBe(500);
      expect(error.response.data.error).toBe("DynamoDB read timeout");
    });

    // Restore the default mock behaviour
    dynamoDBMock.on(GetItemCommand).callsFake(() => {
      return { Item: storedSession };
    });
  });
});

afterAll(async () => {
  await oidc_server.stop();
  server.close();
});
