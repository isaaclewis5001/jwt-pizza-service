const globalConfig = require('../config.js');
const Database = require('../database/database.js');
const App = require('../service.js');


async function withApp(fn) {
  const rand = Math.floor(Math.random() * 10000000000);
  const name = 'jwt_pizza_service_test' + rand;

  const dbConnectionConfig = {
    ...globalConfig.db.connection,
    database: name,
  };

  const dbConfig = {
    ...globalConfig.db,
    connection: dbConnectionConfig,
  }

  const config = {
    ...globalConfig,
    db: dbConfig
  }

  const database = new Database(dbConfig);

  try {
    const appContext = {
      config,
      database,
    }

    const app = new App(appContext)

    await fn(app);
  }
  finally {
    let conn = await database.pool.getConnection();
    conn.query(`DROP DATABASE ${name}`);
    database.pool.release(conn);
    database.close();
  }
}
module.exports = withApp;
