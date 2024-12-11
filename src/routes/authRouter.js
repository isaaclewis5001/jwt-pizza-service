const express = require('express');
const { asyncHandler } = require('../endpointHelper.js');
const { Role } = require('../model/model.js');
const JWToken = require('../JWToken.js');

const endpoints = [
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
  constructor(app) {
    const that = this;

    this.context = app.context;

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
        const user = await app.context.database.addUser({ name, email, password, roles: [{ role: Role.Diner }] });
        const auth = await that.setAuth(user);
        res.json({ user: user, token: auth.fullText });
      })
    );

    // login
    this.router.put(
      '/',
      asyncHandler((req, res) => that.login(req, res))
    );

    // logout
    this.router.delete(
      '/',
      app.authenticateToken,
      asyncHandler((req, res) => that.logout(req, res))
    );

    // updateUser
    this.router.put(
      '/:userId',
      app.authenticateToken,
      asyncHandler(async (req, res) => {
        const { email, password } = req.body;
        const userId = Number(req.params.userId);
        const user = req.user;
        if (user.id !== userId && !user.isRole(Role.Admin)) {
          return res.status(401).json({ message: 'unauthorized' });
        }

        const updatedUser = await that.context.database.updateUser(userId, email, password);
        res.json(updatedUser);
      })
    );
  }

  logout = ((that) => async (req, res) => {
    that.clearAuth(req);
    res.json({ message: 'logout successful' });
  })(this)

  login = ((that) => async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'bad request'});
    }
    const user = await that.context.database.getUser(email, password);
    const auth = await that.setAuth(user);
    res.json({ user: user, token: auth.fullText });
  })(this)

  async setAuth(user) {
    const token = JWToken.sign(user, this.context.config.jwtSecret);
    await this.context.database.loginUser(user.id, token);
    this.context.metrics.reportLogin();
    return token;
  }

  async clearAuth(req) {
    const token = JWToken.fromRequest(req);
    if (token) {
      this.context.metrics.reportLogout();
      await this.context.database.logoutUser(token);
    }
  }
}

module.exports = AuthRouter;
