const Router = require("koa-router");
const router = new Router();
const { setNonceAndRedirect } = require('./controllers/start.controller')
const { processCallback } = require('./controllers/callback.controller');
const { rpInitiateLogout } = require('./controllers/logout.controller');
const cookie = require("koa-cookie");

router.use(cookie.default());

router.get("/start", setNonceAndRedirect);
router.get("/callback", processCallback);
router.get("/logout", rpInitiateLogout);
router.get("/test", (ctx, next) => {
    ctx.status = 200,
    ctx.body = "TestPage"
})

module.exports = router;