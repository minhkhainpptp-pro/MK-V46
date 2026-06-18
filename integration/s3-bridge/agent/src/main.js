'use strict';

const { loadConfig } = require('./config');
const logger = require('./logger');
const { V45Client } = require('./v45Client');
const { SqlReturnRepository } = require('./sqlReturnRepository');
const { ReturnProcessor } = require('./returnProcessor');
const { SqlPoolProvider } = require('./sqlPoolProvider');
const { SqlMasterOrderRepository } = require('./sqlMasterOrderRepository');
const { MasterOrderProcessor } = require('./masterOrderProcessor');

function sleep(ms, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

async function main() {
  const config = loadConfig();
  const controller = new AbortController();
  let sqlRepository;
  let masterOrderRepository;
  let sqlPoolProvider;
  const stop = (signal) => {
    logger.info('shutdown requested', { signal });
    controller.abort();
  };
  process.once('SIGINT', () => stop('SIGINT'));
  process.once('SIGTERM', () => stop('SIGTERM'));

  const v45Client = new V45Client(config);
  try {
    await v45Client.health();
    logger.info('V45 integration health check passed', { agentId: config.agentId });

    if (!config.returnEnabled && !config.masterOrderEnabled) {
      logger.warn('Bridge started with all processors disabled');
      while (!controller.signal.aborted) await sleep(60000, controller.signal);
      return;
    }

    sqlPoolProvider = new SqlPoolProvider(config.sql);
    await sqlPoolProvider.connect();

    let returnProcessor;
    if (config.returnEnabled) {
      sqlRepository = new SqlReturnRepository(config.sql, { poolProvider: sqlPoolProvider });
      returnProcessor = new ReturnProcessor({ config, v45Client, sqlRepository, logger });
      logger.info('return processor enabled', { pollMs: config.returnPollMs, claimLimit: config.returnClaimLimit });
    }

    let masterOrderProcessor;
    if (config.masterOrderEnabled) {
      masterOrderRepository = new SqlMasterOrderRepository(config.sql, { poolProvider: sqlPoolProvider });
      masterOrderProcessor = new MasterOrderProcessor({ config, v45Client, repository: masterOrderRepository, logger });
      logger.info('master order processor enabled', { pollMs: config.masterOrderPollMs, batchSize: config.masterOrderBatchSize });
    }

    let nextReturnAt = 0;
    let nextMasterAt = 0;
    while (!controller.signal.aborted) {
      const now = Date.now();
      if (returnProcessor && now >= nextReturnAt) {
        try {
          const result = await returnProcessor.runOnce();
          if (result.claimed > 0) logger.info('return poll completed', result);
        } catch (error) {
          logger.error('return poll failed', { code: error.code, message: error.message });
        }
        nextReturnAt = Date.now() + config.returnPollMs;
      }
      if (masterOrderProcessor && now >= nextMasterAt) {
        try {
          const result = await masterOrderProcessor.runOnce();
          if (result.read > 0) logger.info('master order poll completed', result);
        } catch (error) {
          logger.error('master order poll failed', { code: error.code, message: error.message });
        }
        nextMasterAt = Date.now() + config.masterOrderPollMs;
      }
      await sleep(500, controller.signal);
    }
  } finally {
    await sqlRepository?.close().catch((error) => logger.error('return repository close failed', { message: error.message }));
    await masterOrderRepository?.close().catch((error) => logger.error('master repository close failed', { message: error.message }));
    await sqlPoolProvider?.close().catch((error) => logger.error('SQL pool close failed', { message: error.message }));
    logger.info('Bridge stopped');
  }
}

main().catch((error) => {
  logger.error('Bridge fatal error', { code: error.code, message: error.message, stack: error.stack });
  process.exitCode = 1;
});
