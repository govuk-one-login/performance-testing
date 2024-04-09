const { OAuth2Server } = require('oauth2-mock-server');

let server = new OAuth2Server();

// Generate a new RSA key and add it to the keystore
server.issuer.keys.generate('RS256');

// Start the server
server.start(8000, 'localhost').then ( () => {
    console.log('Issuer URL:', server.issuer.url); // -> http://localhost:8080
}
)
