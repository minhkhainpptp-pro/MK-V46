'use strict';

const sql = require('mssql');

function dateOrNull(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

class SqlReturnRepository {
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

  async close() {
    if (this.poolProvider) return;
    if (this.pool) await this.pool.close();
    this.pool = null;
  }

  itemTable(items = []) {
    const table = new this.sql.Table('v45_int.ReturnReceiptItemType');
    table.columns.add('LineNo', this.sql.Int, { nullable: false });
    table.columns.add('ProductCode', this.sql.NVarChar(100), { nullable: false });
    table.columns.add('BaseQuantity', this.sql.Decimal(18, 4), { nullable: false });
    table.columns.add('Reason', this.sql.NVarChar(500), { nullable: true });
    table.columns.add('SourceLineId', this.sql.NVarChar(100), { nullable: true });
    items.forEach((item, index) => {
      table.rows.add(
        index + 1,
        String(item.productCode || '').trim(),
        Number(item.baseQuantity || 0),
        item.reason ? String(item.reason) : null,
        item.sourceLineId ? String(item.sourceLineId) : null
      );
    });
    return table;
  }

  async createReturnReceipt(command) {
    const pool = await this.connect();
    const payload = command.payload || {};
    const request = pool.request();
    request.input('V45ReturnId', this.sql.NVarChar(100), payload.sourceReturnId);
    request.input('V45EventId', this.sql.NVarChar(150), command.eventId);
    request.input('PayloadHash', this.sql.Char(64), command.payloadHash);
    request.input('CustomerCode', this.sql.NVarChar(100), payload.customerCode);
    request.input('SourceOrderCode', this.sql.NVarChar(100), payload.sourceOrderCode);
    request.input('SiteID', this.sql.NVarChar(50), payload.siteId);
    request.input('ReturnDate', this.sql.Date, dateOrNull(payload.returnDate) || new Date());
    request.input('ConfirmedAt', this.sql.DateTime2(3), dateOrNull(payload.confirmedAt));
    request.input('Note', this.sql.NVarChar(1000), payload.note || null);
    request.input('RawPayload', this.sql.NVarChar(this.sql.MAX), JSON.stringify(payload));
    request.input('Items', this.itemTable(payload.items));

    const result = await request.execute('v45_int.sp_CreateReturnReceipt');
    const row = result.recordset?.[0] || {};
    return {
      v45ReturnId: row.V45ReturnId || payload.sourceReturnId,
      status: String(row.Status || '').toLowerCase(),
      s3INNbr: row.S3INNbr || '',
      isIdempotentReplay: Boolean(row.IsIdempotentReplay)
    };
  }
}

module.exports = { SqlReturnRepository, dateOrNull };
