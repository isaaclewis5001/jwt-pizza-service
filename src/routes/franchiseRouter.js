const express = require('express');
const { Role } = require('../model/model.js');
const { StatusCodeError, asyncHandler } = require('../endpointHelper.js');


const endpoints = [
  {
    method: 'GET',
    path: '/api/franchise',
    description: 'List all the franchises',
    example: `curl localhost:3000/api/franchise`,
    response: [{ id: 1, name: 'pizzaPocket', stores: [{ id: 1, name: 'SLC' }] }],
  },
  {
    method: 'GET',
    path: '/api/franchise/:userId',
    requiresAuth: true,
    description: `List a user's franchises`,
    example: `curl localhost:3000/api/franchise/4  -H 'Authorization: Bearer tttttt'`,
    response: [{ id: 2, name: 'pizzaPocket', admins: [{ id: 4, name: 'pizza franchisee', email: 'f@jwt.com' }], stores: [{ id: 4, name: 'SLC', totalRevenue: 0 }] }],
  },
  {
    method: 'POST',
    path: '/api/franchise',
    requiresAuth: true,
    description: 'Create a new franchise',
    example: `curl -X POST localhost:3000/api/franchise -H 'Content-Type: application/json' -H 'Authorization: Bearer tttttt' -d '{"name": "pizzaPocket", "admins": [{"email": "f@jwt.com"}]}'`,
    response: { name: 'pizzaPocket', admins: [{ email: 'f@jwt.com', id: 4, name: 'pizza franchisee' }], id: 1 },
  },
  {
    method: 'DELETE',
    path: '/api/franchise/:franchiseId',
    requiresAuth: true,
    description: `Delete a franchises`,
    example: `curl -X DELETE localhost:3000/api/franchise/1 -H 'Authorization: Bearer tttttt'`,
    response: { message: 'franchise deleted' },
  },
  {
    method: 'POST',
    path: '/api/franchise/:franchiseId/store',
    requiresAuth: true,
    description: 'Create a new franchise store',
    example: `curl -X POST localhost:3000/api/franchise/1/store -H 'Content-Type: application/json' -d '{"franchiseId": 1, "name":"SLC"}' -H 'Authorization: Bearer tttttt'`,
    response: { id: 1, franchiseId: 1, name: 'SLC' },
  },
  {
    method: 'DELETE',
    path: '/api/franchise/:franchiseId/store/:storeId',
    requiresAuth: true,
    description: `Delete a store`,
    example: `curl -X DELETE localhost:3000/api/franchise/1/store/1  -H 'Authorization: Bearer tttttt'`,
    response: { message: 'store deleted' },
  },
];

class FranchiseRouter {
  constructor(app) {
    this.router = express.Router();
    this.router.endpoints = endpoints;

    // getFranchises
    this.router.get(
      '/',
      asyncHandler(async (req, res) => {
        res.json(await app.context.database.getFranchises(req.user));
      })
    );

    // getUserFranchises
    this.router.get(
      '/:userId',
      app.authenticateToken,
      asyncHandler(async (req, res) => {
        let result = [];
        const userId = Number(req.params.userId);
        if (req.user.id === userId || req.user.isRole(Role.Admin)) {
          result = await app.context.database.getUserFranchises(userId);
        }

        res.json(result);
      })
    );

    // createFranchise
    this.router.post(
      '/',
      app.authenticateToken,
      asyncHandler(async (req, res) => {
        if (!req.user.isRole(Role.Admin)) {
          throw new StatusCodeError('unable to create a franchise', 403);
        }
        const franchise = req.body;
        res.send(await app.context.database.createFranchise(franchise));
      })
    );

    // deleteFranchise
    this.router.delete(
      '/:franchiseId',
      app.authenticateToken,
      asyncHandler(async (req, res) => {
        if (!req.user.isRole(Role.Admin)) {
          throw new StatusCodeError('unable to delete a franchise', 403);
        }

        const franchiseId = Number(req.params.franchiseId);
        await app.context.database.deleteFranchise(franchiseId);
        res.json({ message: 'franchise deleted' });
      })
    );

    // createStore
    this.router.post(
      '/:franchiseId/store',
      app.authenticateToken,
      asyncHandler(async (req, res) => {
        const franchiseId = Number(req.params.franchiseId);
        const franchise = await app.context.database.getFranchise({ id: franchiseId });
        if (!franchise || (!req.user.isRole(Role.Admin) && !franchise.admins.some((admin) => admin.id === req.user.id))) {
          throw new StatusCodeError('unable to create a store', 403);
        }

        res.send(await app.context.database.createStore(franchise.id, req.body));
      })
    );

    // deleteStore
    this.router.delete(
      '/:franchiseId/store/:storeId',
      app.authenticateToken,
      asyncHandler(async (req, res) => {
        const franchiseId = Number(req.params.franchiseId);
        const franchise = await app.context.database.getFranchise({ id: franchiseId });
        if (!franchise || (!req.user.isRole(Role.Admin) && !franchise.admins.some((admin) => admin.id === req.user.id))) {
          throw new StatusCodeError('unable to delete a store', 403);
        }

        const storeId = Number(req.params.storeId);
        await app.context.database.deleteStore(franchiseId, storeId);
        res.json({ message: 'store deleted' });
      })
    );
  }
}

module.exports = FranchiseRouter;
