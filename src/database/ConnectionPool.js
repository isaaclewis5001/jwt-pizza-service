const mysql = require('mysql2/promise');

function getDBNameFromConfig(config) {
  return config.connection.database;
}

class ConnectionPool {
  constructor(config, initFn) {
    this._config = config;
    this._connections = [];
    this._initialized = this._initialize(initFn);
  }

  async getConnection() {
    await this._initialized;
    return await this._getConnection();
  }

  async _initialize(initFn) {
    let connection;
    try {
      connection = await this._getConnection(false);
    }
    catch (e) {
      console.log(e);
      console.warn("could not connect to database, most endpoints will break!")
      return;
    }
    try {
      const dbname = getDBNameFromConfig(this._config);

      const [rows] = await connection.query(`select schema_name from information_schema.schemata where schema_name = ?`, [dbname]);
      const dbexists = rows.length > 0;
      console.log(dbexists ? 'database exists' : `database does not exist (${dbname})`);

      await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbname}`);
      await connection.query(`USE ${dbname}`);
      await initFn(connection, dbexists);
      this.release(connection);
    } catch (err) {
      connection.end();
      console.error(JSON.stringify({ message: 'Error initializing database', exception: err.message, connection: this._config.connection }));
      return Promise.reject(err);
    }
    finally {
      this.release(connection)
    }
  }

  async closeAll() {
    let oldConns = this._connections;
    this._connections = [];
    await Promise.all(oldConns.map((connection) =>
      connection.end()
    ));
  }

  async _getConnection(isInitialized = true) {
    let connection = this._connections.pop();
    if (connection === undefined) {
      connection = await mysql.createConnection({
        host: this._config.connection.host,
        user: this._config.connection.user,
        password: this._config.connection.password,
        connectTimeout: this._config.connection.connectTimeout,
        decimalNumbers: true,
      });
      if (isInitialized) {
        try {
          const dbName = getDBNameFromConfig(this._config);
          connection.query(`USE ${dbName}`);
        } catch (e) {
          connection.end();
          throw e;
        }
      }
    }
    return connection;
  }



  release(conn) {
    this._connections.push(conn);
  }
}

module.exports = ConnectionPool;



