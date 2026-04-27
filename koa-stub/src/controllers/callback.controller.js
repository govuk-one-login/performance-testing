const { GetItemCommand } = require("@aws-sdk/client-dynamodb");
const openidClient = require("openid-client");

async function checkUserStateAgainstDB(ctx, nonce, state) {
  const input = {
    TableName: process.env.SESSION_TABLE,
    Key: {
      id: {
        S: nonce,
      },
    },
  };
  const command = new GetItemCommand(input);
  const dbresponse = await ctx.ddbClient.send(command);
  console.log(JSON.stringify(dbresponse));
  if (dbresponse.Item.state.S === state) {
    console.log("Yay! Correct state.");
  }
}

async function handleCallbackAndGetTokenSet(ctx, nonce, state) {
  console.log(`Processing the params ${nonce} and ${state}`);
  const currentUrl = new URL(
    `${process.env.CALLBACK_URL}?${ctx.request.querystring}`
  );
  const tokenSet = await openidClient.authorizationCodeGrant(
    ctx.oneLogin,
    currentUrl,
    {
      expectedNonce: nonce,
      expectedState: state,
    }
  );
  return tokenSet;
}

const processCallback = async (ctx) => {
  try {
    console.log("Handling callback.");
    const cookies = ctx.cookie;
    const nonce = cookies.nonce;
    const state = cookies.session;

    console.log(`Cookies are nonce: ${nonce} and state: ${state}`);

    await checkUserStateAgainstDB(ctx, nonce, state);

    const tokenSet = await handleCallbackAndGetTokenSet(ctx, nonce, state);
    if (tokenSet.access_token) {
      console.debug(
        `Retrieved successful tokenSet: ${JSON.stringify(tokenSet, null, 2)}`
      );
    } else {
      throw new Error(`TokenSet is empty object`);
    }

    const cookieOptions = { httpOnly: true, secure: false };
    ctx.cookies.set("id_token", tokenSet.id_token, cookieOptions);

    let userinfo;
    if (tokenSet.access_token) {
      userinfo = await getUserInfo(ctx, tokenSet.access_token);
    } else {
      throw new Error(`TokenSet issue, access_token not present`);
    }
    console.log(`Getting the ${JSON.stringify(userinfo)} object from the RP`);

    ctx.body = userinfo;
  } catch (e) {
    console.log(e);
    ctx.status = 500;
    throw e;
  }
};

async function getUserInfo(ctx, access_token) {
  let maxRetries = 3;
  console.log("Getting the userinfo request");
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await openidClient.fetchUserInfo(
        ctx.oneLogin,
        access_token,
        openidClient.skipSubjectCheck
      );
      console.log(response);
      return response;
    } catch (error) {
      console.warn(`Request to userinfo failed due to ${error}`);
      const delay = 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error(`Userinfo endpoint not authorising`);
}

module.exports = {
  processCallback,
};
