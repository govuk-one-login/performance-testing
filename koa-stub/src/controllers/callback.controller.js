const { GetItemCommand } = require("@aws-sdk/client-dynamodb");

// Check the data we have aligns with this user.
async function checkUserStateAgainstDB(ctx, nonce, state) {

    // Read the data from the DB
    const input = {
        TableName: process.env.SESSION_TABLE,
        Key: {
            "id": {
                "S": nonce,
            }
        }
    }
    const command = new GetItemCommand(input)
    const dbresponse = await ctx.ddbClient.send(command);
    console.log(JSON.stringify(dbresponse))
    // RP Check that the user is who they say they are.
    if (dbresponse.Item) {
        console.log(dbresponse.Item.state.S === state)
        console.log("Yay! Correct state.")
    }
}

async function handleCallbackAndGetTokenSet(ctx, nonce, state) {
    const params = ctx.oneLogin.callbackParams(ctx.request)
    // Checks existing tokens for
    const tokenSet = await ctx.oneLogin.callback(
        `${process.env.CALLBACK_URL}`,
        params,
        {
            'nonce': nonce,
            'state': state,
        });
    return tokenSet
    }

const processCallback = async (ctx) => {
    try {
        // Generate nonce and store in dynamodb
        const cookies = ctx.cookie;
        const nonce = cookies.nonce;
        const state = cookies.session;

        await checkUserStateAgainstDB(ctx, nonce, state);
        console.log("User state correct.")

        const tokenSet = await handleCallbackAndGetTokenSet(ctx, nonce, state)
        console.log(`Retrieved successful tokenSet: ${tokenSet}`)

        // Only doing this in perf to enable logout.
        const cookieOptions = { httpOnly: true, secure: false }
        ctx.cookies.set('id_token', tokenSet.id_token, cookieOptions)

        // Call the userInfo endpoint with the accessToken
        let userinfo;
        if (tokenSet.access_token) {
            userinfo = await ctx.oneLogin.userinfo(tokenSet.access_token);
        }

        ctx.status = 200
        ctx.body = userinfo
    }
    catch (e) {
        console.log(e)
        ctx.status = 500
        throw(e)
    }


}

module.exports = {
    processCallback,
}