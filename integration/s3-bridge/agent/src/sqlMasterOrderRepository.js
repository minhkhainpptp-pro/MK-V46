'use strict';

const sql = require('mssql');

class SqlMasterOrderRepository {
  constructor(sqlConfig, options = {}) {
    this.sql = options.sql || sql;
    this.sqlConfig = sqlConfig;
    this.poolProvider = options.poolProvider || null;
    this.pool = null;
  }

  async connect() {
    if (this.poolProvider) return this.poolProvider.connect();
    if (this.pool?.connected) return this.pool;
    this.pool = await new this.sql.ConnectionPool(this.sqlConfig).connect();
    return this.pool;
  }

  async getCheckpoint(streamName = 'master_orders') {
    const pool = await this.connect();
    const result = await pool.request()
      .input('StreamName', this.sql.NVarChar(100), streamName)
      .execute('v45_int.sp_GetBridgeCheckpoint');
    return result.recordset?.[0]?.CursorValue || '';
  }

  async readCompletedMasterOrders(cursorValue, batchSize) {
    const pool = await this.connect();
    const result = await pool.request()
      .input('CursorValue', this.sql.NVarChar(1000), cursorValue || null)
      .input('BatchSize', this.sql.Int, batchSize)
      .execute('v45_int.sp_GetCompletedMasterOrdersForV45');
    return (result.recordset || []).map((row) => ({
      eventId: String(row.EventId || '').trim(),
      sourceMasterOrderId: String(row.SourceMasterOrderId || '').trim(),
      sourceVersion: String(row.SourceVersion || '').trim(),
      sourceCursor: String(row.SourceCursor || '').trim(),
      payloadHash: String(row.PayloadHash || '').trim().toLowerCase(),
      payload: typeof row.PayloadJson === 'string' ? JSON.parse(row.PayloadJson) : row.PayloadJson
    }));
  }

  async recordDispatch(row, status, errorMessage = '') {
    const pool = await this.connect();
    await pool.request()
      .input('EventId', this.sql.NVarChar(180), row.eventId)
      .input('SourceMasterOrderId', this.sql.NVarChar(100), row.sourceMasterOrderId)
      .input('SourceVersion', this.sql.NVarChar(100), row.sourceVersion)
      .input('PayloadHash', this.sql.Char(64), row.payloadHash)
      .input('SourceCursor', this.sql.NVarChar(1000), row.sourceCursor || null)
      .input('Status', this.sql.NVarChar(30), status)
      .input('LastError', this.sql.NVarChar(2000), errorMessage || null)
      .execute('v45_int.sp_RecordMasterOrderDispatch');
  }

  async saveCheckpoint(cursorValue, runId = '') {
    const pool = await this.connect();
    await pool.request()
      .input('StreamName', this.sql.NVarChar(100), 'master_orders')
      .input('CursorValue', this.sql.NVarChar(1000), cursorValue)
      .input('LastRunId', this.sql.NVarChar(100), runId || null)
      .input('LastError', this.sql.NVarChar(2000), null)
      .execute('v45_int.sp_SaveBridgeCheckpoint');
  }

  async close() {
    if (this.poolProvider) return;
    if (this.pool) await this.pool.close();
    this.pool = null;
  }
}

module.exports = { SqlMasterOrderRepository };
