const rpInitiateLogout = async (ctx) => {
  try {
    const openidClient = require("openid-client");
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

module.exports = {
  rpInitiateLogout,
};
