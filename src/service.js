const express = require('express');
const AuthRouter = require('./routes/authRouter.js');
const OrderRouter = require('./routes/orderRouter.js');
const FranchiseRouter = require('./routes/franchiseRouter.js');
const version = require('./version.json');
const JWToken = require('./JWToken.js');



class App {
  constructor(appContext) {

    this.context = appContext;

    this.authRouter = new AuthRouter(this);
    this.orderRouter = new OrderRouter(this);
    this.franchiseRouter = new FranchiseRouter(this);
    this.apiRouter = express.Router();

    // Authenticate token

    const that = this

    this.app = express();
    this.app.use((req, res, next) => that.requestReporting(req, res, next));
    this.app.use(this.context.logger.httpLogger);
    this.app.use(express.json());
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
    this.app.use(this.handleError);
  }

  requestReporting(req, res, next) {
    this.context.metrics.incrementRequests(req.method);
    const t1 = Date.now();
    next();
    const t2 = Date.now();
    this.context.metrics.reportServiceLatency(t2 - t1);
    if (res.statusCode >= 400) {
      this.context.metrics.reportResponseStatusError();
    }
  }

  handleError = (err, req, res, next) => {
    this.context.logger.unhandledErrorLogger(err);
    this.context.metrics.reportUnhandledError();
    res.status(err.statusCode ?? 500).json({ message: err.message, stack: err.stack });
    next();
  }

  authenticateToken = ((that) => (async (req, res, next) => {
    const token = JWToken.fromRequest(req);
    if (token) {
      try {
        if (await that.context.database.isLoggedIn(token)) {
          // Check the database to make sure the token is valid.
          req.user = token.verify(that.context.config.jwtSecret);
          req.user.isRole = (role) => !!req.user.roles.find((r) => r.role === role);
          that.context.metrics.reportAuth(true);
          return await next();
        }
      } catch {
        // Treat intermediate exceptions as auth failures
      }
    }
    that.context.metrics.reportAuth(false);
    return res.status(401).send({ message: 'unauthorized' });
  }))(this)
}

module.exports = App;
