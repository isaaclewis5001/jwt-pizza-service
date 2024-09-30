const supertest = require('supertest');
const withApp = require('./withApp.js');

let testUsers = [
  {
    name: 'jacob marley',
    email: 'jac.marley@smholdings.uk',
    password: 'moreliketinyjim'
  }, {
    name: 'ebeneezer scrooge',
    email: 'eb.scrooge@smholdings.uk',
    password: 'humbug'
  }
];

async function registerUser(app, user, expectStatus = 200) {
  return (await supertest(app.app)
    .post('/api/auth')
    .send({ name: user.name, email: user.email, password: user.password })
    .expect(expectStatus)
    .expect('Content-Type', /json/)
  ).body;
}

async function loginUser(app, user, expectStatus = 200) {
  return (await supertest(app.app)
    .put('/api/auth')
    .send({ email: user.email, password: user.password })
    .expect(expectStatus)
    .expect('Content-Type', /json/)
  ).body;
}

async function logoutUser(app, auth, expectStatus = 200) {
  await supertest(app.app)
    .del('/api/auth')
    .set('Authorization', 'Bearer: ' + auth)
    .expect(expectStatus);
}

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
      roles: [
        { role: 'diner' }
      ],
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

    const login1response = await loginUser(app, user1);
    validateLoginResponse(login1response, user1);

    await logoutUser(app, login1response.token);
  });
})

