const { PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { generators } = require("openid-client");
const crypto = require('crypto')


async function createSession(ctx) {
    const nonce = generators.nonce();
    const session = (Math.random() + 1).toString(36).substring(7);
    // Read this into a hash from session state long term, small hack to get this working as not touching prod data.
    const state = crypto.createHash('md5').update(session).digest('hex');
    const expiry = new Date(); expiry.setDate(expiry.getDate()+1);
    const input = {
        TableName: process.env.SESSION_TABLE,
        Item: {
            "id": {
                "S": `${nonce}`,
            },
            "state": {
                "S": `${state}`,
            },
            "expiry": {
                "S": `${expiry}`
            }
        }
    }
    const command = new PutItemCommand(input)
    await ctx.ddbClient.send(command);

    return {
        'nonce':nonce,
        'state': state
    }
}


const setNonceAndRedirect = async (ctx) => {
    try {
        // Generate nonce and store in dynamodb

        const session = await createSession(ctx);

        // Set cookies
        const cookieOptions = { httpOnly: true, secure: false }
        ctx.cookies.set('nonce', session.nonce, cookieOptions)
        ctx.cookies.set('session', session.state, cookieOptions)

        // Return redirect URL
        const redirectUrl = ctx.oneLogin.authorizationUrl({
            scope: 'openid email phone',
            state: session.state,
            nonce: session.nonce,
            vtr: '["Cl.Cm"]',
            ui_locales: "en",
        });

        ctx.redirect(redirectUrl)
    }
    catch (e) {
        console.log(e)
        ctx.status = 500
        throw(e)
    }


}

module.exports = {
    setNonceAndRedirect,
}
