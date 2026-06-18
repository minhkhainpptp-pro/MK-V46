'use strict';

const {
  assertLocalOrderEnabled,
  assertLocalMasterOrderEnabled,
  assertLocalInventoryEnabled,
  assertLocalImportEnabled
} = require('../domain/integration/S3ExecutionGuard');

function sendBlocked(req, res, error) {
  req.log?.warn({
    code: error.code,
    method: req.method,
    path: req.originalUrl || req.url,
    userCode: req.user?.code || req.user?.staffCode || req.mobileUser?.code || '',
    details: error.details
  }, 'S3 execution mode blocked local source command');

  return res.status(error.status || 409).json({
    ok: false,
    success: false,
    code: error.code || 'S3_EXECUTION_COMMAND_BLOCKED',
    message: error.message,
    ...(error.details ? { details: error.details } : {})
  });
}

function guard(assertion) {
  return function integrationAuthorityGuard(req, res, next) {
    try {
      assertion(req);
      return next();
    } catch (error) {
      return sendBlocked(req, res, error);
    }
  };
}

function blockOrderSourceWrite(action) {
  return guard(() => assertLocalOrderEnabled(action));
}

function blockMasterOrderSourceWrite(action) {
  return guard(() => assertLocalMasterOrderEnabled(action));
}

function blockInventorySourceWrite(action) {
  return guard(() => assertLocalInventoryEnabled(action));
}

function blockManagedImportWrite(action) {
  return guard((req) => assertLocalImportEnabled(
    req.body?.type || req.query?.type || req.headers?.['x-import-type'] || '',
    action
  ));
}

module.exports = {
  blockOrderSourceWrite,
  blockMasterOrderSourceWrite,
  blockInventorySourceWrite,
  blockManagedImportWrite
};
