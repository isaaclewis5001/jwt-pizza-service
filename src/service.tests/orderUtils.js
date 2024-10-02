const supertest = require('supertest');

const testMenu = [
    {
        title: "Rice Pizza",
        description: "A pizza with rice on it.",
        image: "rice.jpg",
        price: 0.01,
    },
    {
        title: "Imaginary Pizza",
        description: "Almost too good to be true.",
        image: "the_thinker.png",
        price: 0.0001,
    }
]

async function getMenu(app, expectStatus = 200) {
    return (await supertest(app.app)
        .get("/api/order/menu")
        .expect(expectStatus)
        .expect('Content-Type', /json/)
    ).body;
}

async function getOrders(app, auth, expectStatus = 200) {
    return (await supertest(app.app)
        .get("/api/order")
        .set('Authorization', 'Bearer: ' + auth)
        .expect(expectStatus)
        .expect('Content-Type', /json/)
    ).body;
}

async function addToMenu(app, auth, item, expectStatus = 200) {
    await supertest(app.app)
        .put('/api/order/menu')
        .set('Authorization', 'Bearer: ' + auth)
        .send({title: item.title, description: item.description, image: item.image, price: item.price})
        .expect(expectStatus);
}

module.exports = {getMenu, addToMenu, getOrders, testMenu}
