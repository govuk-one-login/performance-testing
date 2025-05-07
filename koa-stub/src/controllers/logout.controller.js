import { GetItemCommand } from '@aws-sdk/client-dynamodb';

const rpInitiateLogout = async (ctx) => {
  try {
    // Generate nonce and store in dynamodb
    const cookies = ctx.cookie;
    const id_token = cookies.id_token;
    const state = cookies.session;

    // Call the logout endpoint with the accessToken
    let logout;
    if (id_token) {
      logout = await ctx.oneLogin.endSessionUrl({
        id_token_hint: id_token,
        state: state,
      });
      console.log(`Logout url ${logout}`);
    }

    // Clear the cookies on the domain.
    const cookieOptions = { httpOnly: false, secure: false };
    console.log("Trying to delete all our cookies");
    const cookieList = Object.keys(cookies);
    cookieList.forEach((cookie) => {
      console.log(`Deleting cookie ${cookie}`);
      ctx.cookies.set(cookie.name, "", cookieOptions);
      console.log(`Deleted cookie ${cookie}`);
    });
    console.log(`Sending user to url ${logout}`);
    ctx.redirect(logout);
  } catch (e) {
    console.log(e);
    ctx.status = 500;
    throw e;
  }
};

export default {
  rpInitiateLogout,
};
