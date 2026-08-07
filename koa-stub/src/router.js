import Router from "koa-router";
import koaCookie from "koa-cookie";
const cookie = koaCookie.default || koaCookie;
import { setNonceAndRedirect } from "./controllers/start.controller.js";
import { processCallback } from "./controllers/callback.controller.js";
import { rpInitiateLogout } from "./controllers/logout.controller.js";

const router = new Router();

router.use(cookie());

router.get("/start", setNonceAndRedirect);
router.get("/callback", processCallback);
router.get("/logout", rpInitiateLogout);
router.get("/test", (ctx) => {
  ctx.status = 200;
  ctx.body = "TestPage";
});
router.get("/", (ctx) => {
  ctx.status = 200;
  ctx.body =
    "Welcome to the RP stub, please see the tests for instructions on how to use.";
});

export default router;
