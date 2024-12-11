const { expect, test } = require('@jest/globals');

const { registerUser, loginUser, logoutUser, updateUser, testUsers, defaultAdmin } = require('./authUtils.js');
const withApp = require('./withApp.js');

function validateLoginResponse(response, user) {
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

function validateUpdateResponse(response, user) {
  let id = response.id;
  expect(typeof id).toBe('number');
  let expectedResponse = {
    name: user.name,
    email: user.email,
    roles: user.roles,
    id
  }
  expect(response).toEqual(expectedResponse);
}

test('user auth cycle', async () => {
  await withApp(async (app) => {
    const user1 = testUsers[0];
    const register1Response = await registerUser(app, user1);

    const user1Id = register1Response.user.id;

    validateLoginResponse(register1Response, user1);
    await registerUser(app, user1, 409);

    const user2 = testUsers[1];
    const register2Response = await registerUser(app, user2);
    const user2Id = register2Response.user.id;

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


    const login1Response = await loginUser(app, user1);
    validateLoginResponse(login1Response, user1);
    expect(login1Response.user.id).toBe(user1Id);

    const loginAdminResponse = await loginUser(app, defaultAdmin);
    validateLoginResponse(
      loginAdminResponse,
      defaultAdmin
    );
    const adminAuth = loginAdminResponse.token;

    const updateUser1Result = await updateUser(app, login1Response.token, user1Id, "new_email", undefined);

    const newUser1 = { ...user1, email: "new_email" };
    validateUpdateResponse(updateUser1Result, newUser1);

    validateUpdateResponse(await updateUser(app, adminAuth, user2Id, undefined, "shiny_new_password"), user2);

    await updateUser(app, login1Response.token, user2Id, undefined, "your_account_is_mine", 401);

    await logoutUser(app, login1Response.token);
  });
})

