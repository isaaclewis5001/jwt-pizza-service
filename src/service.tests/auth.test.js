let mockDB = require('./mockDB.js');
mockDB();

let supertest = require('supertest');
let app = require('../service.js');

let testUsers = [
  {
    name: 'jacob marley',
    email: 'jac.marley@smholdings.uk',
    password: 'moreliketinyjim'
  }
];

async function registerUser(user, expectStatus = 200) {
  return (await supertest(app)
    .post('/api/auth')
    .send({ name: user.name, email: user.email, password: user.password })
    .expect(expectStatus)
    .expect('Content-Type', /json/)
  ).body;
}

function validateLoginResponse(response, user) {
  expect(response.user).toBeDefined();

  let token = response.token;
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

test('register user', async () => {
  let user = testUsers[0];
  let response = await registerUser(user);
  validateLoginResponse(response, user);
});

