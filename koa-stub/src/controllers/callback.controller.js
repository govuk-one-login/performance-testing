import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import * as openidClient from "openid-client";

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
  if (dbresponse.Item.state.S === state) {
  }
}

async function handleCallbackAndGetTokenSet(ctx, nonce, state) {

  const currentUrl = new URL(
    `${process.env.CALLBACK_URL}?${ctx.request.querystring}`,
  );
  const tokenSet = await openidClient.authorizationCodeGrant(
    ctx.oneLogin,
    currentUrl,
    {
      expectedNonce: nonce,
      expectedState: state,
    },
  );
  return tokenSet;
}

export const processCallback = async (ctx) => {
  try {
    const cookies = ctx.cookie;
    const nonce = cookies.nonce;
    const state = cookies.session;

    await checkUserStateAgainstDB(ctx, nonce, state);

    const tokenSet = await handleCallbackAndGetTokenSet(ctx, nonce, state);
    if (tokenSet.access_token) {

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


    ctx.body = userinfo;
  } catch (e) {
    console.error(e);
    ctx.status = 500;
    throw e;
  }
};

async function getUserInfo(ctx, access_token) {
  let maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await openidClient.fetchUserInfo(
        ctx.oneLogin,
        access_token,
        openidClient.skipSubjectCheck,
      );
      return response;
    } catch (error) {
      console.warn(`Request to userinfo failed due to ${error}`);
      const delay = 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error(`Userinfo endpoint not authorising`);
}
