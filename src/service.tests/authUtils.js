const supertest = require('supertest')

let testUsers = [
  {
    name: 'jacob marley',
    email: 'jac.marley@smholdings.uk',
    password: 'moreliketinyjim',
    roles: [{ role: 'diner' }]
  }, {
    name: 'ebeneezer scrooge',
    email: 'eb.scrooge@smholdings.uk',
    password: 'humbug',
    roles: [{ role: 'diner' }]
  },
];

let defaultAdmin = {
  name: '常用名字',
  email: 'a@jwt.com',
  password: 'admin',
  roles: [{ role: 'admin' }]
};

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

module.exports = { registerUser, loginUser, logoutUser, testUsers, defaultAdmin }
