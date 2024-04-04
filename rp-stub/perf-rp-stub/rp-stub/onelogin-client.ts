import { Issuer } from 'openid-client';

async function setupClient() {
    const oneLogin = await Issuer.discover("https://oidc.build.account.gov.uk/.well-known/openid-configuration");

    const client = new oneLogin.Client({
        client_id: 'zELcpfANLqY7Oqas',
        client_secret: 'TQV5U29k1gHibH5bx1layBo0OSAvAbRT3UYW3EWrSYBB5swxjVfWUa1BS8lqzxG/0v9wruMcrGadany3',
        redirect_uris: ['http://localhost:3000/callback'],
        response_types: ['code'],
    });
    return client
}

export { setupClient }