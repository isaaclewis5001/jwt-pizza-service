const express = require('express');
const AuthRouter = require('./routes/authRouter.js');
const OrderRouter = require('./routes/orderRouter.js');
const FranchiseRouter = require('./routes/franchiseRouter.js');
const version = require('./version.json');
const JWToken = require('./JWToken.js');

class App {
  constructor(appContext) {
    this.context = appContext;
    this.authRouter = new AuthRouter(appContext);
    this.orderRouter = new OrderRouter(appContext);
    this.franchiseRouter = new FranchiseRouter(appContext);
    this.apiRouter = express.Router();


    // Authenticate token

    async function setAuthUser(req, _res, next) {
      const token = JWToken.fromRequest(req);
      if (token) {
        try {
          if (await appContext.database.isLoggedIn(token)) {
            // Check the database to make sure the token is valid.
            req.user = token.verify(appContext.config.jwtSecret);
            req.user.isRole = (role) => !!req.user.roles.find((r) => r.role === role);
          }
        } catch {
          req.user = null;
        }
      }
      next();
    }

    this.app = express();
    this.app.use(express.json());
    this.app.use(setAuthUser);
    this.app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      next();
    });

    this.app.use('/api', this.apiRouter);
    this.apiRouter.use('/auth', this.authRouter.router);
    this.apiRouter.use('/order', this.orderRouter.router);
    this.apiRouter.use('/franchise', this.franchiseRouter.router);

    const authRouter = this.authRouter;
    const orderRouter = this.orderRouter;
    const franchiseRouter = this.franchiseRouter;
    this.apiRouter.use('/docs', (_req, res) => {
      res.json({
        version: version.version,
        endpoints: [...authRouter.router.endpoints, ...orderRouter.router.endpoints, ...franchiseRouter.router.endpoints],
        config: { factory: appContext.config.factory.url, db: appContext.config.db.connection.host },
      });
    });

    this.app.get('/', (_req, res) => {
      res.json({
        message: 'welcome to JWT Pizza',
        version: version.version,
      });
    });

    this.app.use('*', (_req, res) => {
      res.status(404).json({
        message: 'unknown endpoint',
      });
    });


    // Default error handler for all exceptions and errors.
    this.app.use((err, _req, res, next) => {
      res.status(err.statusCode ?? 500).json({ message: err.message, stack: err.stack });
      next();
    });
  }
}

module.exports = App;
