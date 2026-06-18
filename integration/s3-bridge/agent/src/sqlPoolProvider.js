'use strict';

const sql = require('mssql');

class SqlPoolProvider {
  constructor(sqlConfig, options = {}) {
    this.sql = options.sql || sql;
    this.sqlConfig = sqlConfig;
    this.pool = null;
  }

  async connect() {
    if (this.pool?.connected) return this.pool;
    this.pool = await new this.sql.ConnectionPool(this.sqlConfig).connect();
    return this.pool;
  }

  async close() {
    if (this.pool) await this.pool.close();
    this.pool = null;
  }
}

module.exports = { SqlPoolProvider };
