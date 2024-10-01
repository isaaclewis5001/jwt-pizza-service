const supertest = require('supertest');
const { registerUser, loginUser, logoutUser, testUsers, defaultAdmin } = require('./authUtils.js');
const withApp = require('./withApp.js');

function validateLoginResponse(response, user, roles) {
  expect(response.user).toBeDefined();

  const token = response.token;
  let id = response.user.id;

  expect(typeof token).toBe('string');
  expect(typeof id).toBe('number');

  let expectedResponse = {
    user: {
      name: user.name,
      email: user.email,
      roles: user.roles,
      id
    },
    token
  }

  expect(response).toEqual(expectedResponse);
}

test('user auth cycle', async () => {
  await withApp(async (app) => {
    const user1 = testUsers[0];
    const register1Response = await registerUser(app, user1);
    validateLoginResponse(register1Response, user1);

    await registerUser(app, user1, 409);

    const user2 = testUsers[1];
    const register2Response = await registerUser(app, user2);

    await registerUser(app, { email: "some_email", password: "some_password" }, 400);
    await registerUser(app, { name: "some_name", email: "some_email" }, 400);
    await registerUser(app, { name: "some_name", password: "some_password" }, 400);

    await logoutUser(app, register1Response.token);
    await logoutUser(app, register2Response.token);
    await logoutUser(app, "garbage", 401);
    await logoutUser(app, "garbage.butslightlymore.convincing", 401);

    await logoutUser(app, register1Response.token, 401);

    await loginUser(app, { email: user1.email, password: "spoof" }, 404);
    await loginUser(app, { email: "youdontknowmebut", password: "pleaseletmein" }, 404);

    await loginUser(app, { email: "youdontknowmebut", password: "pleaseletmein" }, 404);


    const login1response = await loginUser(app, user1);
    validateLoginResponse(login1response, user1);


    validateLoginResponse(
      await loginUser(app, defaultAdmin),
      defaultAdmin
    );

    await logoutUser(app, login1response.token);
  });
})

