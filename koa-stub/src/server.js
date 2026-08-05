import app from "./app.js";
import { setupClient } from "./utils/onelogin.util.js";

app.context.oneLogin = await setupClient();
app.listen(3000);
console.log("Listening on http://localhost:3000");
