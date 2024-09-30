const mysql = require('mysql2/promise');
const globalConfig = require('../config.js');
const Database = require('../database/database.js');
const App = require('../service.js')

let testDBID = 0;

async function withApp(fn) {
  const name = 'jwt_pizza_service_test' + testDBID;
  testDBID += 1;

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
