const { PutItemCommand } = require("@aws-sdk/client-dynamodb");
const crypto = require("crypto");
const openidClient = require("openid-client");

async function createSession(ctx) {
  const nonce = crypto.randomBytes(32).toString("hex");
  // FIX: Math.random() is not cryptographically secure and MD5 is deprecated.
  // Use crypto.randomBytes for state generation, matching nonce approach.
  const state = crypto.randomBytes(16).toString("hex");
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 1);
  const input = {
    TableName: process.env.SESSION_TABLE,
    Item: {
      id: {
        S: `${nonce}`,
      },
      state: {
        S: `${state}`,
      },
      expiry: {
        S: `${expiry}`,
      },
    },
  };
  const command = new PutItemCommand(input);
  await ctx.ddbClient.send(command);

  const sessionObject = {
    nonce: nonce,
    state: state,
  };
  console.log(`Successfully created session: ${JSON.stringify(sessionObject)}`);
  return sessionObject;
}

const setNonceAndRedirect = async (ctx) => {
  try {
    const session = await createSession(ctx);

    const cookieOptions = { httpOnly: true, secure: false };
    ctx.cookies.set("nonce", session.nonce, cookieOptions);
    ctx.cookies.set("session", session.state, cookieOptions);
    console.log("Successfully set session cookies.");

    const redirectUrl = openidClient.buildAuthorizationUrl(ctx.oneLogin, {
      scope: "openid email phone",
      state: session.state,
      nonce: session.nonce,
      vtr: '["Cl.Cm"]',
      ui_locales: "en",
      redirect_uri: process.env.CALLBACK_URL,
    });
    console.log(`Sending user to ${redirectUrl}`);

    ctx.redirect(redirectUrl.href);
  } catch (e) {
    // FIX: Don't re-throw after setting status — Koa's error handler would double-log the error.
    // Set status and body to handle it cleanly.
    console.log(e);
    ctx.status = 500;
    ctx.body = { error: e.message };
  }
};

module.exports = {
  setNonceAndRedirect,
};
