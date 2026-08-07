import { OAuth2Server } from "oauth2-mock-server";

const server = new OAuth2Server();
await server.issuer.keys.generate("RS256");
await server.start(8080, "localhost");
console.log("OAuth 2 issuer is", server.issuer.url);

process.on("SIGINT", async () => {
  await server.stop();
  process.exit(0);
});
