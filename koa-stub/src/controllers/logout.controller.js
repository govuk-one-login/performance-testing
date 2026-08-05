import * as openidClient from "openid-client";

export const rpInitiateLogout = async (ctx) => {
  try {
    const cookies = ctx.cookie;
    const id_token = cookies.id_token;
    const state = cookies.session;

    let logout;
    if (id_token) {
      const logout_url =
        process.env.LOGOUT_URL ||
        process.env.CALLBACK_URL.replace("callback", "");
      const logoutUrl = openidClient.buildEndSessionUrl(ctx.oneLogin, {
        id_token_hint: id_token,
        state: state,
        post_logout_redirect_uri: logout_url,
      });
      logout = logoutUrl.href;
    }

    const cookieOptions = { httpOnly: false, secure: false };
    const cookieList = Object.keys(cookies);
    cookieList.forEach((cookie) => {
      ctx.cookies.set(cookie.name, "", cookieOptions);
    });
    ctx.redirect(logout);
  } catch (e) {
    console.error(e);
    ctx.status = 500;
    throw e;
  }
};
