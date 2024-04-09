const request = require('supertest');
const app = require('../app')

test('The /test endpoint returns TestPage', async () => {
    const response = await request(app.callback()).get('/test');
    expect(response.status).toBe(200);
    expect(response.text).toMatchSnapshot();
});