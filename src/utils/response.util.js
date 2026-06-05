function successResponse(res, data = null, extra = {}, status = 200) {
  return res.status(status).json({ ok: true, data, ...extra });
}

function createdResponse(res, data = null, extra = {}) {
  return successResponse(res, data, extra, 201);
}

function errorResponse(res, message = 'Error', status = 400, extra = {}) {
  return res.status(status).json({ ok: false, message, ...extra });
}

// Backward-compatible aliases used by older controllers.
function ok(res, data = null, extra = {}) {
  return successResponse(res, data, extra);
}

function fail(res, message = 'Error', status = 400, extra = {}) {
  return errorResponse(res, message, status, extra);
}

module.exports = {
  successResponse,
  createdResponse,
  errorResponse,
  ok,
  fail,
};
