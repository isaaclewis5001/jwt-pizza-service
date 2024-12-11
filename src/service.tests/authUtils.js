const supertest = require('supertest');
const config = require('../config');

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

const defaultAdmin = {
  ...config.db.admin,
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

async function updateUser(app, auth, userId, email, password, expectStatus = 200) {
  return (await supertest(app.app)
    .put(`/api/auth/${userId}`)
    .set('Authorization', 'Bearer: ' + auth)
    .send({ email, password })
    .expect(expectStatus)).body;
}
module.exports = { registerUser, loginUser, logoutUser, testUsers, updateUser, defaultAdmin }
