// FIX: require was inside function body — moved to top level for consistency and efficiency
const openidClient = require("openid-client");

const rpInitiateLogout = async (ctx) => {
  try {
    const cookies = ctx.cookie;
    const id_token = cookies.id_token;
    const state = cookies.session;

    let logout;
    if (id_token) {
      const logout_url =
        process.env.LOGOUT_URL || process.env.CALLBACK_URL.replace("callback", "");
      const logoutUrl = openidClient.buildEndSessionUrl(ctx.oneLogin, {
        id_token_hint: id_token,
        state: state,
        post_logout_redirect_uri: logout_url,
      });
      logout = logoutUrl.href;
      console.log(`Logout url ${logout}`);
    }

    const cookieOptions = { httpOnly: false, secure: false };
    console.log("Trying to delete all our cookies");
    const cookieList = Object.keys(cookies);
    cookieList.forEach((cookieName) => {
      // FIX: Object.keys returns strings, not objects — cookie.name was always undefined
      console.log(`Deleting cookie ${cookieName}`);
      ctx.cookies.set(cookieName, "", cookieOptions);
      console.log(`Deleted cookie ${cookieName}`);
    });
    console.log(`Sending user to url ${logout}`);
    ctx.redirect(logout);
  } catch (e) {
    // FIX: Don't re-throw after setting status — Koa's error handler would double-log the error.
    // Set status and body to handle it cleanly.
    console.log(e);
    ctx.status = 500;
    ctx.body = { error: e.message };
  }
};

module.exports = {
  rpInitiateLogout,
};
