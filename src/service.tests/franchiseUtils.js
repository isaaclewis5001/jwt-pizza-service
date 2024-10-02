const supertest = require('supertest');
const { testUsers } = require('./authUtils');


testFranchises = [
    {
        name: "The Jawt",
        admins: [{
            email: testUsers[0].email
        }],
    },
    {
        name: "Jensenzo's Place",
        admins: [],
    }
]

async function listAllFranchises(app, expectStatus=200) {
    return (await supertest(app.app)
        .get('/api/franchise')
        .expect(expectStatus)
        .expect('Content-Type', /json/)
    ).body;
}

async function listUserFranchises(app, auth, userId, expectStatus=200) {
    return (await supertest(app.app)
        .get(`/api/franchise/${userId}`)
        .set('Authorization', 'Bearer: ' + auth)
        .expect(expectStatus)
        .expect('Content-Type', /json/)
    ).body;
}

async function createFranchise(app, auth, franchise, expectStatus=200) {
    return (await supertest(app.app)
        .post(`/api/franchise`)
        .set('Authorization', 'Bearer: ' + auth)
        .send({
            name: franchise.name,
            admins: franchise.admins.map((admin) => {
                return {
                    email: admin.email
                };
            }),
        })
        .expect(expectStatus)
        .expect('Content-Type', /json/)).body;
}

async function deleteFranchise(app, auth, franchiseId, expectStatus=200) {
    await supertest(app.app)
        .del(`/api/franchise/${franchiseId}`)
        .set('Authorization', 'Bearer: ' + auth)
        .expect(expectStatus)
        .expect('Content-Type', /json/);
}

async function createStore(app, auth, franchiseId, store, expectStatus=200) {
    return(await supertest(app.app)
        .post(`/api/franchise/${franchiseId}/store`)
        .set('Authorization', 'Bearer: ' + auth)
        .send({
            name: store.name,
            location: store.location
        })
        .expect(expectStatus)
        .expect('Content-Type', /json/)).body;
}


module.exports = {listAllFranchises, listUserFranchises, deleteFranchise, createFranchise, createStore, testFranchises}
