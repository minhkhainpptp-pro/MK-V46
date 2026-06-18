'use strict';

const { payloadHash } = require('./signature');

function classifySqlError(error = {}) {
  const number = Number(error.number || error.originalError?.info?.number || 0);
  const message = String(error.message || 'SQL return processing failed');
  const nonRetryableNumbers = new Set([51001, 51002, 51003, 51004, 51005, 51006, 51007, 51008, 51009, 51011]);
  return {
    code: number ? `SQL_${number}` : (error.code || 'S3_SQL_ERROR'),
    message,
    retryable: !nonRetryableNumbers.has(number),
    details: number ? { sqlNumber: number } : undefined
  };
}

class ReturnProcessor {
  constructor({ config, v45Client, sqlRepository, logger }) {
    this.config = config;
    this.v45Client = v45Client;
    this.sqlRepository = sqlRepository;
    this.logger = logger;
  }

  validateCommand(command = {}) {
    if (!command.eventId || !command.payload || !command.payloadHash) throw new Error('Return command không đầy đủ');
    const actualHash = payloadHash(command.payload);
    if (actualHash !== command.payloadHash) {
      const error = new Error('Payload hash của return command không khớp');
      error.code = 'RETURN_PAYLOAD_HASH_MISMATCH';
      error.retryable = false;
      throw error;
    }
    if (!Array.isArray(command.payload.items) || command.payload.items.length === 0) {
      const error = new Error('Return command không có item');
      error.code = 'RETURN_ITEMS_REQUIRED';
      error.retryable = false;
      throw error;
    }
  }

  async processCommand(command) {
    const startedAt = Date.now();
    try {
      this.validateCommand(command);
      const sqlResult = await this.sqlRepository.createReturnReceipt(command);
      if (sqlResult.status === 'posted' && sqlResult.s3INNbr) {
        await this.v45Client.completeReturnCommand(command.eventId, {
          s3ReceiptId: sqlResult.s3INNbr,
          s3ReceiptCode: sqlResult.s3INNbr,
          postedAt: new Date().toISOString(),
          sqlStatus: 'posted'
        });
        this.logger.info('return command completed', {
          eventId: command.eventId,
          s3ReceiptCode: sqlResult.s3INNbr,
          durationMs: Date.now() - startedAt,
          idempotentReplay: sqlResult.isIdempotentReplay
        });
        return { status: 'completed', sqlResult };
      }

      if (sqlResult.status === 'staged' || sqlResult.status === 'processing') {
        await this.v45Client.deferReturnCommand(command.eventId, {
          sqlStatus: sqlResult.status,
          stagedAt: new Date().toISOString(),
          retryAfterSeconds: this.config.stagedRetrySeconds,
          message: 'Yêu cầu đã vào staging S3, chưa có chứng từ kho posted'
        });
        this.logger.info('return command staged', {
          eventId: command.eventId,
          sqlStatus: sqlResult.status,
          durationMs: Date.now() - startedAt
        });
        return { status: 'deferred', sqlResult };
      }

      const unexpected = new Error(`SQL orchestrator trả trạng thái không hợp lệ: ${sqlResult.status || '(empty)'}`);
      unexpected.code = 'S3_SQL_STATUS_INVALID';
      unexpected.retryable = true;
      throw unexpected;
    } catch (error) {
      const normalized = error.number || error.originalError
        ? classifySqlError(error)
        : {
            code: error.code || 'RETURN_PROCESSING_ERROR',
            message: error.message || 'Return processing failed',
            retryable: error.retryable !== false
          };
      try {
        await this.v45Client.failReturnCommand(command.eventId, normalized);
      } catch (notifyError) {
        this.logger.error('cannot report return command failure to V45', {
          eventId: command.eventId,
          originalError: normalized,
          notifyError: { code: notifyError.code, message: notifyError.message }
        });
        throw notifyError;
      }
      this.logger.warn('return command failed', {
        eventId: command.eventId,
        error: normalized,
        durationMs: Date.now() - startedAt
      });
      return { status: 'failed', error: normalized };
    }
  }

  async runOnce() {
    const claimed = await this.v45Client.claimReturnCommands(
      this.config.returnClaimLimit,
      this.config.returnLeaseSeconds
    );
    const commands = Array.isArray(claimed.commands) ? claimed.commands : [];
    for (const command of commands) await this.processCommand(command);
    return { claimed: commands.length };
  }
}

module.exports = { ReturnProcessor, classifySqlError };
