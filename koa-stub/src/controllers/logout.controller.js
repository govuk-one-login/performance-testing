const { GetItemCommand } = require("@aws-sdk/client-dynamodb");

const rpInitiateLogout = async (ctx) => {
    try {
        // Generate nonce and store in dynamodb
        const cookies = ctx.cookie;
        const id_token = cookies.id_token
        const state = cookies.session;

        // Call the logout endpoint with the accessToken
        let logout;
        if (id_token) {
            logout = await ctx.oneLogin.endSessionUrl(
                {
                    id_token_hint:id_token,
                    state: state
                });
        }  

        // Clear the cookies on the domain.
        const cookieOptions = { httpOnly: true, secure: false }
        console.log("Trying to delete all our cookies")
        const cookieList = Object.keys(cookies)
        cookieList.forEach( (cookie) => {
            console.log(`Deleting cookie ${cookie.name}`)
            ctx.cookies.set(cookie.name, '', cookieOptions);
        });
        
        ctx.redirect(logout)
    }
    catch (e) {
        console.log(e)
        ctx.status = 500
        throw(e)
    }
    

}

module.exports = {
    rpInitiateLogout,
}