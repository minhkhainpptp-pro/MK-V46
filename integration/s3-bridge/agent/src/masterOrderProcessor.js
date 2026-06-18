'use strict';

const { payloadHash } = require('./signature');

class MasterOrderProcessor {
  constructor({ config, v45Client, repository, logger }) {
    this.config = config;
    this.v45Client = v45Client;
    this.repository = repository;
    this.logger = logger;
  }

  validateRow(row = {}) {
    if (!row.eventId || !row.sourceMasterOrderId || !row.sourceVersion || !row.payload) {
      const error = new Error('Dòng đơn tổng từ SQL không đủ contract');
      error.code = 'MASTER_ORDER_SQL_CONTRACT_INVALID';
      throw error;
    }
    const actualHash = payloadHash(row.payload);
    if (actualHash !== row.payloadHash) {
      const error = new Error('PayloadHash đơn tổng không khớp JSON');
      error.code = 'MASTER_ORDER_PAYLOAD_HASH_MISMATCH';
      throw error;
    }
    if (row.payload.eventId && row.payload.eventId !== row.eventId) {
      const error = new Error('EventId trong payload không khớp result-set');
      error.code = 'MASTER_ORDER_EVENT_ID_MISMATCH';
      throw error;
    }
  }

  async processRow(row) {
    try {
      this.validateRow(row);
      const payload = {
        ...row.payload,
        eventId: row.eventId,
        sourceMasterOrderId: row.sourceMasterOrderId,
        sourceVersion: row.sourceVersion,
        sourceHash: row.payloadHash
      };
      const result = await this.v45Client.upsertMasterOrder(payload);
      const status = result.conflict ? 'conflict' : 'completed';
      await this.repository.recordDispatch(row, status, '');
      await this.repository.saveCheckpoint(row.sourceCursor, row.eventId);
      this.logger.info('master order dispatched', {
        eventId: row.eventId,
        sourceMasterOrderId: row.sourceMasterOrderId,
        status,
        duplicate: Boolean(result.duplicate)
      });
      return { status, result };
    } catch (error) {
      await this.repository.recordDispatch(row, 'failed', error.message).catch((recordError) => {
        this.logger.error('cannot record master order dispatch failure', {
          eventId: row.eventId,
          error: recordError.message
        });
      });
      this.logger.warn('master order dispatch failed', {
        eventId: row.eventId,
        code: error.code,
        message: error.message
      });
      return { status: 'failed', error };
    }
  }

  async runOnce() {
    const cursor = await this.repository.getCheckpoint('master_orders');
    const rows = await this.repository.readCompletedMasterOrders(cursor, this.config.masterOrderBatchSize);
    let successful = 0;
    for (const row of rows) {
      const result = await this.processRow(row);
      if (result.status === 'failed') break; // giữ checkpoint, không vượt qua bản ghi lỗi
      successful += 1;
    }
    return { read: rows.length, successful };
  }
}

module.exports = { MasterOrderProcessor };
