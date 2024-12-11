const bcrypt = require('bcrypt');
const { StatusCodeError } = require('../endpointHelper.js');
const dbModel = require('./dbModel.js');
const { Role } = require('../model/model.js');
const ConnectionPool = require('./ConnectionPool.js');


async function hash(pass) {
  return await bcrypt.hash(pass, 10);
}

class Database {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    const self = this;
    this.pool = new ConnectionPool(config, (conn, dbExists) => self._initializeDatabase(conn, dbExists));
  }

  async getMenu() {
    const connection = await this.pool.getConnection();
    try {
      const rows = await this.query(connection, `SELECT * FROM menu`);
      return rows;
    } finally {
      this.pool.release(connection);
    }
  }

  async addMenuItem(item) {
    const connection = await this.pool.getConnection();
    try {
      return await this._addMenuItemWithConn(item, connection);
    } finally {
      this.pool.release(connection);
    }
  }

  async _addMenuItemWithConn(item, conn) {
    const addResult = await this.query(conn, `INSERT INTO menu (title, description, image, price) VALUES (?, ?, ?, ?)`, [item.title, item.description, item.image, item.price]);
    return { ...item, id: addResult.insertId };
  }

  async addUser(user) {
    const connection = await this.pool.getConnection();
    try {
      return await this._addUserWithConn(user, connection);
    } finally {
      this.pool.release(connection);
    }
  }

  async _addUserWithConn(user, conn) {
    user.password = await hash(user.password);
    let userResult;
    try {
      userResult = await this.query(conn, 'INSERT INTO user (name, email, password) VALUES (?, ?, ?)', [user.name, user.email, user.password]);
    }
    catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        throw new StatusCodeError("Email already in use. Login?", 409);
      }
      throw (e);
    }
    const userId = userResult.insertId;
    for (const role of user.roles) {
      switch (role.role) {
        case Role.Franchisee: {
          const franchiseId = await this.getID(conn, 'name', role.object, 'franchise');
          await this.query(conn, `INSERT INTO userRole (userId, role, objectId) VALUES (?, ?, ?)`, [userId, role.role, franchiseId]);
          break;
        }
        default: {
          await this.query(conn, `INSERT INTO userRole (userId, role, objectId) VALUES (?, ?, ?)`, [userId, role.role, 0]);
          break;
        }
      }
    }
    return { ...user, id: userId, password: undefined };
  }

  async _userEntryToResult(user, conn) {
    const roleResult = await this.query(conn, `SELECT * FROM userRole WHERE userId=?`, [user.id]);
    const roles = roleResult.map((r) => {
      return { objectId: r.objectId || undefined, role: r.role };
    });

    return { ...user, roles: roles, password: undefined };
  }

  async getUser(email, password) {
    const connection = await this.pool.getConnection();
    try {
      const userResult = await this.query(connection, `SELECT * FROM user WHERE email=?`, [email]);
      const user = userResult[0];
      if (!user || !(await bcrypt.compare(password, user.password))) {
        throw new StatusCodeError('unknown user', 404);
      }

      return await this._userEntryToResult(user, connection)
    } finally {
      this.pool.release(connection);
    }
  }

  async updateUser(userId, email, password) {
    const connection = await this.pool.getConnection();
    try {
      const userResult = await this.query(connection, 'SELECT * FROM user WHERE id=?', [userId]);
      const user = userResult[0];
      if (!user) {
        throw new StatusCodeError('unknown user', 404);
      }
      if (email) {
        try {
          user.email = email;
          await this.query(connection, 'UPDATE user SET email=? WHERE id=?', [user.email, userId]);
        } catch (err) {
          if (err.code === 'ERR_DUP_ENTRY') {
            throw new StatusCodeError("Email already in use.", 409);
          }
          throw err;
        }
      }
      if (password) {
        const hashedPassword = await hash(password);
        await this.query(connection, 'UPDATE user SET password=? WHERE id=?', [hashedPassword, userId]);
      }
      return await this._userEntryToResult(user, connection);
    } finally {
      this.pool.release(connection);
    }
  }

  async loginUser(userId, token) {
    const connection = await this.pool.getConnection();
    try {
      await this.query(connection, `INSERT INTO auth (token, userId) VALUES (?, ?)`, [token.signature, userId]);
    } finally {
      this.pool.release(connection);
    }
  }

  async isLoggedIn(token) {
    const connection = await this.pool.getConnection();
    try {
      const authResult = await this.query(connection, `SELECT userId FROM auth WHERE token=?`, [token.signature]);
      return authResult.length > 0;
    } finally {
      this.pool.release(connection);
    }
  }

  async logoutUser(token) {
    const connection = await this.pool.getConnection();
    try {
      await this.query(connection, `DELETE FROM auth WHERE token=?`, [token.signature]);
    } finally {
      this.pool.release(connection);
    }
  }

  async getOrders(user, page = 1) {
    const connection = await this.pool.getConnection();
    try {
      const listPerPage = this.config.listPerPage;
      const offset = this.getOffset(page, listPerPage);
      const orders = await this.query(connection, `SELECT id, franchiseId, storeId, date FROM dinerOrder WHERE dinerId=? LIMIT ${offset},${listPerPage}`, [user.id]);
      for (const order of orders) {
        let items = await this.query(connection, `SELECT id, menuId, description, price FROM orderItem WHERE orderId=?`, [order.id]);
        order.items = items;
      }
      return { dinerId: user.id, orders: orders, page };
    } finally {
      this.pool.release(connection);
    }
  }

  async addDinerOrder(user, order) {
    const connection = await this.pool.getConnection();
    try {
      const orderResult = await this.query(connection, `INSERT INTO dinerOrder (dinerId, franchiseId, storeId, date) VALUES (?, ?, ?, now())`, [user.id, order.franchiseId, order.storeId]);
      const orderId = orderResult.insertId;
      for (const item of order.items) {
        const menuId = await this.getID(connection, 'id', item.menuId, 'menu');
        await this.query(connection, `INSERT INTO orderItem (orderId, menuId, description, price) VALUES (?, ?, ?, ?)`, [orderId, menuId, item.description, item.price]);
      }
      return { ...order, id: orderId };
    } finally {
      this.pool.release(connection);
    }
  }

  async createFranchise(franchise) {
    const connection = await this.pool.getConnection();
    try {
      for (const admin of franchise.admins) {
        const adminUser = await this.query(connection, `SELECT id, name FROM user WHERE email=?`, [admin.email]);
        if (adminUser.length == 0) {
          throw new StatusCodeError(`unknown user for franchise admin ${admin.email} provided`, 404);
        }
        admin.id = adminUser[0].id;
        admin.name = adminUser[0].name;
      }
      const franchiseResult = await this.query(connection, `INSERT INTO franchise (name) VALUES (?)`, [franchise.name]);
      franchise.id = franchiseResult.insertId;

      for (const admin of franchise.admins) {
        await this.query(connection, `INSERT INTO userRole (userId, role, objectId) VALUES (?, ?, ?)`, [admin.id, Role.Franchisee, franchise.id]);
      }

      return franchise;
    } finally {
      this.pool.release(connection);
    }
  }

  async deleteFranchise(franchiseId) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      try {
        await this.query(connection, `DELETE FROM store WHERE franchiseId=?`, [franchiseId]);
        await this.query(connection, `DELETE FROM userRole WHERE objectId=?`, [franchiseId]);
        await this.query(connection, `DELETE FROM franchise WHERE id=?`, [franchiseId]);
        await connection.commit();
      } catch {
        await connection.rollback();
        throw new StatusCodeError('unable to delete franchise', 500);
      }
    } finally {
      this.pool.release(connection);
    }
  }

  async getFranchises(authUser) {
    const connection = await this.pool.getConnection();
    try {
      const franchises = await this.query(connection, `SELECT id, name FROM franchise`);
      for (const franchise of franchises) {
        if (authUser?.isRole(Role.Admin)) {
          await this.getFranchise(franchise);
        } else {
          franchise.stores = await this.query(connection, `SELECT id, name FROM store WHERE franchiseId=?`, [franchise.id]);
        }
      }
      return franchises;
    } finally {
      this.pool.release(connection);
    }
  }

  async getUserFranchises(userId) {
    const connection = await this.pool.getConnection();
    try {
      let franchiseIds = await this.query(connection, `SELECT objectId FROM userRole WHERE role='franchisee' AND userId=?`, [userId]);
      if (franchiseIds.length === 0) {
        return [];
      }

      franchiseIds = franchiseIds.map((v) => v.objectId);
      const franchises = await this.query(connection, `SELECT id, name FROM franchise WHERE id in (${franchiseIds.join(',')})`);
      for (const franchise of franchises) {
        await this.getFranchise(franchise);
      }
      return franchises;
    } finally {
      this.pool.release(connection);
    }
  }

  async getFranchise(franchise) {
    const connection = await this.pool.getConnection();
    try {
      franchise.admins = await this.query(connection, `SELECT u.id, u.name, u.email FROM userRole AS ur JOIN user AS u ON u.id=ur.userId WHERE ur.objectId=? AND ur.role='franchisee'`, [franchise.id]);

      franchise.stores = await this.query(
        connection,
        `SELECT s.id, s.name, COALESCE(SUM(oi.price), 0) AS totalRevenue FROM dinerOrder AS do JOIN orderItem AS oi ON do.id=oi.orderId RIGHT JOIN store AS s ON s.id=do.storeId WHERE s.franchiseId=? GROUP BY s.id`,
        [franchise.id]
      );

      return franchise;
    } finally {
      this.pool.release(connection);
    }
  }

  async createStore(franchiseId, store) {
    const connection = await this.pool.getConnection();
    try {
      const insertResult = await this.query(connection, `INSERT INTO store (franchiseId, name) VALUES (?, ?)`, [franchiseId, store.name]);
      return { id: insertResult.insertId, franchiseId, name: store.name };
    } finally {
      this.pool.release(connection);
    }
  }

  async deleteStore(franchiseId, storeId) {
    const connection = await this.pool.getConnection();
    try {
      await this.query(connection, `DELETE FROM store WHERE franchiseId=? AND id=?`, [franchiseId, storeId]);
    } finally {
      this.pool.release(connection);
    }
  }

  getOffset(currentPage = 1, listPerPage) {
    return (currentPage - 1) * [listPerPage];
  }

  async query(connection, sql, params) {
    this.logger.dbLogger({ "query": sql });
    const [results] = await connection.execute(sql, params);
    return results;
  }

  async getID(connection, key, value, table) {
    const [rows] = await connection.execute(`SELECT id FROM ${table} WHERE ${key}=?`, [value]);
    if (rows.length > 0) {
      return rows[0].id;
    }
    throw new Error('No ID found');
  }

  async _initializeDatabase(conn, dbExists) {
    try {
      if (!dbExists) {
        for (const statement of dbModel.tableCreateStatements) {
          await conn.query(statement);
        }
        const defaultAdmin = { ...this.config.admin, roles: [{ role: Role.Admin }] };
        await this._addUserWithConn(defaultAdmin, conn);
      }
    } catch (err) {
      console.error(JSON.stringify({ message: 'Error initializing database', exception: err.message, connection: this.config.connection }));
    }
  }

  async close() {
    await this.pool.closeAll()
  }
}

module.exports = Database;
