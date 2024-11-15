const express = require('express');
const config = require('../config.js');
const { Role } = require('../model/model.js');
const { asyncHandler, StatusCodeError } = require('../endpointHelper.js');
const metrics = require('../metrics.js');
const logger = require('../logger.js');


const endpoints = [
  {
    method: 'GET',
    path: '/api/order/menu',
    description: 'Get the pizza menu',
    example: `curl localhost:3000/api/order/menu`,
    response: [{ id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' }],
  },
  {
    method: 'PUT',
    path: '/api/order/menu',
    requiresAuth: true,
    description: 'Add an item to the menu',
    example: `curl -X PUT localhost:3000/api/order/menu -H 'Content-Type: application/json' -d '{ "title":"Student", "description": "No topping, no sauce, just carbs", "image":"pizza9.png", "price": 0.0001 }'  -H 'Authorization: Bearer tttttt'`,
    response: [{ id: 1, title: 'Student', description: 'No topping, no sauce, just carbs', image: 'pizza9.png', price: 0.0001 }],
  },
  {
    method: 'GET',
    path: '/api/order',
    requiresAuth: true,
    description: 'Get the orders for the authenticated user',
    example: `curl -X GET localhost:3000/api/order  -H 'Authorization: Bearer tttttt'`,
    response: { dinerId: 4, orders: [{ id: 1, franchiseId: 1, storeId: 1, date: '2024-06-05T05:14:40.000Z', items: [{ id: 1, menuId: 1, description: 'Veggie', price: 0.05 }] }], page: 1 },
  },
  {
    method: 'POST',
    path: '/api/order',
    requiresAuth: true,
    description: 'Create a order for the authenticated user',
    example: `curl -X POST localhost:3000/api/order -H 'Content-Type: application/json' -d '{"franchiseId": 1, "storeId":1, "items":[{ "menuId": 1, "description": "Veggie", "price": 0.05 }]}'  -H 'Authorization: Bearer tttttt'`,
    response: { order: { franchiseId: 1, storeId: 1, items: [{ menuId: 1, description: 'Veggie', price: 0.05 }], id: 1 }, jwt: '1111111111' },
  },
];

class OrderRouter {
  constructor(app) {
    this.router = express.Router();
    this.router.endpoints = endpoints;

    // getMenu
    this.router.get(
      '/menu',
      asyncHandler(async (_req, res) => {
        res.send(await app.context.database.getMenu());
      })
    );

    // addMenuItem
    this.router.put(
      '/menu',
      app.authenticateToken,
      asyncHandler(async (req, res) => {
        if (!req.user.isRole(Role.Admin)) {
          throw new StatusCodeError('unable to add menu item', 403);
        }

        const addMenuItemReq = req.body;
        await app.context.database.addMenuItem(addMenuItemReq);
        res.send(await app.context.database.getMenu());
      })
    );

    // getOrders
    this.router.get(
      '/',
      app.authenticateToken,
      asyncHandler(async (req, res) => {
        res.json(await app.context.database.getOrders(req.user, req.query.page));
      })
    );

    // createOrder
    this.router.post(
      '/',
      app.authenticateToken,
      asyncHandler(async (req, res) => {
        const orderReq = req.body;
        const order = await app.context.database.addDinerOrder(req.user, orderReq);
        const startTime = Date.now();
        const r = await fetch(`${config.factory.url}/api/order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', authorization: `Bearer ${config.factory.apiKey}` },
          body: JSON.stringify({ diner: { id: req.user.id, name: req.user.name, email: req.user.email }, order }),
        });
        const j = await r.json();
        metrics.reportFactoryLatency(Date.now() - startTime);
        if (r.ok) {
          const price = order.items.reduce((acc, item) => {
            try { return acc + Number(item.price) }
            catch { return acc }
          }, 0);
          metrics.reportSale(order.items.length, price, true);
          res.send({ order, jwt: j.jwt, reportUrl: j.reportUrl });
        } else {
          metrics.reportSale(0, 0, false);
          res.status(500).send({ message: 'Failed to fulfill order at factory', reportUrl: j.reportUrl });
        }

        logger.factoryLogger({
          franchiseId: orderReq.franchiseId,
          storeId: orderReq.storeId,
          success: r.ok,
          orderId: order.id
        });
      })
    );
  }
}


module.exports = OrderRouter;
