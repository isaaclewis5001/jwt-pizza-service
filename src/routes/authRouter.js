const express = require('express');
const { asyncHandler } = require('../endpointHelper.js');
const { Role } = require('../model/model.js');
const JWToken = require('../JWToken.js');

endpoints = [
  {
    method: 'POST',
    path: '/api/auth',
    description: 'Register a new user',
    example: `curl -X POST localhost:3000/api/auth -d '{"name":"pizza diner", "email":"d@jwt.com", "password":"diner"}' -H 'Content-Type: application/json'`,
    response: { user: { id: 2, name: 'pizza diner', email: 'd@jwt.com', roles: [{ role: 'diner' }] }, token: 'tttttt' },
  },
  {
    method: 'PUT',
    path: '/api/auth',
    description: 'Login existing user',
    example: `curl -X PUT localhost:3000/api/auth -d '{"email":"a@jwt.com", "password":"admin"}' -H 'Content-Type: application/json'`,
    response: { user: { id: 1, name: '常用名字', email: 'a@jwt.com', roles: [{ role: 'admin' }] }, token: 'tttttt' },
  },
  {
    method: 'PUT',
    path: '/api/auth/:userId',
    requiresAuth: true,
    description: 'Update user',
    example: `curl -X PUT localhost:3000/api/auth/1 -d '{"email":"a@jwt.com", "password":"admin"}' -H 'Content-Type: application/json' -H 'Authorization: Bearer tttttt'`,
    response: { id: 1, name: '常用名字', email: 'a@jwt.com', roles: [{ role: 'admin' }] },
  },
  {
    method: 'DELETE',
    path: '/api/auth',
    requiresAuth: true,
    description: 'Logout a user',
    example: `curl -X DELETE localhost:3000/api/auth -H 'Authorization: Bearer tttttt'`,
    response: { message: 'logout successful' },
  },
];

class AuthRouter {
  constructor(appContext) {
    this.router = express.Router();
    this.router.endpoints = endpoints;

    // register
    this.router.post(
      '/',
      asyncHandler(async (req, res) => {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
          return res.status(400).json({ message: 'name, email, and password are required' });
        }
        const user = await appContext.database.addUser({ name, email, password, roles: [{ role: Role.Diner }] });
        const auth = await setAuth(user);
        res.json({ user: user, token: auth.fullText });
      })
    );

    // login
    this.router.put(
      '/',
      asyncHandler(async (req, res) => {
        const { email, password } = req.body;
        const user = await appContext.database.getUser(email, password);
        const auth = await setAuth(user);
        res.json({ user: user, token: auth.fullText });
      })
    );

    // logout
    this.router.delete(
      '/',
      AuthRouter.authenticateToken,
      asyncHandler(async (req, res) => {
        clearAuth(req);
        res.json({ message: 'logout successful' });
      })
    );

    // updateUser
    this.router.put(
      '/:userId',
      AuthRouter.authenticateToken,
      asyncHandler(async (req, res) => {
        const { email, password } = req.body;
        const userId = Number(req.params.userId);
        const user = req.user;
        if (user.id !== userId && !user.isRole(Role.Admin)) {
          return res.status(403).json({ message: 'unauthorized' });
        }

        const updatedUser = await appContext.database.updateUser(userId, email, password);
        res.json(updatedUser);
      })
    );

    async function setAuth(user) {
      const token = JWToken.sign(user, appContext.config.jwtSecret);
      await appContext.database.loginUser(user.id, token);
      return token;
    }

    async function clearAuth(req) {
      const token = JWToken.fromRequest(req);
      if (token) {
        await appContext.database.logoutUser(token);
      }
    }
  }

  static authenticateToken(req, res, next) {
    if (!req.user) {
      return res.status(401).send({ message: 'unauthorized' });
    }
    next();
  };
}

module.exports = AuthRouter;
