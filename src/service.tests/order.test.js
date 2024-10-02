const { expect, test, fail } = require('@jest/globals');
const { loginUser, defaultAdmin, testUsers, registerUser } = require("./authUtils");
const { addToMenu, testMenu, getMenu, getOrders } = require("./orderUtils");
const withApp = require("./withApp");
const config = require('../config.js');

test('order cycle', async () => {
  await withApp(async (app) => {
    let fetchFactoryInner;

    global.fetch = async (route, options) => {
      if (!route.startsWith(config.factory.url)) {
        throw new TypeError("Forbiden URL")
      }
      let subRoute = route.slice(config.factory.url.length);
      if (subRoute !== "/api/order" || options.method !== 'POST') {
        return Response("Not found", { status: 404 });
      }
      if (!JSON.parse(options.body)) {
        fail();
      };
      return fetchFactoryInner();
    };


    const adminLogin = await loginUser(app, defaultAdmin);
    const dinerLogin = await registerUser(app, testUsers[0]);

    await addToMenu(app, dinerLogin.token, testMenu[0], 403);

    for (const item of testMenu) {
      await addToMenu(app, adminLogin.token, item)
    }

    const menuResult = await getMenu(app);
    expect(menuResult.length).toBe(testMenu.length);

    for (let i = 0; i < menuResult.length; i++) {
      expect(menuResult[i]).toMatchObject(testMenu[i]);
    }

    fetchFactoryInner = () => {
      return Response(JSON.stringify({
        jwt: "da.real.jwt",
        reportUrl: "https://wikipedia.org/",
      }));
    }

    expect(await getOrders(app, dinerLogin.token)).toMatchObject(
      {
        dinerId: dinerLogin.user.id,
        orders: [],
        page: 1
      }
    );


  });
});
